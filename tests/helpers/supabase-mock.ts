import { vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

export type Op = 'select' | 'insert' | 'update' | 'delete' | 'upsert';

export interface QueryCall {
  table: string;
  op: Op;
  payload?: unknown;
  columns?: string;
  filters: [string, ...unknown[]][];
  single: boolean;
}

export interface QueryResult {
  data?: unknown;
  error?: unknown;
}

// Decides what each awaited query resolves to. Returning undefined falls back to
// an empty success, which is also how RLS presents another user's rows: nothing.
export type Responder = (q: QueryCall) => QueryResult | undefined;

const FILTER_METHODS = ['eq', 'neq', 'in', 'or', 'order', 'limit', 'ilike', 'is', 'match', 'gt', 'lt', 'gte', 'lte'];

function builder(table: string, calls: QueryCall[], respond: Responder) {
  const q: QueryCall = { table, op: 'select', filters: [], single: false };
  let recorded = false;
  const record = () => {
    if (!recorded) {
      calls.push(q);
      recorded = true;
    }
  };

  const b: Record<string, unknown> = {};
  const chain = (fn: (...a: unknown[]) => void) => (...args: unknown[]) => {
    fn(...args);
    return b;
  };

  b.select = chain((cols) => {
    q.columns = (cols as string) ?? '*';
  });
  for (const op of ['insert', 'update', 'upsert'] as const) {
    b[op] = chain((payload) => {
      q.op = op;
      q.payload = payload;
    });
  }
  b.delete = chain(() => {
    q.op = 'delete';
  });
  for (const m of FILTER_METHODS) {
    b[m] = chain((...args) => {
      q.filters.push([m, ...args]);
    });
  }
  b.single = chain(() => {
    q.single = true;
  });
  b.maybeSingle = b.single;

  b.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
    record();
    let result: QueryResult | undefined;
    try {
      result = respond(q);
    } catch (e) {
      return Promise.reject(e).then(onFulfilled, onRejected);
    }
    const fallbackData = q.op === 'select' && !q.single ? [] : null;
    const value = {
      data: result && 'data' in result ? result.data : fallbackData,
      error: result?.error ?? null,
    };
    return Promise.resolve(value).then(onFulfilled, onRejected);
  };
  return b;
}

export function createSupabaseMock(respond: Responder = () => undefined) {
  const calls: QueryCall[] = [];
  const client = {
    from: vi.fn((table: string) => builder(table, calls, respond)),
    auth: {
      getUser: vi.fn(),
      signOut: vi.fn(async () => ({ error: null })),
    },
  };
  return {
    client: client as unknown as SupabaseClient<any>,
    calls,
    callsTo: (table: string, op?: Op) => calls.filter((c) => c.table === table && (!op || c.op === op)),
  };
}

export const pgError = (message = 'upstream failure', code = 'XX000') => ({
  message,
  code,
  details: 'internal detail that must not leak',
  hint: null,
});
