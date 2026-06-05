import { test, expect } from '@playwright/test';

test('admin login page loads', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /FORGE Admin/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
});
