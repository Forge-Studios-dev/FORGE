import { Test, TestingModule } from '@nestjs/testing';
import { AiCommunityService } from './ai-community.service';
import { AiModerationService } from './ai-moderation.service';
import { ConfigService } from '@nestjs/config';

describe('AiCommunityService', () => {
  let service: AiCommunityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiCommunityService,
        AiModerationService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(false) },
        },
      ],
    }).compile();
    service = module.get(AiCommunityService);
  });

  it('flags repetitive spam with heuristic ML', () => {
    const result = service.scoreContent(
      'buy now click here free money ' + 'spamword '.repeat(20),
    );
    expect(result.flagged).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.45);
  });

  it('summarizes discussion messages', () => {
    const summary = service.summarizeDiscussion([
      'How do I start learning guitar?',
      'Practice daily and focus on chords first.',
      'Thanks, that helps!',
    ]);
    expect(summary).toContain('Recent themes');
  });
});
