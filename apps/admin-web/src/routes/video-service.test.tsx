import type { AnchorHTMLAttributes } from 'react';

import { renderWithProviders } from '@/test/render';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoServicePage } from '@/routes/video-service';

type CustomerProfile = {
  id: number;
  external_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  tags: [];
};

type Conversation = {
  id: number;
  customer_profile_id: number;
  channel: string;
  assignee: string | null;
  status: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

type Ticket = {
  id: number;
  title: string;
  status: string;
  priority: string;
  source: string;
  customer_profile_id: number | null;
  conversation_id: number | null;
  assignee: string | null;
  assignee_group: string | null;
  summary: string | null;
  sla_due_at: string | null;
  created_at: string;
  updated_at: string;
};

type VideoSession = {
  id: number;
  customer_profile_id: number;
  conversation_id: number | null;
  assignee: string | null;
  status: string;
  ticket_id: number | null;
  started_at: string;
  ended_at: string | null;
  ended_reason: string | null;
  created_at: string;
  updated_at: string;
  snapshot_count: number;
  latest_snapshot_at: string | null;
};

type VideoSnapshot = {
  id: number;
  session_id: number;
  label: string;
  note: string | null;
  created_at: string;
};

const state = {
  customers: [
    {
      id: 1,
      external_id: 'c-1',
      name: '张晓晴',
      email: 'zhang@example.com',
      phone: '13800000000',
      status: 'vip',
      created_at: '2026-04-07T04:00:00.000Z',
      updated_at: '2026-04-07T04:00:00.000Z',
      tags: [],
    } satisfies CustomerProfile,
  ],
  conversations: [
    {
      id: 11,
      customer_profile_id: 1,
      channel: 'video',
      assignee: 'agent-video',
      status: 'open',
      ended_at: null,
      created_at: '2026-04-07T04:00:00.000Z',
      updated_at: '2026-04-07T04:00:00.000Z',
    } satisfies Conversation,
  ],
  tickets: [] as Ticket[],
  sessions: [] as VideoSession[],
  snapshots: [] as VideoSnapshot[],
};

let nextSessionId = 1;
let nextSnapshotId = 1;
let nextTicketId = 1;

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/platform-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/platform-api')>('@/lib/platform-api');

  return {
    ...actual,
    requestJson: vi.fn(async (path: string, options: { method?: string; body?: unknown } = {}) => {
      const method = (options.method ?? 'GET').toUpperCase();

      if (method === 'GET' && path === '/customer/profiles') {
        return state.customers;
      }

      if (method === 'GET' && path === '/conversation/conversations') {
        return state.conversations;
      }

      if (method === 'GET' && path === '/service/tickets') {
        return { items: state.tickets };
      }

      if (method === 'GET' && path === '/video/sessions') {
        return { items: state.sessions };
      }

      if (method === 'GET' && path === '/video/sessions/current') {
        return state.sessions.find((item) => item.status === 'active') ?? null;
      }

      if (method === 'GET' && path.startsWith('/video/sessions/') && path.endsWith('/snapshots')) {
        const sessionId = Number(path.split('/')[3]);
        return { items: state.snapshots.filter((item) => item.session_id === sessionId) };
      }

      if (method === 'POST' && path === '/video/sessions/start') {
        const body = options.body as { customer_profile_id?: number; conversation_id?: number | null; assignee?: string | null } | undefined;
        const activeSession = state.sessions.find((item) => item.status === 'active');
        if (activeSession) {
          return activeSession;
        }

        const now = new Date().toISOString();
        const session: VideoSession = {
          id: nextSessionId++,
          customer_profile_id: body?.customer_profile_id ?? 1,
          conversation_id: body?.conversation_id ?? 11,
          assignee: body?.assignee ?? 'agent-video',
          status: 'active',
          ticket_id: null,
          started_at: now,
          ended_at: null,
          ended_reason: null,
          created_at: now,
          updated_at: now,
          snapshot_count: 0,
          latest_snapshot_at: null,
        };
        state.sessions.unshift(session);
        return session;
      }

      if (method === 'POST' && path.match(/^\/video\/sessions\/\d+\/end$/)) {
        const sessionId = Number(path.split('/')[3]);
        const session = state.sessions.find((item) => item.id === sessionId);
        if (!session) {
          throw new Error(`session ${sessionId} not found`);
        }
        session.status = 'ended';
        session.ended_at = new Date().toISOString();
        session.updated_at = session.ended_at;
        session.ended_reason = ((options.body as { reason?: string | null } | undefined)?.reason ?? null);
        return session;
      }

      if (method === 'POST' && path.match(/^\/video\/sessions\/\d+\/snapshots$/)) {
        const sessionId = Number(path.split('/')[3]);
        const session = state.sessions.find((item) => item.id === sessionId);
        if (!session) {
          throw new Error(`session ${sessionId} not found`);
        }
        const body = options.body as { label?: string | null; note?: string | null } | undefined;
        const now = new Date().toISOString();
        const snapshot: VideoSnapshot = {
          id: nextSnapshotId++,
          session_id: sessionId,
          label: body?.label?.trim() || `抓拍 ${state.snapshots.filter((item) => item.session_id === sessionId).length + 1}`,
          note: body?.note ?? null,
          created_at: now,
        };
        state.snapshots.unshift(snapshot);
        session.snapshot_count += 1;
        session.latest_snapshot_at = now;
        session.updated_at = now;
        return snapshot;
      }

      if (method === 'POST' && path.match(/^\/video\/sessions\/\d+\/transfer-ticket$/)) {
        const sessionId = Number(path.split('/')[3]);
        const session = state.sessions.find((item) => item.id === sessionId);
        if (!session) {
          throw new Error(`session ${sessionId} not found`);
        }
        if (session.ticket_id) {
          return state.tickets.find((ticket) => ticket.id === session.ticket_id)!;
        }

        const body = options.body as { title?: string; status?: string; priority?: string; source?: string; assignee?: string | null; assignee_group?: string | null; summary?: string | null } | undefined;
        const now = new Date().toISOString();
        const ticket: Ticket = {
          id: nextTicketId++,
          title: body?.title ?? `视频会话 #${sessionId} 工单`,
          status: body?.status ?? 'open',
          priority: body?.priority ?? 'normal',
          source: body?.source ?? 'video',
          customer_profile_id: session.customer_profile_id,
          conversation_id: session.conversation_id,
          assignee: body?.assignee ?? session.assignee,
          assignee_group: body?.assignee_group ?? '视频客服',
          summary: body?.summary ?? '由视频客服抓拍后转工单',
          sla_due_at: null,
          created_at: now,
          updated_at: now,
        };
        state.tickets.unshift(ticket);
        session.ticket_id = ticket.id;
        session.updated_at = now;
        return ticket;
      }

      throw new Error(`Unhandled request ${method} ${path}`);
    }),
  };
});

vi.mock('@/hooks/use-platform-api', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/use-platform-api')>('@/hooks/use-platform-api');
  return actual;
});

describe('VideoServicePage', () => {
  beforeEach(() => {
    state.tickets = [];
    state.sessions = [];
    state.snapshots = [];
    nextSessionId = 1;
    nextSnapshotId = 1;
    nextTicketId = 1;
  });

  it('starts, captures, transfers, and ends a video service session', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VideoServicePage />);

    await screen.findByRole('button', { name: '开始视频服务' });
    await user.click(screen.getByRole('button', { name: '开始视频服务' }));
    await waitFor(() => expect(screen.getByText('当前状态：active')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: '抓拍记录' }));
    await waitFor(() => expect(screen.getByText('已创建抓拍记录「抓拍 1」')).toBeInTheDocument());
    expect(screen.getByText('共 1 条')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '转工单' }));
    await waitFor(() => expect(screen.getByText(/已转工单 #1/)).toBeInTheDocument());
    expect(screen.getByText('视频会话 #1 工单')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '结束服务' }));
    await waitFor(() => expect(screen.getByText('当前状态：ended')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: '开始视频服务' })).toBeInTheDocument());
  });
});
