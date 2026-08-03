import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Lightweight accessibility gate for primary public surfaces.
 * Fail on serious/critical impact only (keeps CI signal high-value).
 */
async function assertNoSeriousViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blockers = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  expect(blockers, JSON.stringify(blockers, null, 2)).toEqual([]);
}

test.describe('a11y smoke', () => {
  test('home has no serious axe violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('forge-home')).toBeVisible();
    await assertNoSeriousViolations(page);
  });

  test('login has no serious axe violations', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible({ timeout: 20_000 });
    await assertNoSeriousViolations(page);
  });

  test('search has no serious axe violations', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByRole('heading', { name: /search/i })).toBeVisible();
    await assertNoSeriousViolations(page);
  });

  test('library has no serious axe violations', async ({ page }) => {
    await page.goto('/library');
    await expect(page.getByRole('heading', { name: /you|library/i })).toBeVisible({
      timeout: 20_000,
    });
    await assertNoSeriousViolations(page);
  });

  test('subscriptions has no serious axe violations', async ({ page }) => {
    await page.goto('/subscriptions');
    await expect(page.getByRole('heading', { name: /subscription/i })).toBeVisible({
      timeout: 20_000,
    });
    await assertNoSeriousViolations(page);
  });

  test('shorts has no serious axe violations', async ({ page }) => {
    await page.goto('/shorts');
    await expect(page.getByRole('heading', { name: /shorts/i })).toBeVisible({
      timeout: 20_000,
    });
    await assertNoSeriousViolations(page);
  });

  test('explore has no serious axe violations', async ({ page }) => {
    await page.goto('/explore');
    await expect(page.getByTestId('forge-explore')).toBeVisible({ timeout: 20_000 });
    await assertNoSeriousViolations(page);
  });

  test('trending has no serious axe violations', async ({ page }) => {
    await page.goto('/trending');
    await expect(page.getByTestId('forge-trending')).toBeVisible({ timeout: 20_000 });
    await assertNoSeriousViolations(page);
  });

  test('history has no serious axe violations', async ({ page }) => {
    await page.goto('/history');
    await expect(page.getByRole('heading', { name: /history/i })).toBeVisible({
      timeout: 20_000,
    });
    await assertNoSeriousViolations(page);
  });

  test('notifications has no serious axe violations', async ({ page }) => {
    await page.goto('/notifications');
    await expect(page.getByRole('heading', { name: /notification/i })).toBeVisible({
      timeout: 20_000,
    });
    await assertNoSeriousViolations(page);
  });

  test('watch page has no serious axe violations when a video exists', async ({ page, request }) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
    let videoId: string | null = null;
    try {
      const res = await request.get(`${apiBase}/videos/feed?limit=1`);
      if (res.ok()) {
        const body = (await res.json()) as {
          data?: { data?: { id: string }[] } | { id: string }[];
        };
        const list = Array.isArray(body.data)
          ? body.data
          : Array.isArray((body.data as { data?: { id: string }[] })?.data)
            ? (body.data as { data: { id: string }[] }).data
            : [];
        videoId = list[0]?.id ?? null;
      }
    } catch {
      /* API unavailable in some CI shards */
    }
    test.skip(!videoId, 'No public video available for watch axe smoke');
    await page.goto(`/watch/${videoId}`);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });
    await assertNoSeriousViolations(page);
  });
});

test.describe('a11y studio authenticated', () => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  test.skip(!email || !password, 'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run Studio axe');

  test('studio dashboard has no serious axe violations', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email!);
    await page.getByLabel('Password', { exact: true }).fill(password!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

    await page.goto('/studio');
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible({ timeout: 20_000 });
    await assertNoSeriousViolations(page);
  });
});
