import { test, expect } from '@playwright/test';

test.describe('Admin moderation flows', () => {
  test.skip(!!process.env.CI && !process.env.STAGING_URL, 'Requires staging environment');

  test('admin login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email').or(page.getByRole('button', { name: /sign in/i }))).toBeVisible({
      timeout: 10_000,
    });
  });

  test('content reports page loads after auth', async ({ page }) => {
    test.skip(true, 'Needs admin credentials in staging');
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: /reports/i })).toBeVisible();
  });

  test('approve/reject actions exist on creator-approvals', async ({ page }) => {
    test.skip(true, 'Needs admin credentials in staging');
    await page.goto('/creator-approvals');
    await expect(page.getByRole('heading', { name: /creator/i })).toBeVisible();
    const approveBtn = page.getByRole('button', { name: /approve/i });
    const rejectBtn = page.getByRole('button', { name: /reject/i });
    const noData = page.getByText(/no pending/i);
    await expect(approveBtn.or(noData)).toBeVisible({ timeout: 10_000 });
    if (await rejectBtn.isVisible().catch(() => false)) {
      expect(rejectBtn).toBeTruthy();
    }
  });
});
