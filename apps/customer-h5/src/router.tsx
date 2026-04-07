import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';

import { ModeShell } from '@/components/mode-shell';
import { EmbeddedPage } from '@/routes/embedded';
import { HomePage } from '@/routes/index';
import { LeaveMessagePage } from '@/routes/leave-message';
import { StandalonePage } from '@/routes/standalone';

const rootRoute = createRootRoute({
  component: function RootLayout() {
    return <Outlet />;
  },
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

const standaloneRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'standalone',
  component: function StandaloneRoute() {
    return (
      <ModeShell mode="standalone">
        <StandalonePage />
      </ModeShell>
    );
  },
});

const embeddedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'embedded',
  component: function EmbeddedRoute() {
    return (
      <ModeShell mode="embedded">
        <EmbeddedPage />
      </ModeShell>
    );
  },
});

const leaveMessageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'leave-message',
  component: LeaveMessagePage,
});

const routeTree = rootRoute.addChildren([indexRoute, standaloneRoute, embeddedRoute, leaveMessageRoute]);

export const router = createRouter({
  routeTree,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
