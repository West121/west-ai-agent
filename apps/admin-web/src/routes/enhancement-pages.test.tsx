import type { AnchorHTMLAttributes } from 'react';

import { screen } from '@testing-library/react';

import { ExportManagementPage } from '@/routes/export-management';
import { QualityReviewPage } from '@/routes/quality-review';
import { ReportCenterPage } from '@/routes/report-center';
import { renderWithProviders } from '@/test/render';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/hooks/use-platform-api', () => ({
  useDashboardSummary: () => ({
    data: {
      customerCount: 12,
      knowledgeCount: 4,
      channelCount: 2,
      conversationCount: 8,
      activeChannelCount: 1,
      draftKnowledgeCount: 1,
      publishedKnowledgeCount: 3,
      openConversationCount: 2,
      topKnowledgeDocuments: [{ id: 1, title: '退款说明', status: 'published', category: '售后', type: 'faq', version: 1, publish_version: 1 }],
      topConversations: [{ id: 11, channel: 'web', assignee: 'agent-1', status: 'ended' }],
      topChannels: [{ id: 1, name: '官网 H5', code: 'web-h5', is_active: true, base_url: 'https://example.com' }],
      lastRefreshedAt: '2026-04-07T04:00:00.000Z',
    },
    isLoading: false,
    isError: false,
  }),
  useAnalytics: () => ({
    data: {
      averageSatisfaction: 4.7,
      totalMessages: 88,
      historyCount: 6,
      summaryCount: 5,
      statusBreakdown: [{ label: 'ended', value: 4 }],
      channelBreakdown: [{ label: 'web', value: 3 }],
      recentItems: [{ id: 11, customer_profile_id: 1, channel: 'web', status: 'ended', last_message_at: '2026-04-07T04:00:00.000Z', message_count: 8, satisfaction_score: 5, ai_summary: '退款说明已命中。' }],
      lastRefreshedAt: '2026-04-07T04:00:00.000Z',
      conversationAnalytics: {
        window_days: 7,
        trend: [
          { date: '2026-04-06', created_count: 3, ended_count: 2, transferred_count: 1, average_duration_minutes: 12, summary_coverage_rate: 70, satisfaction_coverage_rate: 40 },
          { date: '2026-04-07', created_count: 4, ended_count: 3, transferred_count: 2, average_duration_minutes: 18, summary_coverage_rate: 75, satisfaction_coverage_rate: 50 },
        ],
        status_distribution: [{ label: 'ended', value: 4 }, { label: 'open', value: 2 }],
        channel_distribution: [{ label: 'web', value: 3 }, { label: 'h5', value: 2 }],
        duration: { count: 6, average_minutes: 15, max_minutes: 40 },
        hit_rate: { summary_coverage_rate: 80, satisfaction_coverage_rate: 50, satisfaction_high_score_rate: 90 },
        last_refreshed_at: '2026-04-07T04:00:00.000Z',
      },
      serviceAnalytics: {
        window_days: 7,
        trend: [
          { date: '2026-04-06', ticket_count: 2, leave_message_count: 1, open_ticket_count: 1, pending_leave_message_count: 1, average_ticket_age_minutes: 80, average_leave_message_age_minutes: 30 },
          { date: '2026-04-07', ticket_count: 3, leave_message_count: 1, open_ticket_count: 1, pending_leave_message_count: 1, average_ticket_age_minutes: 60, average_leave_message_age_minutes: 24 },
        ],
        distribution: {
          ticket_status: [{ label: 'open', value: 1 }, { label: 'resolved', value: 1 }],
          ticket_priority: [{ label: 'high', value: 1 }, { label: 'normal', value: 1 }],
          ticket_source: [{ label: 'web', value: 2 }],
          leave_message_status: [{ label: 'pending', value: 1 }],
          leave_message_source: [{ label: 'h5', value: 1 }],
        },
        duration: {
          ticket_count: 2,
          leave_message_count: 1,
          open_ticket_average_age_minutes: 60,
          pending_leave_message_average_age_minutes: 24,
          oldest_ticket_age_minutes: 90,
          oldest_leave_message_age_minutes: 24,
        },
        hit_rate: { ticket_assignment_rate: 100, sla_compliance_rate: 50, leave_assignment_rate: 0 },
        last_refreshed_at: '2026-04-07T04:00:00.000Z',
      },
      transferTrend: [{ label: '04-06', value: 1 }],
      ticketPriorityBreakdown: [{ label: 'high', value: 1 }],
      leaveSourceBreakdown: [{ label: 'h5', value: 1 }],
    },
    isLoading: false,
    isError: false,
  }),
  useTickets: () => ({
    data: [
      { id: 1, title: '退款单', status: 'open', priority: 'high', source: 'web', customer_profile_id: 1, conversation_id: 11, assignee: 'agent-1', assignee_group: '售后', summary: '', sla_due_at: null, created_at: '', updated_at: '' },
      { id: 2, title: '发票单', status: 'resolved', priority: 'normal', source: 'app', customer_profile_id: 2, conversation_id: null, assignee: 'agent-2', assignee_group: '财务', summary: '', sla_due_at: null, created_at: '', updated_at: '' },
    ],
    isLoading: false,
    isError: false,
  }),
  useLeaveMessages: () => ({
    data: [{ id: 1, visitor_name: '张三', phone: null, email: null, source: 'h5', status: 'pending', subject: '退款', content: '', assigned_group: null, created_at: '', updated_at: '' }],
    isLoading: false,
    isError: false,
  }),
  useKnowledgeDocuments: () => ({
    data: [
      { id: 1, tenant_id: 'tenant-1', type: 'faq', title: '退款说明', source_kind: 'imported', status: 'published', category: '售后', tags: ['退款'], language: 'zh-CN', channels: ['web'], version: 1, publish_version: 1, content: '', index_status: 'completed', indexed_chunk_count: 1, last_indexed_at: null, last_index_task_id: null, last_index_error: null, last_index_result: null, imported_at: null, published_at: null, created_at: '', updated_at: '' },
    ],
    isLoading: false,
    isError: false,
  }),
  useConversationHistory: () => ({
    data: [{ id: 11, customer_profile_id: 1, status: 'ended', assignee: 'agent-1', channel: 'web', summary: '退款摘要', last_message_at: '2026-04-07T04:00:00.000Z', created_at: '', ended_at: '' }],
    isLoading: false,
    isError: false,
  }),
  useExportTasks: () => ({
    data: [
      {
        id: 1,
        name: '工单与留言日报',
        source_kind: 'tickets',
        format: 'csv',
        status: 'completed',
        row_count: 2,
        download_url: 'http://localhost:8000/exporting/tasks/1/download',
        last_error: null,
        started_at: '2026-04-07T03:00:00.000Z',
        completed_at: '2026-04-07T03:05:00.000Z',
        created_at: '2026-04-07T03:00:00.000Z',
        updated_at: '2026-04-07T03:05:00.000Z',
      },
    ],
    isLoading: false,
    isError: false,
  }),
  useExportTask: (taskId: number | null) => ({
    data:
      taskId === 1
        ? {
            id: 1,
            name: '工单与留言日报',
            source_kind: 'tickets',
            format: 'csv',
            status: 'completed',
            row_count: 2,
            download_url: 'http://localhost:8000/exporting/tasks/1/download',
            last_error: null,
            started_at: '2026-04-07T03:00:00.000Z',
            completed_at: '2026-04-07T03:05:00.000Z',
            created_at: '2026-04-07T03:00:00.000Z',
            updated_at: '2026-04-07T03:05:00.000Z',
          }
        : null,
    isLoading: false,
    isError: false,
  }),
  useCreateExportTask: () => ({
    data: null,
    isPending: false,
    isError: false,
    mutateAsync: vi.fn().mockResolvedValue({
      id: 2,
      name: '工单与留言日报',
      source_kind: 'tickets',
      format: 'csv',
      status: 'pending',
      row_count: null,
      download_url: null,
      last_error: null,
      started_at: null,
      completed_at: null,
      created_at: '2026-04-07T04:00:00.000Z',
      updated_at: '2026-04-07T04:00:00.000Z',
    }),
  }),
  useExecuteExportTask: () => ({
    data: null,
    isPending: false,
    isError: false,
    mutateAsync: vi.fn().mockResolvedValue({
      id: 1,
      name: '工单与留言日报',
      source_kind: 'tickets',
      format: 'csv',
      status: 'running',
      row_count: 2,
      download_url: null,
      last_error: null,
      started_at: '2026-04-07T04:10:00.000Z',
      completed_at: null,
      created_at: '2026-04-07T03:00:00.000Z',
      updated_at: '2026-04-07T04:10:00.000Z',
    }),
  }),
  useCompleteExportTask: () => ({
    data: null,
    isPending: false,
    isError: false,
    mutateAsync: vi.fn().mockResolvedValue({
      id: 1,
      name: '工单与留言日报',
      source_kind: 'tickets',
      format: 'csv',
      status: 'completed',
      row_count: 2,
      download_url: 'http://localhost:8000/exporting/tasks/1/download',
      last_error: null,
      started_at: '2026-04-07T04:10:00.000Z',
      completed_at: '2026-04-07T04:20:00.000Z',
      created_at: '2026-04-07T03:00:00.000Z',
      updated_at: '2026-04-07T04:20:00.000Z',
    }),
  }),
  useAuthState: () => ({
    data: { isAuthenticated: true, user: { username: 'admin' }, permissions: ['read'] },
    isLoading: false,
    isError: false,
  }),
}));

describe('admin-web enhancement pages', () => {
  it('renders report center metrics and quick actions', () => {
    renderWithProviders(<ReportCenterPage />);
    expect(screen.getByRole('heading', { name: '报表中心' })).toBeInTheDocument();
    expect(screen.getAllByText('客户总量').length).toBeGreaterThan(0);
    expect(screen.getByText('近 7 天工单趋势')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看会话分析' })).toBeInTheDocument();
  });

  it('renders quality review samples and actions', () => {
    renderWithProviders(<QualityReviewPage />);
    expect(screen.getByRole('heading', { name: '质检评分' })).toBeInTheDocument();
    expect(screen.getByText('评分标准')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '发起复核' })).toBeInTheDocument();
  });

  it('renders export management templates and snapshots', () => {
    renderWithProviders(<ExportManagementPage />);
    expect(screen.getByRole('heading', { name: '导出管理' })).toBeInTheDocument();
    expect(screen.getByText('任务总数')).toBeInTheDocument();
    expect(screen.getByText('导出任务列表')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建导出任务' })).toBeInTheDocument();
  });
});
