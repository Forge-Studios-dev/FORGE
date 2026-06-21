import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CreatorCopilotService } from './creator-copilot.service';
import { AiModerationService } from './ai-moderation.service';

describe('CreatorCopilotService', () => {
  let service: CreatorCopilotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorCopilotService,
        {
          provide: AiModerationService,
          useValue: { scoreContent: jest.fn().mockResolvedValue({ flagged: true, score: 0.9, reasons: ['spam'] }) },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(false) },
        },
      ],
    }).compile();
    service = module.get(CreatorCopilotService);
  });

  it('does not confirm flagged content when LLM judge is disabled', async () => {
    const result = await service.judgeFlaggedContent('buy cheap followers now');
    expect(result.confirmed).toBe(false);
    expect(result.reason).toBe('llm_disabled_skip_judge');
  });
});
