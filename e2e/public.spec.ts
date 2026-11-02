import { test, expect, visualSmoke } from './fixtures';

test.describe('public pages', () => {
  test('login page renders every sign-in option', async ({ page }, testInfo) => {
    await page.goto('/login');
    await expect(page.getByText('Sign in to continue.')).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with email/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /try the demo/i })).toBeVisible();
    await visualSmoke(page, testInfo, 'login');
  });

  for (const [path, title] of [
    ['/privacy', 'Privacy Policy'],
    ['/tos', 'Terms of Service'],
  ] as const) {
    test(`${path} renders for anonymous visitors`, async ({ page }, testInfo) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      expect(page.url()).toContain(path);
      await expect(page.getByText(title, { exact: true })).toBeVisible();
      await expect(page.getByText(/^Last updated:/)).toBeVisible();
      expect(await page.getByRole('heading', { level: 2 }).count()).toBeGreaterThan(3);
      await expect(page.getByRole('link', { name: /back to finalfinal/i })).toHaveAttribute('href', '/login');
      await visualSmoke(page, testInfo, path.slice(1));
    });
  }

  test('login links to the legal pages', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /privacy policy/i }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await page.goto('/login');
    await page.getByRole('link', { name: /terms of service/i }).click();
    await expect(page).toHaveURL(/\/tos$/);
  });

  test('ships the security headers', async ({ request }) => {
    const res = await request.get('/login');
    const h = res.headers();
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  });
});

test.describe('protected routes while logged out', () => {
  test('the app redirects to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Sign in to continue.')).toBeVisible();
  });

  test('unknown app paths redirect to /login too', async ({ page }) => {
    await page.goto('/settings/billing');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('API routes answer 401 JSON, not a redirect', async ({ request }) => {
    for (const path of ['/api/resumes', '/api/sections', '/api/applications', '/api/analytics', '/api/resumes/export?id=00000000-0000-4000-8000-000000000000']) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(401);
      expect(await res.json()).toEqual({ error: 'Not authenticated' });
    }
  });

  test('a forged session cookie does not get in', async ({ page, context }) => {
    await context.addCookies([{ name: 'sb-127-auth-token', value: 'base64-eyJhY2Nlc3NfdG9rZW4iOiJmb3JnZWQifQ', url: 'http://localhost:3100' }]);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });
});
