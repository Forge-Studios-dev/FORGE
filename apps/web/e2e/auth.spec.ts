import { test, expect } from '@playwright/test';

const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;

test.describe('FORGE authenticated smoke', () => {
  test.skip(!email || !password, 'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run');

  test('login and reach library', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email!);
    await page.getByLabel('Password', { exact: true }).fill(password!);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

    await page.goto('/library');
    await expect(page.getByRole('heading', { name: /library/i })).toBeVisible({
      timeout: 15_000,
    });
  });
});
