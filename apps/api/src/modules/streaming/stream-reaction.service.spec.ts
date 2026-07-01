import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StreamReactionService } from './stream-reaction.service';

describe('StreamReactionService', () => {
  let service: StreamReactionService;
  const redis = {
    incr: jest.fn().mockResolvedValue(5),
    expire: jest.fn().mockResolvedValue(1),
    sadd: jest.fn().mockResolvedValue(1),
    smembers: jest.fn(),
    mget: jest.fn(),
  };
  const eventEmitter = { emit: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        StreamReactionService,
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();
    service = moduleRef.get(StreamReactionService);
  });

  it('increments the reaction counter and emits a realtime event', async () => {
    const result = await service.react('stream-1', 'heart');
    expect(result).toEqual({ reaction: 'heart', count: 5 });
    expect(redis.incr).toHaveBeenCalledWith('stream:reactions:stream-1:heart');
    expect(redis.sadd).toHaveBeenCalledWith('stream:reactions:types:stream-1', 'heart');
    expect(eventEmitter.emit).toHaveBeenCalledWith('stream.reaction', {
      streamId: 'stream-1',
      reaction: 'heart',
      count: 5,
    });
  });

  it('falls back to "heart" for an empty reaction and caps length at 32 chars', async () => {
    const empty = await service.react('stream-1', '');
    expect(empty.reaction).toBe('heart');

    const long = 'x'.repeat(50);
    const capped = await service.react('stream-1', long);
    expect(capped.reaction).toBe('x'.repeat(32));
  });

  it('aggregates counts across known reaction types', async () => {
    redis.smembers.mockResolvedValue(['heart', 'fire']);
    redis.mget.mockResolvedValue(['10', null]);
    const counts = await service.getCounts('stream-1');
    expect(counts).toEqual({ heart: 10, fire: 0 });
  });

  it('returns an empty map when there are no reactions', async () => {
    redis.smembers.mockResolvedValue([]);
    const counts = await service.getCounts('stream-1');
    expect(counts).toEqual({});
    expect(redis.mget).not.toHaveBeenCalled();
  });
});
