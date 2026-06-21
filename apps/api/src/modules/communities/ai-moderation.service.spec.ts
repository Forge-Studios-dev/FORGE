import { AiModerationService } from './ai-moderation.service';

describe('AiModerationService', () => {
  const service = new AiModerationService();

  it('flags obvious spam patterns', () => {
    const result = service.scoreSpam('buy now click here free money');
    expect(result.flagged).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.4);
  });

  it('allows normal community messages', () => {
    const result = service.scoreSpam('Thanks for sharing that lesson!');
    expect(result.flagged).toBe(false);
  });
});
