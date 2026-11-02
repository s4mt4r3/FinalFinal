import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installNextWebSocketPolyfill } from '../helpers/websocket-polyfill';
import { server } from '../helpers/msw';

installNextWebSocketPolyfill();

// Unit/integration tests must never reach a real Supabase. The `.test` TLD is
// reserved (RFC 2606), and MSW errors on any request no handler claims, so a
// forgotten mock fails the test instead of silently hitting the network.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.unit.test';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'unit-test-anon-key';
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
// RTL only auto-cleans when Vitest globals are enabled; they aren't here.
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
