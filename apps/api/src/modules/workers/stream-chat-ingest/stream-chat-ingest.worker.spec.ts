import { Job } from 'bullmq';
import { StreamChatIngestWorker, StreamChatIngestJob } from './stream-chat-ingest.worker';
import { moderateChatMessage } from '../../../common/chat/ai-moderation.util';
import { toPublicStreamMessage } from '../../stream-chat/stream-chat.mapper';

jest.mock('../../../common/chat/ai-moderation.util');
jest.mock('../../../common/redis/redis-safe.util', () => ({
  safeRedisDel: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../common/streaming/stream-chat-minute-counter.util', () => ({
  incrementStreamChatMinuteCounter: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../stream-chat/stream-chat.mapper', () => ({
  toPublicStreamMessage: jest.fn().mockReturnValue({ id: 'msg-1', body: 'hi' }),
}));

const moderateMock = moderateChatMessage as jest.Mock;

describe('StreamChatIngestWorker', () => {
  let worker: StreamChatIngestWorker;
  const messageRepository = { findOne: jest.fn(), create: jest.fn((x) => x), save: jest.fn() };
  const eventEmitter = { emit: jest.fn() };
  const redis = { del: jest.fn() };
  const configService = { get: jest.fn().mockReturnValue(undefined) };

  const makeJob = (overrides: Partial<StreamChatIngestJob> = {}): Job<StreamChatIngestJob> =>
    ({
      data: {
        streamId: 'stream-1',
        userId: 'user-1',
        body: 'hello chat',
        messageId: 'msg-1',
        ...overrides,
      },
    }) as Job<StreamChatIngestJob>;

  beforeEach(() => {
    jest.clearAllMocks();
    moderateMock.mockResolvedValue({ allowed: true });
    worker = new StreamChatIngestWorker(
      messageRepository as never,
      eventEmitter as never,
      redis as never,
      configService as never,
    );
  });

  it('drops messages blocked by AI moderation without persisting', async () => {
    moderateMock.mockResolvedValue({ allowed: false });
    await worker.process(makeJob());
    expect(messageRepository.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('is idempotent — skips messages that already exist (duplicate delivery)', async () => {
    messageRepository.findOne.mockResolvedValueOnce({ id: 'msg-1' });
    await worker.process(makeJob());
    expect(messageRepository.save).not.toHaveBeenCalled();
  });

  it('persists and broadcasts a clean new message', async () => {
    messageRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'msg-1', streamId: 'stream-1', user: { id: 'user-1' } });
    messageRepository.save.mockResolvedValue({ id: 'msg-1' });

    await worker.process(makeJob());

    expect(messageRepository.save).toHaveBeenCalled();
    expect(toPublicStreamMessage).toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'stream.chat.message',
      expect.objectContaining({ streamId: 'stream-1' }),
    );
  });

  it('does not broadcast when the saved message cannot be re-loaded', async () => {
    messageRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    messageRepository.save.mockResolvedValue({ id: 'msg-1' });

    await worker.process(makeJob());

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
