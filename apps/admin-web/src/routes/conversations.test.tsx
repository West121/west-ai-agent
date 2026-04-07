import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';

import { ConversationsPage } from '@/routes/conversations';
import { renderWithProviders } from '@/test/render';

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('ConversationsPage', () => {
  it('closes the transfer, end, summary refresh, and satisfaction viewing workflow', async () => {
    let assignee = 'agent-a';
    let status = 'open';
    let endedAt: string | null = null;
    let summaryRequestCount = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const { pathname } = new URL(url, 'http://localhost:8000');

      if (method === 'GET' && pathname === '/conversation/conversations') {
        return jsonResponse([
          {
            id: 101,
            customer_profile_id: 9,
            channel: 'web',
            assignee,
            status,
            ended_at: endedAt,
            created_at: '2026-04-06T09:00:00.000Z',
            updated_at: '2026-04-06T10:00:00.000Z',
          },
        ]);
      }

      if (method === 'GET' && pathname === '/customer/profiles') {
        return jsonResponse([
          {
            id: 9,
            external_id: 'cust-9',
            name: '杭州来电用户',
            email: null,
            phone: null,
            status: 'active',
            created_at: '2026-04-01T09:00:00.000Z',
            updated_at: '2026-04-06T10:00:00.000Z',
            tags: [],
          },
        ]);
      }

      if (method === 'GET' && pathname === '/conversation/conversations/101/summary') {
        summaryRequestCount += 1;
        return jsonResponse({
          conversation_id: 101,
          ai_summary:
            summaryRequestCount >= 3 ? '人工接管后已更新摘要' : '初始摘要',
          message_count: summaryRequestCount >= 3 ? 6 : 4,
          last_message_at: '2026-04-06T10:05:00.000Z',
          satisfaction_score: 4,
        });
      }

      if (method === 'GET' && pathname === '/conversation/conversations/101/satisfaction') {
        return jsonResponse({
          conversation_id: 101,
          score: 4,
          comment: '客服响应及时',
          created_at: '2026-04-06T10:01:00.000Z',
          updated_at: '2026-04-06T10:02:00.000Z',
        });
      }

      if (method === 'POST' && pathname === '/conversation/conversations/101/transfer') {
        const body = JSON.parse(String(init?.body ?? '{}')) as { assignee?: string; reason?: string };
        expect(body).toEqual({ assignee: 'agent-b', reason: '升级到人工复核' });
        assignee = body.assignee ?? assignee;
        status = 'transferred';
        return jsonResponse({
          id: 101,
          customer_profile_id: 9,
          channel: 'web',
          assignee,
          status,
          ended_at: endedAt,
          created_at: '2026-04-06T09:00:00.000Z',
          updated_at: '2026-04-06T10:10:00.000Z',
        });
      }

      if (method === 'POST' && pathname === '/conversation/conversations/101/end') {
        const body = JSON.parse(String(init?.body ?? '{}')) as { reason?: string };
        expect(body).toEqual({ reason: '用户确认问题已解决' });
        status = 'ended';
        endedAt = '2026-04-06T10:12:00.000Z';
        return jsonResponse({
          id: 101,
          customer_profile_id: 9,
          channel: 'web',
          assignee,
          status,
          ended_at: endedAt,
          created_at: '2026-04-06T09:00:00.000Z',
          updated_at: '2026-04-06T10:12:00.000Z',
        });
      }

      throw new Error(`Unhandled request: ${method} ${pathname}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<ConversationsPage />);

    expect(await screen.findByText('会话工作台')).toBeInTheDocument();
    expect(await screen.findByText('客服响应及时')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('转接到'));
    await userEvent.type(screen.getByLabelText('转接到'), 'agent-b');
    await userEvent.type(screen.getByLabelText('处理备注'), '升级到人工复核');
    await userEvent.click(screen.getByRole('button', { name: '转接会话' }));

    await waitFor(() => {
      expect(screen.getByText('transferred')).toBeInTheDocument();
      expect(screen.getByText('agent-b')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: '刷新摘要' }));
    expect(await screen.findByText('人工接管后已更新摘要')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('处理备注'));
    await userEvent.type(screen.getByLabelText('处理备注'), '用户确认问题已解决');
    await userEvent.click(screen.getByRole('button', { name: '结束会话' }));

    await waitFor(() => {
      expect(screen.getAllByText('ended').length).toBeGreaterThan(0);
      expect(screen.getByText('2026/04/06 18:12')).toBeInTheDocument();
    });
  });
});
