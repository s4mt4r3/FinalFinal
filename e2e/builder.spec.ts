import type { Page } from '@playwright/test';
import { test, expect, admin, visualSmoke } from './fixtures';

// A builder row is the element holding both the section title and its variant picker.
const row = (page: Page, title: string) =>
  page.locator('div').filter({ hasText: new RegExp(`^${title}`) }).filter({ has: page.getByRole('combobox') }).last();

async function savedComposition(resumeName: string, userId: string) {
  const { data: r } = await admin.from('resumes').select('id, content').eq('user_id', userId).eq('name', resumeName).single();
  const { data: joins } = await admin.from('resume_sections').select('variant_id, position').eq('resume_id', r!.id).order('position');
  return { id: r!.id as string, content: r!.content as string, variantIds: joins!.map((j) => j.variant_id) };
}

async function rowOrder(page: Page, titles: string[]) {
  const ys = await Promise.all(titles.map(async (t) => (await row(page, t).boundingBox())!.y));
  return [...titles].sort((a, b) => ys[titles.indexOf(a)] - ys[titles.indexOf(b)]);
}

test('compose a resume, reorder and remove sections, and it persists across reload', async ({ authedPage: page, user }, testInfo) => {
  await page.goto('/');
  await page.getByRole('navigation').getByText('Builder', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tailored resumes' })).toBeVisible();
  await page.getByRole('button', { name: /new resume/i }).first().click();
  await page.getByPlaceholder('SWE — Stripe').fill('Composer E2E');
  await page.getByPlaceholder('swe, fintech').fill('e2e, navy');

  // Kinds with exactly one variant are preselected.
  for (const [title, kind] of [['Experience', 'experience'], ['Projects', 'projects'], ['Technical Skills', 'skills']] as const) {
    await expect(row(page, title).getByRole('combobox')).toHaveValue(user.variants[kind]);
  }
  const preview = page.frameLocator('iframe[title="resume-preview"]');
  await expect(preview.getByText('Grace Hopper')).toBeVisible();
  await expect(preview.getByText('Harvard Mark I')).toBeVisible();

  // Reorder: Technical Skills up past Projects and Experience.
  await row(page, 'Technical Skills').getByTitle('Up').click();
  await row(page, 'Technical Skills').getByTitle('Up').click();
  expect(await rowOrder(page, ['Experience', 'Projects', 'Technical Skills'])).toEqual(['Technical Skills', 'Experience', 'Projects']);

  // Remove: drop Projects from this resume.
  await row(page, 'Projects').getByRole('combobox').selectOption({ label: '— not included —' });
  await expect(preview.getByText('Harvard Mark I')).toHaveCount(0);
  await visualSmoke(page, testInfo, 'builder-edit');

  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page.getByText('Created "Composer E2E"')).toBeVisible();

  const saved = await savedComposition('Composer E2E', user.id);
  expect(saved.variantIds).toEqual([user.variants.header, user.variants.skills, user.variants.experience]);
  expect(saved.content.indexOf('TECHNICAL SKILLS')).toBeLessThan(saved.content.indexOf('EXPERIENCE'));
  expect(saved.content).not.toContain('Harvard Mark I');

  // Reload and reopen: the saved order and selections come back.
  await page.reload();
  await page.getByRole('navigation').getByText('Builder', { exact: true }).click();
  const card = page.locator('div').filter({ hasText: /^Composer E2E/ }).filter({ has: page.getByRole('button', { name: /open/i }) }).last();
  await expect(card.getByText('e2e · navy')).toBeVisible();
  await card.getByRole('button', { name: /open/i }).click();
  await expect(page.getByPlaceholder('SWE — Stripe')).toHaveValue('Composer E2E');
  await expect(row(page, 'Technical Skills').getByRole('combobox')).toHaveValue(user.variants.skills);
  await expect(row(page, 'Projects').getByRole('combobox')).toHaveValue('');
  expect(await rowOrder(page, ['Experience', 'Technical Skills'])).toEqual(['Technical Skills', 'Experience']);

  // Edit again: put Projects back at the end and rename; the update persists too.
  await row(page, 'Projects').getByRole('combobox').selectOption({ label: 'projects main' });
  await page.getByPlaceholder('SWE — Stripe').fill('Composer E2E v2');
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page.getByText('Resume saved')).toBeVisible();
  const updated = await savedComposition('Composer E2E v2', user.id);
  expect(updated.id).toBe(saved.id);
  expect(updated.variantIds).toEqual([user.variants.header, user.variants.skills, user.variants.experience, user.variants.projects]);
});

test('a resume can be deleted and its sections stay in the library', async ({ authedPage: page, user }) => {
  const { data: r } = await user.client.from('resumes').insert({ user_id: user.id, name: 'Throwaway' }).select().single();
  await user.client.from('resume_sections').insert({ resume_id: r!.id, variant_id: user.variants.header, position: 0 });
  const res = await page.request.delete(`/api/resumes/${r!.id}`);
  expect(res.status()).toBe(200);
  expect((await admin.from('resumes').select('id').eq('id', r!.id)).data).toEqual([]);
  expect((await admin.from('section_variants').select('id').eq('id', user.variants.header)).data).toHaveLength(1);
});
