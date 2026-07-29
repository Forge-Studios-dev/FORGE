import { EventsBroadcastListener } from './events-broadcast.listener';
import { SocketIoHub } from './socket-io.hub';

describe('EventsBroadcastListener', () => {
  it('relays stream.reconnecting to the stream room', () => {
    const emit = jest.fn();
    const hub = {
      io: {},
      to: jest.fn().mockReturnValue({ emit }),
    } as unknown as SocketIoHub;
    const listener = new EventsBroadcastListener(hub);
    const payload = {
      streamId: 'stream-1',
      userId: 'creator-1',
      since: new Date().toISOString(),
      timeoutSec: 60,
      attempt: 1,
    };
    listener.handleStreamReconnecting(payload);
    expect(hub.to).toHaveBeenCalledWith('stream:stream-1');
    expect(emit).toHaveBeenCalledWith('stream:reconnecting', payload);
  });

  it('relays stream.reconnected to the stream room', () => {
    const emit = jest.fn();
    const hub = {
      io: {},
      to: jest.fn().mockReturnValue({ emit }),
    } as unknown as SocketIoHub;
    const listener = new EventsBroadcastListener(hub);
    const payload = { streamId: 'stream-1', userId: 'creator-1' };
    listener.handleStreamReconnected(payload);
    expect(emit).toHaveBeenCalledWith('stream:reconnected', payload);
  });
});
