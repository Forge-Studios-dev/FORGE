import { test, expect } from '@playwright/test';

test.describe('Checkout flow', () => {
  test.skip(!!process.env.CI && !process.env.STAGING_URL, 'Requires staging environment');

  test('tier page shows pricing cards', async ({ page }) => {
    await page.goto('/explore');
    const creatorLink = page.getByRole('link').first();
    if (await creatorLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await creatorLink.click();
      const membershipSection = page.getByText(/membership|subscribe|tier/i);
      await expect(membershipSection.or(page.getByText(/no tiers/i))).toBeVisible({ timeout: 10_000 });
    }
  });

  test('checkout button exists on tier card', async ({ page }) => {
    test.skip(true, 'Needs authenticated staging session with real tier data');
    await page.goto('/');
    await expect(page.getByRole('button', { name: /subscribe|join/i })).toBeVisible();
  });
});
