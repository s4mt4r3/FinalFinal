import fs from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';
import { test, expect, type SeededUser } from './fixtures';
import type { Page } from '@playwright/test';

async function openSeededResume(page: Page, user: SeededUser) {
  const { data: r } = await user.client.from('resumes').insert({ user_id: user.id, name: 'Export Me' }).select().single();
  const rows = [user.variants.header, user.variants.experience, user.variants.skills].map((variant_id, position) => ({
    resume_id: r!.id,
    variant_id,
    position,
  }));
  await user.client.from('resume_sections').insert(rows);
  await page.goto('/');
  await page.getByRole('navigation').getByText('Builder', { exact: true }).click();
  const card = page.locator('div').filter({ hasText: /^Export Me/ }).filter({ has: page.getByRole('button', { name: /open/i }) }).last();
  await card.getByRole('button', { name: /open/i }).click();
  await expect(page.getByPlaceholder('SWE — Stripe')).toHaveValue('Export Me');
  await expect(page.frameLocator('iframe[title="resume-preview"]').getByText('Grace Hopper')).toBeVisible();
}

test('download .tex: a complete Jake document with the resume’s text', async ({ authedPage: page, user }) => {
  await openSeededResume(page, user);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /\.tex/i }).click()]);
  expect(download.suggestedFilename()).toBe('export_me.tex');
  const tex = await fs.readFile((await download.path())!, 'utf8');
  expect(tex.length).toBeGreaterThan(2000);
  expect(tex).toContain('\\documentclass[letterpaper,11pt]{article}');
  expect(tex).toContain('{\\Huge \\scshape Grace Hopper}');
  expect(tex).toContain('\\resumeItem{Popularised machine-independent languages}');
  expect(tex).toContain('\\textbf{Languages}{: COBOL, FLOW-MATIC}');
  expect(tex.indexOf('\\section{Experience}')).toBeLessThan(tex.indexOf('\\section{Technical Skills}'));
  expect(tex.trimEnd().endsWith('\\end{document}')).toBe(true);
});

test.describe('PDF export', () => {
  test('download PDF: a non-empty one-page Letter PDF', async ({ authedPage: page, user }) => {
    await openSeededResume(page, user);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 45_000 }),
      page.getByRole('button', { name: /^pdf$/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('export_me.pdf');
    const bytes = await fs.readFile((await download.path())!);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    // A blank export (fixed in Builder.tsx) was a valid 3 KB PDF with no image at all.
    expect(bytes.length).toBeGreaterThan(20_000);
    expect(bytes.includes('/Subtype /Image')).toBe(true);
    const parser = new PDFParse({ data: new Uint8Array(bytes) });
    try {
      const info = await parser.getInfo();
      expect(info.total).toBe(1);
    } finally {
      await parser.destroy();
    }
  });

  // KNOWN BUG: html2pdf rasterises the page (html2canvas → JPEG), so the PDF has
  // no text layer — ATS parsers see an image. test.fail() keeps CI green while
  // flagging the day this starts passing (fixed), so the marker can be removed.
  test('PDF contains selectable resume text', async ({ authedPage: page, user }) => {
    test.fail();
    await openSeededResume(page, user);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 45_000 }),
      page.getByRole('button', { name: /^pdf$/i }).click(),
    ]);
    const parser = new PDFParse({ data: new Uint8Array(await fs.readFile((await download.path())!)) });
    try {
      expect((await parser.getText()).text).toContain('Grace Hopper');
    } finally {
      await parser.destroy();
    }
  });
});

test('export API serves only the owner, with no-store caching', async ({ authedPage: page, user }) => {
  const { data: r } = await user.client.from('resumes').insert({ user_id: user.id, name: 'API Export' }).select().single();
  const res = await page.request.get(`/api/resumes/export?id=${r!.id}&format=html`);
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control']).toBe('private, no-store');
  const anon = await page.context().browser()!.newContext();
  expect((await anon.request.get(`http://localhost:3100/api/resumes/export?id=${r!.id}`)).status()).toBe(401);
  await anon.close();
});
