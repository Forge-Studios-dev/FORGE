import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  const interceptor = new TransformInterceptor();

  function mockContext(path: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ path, url: path, correlationId: 'test-id' }),
      }),
    } as ExecutionContext;
  }

  it('wraps normal API responses in { success, data }', (done) => {
    interceptor
      .intercept(mockContext('/api/v1/health'), { handle: () => of({ ok: true }) } as CallHandler)
      .subscribe((result) => {
        expect(result).toEqual({ success: true, data: { ok: true }, correlationId: 'test-id' });
        done();
      });
  });

  it('does not wrap /metrics (raw Prometheus for scrapers)', (done) => {
    interceptor
      .intercept(mockContext('/metrics'), { handle: () => of('# HELP x') } as CallHandler)
      .subscribe((result) => {
        expect(result).toBe('# HELP x');
        done();
      });
  });
});
