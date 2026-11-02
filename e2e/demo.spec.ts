import { test, expect, admin, visualSmoke } from './fixtures';

test.describe('demo mode', () => {
  test('enter, edit, and nothing reaches the database', async ({ page }, testInfo) => {
    const apiCalls: string[] = [];
    page.on('request', (r) => {
      if (new URL(r.url()).pathname.startsWith('/api/')) apiCalls.push(`${r.method()} ${r.url()}`);
    });

    await page.goto('/login');
    await page.getByRole('button', { name: /try the demo/i }).click();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByText(/you.re in demo mode/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    await visualSmoke(page, testInfo, 'demo-dashboard');

    // Compose and save a new resume.
    await page.getByRole('navigation').getByText('Builder', { exact: true }).click();
    await page.getByRole('button', { name: /new resume/i }).first().click();
    await page.getByPlaceholder('SWE — Stripe').fill('Demo Edit Résumé');
    await page.getByRole('button', { name: /^save$/i }).click();
    await page.getByRole('button', { name: /all resumes/i }).click();
    await expect(page.getByText('Demo Edit Résumé', { exact: true })).toBeVisible();
    await visualSmoke(page, testInfo, 'demo-builder-list');

    // In-memory only: no API traffic, and the edit never reached the database.
    expect(apiCalls).toEqual([]);
    const { count } = await admin.from('resumes').select('*', { count: 'exact', head: true }).eq('name', 'Demo Edit Résumé');
    expect(count).toBe(0);

    // A reload of /demo reseeds, so the edit is gone.
    await page.goto('/demo');
    await page.getByRole('navigation').getByText('Builder', { exact: true }).click();
    await expect(page.getByText('Tailored resumes')).toBeVisible();
    await expect(page.getByText('Demo Edit Résumé', { exact: true })).toHaveCount(0);
  });

  test('exiting demo leaves no session behind', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.getByText(/you.re in demo mode/i)).toBeVisible();
    await page.getByRole('button', { name: /exit demo/i }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.request.get('/api/resumes')).status()).toBe(401);
  });

  test('the demo flag does not unlock the real app', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.getByText(/you.re in demo mode/i)).toBeVisible();
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });
});
