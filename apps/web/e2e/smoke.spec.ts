import { test, expect } from '@playwright/test';

test.describe('FORGE web smoke', () => {
  test('home page loads For you section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('forge-home')).toBeVisible();
    await expect(page.getByTestId('discover-section')).toBeVisible();
    await expect(page.getByRole('tab', { name: /^for you$/i })).toBeVisible();
  });

  test('explore page loads categories', async ({ page }) => {
    await page.goto('/explore');
    await expect(page.getByTestId('forge-explore')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Explore' })).toBeVisible();
  });

  test('login page is reachable', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  });

  test('feed grid or empty state renders on home', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('discover-section')).toBeVisible();
    const feed = page.getByTestId('feed-grid');
    const empty = page.getByRole('heading', { name: /no videos yet/i });
    const loadError = page.getByRole('heading', { name: /couldn't load feed/i });
    await expect(feed.or(empty).or(loadError)).toBeVisible({ timeout: 20_000 });
  });

  test('discover courses page loads or redirects when feature off', async ({ page }) => {
    await page.goto('/discover/courses');
    const coursesHeading = page.getByRole('heading', { name: /discover courses/i });
    const exploreHeading = page.getByRole('heading', { name: 'Explore' });
    await expect(coursesHeading.or(exploreHeading)).toBeVisible({ timeout: 20_000 });
  });

  test('studio courses page loads or redirects when feature off', async ({ page }) => {
    await page.goto('/studio/courses');
    const studioCourses = page.getByRole('heading', { name: /courses/i });
    const studioHome = page.getByRole('heading', { name: /channel dashboard|studio/i });
    const loginHeading = page.getByRole('heading', { name: /welcome back|sign in/i });
    await expect(studioCourses.or(studioHome).or(loginHeading)).toBeVisible({ timeout: 20_000 });
  });
});
