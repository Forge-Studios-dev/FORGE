import {
  getForgeMetricsRegistry,
  recordAiLlmCall,
} from './forge-metrics';

describe('forge-metrics recordAiLlmCall', () => {
  const original = process.env.METRICS_ENABLED;

  afterAll(() => {
    process.env.METRICS_ENABLED = original;
  });

  it('is a no-op (no throw) when metrics are disabled', () => {
    process.env.METRICS_ENABLED = 'false';
    expect(() => recordAiLlmCall('summary', 'success')).not.toThrow();
  });

  it('increments the forge_ai_llm_calls_total counter when enabled', async () => {
    process.env.METRICS_ENABLED = 'true';
    const registry = getForgeMetricsRegistry();
    recordAiLlmCall('moderation', 'budget_skipped');
    recordAiLlmCall('moderation', 'budget_skipped');
    recordAiLlmCall('summary', 'error');

    const metrics = await registry.getMetricsAsJSON();
    const counter = metrics.find((m) => m.name === 'forge_ai_llm_calls_total');
    expect(counter).toBeDefined();

    const skipped = counter?.values.find(
      (v) => v.labels.feature === 'moderation' && v.labels.result === 'budget_skipped',
    );
    expect(skipped?.value).toBe(2);

    const summaryErr = counter?.values.find(
      (v) => v.labels.feature === 'summary' && v.labels.result === 'error',
    );
    expect(summaryErr?.value).toBe(1);
  });
});
