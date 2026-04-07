import type { AnchorHTMLAttributes } from 'react';

import { screen } from '@testing-library/react';

import { ExportManagementPage } from '@/routes/export-management';
import { QualityReviewPage } from '@/routes/quality-review';
import { ReportCenterPage } from '@/routes/report-center';
import { VideoServicePage } from '@/routes/video-service';
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
      lastRefreshedAt: '2026-04-07T04:00:00.000Z',
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
  useConversations: () => ({
    data: [{ id: 11, customer_profile_id: 1, channel: 'video', assignee: 'agent-1', status: 'active', ended_at: null, created_at: '', updated_at: '' }],
    isLoading: false,
    isError: false,
  }),
  useCustomers: () => ({
    data: [{ id: 1, external_id: 'c-1', name: '张晓晴', email: 'zhang@example.com', phone: '13800000000', status: 'vip', created_at: '', updated_at: '', tags: [] }],
    isLoading: false,
    isError: false,
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
    expect(screen.getAllByText('开放工单').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: '导出管理' })).toBeInTheDocument();
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
    expect(screen.getByText('导出任务模板')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建导出任务' })).toBeInTheDocument();
  });

  it('renders video service stage and session cards', () => {
    renderWithProviders(<VideoServicePage />);
    expect(screen.getByRole('heading', { name: '视频客服' })).toBeInTheDocument();
    expect(screen.getByText('主视频舞台')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始视频服务' })).toBeInTheDocument();
  });
});
