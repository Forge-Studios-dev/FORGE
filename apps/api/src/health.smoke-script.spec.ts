import { readFileSync } from 'fs';
import { join } from 'path';

describe('scripts/smoke-api.sh', () => {
  const script = readFileSync(join(__dirname, '../../../scripts/smoke-api.sh'), 'utf8');

  it('always probes /health/live first and exits early in live mode', () => {
    expect(script).toContain('${BASE}/health/live');
    expect(script).toContain('MODE="${FORGE_SMOKE_MODE:-full}"');
    expect(script).toMatch(/if \[\[ "\$MODE" == "live" \]\]/);
  });

  it('hits /health/ready only in full mode (on-demand / deploy), not continuous probes', () => {
    expect(script).toContain('${BASE}/health/ready');
    expect(script).toMatch(/if \[\[ "\$MODE" == "full" \]\]/);
  });
});
