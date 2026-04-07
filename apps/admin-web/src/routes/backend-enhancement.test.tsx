import type { AnchorHTMLAttributes } from 'react';

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AnalyticsPage } from '@/routes/analytics';
import { HistoryPage } from '@/routes/history';
import { ServiceOpsPage } from '@/routes/service-ops';
import { SettingsPage } from '@/routes/settings';
import { renderWithProviders } from '@/test/render';

const mocks = vi.hoisted(() => ({
  analytics: {
    historyCount: 9,
    summaryCount: 6,
    totalMessages: 41,
    averageSatisfaction: 4.6,
    statusBreakdown: [
      { label: 'ended', value: 5 },
      { label: 'open', value: 3 },
      { label: 'transferred', value: 1 },
    ],
    channelBreakdown: [
      { label: 'web', value: 4 },
      { label: 'app', value: 3 },
      { label: 'h5', value: 2 },
    ],
    recentItems: [
      {
        id: 501,
        customer_profile_id: 12,
        channel: 'web',
        status: 'ended',
        last_message_at: '2026-04-07T03:15:00.000Z',
        message_count: 6,
        satisfaction_score: 5,
        ai_summary: '退款场景已完成自动回答并记录工单。',
      },
    ],
    lastRefreshedAt: '2026-04-07T03:20:00.000Z',
    conversationAnalytics: {
      window_days: 7,
      trend: [
        { date: '2026-04-06', created_count: 4, ended_count: 3, transferred_count: 1, average_duration_minutes: 12, summary_coverage_rate: 75, satisfaction_coverage_rate: 50 },
        { date: '2026-04-07', created_count: 5, ended_count: 4, transferred_count: 2, average_duration_minutes: 18, summary_coverage_rate: 80, satisfaction_coverage_rate: 60 },
      ],
      status_distribution: [
        { label: 'ended', value: 5 },
        { label: 'open', value: 3 },
      ],
      channel_distribution: [
        { label: 'web', value: 4 },
        { label: 'app', value: 3 },
      ],
      duration: { count: 9, average_minutes: 15, max_minutes: 44 },
      hit_rate: { summary_coverage_rate: 72, satisfaction_coverage_rate: 55, satisfaction_high_score_rate: 88 },
      last_refreshed_at: '2026-04-07T03:20:00.000Z',
    },
    serviceAnalytics: {
      window_days: 7,
      trend: [
        { date: '2026-04-06', ticket_count: 3, leave_message_count: 2, open_ticket_count: 2, pending_leave_message_count: 1, average_ticket_age_minutes: 90, average_leave_message_age_minutes: 45 },
        { date: '2026-04-07', ticket_count: 4, leave_message_count: 1, open_ticket_count: 1, pending_leave_message_count: 1, average_ticket_age_minutes: 60, average_leave_message_age_minutes: 20 },
      ],
      distribution: {
        ticket_status: [{ label: 'open', value: 2 }, { label: 'resolved', value: 1 }],
        ticket_priority: [{ label: 'high', value: 1 }, { label: 'normal', value: 2 }],
        ticket_source: [{ label: 'web', value: 2 }],
        leave_message_status: [{ label: 'pending', value: 1 }],
        leave_message_source: [{ label: 'h5', value: 1 }],
      },
      duration: {
        ticket_count: 3,
        leave_message_count: 1,
        open_ticket_average_age_minutes: 72,
        pending_leave_message_average_age_minutes: 24,
        oldest_ticket_age_minutes: 120,
        oldest_leave_message_age_minutes: 24,
      },
      hit_rate: { ticket_assignment_rate: 80, sla_compliance_rate: 66, leave_assignment_rate: 100 },
      last_refreshed_at: '2026-04-07T03:20:00.000Z',
    },
    transferTrend: [
      { label: '04-06', value: 1 },
      { label: '04-07', value: 2 },
    ],
    ticketPriorityBreakdown: [{ label: 'high', value: 1 }],
    leaveSourceBreakdown: [{ label: 'h5', value: 1 }],
  },
  historyItems: [
    {
      id: 301,
      customer_profile_id: 91,
      channel: 'app',
      assignee: 'agent-a',
      status: 'open',
      summary: '用户询问退款到账进度',
      last_message_at: '2026-04-07T03:10:00.000Z',
      created_at: '2026-04-07T02:50:00.000Z',
    },
  ],
  conversationSummary: {
    conversation_id: 301,
    ai_summary: '用户咨询退款到账时效，建议查看流程说明。',
    message_count: 4,
    last_message_at: '2026-04-07T03:10:00.000Z',
    satisfaction_score: 4,
  },
  channelApps: {
    items: [
      {
        id: 8,
        name: '官网 H5',
        code: 'official_h5',
        base_url: 'https://support.example.com',
        is_active: true,
      },
      {
        id: 9,
        name: 'App 内嵌 H5',
        code: 'app_h5',
        base_url: 'https://app.example.com/service',
        is_active: false,
      },
    ],
  },
  generatedLink: {
    channel_app_id: 8,
    path: '/service/refund',
    h5_url: 'https://support.example.com/service/refund',
  },
  tickets: [
    {
      id: 11,
      title: '退款工单',
      status: 'open',
      priority: 'high',
      source: 'web',
      customer_profile_id: 18,
      conversation_id: 301,
      assignee: 'agent-a',
      assignee_group: '售后组',
      summary: '用户咨询退款到账时效',
      sla_due_at: '2026-04-07T05:00:00.000Z',
      created_at: '2026-04-07T01:20:00.000Z',
      updated_at: '2026-04-07T03:00:00.000Z',
    },
  ],
  leaveMessages: [
    {
      id: 21,
      visitor_name: '林雨',
      phone: '13800000000',
      email: 'lin@example.com',
      source: 'h5',
      status: 'pending',
      subject: '售后回访',
      content: '麻烦回访退款进度',
      assigned_group: '客服一组',
      created_at: '2026-04-07T01:00:00.000Z',
      updated_at: '2026-04-07T02:30:00.000Z',
    },
  ],
  mutations: {
    generateH5Link: {
      data: null,
      isPending: false,
      isError: false,
      mutateAsync: vi.fn().mockResolvedValue(undefined),
    },
    createTicket: { data: null, isPending: false, isError: false, mutateAsync: vi.fn() },
    updateTicket: { data: null, isPending: false, isError: false, mutateAsync: vi.fn() },
    createLeaveMessage: { data: null, isPending: false, isError: false, mutateAsync: vi.fn() },
    updateLeaveMessage: { data: null, isPending: false, isError: false, mutateAsync: vi.fn() },
  },
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/hooks/use-platform-api', () => ({
  useAnalytics: () => ({ data: mocks.analytics, isLoading: false, isError: false }),
  useConversationHistory: () => ({ data: mocks.historyItems, isLoading: false, isError: false }),
  useConversationSummary: (conversationId: number | null) => ({
    data: conversationId === 301 ? mocks.conversationSummary : null,
    isLoading: false,
    isError: false,
  }),
  useChannelApps: () => ({ data: mocks.channelApps, isLoading: false, isError: false }),
  useGenerateH5Link: () => mocks.mutations.generateH5Link,
  useTickets: () => ({ data: mocks.tickets, isLoading: false, isError: false }),
  useLeaveMessages: () => ({ data: mocks.leaveMessages, isLoading: false, isError: false }),
  useCreateTicket: () => mocks.mutations.createTicket,
  useUpdateTicket: () => mocks.mutations.updateTicket,
  useCreateLeaveMessage: () => mocks.mutations.createLeaveMessage,
  useUpdateLeaveMessage: () => mocks.mutations.updateLeaveMessage,
}));

describe('backend enhancement pages', () => {
  it('renders analytics summary and operational actions', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AnalyticsPage />);

    expect(await screen.findByText('会话分析')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '仅会话' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '仅服务' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看会话历史' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '查看工单列表' }).length).toBeGreaterThan(0);
    expect(screen.getByText('近 7 天会话趋势')).toBeInTheDocument();
    expect(screen.getByText('工单优先级分布')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '报表中心' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '质检评分' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '视频客服' })).toBeInTheDocument();
    expect(screen.getByText('运营摘要')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '仅会话' }));
    expect(screen.getByText('会话状态分布')).toBeInTheDocument();
    expect(screen.queryByText('工单优先级分布')).not.toBeInTheDocument();
  });

  it('renders history details and next-step panel', async () => {
    renderWithProviders(<HistoryPage />);

    expect(await screen.findByText('会话历史')).toBeInTheDocument();
    expect(screen.getByText('会话画像')).toBeInTheDocument();
    expect(screen.getByText('建议动作')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '转工单处理' })).toBeInTheDocument();
    expect(screen.getByText('用户询问退款到账时效')).toBeInTheDocument();
  });

  it('renders settings preview and quick operation summary', async () => {
    renderWithProviders(<SettingsPage />);

    expect(await screen.findByText('渠道和 H5 链接')).toBeInTheDocument();
    expect(screen.getByText('渠道摘要')).toBeInTheDocument();
    expect(screen.getByText('操作面板')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成 H5 链接' })).toBeInTheDocument();
    expect(screen.getByText('常用路径')).toBeInTheDocument();
  });

  it('renders service operations summary and response panels', async () => {
    renderWithProviders(<ServiceOpsPage />);

    expect(await screen.findByText('服务运营台')).toBeInTheDocument();
    expect(screen.getByText('运营摘要')).toBeInTheDocument();
    expect(screen.getByText('处理建议')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '创建工单' })).toBeInTheDocument();
    expect(screen.getByText('当前选中工单')).toBeInTheDocument();
    expect(screen.getByText('当前选中留言')).toBeInTheDocument();
    expect(within(screen.getByText('当前处理建议').closest('section') ?? document.body).getByText('建议先补充处理步骤')).toBeInTheDocument();
  });
});
