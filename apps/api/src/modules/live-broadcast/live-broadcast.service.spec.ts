import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { LiveBroadcastService } from './live-broadcast.service';
import { StreamingService } from '../streaming/streaming.service';
import { StreamStatus } from '../streaming/entities/stream.entity';

const addGrant = jest.fn();
const toJwt = jest.fn().mockResolvedValue('signed-jwt');
const createRoom = jest.fn();
const startRoomCompositeEgress = jest.fn();
const stopEgress = jest.fn();

jest.mock('livekit-server-sdk', () => ({
  AccessToken: jest.fn().mockImplementation(() => ({ addGrant, toJwt })),
  RoomServiceClient: jest.fn().mockImplementation(() => ({ createRoom })),
  EgressClient: jest.fn().mockImplementation(() => ({
    startRoomCompositeEgress,
    stopEgress,
  })),
  StreamOutput: jest.fn().mockImplementation((opts) => opts),
  StreamProtocol: { RTMP: 'rtmp' },
}));

describe('LiveBroadcastService', () => {
  let service: LiveBroadcastService;
  let configGet: jest.Mock;
  let streamingService: { findById: jest.Mock; setLivekitEgressId: jest.Mock };

  const livekitConfig: Record<string, unknown> = {
    'livekit.url': 'wss://livekit.forge.dev',
    'livekit.apiKey': 'lk_key',
    'livekit.apiSecret': 'lk_secret',
  };

  const baseStream = () => ({
    id: 'stream-1',
    userId: 'creator-1',
    status: StreamStatus.LIVE,
    streamKey: 'sk_live',
    livekitEgressId: null as string | null,
  });

  async function createService(config: Record<string, unknown> = livekitConfig) {
    configGet = jest.fn((key: string) => config[key]);
    streamingService = {
      findById: jest.fn(),
      setLivekitEgressId: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiveBroadcastService,
        { provide: ConfigService, useValue: { get: configGet } },
        { provide: StreamingService, useValue: streamingService },
      ],
    }).compile();
    return module.get(LiveBroadcastService);
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

    it('is false when any LiveKit setting missing', async () => {
      service = await createService({
        'livekit.url': 'wss://x',
        'livekit.apiKey': 'k',
      });
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('createPublisherToken', () => {
    it('rejects when LiveKit not configured', async () => {
      service = await createService({});
      await expect(
        service.createPublisherToken('stream-1', 'creator-1'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('hides streams owned by other users (404)', async () => {
      streamingService.findById.mockResolvedValue({ ...baseStream(), userId: 'someone-else' });
      await expect(
        service.createPublisherToken('stream-1', 'creator-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects ended streams', async () => {
      streamingService.findById.mockResolvedValue({
        ...baseStream(),
        status: StreamStatus.ENDED,
      });
      await expect(
        service.createPublisherToken('stream-1', 'creator-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects streams without a stream key', async () => {
      streamingService.findById.mockResolvedValue({ ...baseStream(), streamKey: null });
      await expect(
        service.createPublisherToken('stream-1', 'creator-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('issues a publisher token with a room grant', async () => {
      streamingService.findById.mockResolvedValue(baseStream());
      createRoom.mockResolvedValue(undefined);
      const result = await service.createPublisherToken('stream-1', 'creator-1');
      expect(result).toEqual({ token: 'signed-jwt', roomName: 'forge-stream-stream-1' });
      expect(addGrant).toHaveBeenCalledWith(
        expect.objectContaining({
          roomJoin: true,
          room: 'forge-stream-stream-1',
          canPublish: true,
        }),
      );
    });

    it('still issues a token if room already exists (create error swallowed)', async () => {
      streamingService.findById.mockResolvedValue(baseStream());
      createRoom.mockRejectedValue(new Error('room exists'));
      const result = await service.createPublisherToken('stream-1', 'creator-1');
      expect(result.token).toBe('signed-jwt');
    });
  });

  describe('startBrowserEgress', () => {
    it('hides streams owned by other users (404)', async () => {
      streamingService.findById.mockResolvedValue({ ...baseStream(), userId: 'other' });
      await expect(
        service.startBrowserEgress('stream-1', 'creator-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects when stream key missing', async () => {
      streamingService.findById.mockResolvedValue({ ...baseStream(), streamKey: null });
      await expect(
        service.startBrowserEgress('stream-1', 'creator-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('reuses an existing persisted egress without starting a new one', async () => {
      streamingService.findById.mockResolvedValue({
        ...baseStream(),
        livekitEgressId: 'eg_existing',
      });
      const result = await service.startBrowserEgress('stream-1', 'creator-1');
      expect(result).toEqual({ egressId: 'eg_existing' });
      expect(startRoomCompositeEgress).not.toHaveBeenCalled();
    });

    it('starts a composite egress to the Mux RTMP target and persists the id', async () => {
      streamingService.findById.mockResolvedValue(baseStream());
      startRoomCompositeEgress.mockResolvedValue({ egressId: 'eg_new' });
      const result = await service.startBrowserEgress('stream-1', 'creator-1');
      expect(startRoomCompositeEgress).toHaveBeenCalledWith(
        'forge-stream-stream-1',
        expect.objectContaining({
          stream: expect.objectContaining({ urls: ['rtmps://global-live.mux.com:443/app/sk_live'] }),
        }),
      );
      expect(streamingService.setLivekitEgressId).toHaveBeenCalledWith('stream-1', 'eg_new');
      expect(result).toEqual({ egressId: 'eg_new' });
    });
  });

  describe('stopBrowserEgress', () => {
    it('hides streams owned by other users (404)', async () => {
      streamingService.findById.mockResolvedValue({ ...baseStream(), userId: 'other' });
      await expect(
        service.stopBrowserEgress('stream-1', 'creator-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('no-ops when there is no active egress', async () => {
      streamingService.findById.mockResolvedValue(baseStream());
      await service.stopBrowserEgress('stream-1', 'creator-1');
      expect(stopEgress).not.toHaveBeenCalled();
      expect(streamingService.setLivekitEgressId).not.toHaveBeenCalled();
    });

    it('stops the persisted egress and clears the id', async () => {
      streamingService.findById.mockResolvedValue({
        ...baseStream(),
        livekitEgressId: 'eg_existing',
      });
      stopEgress.mockResolvedValue(undefined);
      await service.stopBrowserEgress('stream-1', 'creator-1');
      expect(stopEgress).toHaveBeenCalledWith('eg_existing');
      expect(streamingService.setLivekitEgressId).toHaveBeenCalledWith('stream-1', null);
    });

    it('still clears state when stopEgress throws', async () => {
      streamingService.findById.mockResolvedValue({
        ...baseStream(),
        livekitEgressId: 'eg_existing',
      });
      stopEgress.mockRejectedValue(new Error('already stopped'));
      await service.stopBrowserEgress('stream-1', 'creator-1');
      expect(streamingService.setLivekitEgressId).toHaveBeenCalledWith('stream-1', null);
    });
  });
});
