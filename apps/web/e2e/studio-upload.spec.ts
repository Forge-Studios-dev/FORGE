import { test, expect } from '@playwright/test';

test.describe('Studio upload', () => {
  test.skip(!!process.env.CI && !process.env.STAGING_URL, 'Requires staging environment');

  test('studio page is gated behind auth', async ({ page }) => {
    await page.goto('/studio/videos');
    await expect(
      page.getByLabel('Email').or(page.getByRole('heading', { name: /sign in|welcome back/i })),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('upload button visible when authenticated', async ({ page }) => {
    test.skip(true, 'Needs authenticated staging session');
    await page.goto('/studio/videos');
    await expect(page.getByRole('button', { name: /upload|new/i })).toBeVisible();
  });

  test('upload form has required fields', async ({ page }) => {
    test.skip(true, 'Needs authenticated staging session with creator approval');
    await page.goto('/upload');
    await expect(page.getByLabel(/title/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /upload|publish/i })).toBeVisible();
  });
});
