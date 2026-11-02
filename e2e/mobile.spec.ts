import type { Page } from '@playwright/test';
import { test, expect, visualSmoke } from './fixtures';

const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('mobile viewport', () => {
  for (const path of ['/login', '/privacy', '/tos']) {
    test(`${path} fits the screen without horizontal scrolling`, async ({ page }) => {
      await page.goto(path);
      await page.evaluate(() => document.fonts?.ready);
      expect(await overflowX(page)).toBeLessThanOrEqual(1);
    });
  }

  test('demo can be entered from the login page on a phone', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /try the demo/i }).click();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByText(/you.re in demo mode/i)).toBeVisible();
  });

  // KNOWN BUG: the app shell uses a fixed 240px sidebar plus fixed-width panels
  // (Builder preview is 480px), so on a phone the page scrolls sideways and
  // cards overlap their buttons. Signed-in journeys therefore run on desktop
  // only. Remove test.fail() once the layout is responsive.
  test('app shell fits the screen without horizontal scrolling', async ({ page }, testInfo) => {
    test.fail();
    await page.goto('/demo');
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    await visualSmoke(page, testInfo, 'mobile-demo-dashboard');
    expect(await overflowX(page)).toBeLessThanOrEqual(1);
  });
});
