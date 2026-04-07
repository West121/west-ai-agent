import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ChatWorkspace } from '@/components/chat-workspace';
import * as customerApi from '@/lib/customer-h5-api';
import * as gatewayHook from '@/hooks/use-message-gateway';

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router');
  return {
    ...actual,
    Link: ({
      children,
      to,
      ...props
    }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: React.PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('ChatWorkspace', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(gatewayHook, 'useMessageGateway').mockReturnValue({
      status: 'open',
      error: null,
      ack: {
        type: 'connection.ack',
        conversation_id: '2001',
        client_id: 'customer-h5-test',
        role: 'customer',
      },
      messages: [
        {
          id: 'agent-msg-1',
          conversationId: '2001',
          senderId: 'agent-1',
          senderRole: 'agent',
          text: '您好，请问需要什么帮助？',
          createdAt: '2026-04-06T10:00:00.000Z',
          status: 'sent',
          ackedBy: null,
          ackedAt: null,
        },
      ],
      sendMessage: vi.fn(),
      sendAck: vi.fn(),
    });

    vi.spyOn(customerApi, 'createCustomerProfile').mockResolvedValue({
      id: 101,
      external_id: 'visitor-101',
      name: '匿名访客',
      email: null,
      phone: null,
      status: 'active',
      created_at: '2026-04-06T10:00:00.000Z',
      updated_at: '2026-04-06T10:00:00.000Z',
      tags: [],
    });
    vi.spyOn(customerApi, 'createConversation').mockResolvedValue({
      id: 2001,
      customer_profile_id: 101,
      assignee: null,
      status: 'open',
      ended_at: null,
      created_at: '2026-04-06T10:00:00.000Z',
      updated_at: '2026-04-06T10:00:00.000Z',
    });
    vi.spyOn(customerApi, 'getConversationMessages').mockResolvedValue({
      conversation_id: '2001',
      items: [],
    });
    vi.spyOn(customerApi, 'getConversationSummary').mockResolvedValue({
      conversation_id: 2001,
      status: 'open',
      summary: '当前会话正常进行中。',
    });
    vi.spyOn(customerApi, 'submitConversationSatisfaction').mockResolvedValue(undefined);
    vi.spyOn(customerApi, 'appendConversationMessage').mockResolvedValue({
      id: 'ai-msg-1',
      conversation_id: '2001',
      sender_id: 'ai-bot',
      sender_role: 'assistant',
      text: '一般情况下原路退款会在 1 到 3 个工作日到账。',
      status: 'sent',
      created_at: '2026-04-06T10:00:01.000Z',
      acked_by: null,
      acked_at: null,
    });
  });

  it('shows AI answer advice after sending a customer message', async () => {
    const requestAiDecision = vi.spyOn(customerApi, 'requestAiDecision').mockResolvedValue({
      query: '退款多久到账？',
      decision: 'clarify',
      answer: null,
      clarification: '请补充订单号和手机号。',
      workflow_mode: 'langgraph',
      confidence: 0.78,
    });

    render(<ChatWorkspace mode="standalone" />, { wrapper: createWrapper() });

    await userEvent.click(screen.getByRole('button', { name: '创建并连接会话' }));

    const input = await screen.findByLabelText('message');
    await userEvent.type(input, '退款多久到账？');
    await userEvent.click(screen.getByRole('button', { name: '发送消息' }));

    await waitFor(() => {
      expect(requestAiDecision).toHaveBeenCalledWith({
        query: '退款多久到账？',
        endpoint: 'triage',
      });
    });

    expect(await screen.findByText('AI 建议')).toBeInTheDocument();
    expect(await screen.findByText(/流程 langgraph/)).toBeInTheDocument();
    expect(await screen.findByText(/AI 需要更多信息/)).toBeInTheDocument();
  });

  it('shows handoff guidance when AI confidence is low', async () => {
    vi.spyOn(customerApi, 'requestAiDecision').mockResolvedValue({
      query: '这个售后问题很复杂',
      decision: 'handoff',
      answer: null,
      clarification: null,
      confidence: 0.41,
      retrieval_summary: {
        top_score: 0.41,
        matched_count: 1,
        matched_documents: [],
      },
    });

    render(<ChatWorkspace mode="standalone" />, { wrapper: createWrapper() });

    await userEvent.click(screen.getByRole('button', { name: '创建并连接会话' }));

    const input = await screen.findByLabelText('message');
    await userEvent.type(input, '这个售后问题很复杂');
    await userEvent.click(screen.getByRole('button', { name: '发送消息' }));

    const notices = await screen.findAllByText('建议转人工继续处理当前问题。');
    expect(notices.length).toBeGreaterThan(0);
    expect(screen.getByText('AI 建议')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '留言' })).toBeInTheDocument();
  });

  it('routes refund-like issues to langgraph triage flow', async () => {
    const requestAiDecision = vi.spyOn(customerApi, 'requestAiDecision').mockResolvedValue({
      query: '退款不到账，订单号 123456 手机号 13800000000',
      decision: 'handoff',
      answer: null,
      clarification: null,
      workflow_mode: 'langgraph',
      confidence: 0.91,
    });

    render(<ChatWorkspace mode="standalone" />, { wrapper: createWrapper() });

    await userEvent.click(screen.getByRole('button', { name: '创建并连接会话' }));

    const input = await screen.findByLabelText('message');
    await userEvent.type(input, '退款不到账，订单号 123456 手机号 13800000000');
    await userEvent.click(screen.getByRole('button', { name: '发送消息' }));

    await waitFor(() => {
      expect(requestAiDecision).toHaveBeenCalledWith({
        query: '退款不到账，订单号 123456 手机号 13800000000',
        endpoint: 'triage',
      });
    });

    expect(await screen.findByText(/流程 langgraph/)).toBeInTheDocument();
  });
});
