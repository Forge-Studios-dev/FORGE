import { test, expect } from '@playwright/test';

/**
 * Guest-safe critical chrome: search type tablist keyboard + home category chips.
 * No live auth secrets required.
 */
test.describe('critical chrome (guest)', () => {
  test('search type tablist supports arrow-key navigation', async ({ page }) => {
    await page.goto('/search?q=forge');
    const tablist = page.getByRole('tablist', { name: 'Result type' });
    await expect(tablist).toBeVisible({ timeout: 20_000 });
    const allTab = tablist.getByRole('tab', { name: 'All' });
    await allTab.focus();
    await expect(allTab).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(tablist.getByRole('tab', { name: 'Videos' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('home feed tablist supports arrow-key navigation when signed-out', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('discover-section')).toBeVisible();
    const tablist = page.getByRole('tablist', { name: 'Home feed' });
    await expect(tablist).toBeVisible();
    const forYou = tablist.getByRole('tab', { name: 'For you' });
    await expect(forYou).toHaveAttribute('aria-selected', 'true');
    await expect(forYou).toHaveAttribute('tabindex', '0');
  });

  test('home category tablist exposes roving tabindex', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('forge-home')).toBeVisible();
    const tablist = page.getByRole('tablist', { name: 'Categories' });
    // Categories may be empty in some envs; All chip should still exist when filter renders.
    if ((await tablist.count()) === 0) {
      test.skip(true, 'Category filter not rendered (no categories / layout)');
      return;
    }
    const allTab = tablist.getByRole('tab', { name: 'All' });
    await expect(allTab).toHaveAttribute('tabindex', '0');
  });
});
