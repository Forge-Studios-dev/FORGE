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

describe('AiCommunityService.summarizeDiscussionAsync', () => {
  const regexStub = { scoreSpam: jest.fn(), scoreContent: jest.fn() } as never;
  const config = (overrides: Record<string, unknown>) =>
    ({ get: jest.fn((key: string) => overrides[key]) }) as never;
  const messages = ['How do I tune a guitar?', 'Use a tuner app.', 'Thanks!'];

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('falls back to the deterministic summary when copilot is disabled', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const svc = new AiCommunityService(regexStub, config({ 'ai.copilotEnabled': false }));
    const summary = await svc.summarizeDiscussionAsync(messages);
    expect(summary).toContain('Recent themes');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uses the LLM summary when enabled, keyed, and within budget', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '- They discussed guitar tuning' } }] }),
    } as never);
    const budget = { tryConsume: jest.fn().mockResolvedValue(true) } as never;
    const svc = new AiCommunityService(
      regexStub,
      config({ 'ai.copilotEnabled': true, 'openai.apiKey': 'sk-test', 'ai.copilotModel': 'gpt-4.1-mini' }),
      budget,
    );
    const summary = await svc.summarizeDiscussionAsync(messages);
    expect(summary).toBe('- They discussed guitar tuning');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('skips the LLM call and falls back when the budget is exhausted', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const budget = { tryConsume: jest.fn().mockResolvedValue(false) } as never;
    const svc = new AiCommunityService(
      regexStub,
      config({ 'ai.copilotEnabled': true, 'openai.apiKey': 'sk-test' }),
      budget,
    );
    const summary = await svc.summarizeDiscussionAsync(messages);
    expect(summary).toContain('Recent themes');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to the deterministic summary when the LLM request fails', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    const budget = { tryConsume: jest.fn().mockResolvedValue(true) } as never;
    const svc = new AiCommunityService(
      regexStub,
      config({ 'ai.copilotEnabled': true, 'openai.apiKey': 'sk-test' }),
      budget,
    );
    const summary = await svc.summarizeDiscussionAsync(messages);
    expect(summary).toContain('Recent themes');
  });
});

describe('AiCommunityService.generateCreatorInsights', () => {
  const regexStub = { scoreSpam: jest.fn(), scoreContent: jest.fn() } as never;
  const config = (overrides: Record<string, unknown>) =>
    ({ get: jest.fn((key: string) => overrides[key]) }) as never;

  const analyticsData = {
    totalSubscribers: 250,
    mrr: 1200,
    churnRate: 0.05,
    videoViews: 8000,
    lessonCompletionRate: 0.65,
    communityEngagement: 72,
    topContentTitles: ['Intro to Yoga', 'Morning Flow'],
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns deterministic insights when Claude is disabled', async () => {
    const svc = new AiCommunityService(regexStub, config({ 'ai.claudeEnabled': false }));
    const result = await svc.generateCreatorInsights(analyticsData);
    expect(result.provider).toBe('deterministic');
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.summary).toContain('250 subscribers');
  });

  it('uses Claude when enabled and key is present', async () => {
    const claudeResponse = {
      summary: 'Strong creator momentum.',
      recommendations: ['Post more reels', 'Run a live Q&A', 'Add a referral program'],
      growthFocus: 'Retention via live engagement',
    };
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: JSON.stringify(claudeResponse) }],
      }),
    } as never);
    const budget = { tryConsume: jest.fn().mockResolvedValue(true) } as never;
    const svc = new AiCommunityService(
      regexStub,
      config({
        'ai.claudeEnabled': true,
        'anthropic.apiKey': 'sk-ant-test',
        'ai.claudeModel': 'claude-haiku-4-5-20251001',
      }),
      budget,
    );
    const result = await svc.generateCreatorInsights(analyticsData);
    expect(result.provider).toBe('claude');
    expect(result.summary).toBe('Strong creator momentum.');
    expect(result.recommendations).toHaveLength(3);
  });

  it('falls back to deterministic when Claude API returns non-OK response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as never);
    const budget = { tryConsume: jest.fn().mockResolvedValue(true) } as never;
    const svc = new AiCommunityService(
      regexStub,
      config({ 'ai.claudeEnabled': true, 'anthropic.apiKey': 'sk-ant-test' }),
      budget,
    );
    const result = await svc.generateCreatorInsights(analyticsData);
    expect(result.provider).toBe('deterministic');
  });

  it('falls back when budget is exhausted', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const budget = { tryConsume: jest.fn().mockResolvedValue(false) } as never;
    const svc = new AiCommunityService(
      regexStub,
      config({ 'ai.claudeEnabled': true, 'anthropic.apiKey': 'sk-ant-test' }),
      budget,
    );
    const result = await svc.generateCreatorInsights(analyticsData);
    expect(result.provider).toBe('deterministic');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('highlights churn as growth focus when rate exceeds 8%', async () => {
    const svc = new AiCommunityService(regexStub, config({ 'ai.claudeEnabled': false }));
    const result = await svc.generateCreatorInsights({ ...analyticsData, churnRate: 0.12 });
    expect(result.growthFocus).toContain('churn');
    expect(result.recommendations.some((r) => r.toLowerCase().includes('churn'))).toBe(true);
  });
});
