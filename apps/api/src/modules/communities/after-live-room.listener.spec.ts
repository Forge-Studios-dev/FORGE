import { AfterLiveRoomListener } from './after-live-room.listener';

describe('AfterLiveRoomListener', () => {
  let listener: AfterLiveRoomListener;
  const roomsService = { ensureAfterLiveRoom: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    listener = new AfterLiveRoomListener(roomsService as never);
  });

  it('provisions an after-live room for a community-linked stream', async () => {
    roomsService.ensureAfterLiveRoom.mockResolvedValue({ id: 'r-1' });
    await listener.onStreamEnded({
      streamId: 'stream-1',
      userId: 'host-1',
      title: 'Weekly call',
      communityId: 'comm-1',
    });
    expect(roomsService.ensureAfterLiveRoom).toHaveBeenCalledWith(
      'host-1',
      'comm-1',
      'stream-1',
      'Weekly call',
    );
  });

  it('skips streams not linked to a community', async () => {
    await listener.onStreamEnded({
      streamId: 'stream-1',
      userId: 'host-1',
      title: 'Solo stream',
      communityId: null,
    });
    expect(roomsService.ensureAfterLiveRoom).not.toHaveBeenCalled();
  });

  it('swallows errors so stream-end is never affected', async () => {
    roomsService.ensureAfterLiveRoom.mockRejectedValue(new Error('forbidden'));
    await expect(
      listener.onStreamEnded({
        streamId: 'stream-1',
        userId: 'host-1',
        communityId: 'comm-1',
      }),
    ).resolves.toBeUndefined();
  });
});
