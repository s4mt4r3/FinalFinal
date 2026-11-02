import { setupServer } from 'msw/node';

export const server = setupServer();
export const SUPABASE_URL = 'http://supabase.unit.test';
