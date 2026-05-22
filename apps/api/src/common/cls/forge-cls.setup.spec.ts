import { traceIdFromTraceparent } from './forge-cls.setup';

describe('traceIdFromTraceparent', () => {
  it('parses valid W3C traceparent', () => {
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const header = `00-${traceId}-00f067aa0ba902b7-01`;
    expect(traceIdFromTraceparent(header)).toBe(traceId);
  });

  it('returns null for invalid header', () => {
    expect(traceIdFromTraceparent('invalid')).toBeNull();
    expect(traceIdFromTraceparent(undefined)).toBeNull();
  });
});
