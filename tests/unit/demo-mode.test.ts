// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { disableDemoMode, enableDemoMode, isDemoMode } from '@/lib/demo-mode';

describe('demo-mode flag', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('is off by default and toggles via sessionStorage', () => {
    expect(isDemoMode()).toBe(false);
    enableDemoMode();
    expect(isDemoMode()).toBe(true);
    expect(window.sessionStorage.getItem('ff_demo_mode')).toBe('1');
    disableDemoMode();
    expect(isDemoMode()).toBe(false);
  });

  // sessionStorage (not localStorage) means a new tab/session never inherits demo mode.
  it('never writes to localStorage', () => {
    enableDemoMode();
    expect(window.localStorage.length).toBe(0);
  });

  it('degrades to "off" when storage throws (e.g. Safari private mode)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => enableDemoMode()).not.toThrow();
    expect(() => disableDemoMode()).not.toThrow();
    expect(isDemoMode()).toBe(false);
  });
});
