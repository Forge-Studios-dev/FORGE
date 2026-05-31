import { isDisposableEmail } from './disposable-email.util';

describe('isDisposableEmail', () => {
  it('blocks known disposable domains', () => {
    expect(isDisposableEmail('a@mailinator.com')).toBe(true);
  });

  it('allows normal domains', () => {
    expect(isDisposableEmail('user@gmail.com')).toBe(false);
  });
});
