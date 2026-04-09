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
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          query: '退款多久到账？',
          decision: 'clarify',
          answer: null,
          clarification: '请补充订单号和手机号。',
          workflow_mode: 'langgraph',
          flow_category: 'refund',
          next_action: 'collect_slot',
          next_prompt: '退款流程还差 订单号、手机号，补齐后即可转人工或继续处理。',
          confidence: 0.78,
          merged_slots: {
            issue_category: 'refund',
          },
          required_slots: ['order_id', 'contact_phone'],
          missing_slots: ['order_id', 'contact_phone'],
          graph_trace: ['langgraph:classify:refund', 'langgraph:extract_slots'],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<ChatWorkspace mode="standalone" />, { wrapper: createWrapper() });

    await userEvent.click(screen.getByRole('button', { name: '创建并连接会话' }));

    const input = await screen.findByLabelText('message');
    await userEvent.type(input, '退款多久到账？');
    await userEvent.click(screen.getByRole('button', { name: '发送消息' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:8020/workflow/triage',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            query: '退款多久到账？',
            context_slots: {},
          }),
        }),
      );
    });

    expect(await screen.findByText('AI 建议')).toBeInTheDocument();
    expect(await screen.findByText(/流程 langgraph/)).toBeInTheDocument();
    expect(await screen.findByText(/类别 refund/)).toBeInTheDocument();
    expect(await screen.findByText(/AI 需要更多信息/)).toBeInTheDocument();
  });

  it('shows handoff guidance when AI confidence is low', async () => {
    vi.spyOn(customerApi, 'requestAiDecision').mockResolvedValue({
      query: '这个问题比较复杂',
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
    await userEvent.type(input, '这个问题比较复杂');
    await userEvent.click(screen.getByRole('button', { name: '发送消息' }));

    const notices = await screen.findAllByText('建议转人工继续处理当前问题。');
    expect(notices.length).toBeGreaterThan(0);
    expect(screen.getByText('AI 建议')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '留言' })).toBeInTheDocument();
  });

  it('routes refund-like issues to langgraph triage flow and preserves slots across turns', async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            query: '退款不到账，订单号 TK2026040601',
            decision: 'clarify',
            answer: null,
            clarification: '请补充手机号。',
            workflow_mode: 'langgraph',
            flow_category: 'refund',
            next_action: 'collect_slot',
            next_prompt: '退款流程还差 手机号，补齐后即可转人工或继续处理。',
            confidence: 0.78,
            merged_slots: {
              issue_category: 'refund',
              order_id: 'TK2026040601',
            },
            required_slots: ['order_id', 'contact_phone'],
            missing_slots: ['contact_phone'],
            graph_trace: ['langgraph:classify:refund', 'langgraph:merge_context'],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            query: '手机号是 13800000000',
            decision: 'handoff',
            answer: null,
            clarification: null,
            workflow_mode: 'langgraph',
            flow_category: 'refund',
            next_action: 'handoff',
            next_prompt: '已准备好转人工，可附带当前槽位和摘要直接派单。',
            confidence: 0.91,
            merged_slots: {
              issue_category: 'refund',
              order_id: 'TK2026040601',
              contact_phone: '13800000000',
            },
            required_slots: ['order_id', 'contact_phone'],
            missing_slots: [],
            graph_trace: ['langgraph:classify:refund', 'langgraph:decide:handoff'],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(<ChatWorkspace mode="standalone" />, { wrapper: createWrapper() });

    await userEvent.click(screen.getByRole('button', { name: '创建并连接会话' }));

    const input = await screen.findByLabelText('message');
    await userEvent.type(input, '退款不到账，订单号 TK2026040601');
    await userEvent.click(screen.getByRole('button', { name: '发送消息' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        'http://localhost:8020/workflow/triage',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            query: '退款不到账，订单号 TK2026040601',
            context_slots: {},
          }),
        }),
      );
    });

    expect(await screen.findByText(/流程 langgraph/)).toBeInTheDocument();
    expect(await screen.findByText(/类别 refund/)).toBeInTheDocument();
    expect(await screen.findByText(/AI 需要更多信息/)).toBeInTheDocument();

    await userEvent.type(input, '手机号是 13800000000');
    await userEvent.click(screen.getByRole('button', { name: '发送消息' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'http://localhost:8020/workflow/triage',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            query: '手机号是 13800000000',
            context_slots: {
              issue_category: 'refund',
              order_id: 'TK2026040601',
            },
          }),
        }),
      );
    });

    expect((await screen.findAllByText(/已准备好转人工/)).length).toBeGreaterThan(0);
    expect(await screen.findByText(/类别 refund/)).toBeInTheDocument();
  });

  it('starts a voice session and shows finalized transcript with AI reply', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url === 'http://localhost:18030/sessions/start' && method === 'POST') {
        return new Response(
          JSON.stringify({
            voice_session_id: 901,
            livekit_room: 'voice-2001',
            status: 'listening',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url === 'http://localhost:18030/sessions/901/finalize' && method === 'POST') {
        return new Response(
          JSON.stringify({
            decision: 'answer',
            transcript: '我想咨询苹果手机售后',
            normalized_text: '我想咨询苹果手机售后。',
            answer: '可以先告诉我具体型号和城市，我会继续给你推荐售后门店。',
            clarification: null,
            handoff: false,
            audio_mime_type: 'audio/wav',
            audio_duration_ms: 1200,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      throw new Error(`Unhandled request: ${method} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ChatWorkspace mode="standalone" />, { wrapper: createWrapper() });

    await userEvent.click(screen.getByRole('button', { name: '创建并连接会话' }));
    await userEvent.click(await screen.findByRole('button', { name: '开始语音会话' }));

    const voiceDraft = await screen.findByLabelText('实时转写草稿');
    await userEvent.type(voiceDraft, '我想咨询苹果手机售后');
    await userEvent.click(screen.getByRole('button', { name: '完成本轮' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:18030/sessions/start',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:18030/sessions/901/finalize',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    expect(await screen.findByText('智能语音客服')).toBeInTheDocument();
    expect(screen.getAllByText('可以先告诉我具体型号和城市，我会继续给你推荐售后门店。').length).toBeGreaterThan(0);
    expect(screen.getAllByText('标准化：我想咨询苹果手机售后。').length).toBeGreaterThan(0);
  });
});
