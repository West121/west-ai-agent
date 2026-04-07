import type { ReactElement } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';

import { queryClient } from '@/lib/query-client';

export function renderWithProviders(ui: ReactElement) {
  queryClient.clear();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}
