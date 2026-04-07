import type { AnchorHTMLAttributes } from 'react';

import { renderWithProviders } from '@/test/render';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoServicePage } from '@/routes/video-service';

const mocks = vi.hoisted(() => ({
  startSession: vi.fn(),
  endSession: vi.fn(),
  createSnapshot: vi.fn(),
  transferTicket: vi.fn(),
  uploadRecording: vi.fn(),
  saveSummary: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  updateRetention: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/hooks/use-video-call', () => ({
  useVideoCall: () => ({
    localVideoRef: { current: null },
    remoteVideoRef: { current: null },
    connectionState: 'connected',
    recordingState: 'idle',
    error: null,
    connect: mocks.connect,
    disconnect: mocks.disconnect,
    startRecording: mocks.startRecording,
    stopRecording: mocks.stopRecording,
  }),
}));

vi.mock('@/hooks/use-platform-api', () => ({
  useConversations: () => ({
    data: [{ id: 11, customer_profile_id: 1, channel: 'web', assignee: 'agent-video', status: 'open', ended_at: null, created_at: '', updated_at: '' }],
    isLoading: false,
    isError: false,
  }),
  useCustomers: () => ({
    data: [{ id: 1, external_id: 'c-1', name: '张晓晴', email: 'zhang@example.com', phone: '13800000000', status: 'vip', created_at: '', updated_at: '', tags: [] }],
    isLoading: false,
    isError: false,
  }),
  useTickets: () => ({
    data: [{ id: 21, title: '视频工单', status: 'open', priority: 'high', source: 'video', customer_profile_id: 1, conversation_id: 11, assignee: 'agent-video', assignee_group: '视频客服', summary: '已转工单', sla_due_at: null, created_at: '', updated_at: '' }],
    isLoading: false,
    isError: false,
  }),
  useVideoSessions: () => ({
    data: [{
      id: 31,
      customer_profile_id: 1,
      conversation_id: 11,
      assignee: 'agent-video',
      status: 'active',
      ticket_id: 21,
      ai_summary: 'AI 已生成会后摘要',
      operator_summary: '人工已确认订单信息',
      issue_category: 'refund',
      resolution: '等待财务回访',
      next_action: '24 小时内回访',
      handoff_reason: '财务确认到账',
      follow_up_required: true,
      summary_updated_at: '2026-04-07T06:00:00.000Z',
      started_at: '2026-04-07T05:30:00.000Z',
      ended_at: null,
      ended_reason: null,
      created_at: '2026-04-07T05:30:00.000Z',
      updated_at: '2026-04-07T06:00:00.000Z',
      snapshot_count: 1,
      latest_snapshot_at: '2026-04-07T05:40:00.000Z',
      recording_count: 1,
      latest_recording_at: '2026-04-07T05:50:00.000Z',
    }],
    isLoading: false,
    isError: false,
  }),
  useCurrentVideoSession: () => ({ data: null, isLoading: false, isError: false }),
  useVideoSnapshots: () => ({
    data: [{ id: 41, session_id: 31, label: '抓拍 1', note: '客户展示订单号', created_at: '2026-04-07T05:40:00.000Z' }],
    isLoading: false,
    isError: false,
  }),
  useVideoRecordings: (_sessionId?: number | null, retentionState?: 'retained' | 'deleted' | 'all') => ({
    data:
      retentionState === 'deleted'
        ? [{ id: 52, session_id: 31, entry_type: 'recording', label: '已删除录制 10:05', note: '待合规复核', file_key: 'recordings/32.webm', file_name: '32.webm', mime_type: 'video/webm', duration_seconds: 9, playback_url: '/video/recordings/52/playback', recorded_at: '2026-04-07T05:55:00.000Z', created_at: '2026-04-07T05:55:00.000Z', retention_state: 'deleted', retention_reason: '由坐席端标记删除', retained_at: '2026-04-07T05:56:00.000Z', deleted_at: '2026-04-07T05:56:00.000Z' }]
        : [{ id: 51, session_id: 31, entry_type: 'recording', label: '浏览器录制 10:00', note: '用于回放', file_key: 'recordings/31.webm', file_name: '31.webm', mime_type: 'video/webm', duration_seconds: 12, playback_url: '/video/recordings/51/playback', recorded_at: '2026-04-07T05:50:00.000Z', created_at: '2026-04-07T05:50:00.000Z', retention_state: 'retained', retention_reason: null, retained_at: '2026-04-07T05:50:00.000Z', deleted_at: null }],
    isLoading: false,
    isError: false,
  }),
  useVideoSessionSummary: () => ({
    data: {
      id: 31,
      customer_profile_id: 1,
      conversation_id: 11,
      assignee: 'agent-video',
      status: 'active',
      ticket_id: 21,
      ai_summary: 'AI 已生成会后摘要',
      operator_summary: '人工已确认订单信息',
      issue_category: 'refund',
      resolution: '等待财务回访',
      next_action: '24 小时内回访',
      handoff_reason: '财务确认到账',
      follow_up_required: true,
      summary_updated_at: '2026-04-07T06:00:00.000Z',
      started_at: '2026-04-07T05:30:00.000Z',
      ended_at: null,
      ended_reason: null,
      created_at: '2026-04-07T05:30:00.000Z',
      updated_at: '2026-04-07T06:00:00.000Z',
      snapshot_count: 1,
      latest_snapshot_at: '2026-04-07T05:40:00.000Z',
      recording_count: 1,
      latest_recording_at: '2026-04-07T05:50:00.000Z',
    },
    isLoading: false,
    isError: false,
  }),
  useStartVideoSession: () => ({ mutateAsync: mocks.startSession, isPending: false }),
  useEndVideoSession: () => ({ mutateAsync: mocks.endSession, isPending: false }),
  useCreateVideoSnapshot: () => ({ mutateAsync: mocks.createSnapshot, isPending: false }),
  useTransferVideoSessionTicket: () => ({ mutateAsync: mocks.transferTicket, isPending: false }),
  useUploadVideoRecording: () => ({ mutateAsync: mocks.uploadRecording, isPending: false }),
  useUpsertVideoSessionSummary: () => ({ mutateAsync: mocks.saveSummary, isPending: false }),
  useUpdateVideoRecordingRetention: () => ({ mutateAsync: mocks.updateRetention, isPending: false }),
}));

describe('VideoServicePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders video call workspace with playback and summary form', async () => {
    renderWithProviders(<VideoServicePage />);

    expect(await screen.findByRole('heading', { name: '视频客服' })).toBeInTheDocument();
    expect(screen.getByText('1v1 WebRTC')).toBeInTheDocument();
    expect(screen.getByText('录制回放')).toBeInTheDocument();
    expect(screen.getByText('会后摘要与抓拍')).toBeInTheDocument();
    expect(screen.getByDisplayValue('人工已确认订单信息')).toBeInTheDocument();
  });

  it('invokes signaling and summary actions', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VideoServicePage />);

    await user.click(await screen.findByRole('button', { name: '发起 1v1 通话' }));
    expect(mocks.connect).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: '开始录制' }));
    expect(mocks.startRecording).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: '抓拍记录' }));
    expect(mocks.createSnapshot).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: '转工单' }));
    expect(mocks.transferTicket).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: '保存会后摘要' }));
    expect(mocks.saveSummary).toHaveBeenCalledTimes(1);
  });

  it('supports playback governance filters and delete-retain actions', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VideoServicePage />);

    expect(await screen.findByRole('heading', { name: '视频客服' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '删除回放' }));
    expect(mocks.updateRetention).toHaveBeenCalledWith({
      recordingId: 51,
      payload: { retention_state: 'deleted', reason: '由坐席端标记删除' },
    });

    const deletedRecordings = await screen.findAllByText('已删除录制 10:05');
    expect(deletedRecordings.length).toBeGreaterThanOrEqual(1);
    await user.click(screen.getByRole('button', { name: '保留回放' }));
    expect(mocks.updateRetention).toHaveBeenCalledWith({
      recordingId: 52,
      payload: { retention_state: 'retained', reason: undefined },
    });
  });
});
