import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { authenticator } from 'otplib';
import * as bcrypt from 'bcrypt';
import { AuthMfaService } from './auth-mfa.service';
import { encryptWithKey } from '../../common/utils/encryption.util';

describe('AuthMfaService', () => {
  const encryptionKey = randomBytes(32).toString('base64');

  const userRepository = {
    findOne: jest.fn(),
    save: jest.fn(async (u: any) => u),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const config = { get: jest.fn().mockReturnValue(encryptionKey) };
  const redis = { get: jest.fn(), setex: jest.fn(), del: jest.fn() };

  let service: AuthMfaService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue(encryptionKey);
    redis.get.mockResolvedValue(null);
    service = new AuthMfaService(
      userRepository as never,
      config as unknown as ConfigService,
      redis as never,
    );
  });

  describe('beginEnrollment', () => {
    it('generates and stores an encrypted secret, not yet enabled', async () => {
      userRepository.findOne.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });

      const result = await service.beginEnrollment('user-1');

      expect(result.secret).toBeTruthy();
      expect(result.otpauthUri).toContain('otpauth://totp/');
      const saved = userRepository.save.mock.calls[0][0];
      expect(saved.mfaEnabled).toBe(false);
      expect(saved.mfaSecretEncrypted).not.toBe(result.secret);
    });

    it('throws when the user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.beginEnrollment('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('confirmEnrollment', () => {
    it('activates MFA and returns 10 backup codes for a valid code', async () => {
      const secret = authenticator.generateSecret();
      const code = authenticator.generate(secret);
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        mfaSecretEncrypted: encryptWithKey(secret, encryptionKey),
      });

      const result = await service.confirmEnrollment('user-1', code);

      expect(result.backupCodes).toHaveLength(10);
      const saved = userRepository.save.mock.calls[0][0];
      expect(saved.mfaEnabled).toBe(true);
      expect(saved.mfaBackupCodeHashes).toHaveLength(10);
    });

    it('rejects an invalid code', async () => {
      const secret = authenticator.generateSecret();
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        mfaSecretEncrypted: encryptWithKey(secret, encryptionKey),
      });

      await expect(service.confirmEnrollment('user-1', '000000')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects when no enrollment is in progress', async () => {
      userRepository.findOne.mockResolvedValue({ id: 'user-1', mfaSecretEncrypted: null });
      await expect(service.confirmEnrollment('user-1', '123456')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('verifyLoginCode', () => {
    it('accepts a valid TOTP code', async () => {
      const secret = authenticator.generateSecret();
      const code = authenticator.generate(secret);
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        mfaEnabled: true,
        mfaSecretEncrypted: encryptWithKey(secret, encryptionKey),
        mfaBackupCodeHashes: [],
      });

      await expect(service.verifyLoginCode('user-1', code)).resolves.toBe(true);
    });

    it('accepts and consumes a valid backup code', async () => {
      const secret = authenticator.generateSecret();
      const backupCode = 'aabbccddee';
      const otherHash = await bcrypt.hash('zzyyxxwwvv', 10);
      const matchingHash = await bcrypt.hash(backupCode, 10);
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        mfaEnabled: true,
        mfaSecretEncrypted: encryptWithKey(secret, encryptionKey),
        mfaBackupCodeHashes: [otherHash, matchingHash],
      });

      await expect(service.verifyLoginCode('user-1', backupCode)).resolves.toBe(true);
      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        mfaBackupCodeHashes: [otherHash],
      });
    });

    it('rejects an invalid code and increments the attempts counter', async () => {
      const secret = authenticator.generateSecret();
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        mfaEnabled: true,
        mfaSecretEncrypted: encryptWithKey(secret, encryptionKey),
        mfaBackupCodeHashes: [],
      });
      redis.get.mockResolvedValue('2');

      await expect(service.verifyLoginCode('user-1', '000000')).resolves.toBe(false);
      expect(redis.setex).toHaveBeenCalledWith('auth:mfa_attempts:user-1', 600, '3');
    });

    it('blocks verification after too many failed attempts', async () => {
      redis.get.mockResolvedValue('5');
      await expect(service.verifyLoginCode('user-1', '000000')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });

    it('rejects when MFA is not enabled for the account', async () => {
      userRepository.findOne.mockResolvedValue({ id: 'user-1', mfaEnabled: false });
      await expect(service.verifyLoginCode('user-1', '123456')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('disable', () => {
    it('clears MFA fields', async () => {
      await service.disable('user-1');
      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        mfaEnabled: false,
        mfaSecretEncrypted: null,
        mfaBackupCodeHashes: null,
      });
    });
  });

  describe('isEnabled', () => {
    it('returns true when the user has MFA on', async () => {
      userRepository.findOne.mockResolvedValue({ id: 'user-1', mfaEnabled: true });
      expect(await service.isEnabled('user-1')).toBe(true);
    });

    it('returns false when the user has MFA off or does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);
      expect(await service.isEnabled('missing')).toBe(false);
    });
  });
});
