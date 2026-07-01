import { Job } from 'bullmq';
import { CommunityAnnouncementNotifyWorker } from './community-announcement-notify.worker';
import type { CommunityAnnouncementNotifyJobData } from './community-announcement-notify.constants';

describe('CommunityAnnouncementNotifyWorker', () => {
  let worker: CommunityAnnouncementNotifyWorker;
  const announcementNotify = { fanOut: jest.fn().mockResolvedValue(undefined) };

  const job = {
    data: {
      communityId: 'comm-1',
      postId: 'post-1',
      creatorId: 'creator-1',
      title: 'New announcement',
      body: 'Hello members',
    },
  } as Job<CommunityAnnouncementNotifyJobData>;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new CommunityAnnouncementNotifyWorker(announcementNotify as never);
  });

  it('fans out the announcement to community members', async () => {
    await worker.process(job);
    expect(announcementNotify.fanOut).toHaveBeenCalledWith(job.data);
  });

  it('propagates fan-out failures for retry', async () => {
    announcementNotify.fanOut.mockRejectedValueOnce(new Error('fanout failed'));
    await expect(worker.process(job)).rejects.toThrow('fanout failed');
  });
});
