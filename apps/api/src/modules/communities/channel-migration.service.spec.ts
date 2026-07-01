import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChannelMigrationService } from './channel-migration.service';
import { ChannelRoomMapping } from './entities/channel-room-mapping.entity';
import { Channel } from './entities/channel.entity';
import { CommunityRoom, CommunityRoomType } from './entities/community-room.entity';
import { ChannelMessage } from './entities/channel-message.entity';
import { CommunityRoomMessage } from './entities/community-room-message.entity';

describe('ChannelMigrationService', () => {
  let service: ChannelMigrationService;

  const channel = {
    id: 'ch-1',
    communityId: 'comm-1',
    name: 'General',
    slug: 'general',
    categoryId: null,
    sortOrder: 0,
    requiredTierId: null,
    type: 'public',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Channel;

  const room = {
    id: 'room-1',
    communityId: 'comm-1',
    name: 'General',
    slug: 'general',
    roomType: CommunityRoomType.TEXT,
    categoryId: null,
    sortOrder: 0,
    settings: {},
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as CommunityRoom;

  const mappingRepository = {
    findOne: jest.fn(),
    save: jest.fn(async (entity: ChannelRoomMapping) => ({ ...entity, id: 'map-1' })),
    create: jest.fn((dto: Partial<ChannelRoomMapping>) => dto),
  };
  const channelRepository = {
    findOne: jest.fn(),
  };
  const roomRepository = {
    findOne: jest.fn(),
    save: jest.fn(async (entity: CommunityRoom) => ({ ...entity, id: room.id })),
    create: jest.fn((dto: Partial<CommunityRoom>) => dto),
  };
  const channelMessageRepository = {
    find: jest.fn().mockResolvedValue([]),
  };
  const roomMessageRepository = {
    save: jest.fn(),
    create: jest.fn((dto: Partial<CommunityRoomMessage>) => dto),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    channelRepository.findOne.mockResolvedValue(channel);
    roomRepository.findOne.mockResolvedValue(null);
    mappingRepository.findOne.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelMigrationService,
        { provide: getRepositoryToken(ChannelRoomMapping), useValue: mappingRepository },
        { provide: getRepositoryToken(Channel), useValue: channelRepository },
        { provide: getRepositoryToken(CommunityRoom), useValue: roomRepository },
        { provide: getRepositoryToken(ChannelMessage), useValue: channelMessageRepository },
        { provide: getRepositoryToken(CommunityRoomMessage), useValue: roomMessageRepository },
      ],
    }).compile();

    service = module.get(ChannelMigrationService);
  });

  it('returns existing mapping room id', async () => {
    mappingRepository.findOne.mockResolvedValue({ channelId: 'ch-1', roomId: 'room-1' });
    await expect(service.resolveRoomIdForChannel('ch-1')).resolves.toBe('room-1');
  });

  it('lazy-maps channel on first resolve', async () => {
    const roomId = await service.resolveRoomIdForChannel('ch-1');
    expect(roomId).toBe('room-1');
    expect(roomRepository.save).toHaveBeenCalled();
    expect(mappingRepository.save).toHaveBeenCalled();
  });

  it('ensureChannelMapped is idempotent when mapping exists', async () => {
    mappingRepository.findOne.mockResolvedValueOnce({ channelId: 'ch-1', roomId: 'room-1' });
    await expect(service.ensureChannelMapped('ch-1')).resolves.toBe('room-1');
    expect(roomRepository.save).not.toHaveBeenCalled();
  });

  it('throws when channel missing', async () => {
    channelRepository.findOne.mockResolvedValue(null);
    await expect(service.ensureChannelMapped('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
