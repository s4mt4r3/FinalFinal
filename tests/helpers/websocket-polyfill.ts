import { createRequire } from 'node:module';
import path from 'node:path';

// supabase-js >= 2.10x throws "Node.js 20 detected without native WebSocket
// support" while constructing any client. `next start` never hits this because
// next/dist/server/node-environment-baseline.js installs its bundled `ws` as
// globalThis.WebSocket; plain Node 20 under Vitest/Playwright has no such global.
export function installNextWebSocketPolyfill() {
  if (typeof globalThis.WebSocket === 'function') return;
  // Anchored on cwd so this works from both ESM (Vitest) and CJS (Playwright).
  const require = createRequire(path.join(process.cwd(), 'package.json'));
  (globalThis as any).WebSocket = require('next/dist/compiled/ws').WebSocket;
}
