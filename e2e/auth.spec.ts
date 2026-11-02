import { randomUUID } from 'node:crypto';
import { test, expect, admin, latestMagicLink, visualSmoke } from './fixtures';

// The CSP pins connect-src to https://<supabase host>; the local stack is plain
// http, so the browser-side OTP request would be blocked. Production is https.
test.use({ bypassCSP: true });

test.describe('email sign-in', () => {
  // Fresh inbox per test (and per repeat), so a stale, already-used link from an
  // earlier run can never be picked up.
  let email = '';
  test.beforeEach(() => {
    email = `magic-${randomUUID().slice(0, 8)}@example.com`;
  });

  test.afterEach(async () => {
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const u = (data.users as { id: string; email?: string }[]).find((x) => x.email === email);
    if (u) await admin.auth.admin.deleteUser(u.id);
  });

  test('sign up with a magic link, land on the dashboard, sign out', async ({ page }, testInfo) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByRole('button', { name: /continue with email/i }).click();
    await expect(page.getByText(/check your inbox/i)).toBeVisible();

    await page.goto(await latestMagicLink(email));
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    await expect(page.getByRole('navigation').getByText('Builder', { exact: true })).toBeVisible();
    await visualSmoke(page, testInfo, 'dashboard-empty');

    // A fresh account has no data and no tier gate in the way.
    expect((await page.request.get('/api/resumes')).status()).toBe(200);

    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.request.get('/api/resumes')).status()).toBe(401);
  });

  test('a magic link cannot be replayed', async ({ page, browser }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByRole('button', { name: /continue with email/i }).click();
    const link = await latestMagicLink(email);
    await page.goto(link);
    await expect(page).toHaveURL('/');

    const other = await browser.newContext();
    const replay = await other.newPage();
    await replay.goto(link);
    await expect(replay).toHaveURL(/\/login/);
    await other.close();
  });
});

test.describe('existing session', () => {
  test('signed-in users skip the login wall and data loads', async ({ authedPage: page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    await page.getByRole('navigation').getByText('Sections', { exact: true }).click();
    await expect(page.getByText('header main')).toBeVisible();
  });

  test('an expired/revoked session is sent back to /login', async ({ authedPage: page, user }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    await admin.auth.admin.signOut((await user.client.auth.getSession()).data.session!.access_token, 'global');
    await page.context().clearCookies();
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });
});
