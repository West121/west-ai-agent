import type { AnchorHTMLAttributes } from 'react';

import { screen } from '@testing-library/react';

import { AppShell } from '@/components/app-shell';
import { renderWithProviders } from '@/test/render';

const mocks = vi.hoisted(() => ({
  authState: {
    data: { isAuthenticated: true, user: { username: 'admin' }, permissions: ['platform.read'] },
    isPending: false,
  } as { data: { isAuthenticated: boolean; user: { username: string } | null; permissions: string[] }; isPending: boolean },
  token: 'token-123' as string | null,
}));

vi.mock('@/hooks/use-platform-api', () => ({
  useAuthState: () => mocks.authState,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    activeOptions: _activeOptions,
    activeProps: _activeProps,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    activeOptions?: unknown;
    activeProps?: unknown;
  }) => <a {...props}>{children}</a>,
}));

vi.mock('@/lib/platform-api', () => ({
  clearStoredAccessToken: vi.fn(),
  getStoredAccessToken: () => mocks.token,
  platformApiBaseUrl: 'http://127.0.0.1:8000',
}));

describe('AppShell auth guard', () => {
  const originalLocation = window.location;

  function setLocation(pathname: string) {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname,
        assign: vi.fn(),
      },
    });
  }

  beforeEach(() => {
    setLocation('/');
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
    mocks.authState = {
      data: { isAuthenticated: true, user: { username: 'admin' }, permissions: ['platform.read'] },
      isPending: false,
    };
    mocks.token = 'token-123';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('renders protected navigation when authenticated', async () => {
    renderWithProviders(
      <AppShell>
        <section>dashboard content</section>
      </AppShell>,
    );

    expect(await screen.findByText('企业管理后台')).toBeInTheDocument();
    expect(screen.getByText('dashboard content')).toBeInTheDocument();
  });

  it('renders redirect notice on protected routes without a token', async () => {
    setLocation('/users');
    mocks.token = null;
    mocks.authState = {
      data: { isAuthenticated: false, user: null, permissions: [] },
      isPending: false,
    };

    renderWithProviders(
      <AppShell>
        <section>secret content</section>
      </AppShell>,
    );

    expect(await screen.findByText('正在跳转到登录页')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('allows rendering the auth page while unauthenticated', async () => {
    setLocation('/auth');
    mocks.token = null;
    mocks.authState = {
      data: { isAuthenticated: false, user: null, permissions: [] },
      isPending: false,
    };

    renderWithProviders(
      <AppShell>
        <section>auth content</section>
      </AppShell>,
    );

    expect(await screen.findByText('auth content')).toBeInTheDocument();
  });
});
