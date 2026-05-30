import {
  accessTokenAllowsCreatorUpload,
  isValidConsumerAccessToken,
} from './consumer-session';

function b64url(obj: Record<string, unknown>): string {
  const json = JSON.stringify(obj);
  const b64 = Buffer.from(json).toString('base64url');
  return `hdr.${b64}.sig`;
}

describe('isValidConsumerAccessToken', () => {
  it('rejects missing token', () => {
    expect(isValidConsumerAccessToken(null)).toBe(false);
  });

  it('rejects expired token', () => {
    const token = b64url({ sub: '1', role: 'user', exp: 1 });
    expect(isValidConsumerAccessToken(token)).toBe(false);
  });

  it('rejects admin role', () => {
    const token = b64url({ sub: '1', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(isValidConsumerAccessToken(token)).toBe(false);
  });

  it('accepts valid user token', () => {
    const token = b64url({ sub: '1', role: 'user', exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(isValidConsumerAccessToken(token)).toBe(true);
  });
});

describe('accessTokenAllowsCreatorUpload', () => {
  it('requires creator role', () => {
    const viewer = b64url({ sub: '1', role: 'user', exp: Math.floor(Date.now() / 1000) + 3600 });
    const creator = b64url({ sub: '1', role: 'creator', exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(accessTokenAllowsCreatorUpload(viewer)).toBe(false);
    expect(accessTokenAllowsCreatorUpload(creator)).toBe(true);
  });
});
