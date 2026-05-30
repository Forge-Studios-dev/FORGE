import { test, expect } from '@playwright/test';

test.describe('Auth navigation (unauthenticated)', () => {
  test('middleware redirects /library to login with next', async ({ page }) => {
    await page.goto('/library');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    const url = new URL(page.url());
    expect(url.searchParams.get('next')).toContain('/library');
  });

  test('middleware redirects /profile to login with next', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    const url = new URL(page.url());
    expect(url.searchParams.get('next')).toContain('/profile');
  });

  test('middleware preserves search in next for protected route', async ({ page }) => {
    await page.goto('/profile/settings');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    const url = new URL(page.url());
    const next = url.searchParams.get('next') ?? '';
    expect(next).toContain('/profile/settings');
  });

  test('viewer cookie cannot access upload step — redirected to become-creator', async ({ page, context }) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = Buffer.from(JSON.stringify({ sub: 'u1', role: 'user', exp })).toString('base64url');
    const token = `e30.${payload}.sig`;
    await context.addCookies([
      {
        name: 'forge_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);
    await page.goto('/upload/step/1');
    await expect(page).toHaveURL(/\/upload\/become-creator/, { timeout: 15_000 });
  });

  test('session-expired links to login with decoded next', async ({ page }) => {
    await page.goto('/session-expired?next=%2Flibrary');
    const signIn = page.getByRole('link', { name: /sign in/i });
    await expect(signIn).toHaveAttribute('href', '/login?next=%2Flibrary');
  });

  test('signup page reads next from query', async ({ page }) => {
    await page.goto('/signup?next=%2Fnotifications');
    const signInLink = page.getByRole('link', { name: /sign in/i });
    await expect(signInLink).toHaveAttribute('href', /next=%2Fnotifications/);
  });

  test('playlists/new guest state links login with next', async ({ page }) => {
    await page.goto('/playlists/new');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    const url = new URL(page.url());
    expect(url.searchParams.get('next')).toMatch(/playlists\/new/);
  });
});
