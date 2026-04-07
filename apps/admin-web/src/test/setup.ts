import '@testing-library/jest-dom/vitest';

import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

import { queryClient } from '@/lib/query-client';

function ensureLocalStorage() {
  if (typeof window.localStorage?.clear === 'function') {
    return;
  }

  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    value: {
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
    configurable: true,
  });
}

beforeEach(() => {
  queryClient.clear();
  ensureLocalStorage();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  queryClient.clear();
});
