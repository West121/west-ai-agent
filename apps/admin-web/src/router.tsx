import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';

import { AppShell } from '@/components/app-shell';
import { AnalyticsPage } from '@/routes/analytics';
import { ChannelsPage } from '@/routes/channels';
import { ConversationsPage } from '@/routes/conversations';
import { CustomersPage } from '@/routes/customers';
import { AuthPage } from '@/routes/auth';
import { HistoryPage } from '@/routes/history';
import { ExportManagementPage } from '@/routes/export-management';
import { KnowledgePage } from '@/routes/knowledge';
import { KnowledgeStudioPage } from '@/routes/knowledge-studio';
import { LeaveMessagesPage } from '@/routes/leave-messages';
import { HomePage } from '@/routes/index';
import { QualityReviewPage } from '@/routes/quality-review';
import { ReportCenterPage } from '@/routes/report-center';
import { ServiceOpsPage } from '@/routes/service-ops';
import { SettingsPage } from '@/routes/settings';
import { TicketsPage } from '@/routes/tickets';
import { VideoServicePage } from '@/routes/video-service';
import { UsersPage } from '@/routes/users';

const rootRoute = createRootRoute({
  component: function RootLayout() {
    return (
      <AppShell>
        <Outlet />
      </AppShell>
    );
  },
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'users',
  component: UsersPage,
});

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'auth',
  component: AuthPage,
});

const customersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'customers',
  component: CustomersPage,
});

const channelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'channels',
  component: ChannelsPage,
});

const conversationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'conversations',
  component: ConversationsPage,
});

const knowledgeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'knowledge',
  component: KnowledgePage,
});

const knowledgeStudioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'knowledge-studio',
  component: KnowledgeStudioPage,
});

const ticketsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'tickets',
  component: TicketsPage,
});

const leaveMessagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'leave-messages',
  component: LeaveMessagesPage,
});

const serviceOpsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'service-ops',
  component: ServiceOpsPage,
});

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'history',
  component: HistoryPage,
});

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'analytics',
  component: AnalyticsPage,
});

const reportCenterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'report-center',
  component: ReportCenterPage,
});

const qualityReviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'quality-review',
  component: QualityReviewPage,
});

const exportManagementRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'export-management',
  component: ExportManagementPage,
});

const videoServiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'video-service',
  component: VideoServicePage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'settings',
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  authRoute,
  usersRoute,
  customersRoute,
  channelsRoute,
  conversationsRoute,
  knowledgeRoute,
  knowledgeStudioRoute,
  ticketsRoute,
  leaveMessagesRoute,
  serviceOpsRoute,
  historyRoute,
  analyticsRoute,
  reportCenterRoute,
  qualityReviewRoute,
  exportManagementRoute,
  videoServiceRoute,
  settingsRoute,
]);

export const router = createRouter({
  routeTree,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
