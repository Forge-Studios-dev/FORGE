import { Job } from 'bullmq';
import { CommunityModerationWorker } from './community-moderation.worker';
import { CommunityModerationJobData } from './community-moderation.constants';

describe('CommunityModerationWorker', () => {
  let worker: CommunityModerationWorker;
  const moderationService = { createAutoSpamReport: jest.fn().mockResolvedValue(undefined) };
  const copilotService = { judgeFlaggedContent: jest.fn() };

  const makeJob = (data: Partial<CommunityModerationJobData>): Job<CommunityModerationJobData> =>
    ({
      data: {
        communityId: 'comm-1',
        channelId: 'room-1',
        userId: 'user-1',
        messageBody: 'buy crypto now click here',
        score: 0.8,
        reasons: ['pattern_match'],
        ...data,
      },
    }) as Job<CommunityModerationJobData>;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new CommunityModerationWorker(
      moderationService as never,
      copilotService as never,
    );
  });

  it('dismisses the job without a report when the LLM judge does not confirm', async () => {
    copilotService.judgeFlaggedContent.mockResolvedValue({
      confirmed: false,
      score: 0.1,
      reason: 'clean',
    });
    await worker.process(makeJob({ detectedBy: 'llm_tail' }));
    expect(moderationService.createAutoSpamReport).not.toHaveBeenCalled();
  });

  it('creates an auto spam report when the LLM judge confirms', async () => {
    copilotService.judgeFlaggedContent.mockResolvedValue({
      confirmed: true,
      score: 0.95,
      reason: 'spam',
    });
    await worker.process(makeJob({ detectedBy: 'fast_path' }));
    expect(moderationService.createAutoSpamReport).toHaveBeenCalledWith(
      expect.objectContaining({
        communityId: 'comm-1',
        reportedUserId: 'user-1',
        targetType: 'user',
      }),
    );
  });

  it('records the originating surface and detection origin in the report reason', async () => {
    copilotService.judgeFlaggedContent.mockResolvedValue({
      confirmed: true,
      score: 0.9,
      reason: 'spam',
    });
    await worker.process(makeJob({ surface: 'post_comment', detectedBy: 'llm_tail' }));
    const reason = moderationService.createAutoSpamReport.mock.calls[0][0].reason as string;
    expect(reason).toContain('surface=post_comment');
    expect(reason).toContain('via=llm_tail');
  });

  it('defaults surface to room and origin to fast_path when unspecified (back-compat)', async () => {
    copilotService.judgeFlaggedContent.mockResolvedValue({
      confirmed: true,
      score: 0.9,
      reason: 'spam',
    });
    await worker.process(makeJob({ surface: undefined, detectedBy: undefined }));
    const reason = moderationService.createAutoSpamReport.mock.calls[0][0].reason as string;
    expect(reason).toContain('surface=room');
    expect(reason).toContain('via=fast_path');
  });

  it('goes straight to a manual-review report when aiUnavailable, without re-running the LLM judge (which would fail-open the same way)', async () => {
    await worker.process(makeJob({ aiUnavailable: true, reasons: ['ai_moderation_unavailable'] }));

    expect(copilotService.judgeFlaggedContent).not.toHaveBeenCalled();
    expect(moderationService.createAutoSpamReport).toHaveBeenCalledWith(
      expect.objectContaining({
        communityId: 'comm-1',
        reportedUserId: 'user-1',
        reason: expect.stringContaining('Needs manual review'),
      }),
    );
  });
});
