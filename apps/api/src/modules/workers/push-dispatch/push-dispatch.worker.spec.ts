import { Job } from 'bullmq';
import { PushDispatchWorker } from './push-dispatch.worker';
import { PushDispatchJob } from '../../notifications/push-dispatch.constants';

describe('PushDispatchWorker', () => {
  let worker: PushDispatchWorker;
  const deviceTokenRepository = { find: jest.fn(), update: jest.fn().mockResolvedValue(undefined) };
  const messaging = { sendEachForMulticast: jest.fn() };
  const firebase = { getMessaging: jest.fn() };

  const makeJob = (): Job<PushDispatchJob> =>
    ({
      data: { userId: 'user-1', title: 'Hi', body: 'New content', data: { k: 'v' } },
    }) as unknown as Job<PushDispatchJob>;

  beforeEach(() => {
    jest.clearAllMocks();
    firebase.getMessaging.mockReturnValue(messaging);
    worker = new PushDispatchWorker(deviceTokenRepository as never, firebase as never);
  });

  it('skips when FCM is not configured', async () => {
    firebase.getMessaging.mockReturnValue(null);
    await worker.process(makeJob());
    expect(deviceTokenRepository.find).not.toHaveBeenCalled();
  });

  it('no-ops when the user has no active device tokens', async () => {
    deviceTokenRepository.find.mockResolvedValue([]);
    await worker.process(makeJob());
    expect(messaging.sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('sends a multicast notification to active tokens', async () => {
    deviceTokenRepository.find.mockResolvedValue([
      { id: 't1', fcmToken: 'tok-1' },
      { id: 't2', fcmToken: 'tok-2' },
    ]);
    messaging.sendEachForMulticast.mockResolvedValue({
      responses: [{ success: true }, { success: true }],
    });
    await worker.process(makeJob());
    expect(messaging.sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: ['tok-1', 'tok-2'],
        notification: { title: 'Hi', body: 'New content' },
        data: { k: 'v' },
      }),
    );
  });

  it('revokes tokens that FCM reports as unregistered/invalid', async () => {
    deviceTokenRepository.find.mockResolvedValue([
      { id: 't1', fcmToken: 'tok-good' },
      { id: 't2', fcmToken: 'tok-dead' },
      { id: 't3', fcmToken: 'tok-bad' },
    ]);
    messaging.sendEachForMulticast.mockResolvedValue({
      responses: [
        { success: true },
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
        { success: false, error: { code: 'messaging/invalid-registration-token' } },
      ],
    });
    await worker.process(makeJob());
    expect(deviceTokenRepository.update).toHaveBeenCalledWith(
      { fcmToken: 'tok-dead' },
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    );
    expect(deviceTokenRepository.update).toHaveBeenCalledWith(
      { fcmToken: 'tok-bad' },
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    );
  });

  it('does not revoke tokens on transient (non-token) failures', async () => {
    deviceTokenRepository.find.mockResolvedValue([{ id: 't1', fcmToken: 'tok-1' }]);
    messaging.sendEachForMulticast.mockResolvedValue({
      responses: [{ success: false, error: { code: 'messaging/internal-error' } }],
    });
    await worker.process(makeJob());
    expect(deviceTokenRepository.update).not.toHaveBeenCalled();
  });

  it('rethrows so BullMQ can retry when the FCM batch throws', async () => {
    deviceTokenRepository.find.mockResolvedValue([{ id: 't1', fcmToken: 'tok-1' }]);
    messaging.sendEachForMulticast.mockRejectedValue(new Error('network down'));
    await expect(worker.process(makeJob())).rejects.toThrow('network down');
  });
});
