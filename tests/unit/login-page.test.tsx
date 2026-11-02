// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  signInWithOtp: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/lib/supabase-client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithOtp: mocks.signInWithOtp, signInWithOAuth: mocks.signInWithOAuth },
  }),
}));

import LoginPage from '@/app/login/page';
import { isDemoMode, disableDemoMode } from '@/lib/demo-mode';

describe('login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    disableDemoMode();
  });

  it('sends a magic link that returns through the PKCE callback, then confirms', async () => {
    mocks.signInWithOtp.mockResolvedValue({ error: null });
    render(<LoginPage />);
    await userEvent.type(screen.getByPlaceholderText('you@example.com'), '  ada@example.com  ');
    await userEvent.click(screen.getByRole('button', { name: /continue with email/i }));

    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: 'ada@example.com',
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    });
    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('you@example.com')).not.toBeInTheDocument();
  });

  it('shows the Supabase error and re-enables the form when the magic link fails', async () => {
    mocks.signInWithOtp.mockResolvedValue({ error: { message: 'Email rate limit exceeded' } });
    render(<LoginPage />);
    await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'ada@example.com');
    await userEvent.click(screen.getByRole('button', { name: /continue with email/i }));
    expect(await screen.findByText('Email rate limit exceeded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with email/i })).toBeEnabled();
  });

  it('does not call Supabase for a whitespace-only email', async () => {
    render(<LoginPage />);
    const input = screen.getByPlaceholderText('you@example.com');
    // Bypass the browser's type=email validation to exercise the trim guard.
    input.removeAttribute('required');
    input.setAttribute('type', 'text');
    await userEvent.type(input, '   ');
    await userEvent.click(screen.getByRole('button', { name: /continue with email/i }));
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it('starts Google OAuth with the callback redirect', async () => {
    mocks.signInWithOAuth.mockResolvedValue({ error: null });
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
  });

  it('surfaces an OAuth start error', async () => {
    mocks.signInWithOAuth.mockResolvedValue({ error: { message: 'provider disabled' } });
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    expect(await screen.findByText('provider disabled')).toBeInTheDocument();
  });

  it('enters demo mode without touching Supabase', async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: /try the demo/i }));
    expect(isDemoMode()).toBe(true);
    expect(mocks.push).toHaveBeenCalledWith('/demo');
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
  });

  it('links to the terms and privacy pages', () => {
    render(<LoginPage />);
    expect(screen.getByRole('link', { name: /terms of service/i })).toHaveAttribute('href', '/tos');
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy');
  });
});
