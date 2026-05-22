import { test, expect } from '@playwright/test';

test.describe('FORGE web smoke', () => {
  test('home page loads discover section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('forge-home')).toBeVisible();
    await expect(page.getByTestId('discover-section')).toBeVisible();
    await expect(page.getByRole('heading', { name: /discover lessons/i })).toBeVisible();
  });

  test('explore page loads categories', async ({ page }) => {
    await page.goto('/explore');
    await expect(page.getByTestId('forge-explore')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Explore' })).toBeVisible();
  });

  test('login page is reachable', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  });

  test('feed grid or empty state renders on home', async ({ page }) => {
    await page.goto('/');
    const feed = page.getByTestId('feed-grid');
    const empty = page.getByText(/no lessons yet/i);
    await expect(feed.or(empty)).toBeVisible({ timeout: 15_000 });
  });
});
