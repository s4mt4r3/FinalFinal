import { defineConfig, devices } from '@playwright/test';
import { loadTestEnv } from './tests/helpers/test-env';

const env = loadTestEnv();
const PORT = 3100;
export const BASE_URL = `http://localhost:${PORT}`;

// `verify` builds once and sets E2E_PREBUILT so the build isn't repeated here.
const serverCommand = process.env.E2E_PREBUILT
  ? 'npm run start:test'
  : 'npm run build:test && npm run start:test';

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // The Next server and Supabase share this machine; more workers just cause timeouts.
  workers: 2,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
    // Signed-in journeys are desktop-only until the app shell is responsive
    // (see the known-bug test in e2e/mobile.spec.ts).
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /(public|mobile)\.spec\.ts/ },
  ],
  webServer: {
    command: serverCommand,
    url: `${BASE_URL}/login`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      NEXT_PUBLIC_SUPABASE_URL: env.url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: env.anonKey,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
