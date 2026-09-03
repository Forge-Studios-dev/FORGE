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
  test.beforeEach(async ({ page }) => {
    // Product default is dark; pin it so axe isn't flaky across OS color-scheme.
    await page.addInitScript(() => {
      try {
        localStorage.setItem('forge-theme', 'dark');
      } catch {
        /* ignore */
      }
    });
  });

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
    await expect(page.getByRole('heading', { name: 'Search', exact: true })).toBeVisible();
    await assertNoSeriousViolations(page);
  });

  test('library has no serious axe violations', async ({ page }) => {
    await page.goto('/library');
    // Guests are middleware-redirected to login.
    await expect(page.getByRole('heading', { name: /welcome back|you|library/i })).toBeVisible({
      timeout: 20_000,
    });
    await assertNoSeriousViolations(page);
  });

  test('subscriptions has no serious axe violations', async ({ page }) => {
    await page.goto('/subscriptions');
    await expect(
      page.getByRole('heading', { name: 'Subscriptions', exact: true }).or(
        page.getByRole('heading', { name: /welcome back/i }),
      ),
    ).toBeVisible({
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
    // Guests are middleware-redirected to login.
    await expect(page.getByRole('heading', { name: /welcome back|history/i })).toBeVisible({
      timeout: 20_000,
    });
    await assertNoSeriousViolations(page);
  });

  test('notifications has no serious axe violations', async ({ page }) => {
    await page.goto('/notifications');
    // Guests are middleware-redirected to login.
    await expect(page.getByRole('heading', { name: /welcome back|notification/i })).toBeVisible({
      timeout: 20_000,
    });
    await assertNoSeriousViolations(page);
  });

  test('signup has no serious axe violations', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByLabel('Email')).toBeVisible({ timeout: 20_000 });
    await assertNoSeriousViolations(page);
  });

  test('forgot password has no serious axe violations', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: /forgot|reset|password/i })).toBeVisible({
      timeout: 20_000,
    });
    await assertNoSeriousViolations(page);
  });

  test('live directory has no serious axe violations', async ({ page }) => {
    await page.goto('/live');
    await expect(page.getByRole('heading', { name: /live/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await assertNoSeriousViolations(page);
  });

  test('discover courses has no serious axe violations', async ({ page }) => {
    await page.goto('/discover/courses');
    // Feature flag off → redirect to /explore
    await expect(
      page
        .getByRole('heading', { name: /course|discover/i })
        .first()
        .or(page.getByTestId('forge-explore'))
        .or(page.getByRole('heading', { name: /welcome back/i })),
    ).toBeVisible({ timeout: 20_000 });
    await assertNoSeriousViolations(page);
  });

  test('discover communities has no serious axe violations', async ({ page }) => {
    await page.goto('/discover/communities');
    await expect(page.getByRole('heading', { name: /communit/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await assertNoSeriousViolations(page);
  });

  test('privacy policy has no serious axe violations', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: /privacy/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await assertNoSeriousViolations(page);
  });

  test('terms has no serious axe violations', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByRole('heading', { name: /terms/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await assertNoSeriousViolations(page);
  });

  test('messages guest redirect has no serious axe violations', async ({ page }) => {
    await page.goto('/messages');
    await expect(page.getByRole('heading', { name: /welcome back|messages/i })).toBeVisible({
      timeout: 20_000,
    });
    await assertNoSeriousViolations(page);
  });

  test('embed not-found shell has no serious axe violations', async ({ page }) => {
    await page.goto('/embed/00000000-0000-0000-0000-000000000001');
    await expect(page.locator('body')).toBeVisible({ timeout: 20_000 });
    await assertNoSeriousViolations(page);
  });

  test('unknown channel page has no serious axe violations', async ({ page }) => {
    await page.goto('/forge-a11y-missing-channel-xyz');
    await expect(
      page.getByRole('heading', { name: /not found|unavailable/i }),
    ).toBeVisible({ timeout: 20_000 });
    await assertNoSeriousViolations(page);
  });

  test('public playlist has no serious axe violations when one exists', async ({ page, request }) => {
    // Unlike the page.goto() smoke tests above (which load a local build that
    // happens to read from prod), this issues its own direct API request with
    // no purpose beyond finding a ${playlistId} — that's live-prod traffic
    // with no CI-secret gate, unlike checkout.spec.ts's equivalent guard.
    test.skip(!!process.env.CI && !process.env.STAGING_URL, 'Requires a staging environment');
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
    let playlistId: string | null = null;
    try {
      const res = await request.get(`${apiBase}/search?q=a&type=playlist&limit=1`);
      if (res.ok()) {
        const body = (await res.json()) as {
          data?: { playlists?: { id: string }[] };
        };
        playlistId = body.data?.playlists?.[0]?.id ?? null;
      }
    } catch {
      /* API unavailable in some CI shards */
    }
    test.skip(!playlistId, 'No public playlist available for playlist axe smoke');
    await page.goto(`/playlists/${playlistId}`);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });
    await assertNoSeriousViolations(page);
  });

  test('home light theme has no serious axe violations', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('forge-theme', 'light');
      } catch {
        /* ignore */
      }
    });
    await page.goto('/');
    await expect(page.getByTestId('forge-home')).toBeVisible();
    await assertNoSeriousViolations(page);
  });

  test('watch page has no serious axe violations when a video exists', async ({ page, request }) => {
    // See the playlist test above — same direct-request-to-prod concern.
    test.skip(!!process.env.CI && !process.env.STAGING_URL, 'Requires a staging environment');
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

  // Studio axe stays optional in CI — set E2E_TEST_EMAIL / E2E_TEST_PASSWORD locally or in secrets.
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
