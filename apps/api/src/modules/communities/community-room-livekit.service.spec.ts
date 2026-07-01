import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { CommunityRoomLivekitService } from './community-room-livekit.service';
import { CommunityRoomType } from './entities/community-room.entity';

const addGrant = jest.fn();
const toJwt = jest.fn().mockResolvedValue('signed-jwt');
const createRoom = jest.fn();

jest.mock('livekit-server-sdk', () => ({
  AccessToken: jest.fn().mockImplementation(() => ({ addGrant, toJwt })),
  RoomServiceClient: jest.fn().mockImplementation(() => ({ createRoom })),
}));

describe('CommunityRoomLivekitService', () => {
  let service: CommunityRoomLivekitService;
  let configGet: jest.Mock;

  const livekitConfig: Record<string, unknown> = {
    'livekit.url': 'wss://livekit.forge.dev',
    'livekit.apiKey': 'lk_key',
    'livekit.apiSecret': 'lk_secret',
  };

  async function createService(config: Record<string, unknown> = livekitConfig) {
    configGet = jest.fn((key: string) => config[key]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityRoomLivekitService,
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    }).compile();
    return module.get(CommunityRoomLivekitService);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    toJwt.mockResolvedValue('signed-jwt');
    service = await createService();
  });

  describe('isConfigured', () => {
    it('is true when all LiveKit settings present', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('is false when a setting is missing', async () => {
      service = await createService({ 'livekit.url': 'wss://x' });
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('roomName', () => {
    it('builds a deterministic namespaced room name', () => {
      expect(service.roomName('comm-1', 'room-1')).toBe('forge-community-comm-1-room-1');
    });
  });

  describe('ensureRoom', () => {
    it('throws when LiveKit not configured', async () => {
      service = await createService({});
      await expect(
        service.ensureRoom('comm-1', 'room-1', CommunityRoomType.VOICE),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('creates a voice room with the default 25 cap', async () => {
      createRoom.mockResolvedValue(undefined);
      const name = await service.ensureRoom('comm-1', 'room-1', CommunityRoomType.VOICE);
      expect(createRoom).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'forge-community-comm-1-room-1', maxParticipants: 25 }),
      );
      expect(name).toBe('forge-community-comm-1-room-1');
    });

    it('creates a stage room with the larger 50 cap', async () => {
      createRoom.mockResolvedValue(undefined);
      await service.ensureRoom('comm-1', 'room-1', CommunityRoomType.STAGE);
      expect(createRoom).toHaveBeenCalledWith(
        expect.objectContaining({ maxParticipants: 50 }),
      );
    });

    it('honors an explicit maxParticipants override', async () => {
      createRoom.mockResolvedValue(undefined);
      await service.ensureRoom('comm-1', 'room-1', CommunityRoomType.STAGE, 5);
      expect(createRoom).toHaveBeenCalledWith(
        expect.objectContaining({ maxParticipants: 5 }),
      );
    });

    it('swallows create errors (idempotent room creation)', async () => {
      createRoom.mockRejectedValue(new Error('room exists'));
      const name = await service.ensureRoom('comm-1', 'room-1', CommunityRoomType.VOICE);
      expect(name).toBe('forge-community-comm-1-room-1');
    });
  });

  describe('createJoinToken', () => {
    it('throws when LiveKit not configured', async () => {
      service = await createService({});
      await expect(
        service.createJoinToken({
          communityId: 'comm-1',
          roomId: 'room-1',
          userId: 'user-1',
          roomType: CommunityRoomType.VOICE,
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('grants publish for voice rooms by default', async () => {
      createRoom.mockResolvedValue(undefined);
      const result = await service.createJoinToken({
        communityId: 'comm-1',
        roomId: 'room-1',
        userId: 'user-1',
        roomType: CommunityRoomType.VOICE,
      });
      expect(addGrant).toHaveBeenCalledWith(
        expect.objectContaining({ roomJoin: true, canPublish: true, canSubscribe: true }),
      );
      expect(result).toEqual({
        token: 'signed-jwt',
        roomName: 'forge-community-comm-1-room-1',
        livekitUrl: 'wss://livekit.forge.dev',
      });
    });

    it('defaults stage audience to subscribe-only (no publish)', async () => {
      createRoom.mockResolvedValue(undefined);
      await service.createJoinToken({
        communityId: 'comm-1',
        roomId: 'room-1',
        userId: 'user-1',
        roomType: CommunityRoomType.STAGE,
      });
      expect(addGrant).toHaveBeenCalledWith(
        expect.objectContaining({ canPublish: false, canSubscribe: true }),
      );
    });

    it('allows an explicit canPublish override for stage speakers', async () => {
      createRoom.mockResolvedValue(undefined);
      await service.createJoinToken({
        communityId: 'comm-1',
        roomId: 'room-1',
        userId: 'speaker-1',
        roomType: CommunityRoomType.STAGE,
        canPublish: true,
      });
      expect(addGrant).toHaveBeenCalledWith(
        expect.objectContaining({ canPublish: true }),
      );
    });
  });
});
