import { test as base, expect, type Page, type TestInfo } from '@playwright/test';
import { admin, createTestUser, deleteTestUsers, sessionCookiesFor, type TestUser } from '../tests/helpers/local-supabase';
import { BASE_URL } from '../playwright.config';

export const SEED = {
  header: { name: 'Grace Hopper', email: 'grace@example.com', location: 'Arlington, VA' },
  experience: {
    items: [{ company: 'US Navy', title: 'Rear Admiral', dateRange: '1943 -- 1986', location: 'Washington, DC', bullets: ['Popularised machine-independent languages'] }],
  },
  skills: { categories: [{ category: 'Languages', items: 'COBOL, FLOW-MATIC' }] },
  projects: { items: [{ name: 'Harvard Mark I', tech: 'Relays', date: '1944', bullets: ['Programmed the Mark I'] }] },
};

export interface SeededUser extends TestUser {
  variants: Record<keyof typeof SEED, string>;
}

async function seedVariants(u: TestUser) {
  const variants = {} as SeededUser['variants'];
  for (const [kind, data] of Object.entries(SEED) as [keyof typeof SEED, unknown][]) {
    const { data: row, error } = await u.client
      .from('section_variants')
      .insert({ user_id: u.id, kind, label: `${kind} main`, data })
      .select()
      .single();
    if (error) throw error;
    variants[kind] = row.id;
  }
  return variants;
}

export const test = base.extend<{ user: SeededUser; authedPage: Page }>({
  // Pages @import Google Fonts; a slow third-party fetch holds the load event and
  // was the source of intermittent 60s timeouts. Tests stay hermetic without them.
  context: async ({ context }, use) => {
    await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
    await use(context);
  },
  user: async ({}, use) => {
    const u = await createTestUser('e2e');
    await use({ ...u, variants: await seedVariants(u) });
    await deleteTestUsers();
  },
  // A browser context carrying the exact cookies @supabase/ssr sets after sign-in.
  authedPage: async ({ page, user }, use) => {
    const cookies = await sessionCookiesFor(user);
    await page.context().addCookies(cookies.map((c) => ({ ...c, url: BASE_URL })));
    await use(page);
  },
});

export { expect, admin };

export async function latestMagicLink(email: string, timeoutMs = 15_000): Promise<string> {
  const inbucket = process.env.SUPABASE_INBUCKET_URL ?? 'http://127.0.0.1:54324';
  const mailbox = email.split('@')[0];
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const list = (await (await fetch(`${inbucket}/api/v1/mailbox/${mailbox}`)).json()) as { id: string }[];
    if (list.length) {
      const msg = await (await fetch(`${inbucket}/api/v1/mailbox/${mailbox}/${list[list.length - 1].id}`)).json();
      const link = String(msg.body?.html ?? msg.body?.text ?? '').match(/href="([^"]+)"/)?.[1];
      if (link) return link.replace(/&amp;/g, '&');
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No magic link for ${email} within ${timeoutMs}ms`);
}

// Visual smoke: a full-page capture attached to the report, plus a check that the
// page actually painted (a blank page PNG compresses to a few KB).
export async function visualSmoke(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(() => document.fonts?.ready);
  const png = await page.screenshot({ fullPage: true, animations: 'disabled' });
  await testInfo.attach(`${name}.png`, { body: png, contentType: 'image/png' });
  expect(png.length, `${name} screenshot looks blank`).toBeGreaterThan(15_000);
}
