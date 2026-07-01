import { LlmRouterService } from './llm-router.service';

const config = (overrides: Record<string, unknown>) =>
  ({ get: jest.fn((key: string) => overrides[key]) }) as never;

const budget = (canConsume: boolean) =>
  ({ tryConsume: jest.fn().mockResolvedValue(canConsume) }) as never;

describe('LlmRouterService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns null when budget is exhausted', async () => {
    const svc = new LlmRouterService(config({}), budget(false));
    const result = await svc.complete('summary', 'system', [{ role: 'user', content: 'hello' }]);
    expect(result).toBeNull();
  });

  it('routes summary to OpenAI and returns text', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Summary here.' } }] }),
    } as never);
    const svc = new LlmRouterService(
      config({ 'ai.copilotEnabled': true, 'openai.apiKey': 'sk-test', 'ai.copilotModel': 'gpt-4.1-mini' }),
      budget(true),
    );
    const result = await svc.complete('summary', 'You summarize.', [{ role: 'user', content: 'msg' }]);
    expect(result).not.toBeNull();
    expect(result?.provider).toBe('openai');
    expect(result?.text).toBe('Summary here.');
  });

  it('routes creator_insights to Anthropic and returns text', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'You are growing fast.' }],
        usage: { cache_read_input_tokens: 0 },
      }),
    } as never);
    const svc = new LlmRouterService(
      config({ 'ai.claudeEnabled': true, 'anthropic.apiKey': 'sk-ant', 'ai.claudeModel': 'claude-haiku-4-5-20251001' }),
      budget(true),
    );
    const result = await svc.complete('creator_insights', 'You are a creator coach.', [
      { role: 'user', content: 'analyze me' },
    ]);
    expect(result?.provider).toBe('anthropic');
    expect(result?.text).toBe('You are growing fast.');
    expect(result?.cached).toBe(false);
  });

  it('reports cached=true when Claude returns cache_read_input_tokens > 0', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'Cached response.' }],
        usage: { cache_read_input_tokens: 1200 },
      }),
    } as never);
    const svc = new LlmRouterService(
      config({ 'ai.claudeEnabled': true, 'anthropic.apiKey': 'sk-ant' }),
      budget(true),
    );
    const result = await svc.complete('creator_insights', 'system', [
      { role: 'user', content: 'test' },
    ], { cacheSystemPrompt: true });
    expect(result?.cached).toBe(true);
  });

  it('falls back to Anthropic when OpenAI is not configured for a summary request', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'Fallback summary.' }],
        usage: {},
      }),
    } as never);
    const svc = new LlmRouterService(
      config({ 'ai.claudeEnabled': true, 'anthropic.apiKey': 'sk-ant' }),
      budget(true),
    );
    const result = await svc.complete('summary', 'Summarize.', [{ role: 'user', content: 'msgs' }]);
    expect(result?.provider).toBe('anthropic');
  });

  it('returns null when both providers fail', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network error'));
    const svc = new LlmRouterService(
      config({
        'ai.copilotEnabled': true, 'openai.apiKey': 'sk-test',
        'ai.claudeEnabled': true, 'anthropic.apiKey': 'sk-ant',
      }),
      budget(true),
    );
    const result = await svc.complete('summary', 'sys', [{ role: 'user', content: 'msg' }]);
    expect(result).toBeNull();
  });
});
