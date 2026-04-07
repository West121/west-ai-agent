import '@testing-library/jest-dom/vitest';

import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

import { queryClient } from '@/lib/query-client';

beforeEach(() => {
  queryClient.clear();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  queryClient.clear();
});
