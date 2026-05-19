import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test';

const mockGetAll = mock(() => []);
const mockSet = mock(() => {});
const mockCookies = mock(async () => ({
  getAll: mockGetAll,
  set: mockSet,
}));

mock.module('next/headers', () => ({
  cookies: mockCookies,
}));

// Use explicit type to avoid any
let passedOptions: { cookies?: { getAll?: () => unknown; setAll?: (cookies: unknown[]) => void } } | undefined;

mock.module('@supabase/ssr', () => ({
  createServerClient: mock((url: string, key: string, options: typeof passedOptions) => {
    passedOptions = options;
    return { mockClient: true };
  }),
}));

import { createClient } from './server';

describe('Supabase Server Client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    mockGetAll.mockClear();
    mockSet.mockClear();
    mockCookies.mockClear();
    passedOptions = undefined;

    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should initialize client with env vars', async () => {
    const client = await createClient();
    expect(client).toEqual({ mockClient: true } as unknown as ReturnType<typeof createClient>);
  });

  it('should implement getAll cookie getter', async () => {
    mockGetAll.mockReturnValue([{ name: 'test', value: '123' }] as unknown as []);
    await createClient();

    expect(passedOptions).toBeDefined();
    expect(passedOptions?.cookies?.getAll).toBeDefined();

    const cookies = passedOptions?.cookies?.getAll?.();
    expect(mockGetAll).toHaveBeenCalled();
    expect(cookies).toEqual([{ name: 'test', value: '123' }]);
  });

  it('should implement setAll cookie setter successfully', async () => {
    await createClient();

    expect(passedOptions).toBeDefined();
    expect(passedOptions?.cookies?.setAll).toBeDefined();

    passedOptions?.cookies?.setAll?.([
      { name: 'test1', value: '1', options: { path: '/' } },
      { name: 'test2', value: '2', options: { path: '/' } },
    ]);

    expect(mockSet).toHaveBeenCalledTimes(2);
    expect(mockSet).toHaveBeenNthCalledWith(1, 'test1', '1', { path: '/' });
    expect(mockSet).toHaveBeenNthCalledWith(2, 'test2', '2', { path: '/' });
  });

  it('should silently catch errors in setAll (e.g. from Server Components)', async () => {
    mockSet.mockImplementation(() => {
      throw new Error('Server Component error');
    });

    await createClient();

    expect(passedOptions).toBeDefined();
    expect(passedOptions?.cookies?.setAll).toBeDefined();

    // Should not throw
    expect(() => {
      passedOptions?.cookies?.setAll?.([
        { name: 'test', value: '1', options: { path: '/' } },
      ]);
    }).not.toThrow();

    expect(mockSet).toHaveBeenCalledTimes(1);
  });
});
