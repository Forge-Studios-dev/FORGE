import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleOAuthGuard } from './google-oauth.guard';

function contextWithQuery(query: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ query }) }),
  } as unknown as ExecutionContext;
}

describe('GoogleOAuthGuard', () => {
  const config = { get: jest.fn().mockReturnValue(true) };
  let guard: GoogleOAuthGuard;

  beforeEach(() => {
    guard = new GoogleOAuthGuard(config as unknown as ConfigService);
  });

  it('requests a mobile state hint when platform=mobile', () => {
    expect(guard.getAuthenticateOptions(contextWithQuery({ platform: 'mobile' }))).toEqual({
      state: 'mobile',
    });
  });

  it('requests no state hint for the web flow', () => {
    expect(guard.getAuthenticateOptions(contextWithQuery({}))).toBeUndefined();
  });
});
