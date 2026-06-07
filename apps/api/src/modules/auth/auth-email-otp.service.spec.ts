import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthEmailOtpService } from './auth-email-otp.service';

describe('AuthEmailOtpService', () => {
  const redis = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  };

  const config = {
    get: jest.fn(),
  };

  let service: AuthEmailOtpService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string) => {
      if (key === 'nodeEnv') return 'development';
      if (key === 'auth.emailOtpEnabled') return true;
      return undefined;
    });
    service = new AuthEmailOtpService(redis as never, config as unknown as ConfigService);
  });

  it('rejects invalid code and increments attempts', async () => {
    redis.get.mockResolvedValueOnce('0').mockResolvedValueOnce('storedhash');
    await expect(service.verifyOtp('user@example.com', '123456')).rejects.toThrow(
      BadRequestException,
    );
    expect(redis.setex).toHaveBeenCalledWith('auth:email_otp_attempts:user@example.com', 600, '1');
  });

  it('fails closed in production when redis GET errors on attempts', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'nodeEnv') return 'production';
      return undefined;
    });
    redis.get.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(service.verifyOtp('user@example.com', '123456')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
