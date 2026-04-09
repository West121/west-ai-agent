import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';

import {
  appendConversationMessage,
  createConversation,
  createCustomerProfile,
  getConversationMessages,
  getConversationSummary,
  requestAiDecision,
  submitConversationSatisfaction,
  type AiDecisionRead,
  type ConversationRead,
  type ConversationSummaryRead,
  type CustomerProfileRead,
} from '@/lib/customer-h5-api';
import { VoiceComposer } from '@/components/voice-composer';
import { formatMessageReadStatus, mergeChatMessages } from '@/lib/chat-message-utils';
import { aiServiceBaseUrl, platformApiBaseUrl, messageGatewayWsUrl } from '@/lib/runtime-config';
import { useMessageGateway } from '@/hooks/use-message-gateway';

type ChatMode = 'standalone' | 'embedded';

interface ChatWorkspaceProps {
  mode: ChatMode;
}

interface VisitorDraft {
  externalId: string;
  name: string;
  email: string;
  phone: string;
}

type AiAdviceState =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'success'; query: string; response: AiDecisionRead }
  | { status: 'handoff'; query: string; response: AiDecisionRead; message: string }
  | { status: 'error'; query: string; message: string };

function createDefaultVisitorDraft(): VisitorDraft {
  const suffix = globalThis.crypto?.randomUUID?.().slice(0, 8) ?? `${Date.now()}`;

  return {
    externalId: `visitor-${suffix}`,
    name: '匿名访客',
    email: '',
    phone: '',
  };
}

function shouldUseComplexWorkflow(query: string) {
  return /(退款|退钱|售后|退换|换货|维修|返修|账号冻结|封号|锁定|账号异常|发票|开票|物流|快递|配送|发货|支付失败|付款失败|扣款|不到账|到账|支付异常|投诉|差评|举报|申诉)/i.test(query);
}

async function requestWorkflowTriage(
  query: string,
  contextSlots: Record<string, string>,
): Promise<AiDecisionRead> {
  const response = await fetch(`${aiServiceBaseUrl}/workflow/triage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, context_slots: contextSlots }),
  });

  if (!response.ok) {
    const fallback = `${response.status} ${response.statusText}`.trim();
    throw new Error(fallback || 'workflow triage failed');
  }

  return (await response.json()) as AiDecisionRead;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusLabel(status: string) {
  switch (status) {
    case 'idle':
      return '待连接';
    case 'connecting':
      return '连接中';
    case 'open':
      return '已连接';
    case 'closed':
      return '已关闭';
    case 'error':
      return '错误';
    default:
      return status;
  }
}

function renderSubmitResult(value: unknown): string {
  if (value === undefined) {
    return '后端未返回内容，已提交。';
  }

  if (value === null) {
    return '后端返回空值，已提交。';
  }

  if (typeof value !== 'object') {
    return `已提交：${String(value)}`;
  }

  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length === 0) {
    return '已提交，后端返回空对象。';
  }

  return `已提交，返回了 ${keys.length} 个字段。`;
}

function toSummaryValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return value.trim() ? value : null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => toSummaryValue(item)).filter(Boolean) as string[];
    return items.length > 0 ? items.join(', ') : null;
  }

  if (typeof value === 'object') {
    const text = JSON.stringify(value);
    return text === '{}' ? null : text;
  }

  return String(value);
}

function buildSummaryRows(summary: ConversationSummaryRead | undefined) {
  if (!summary) {
    return [] as Array<{ label: string; value: string }>;
  }

  const candidates: Array<[string, unknown]> = [
    ['主题', summary.subject ?? summary.title],
    ['状态', summary.status],
    ['摘要', summary.summary ?? summary.content],
    ['客户', summary.customer_name ?? summary.visitor_name],
    ['分组', summary.assigned_group],
    ['接待类型', summary.current_assignee_type],
    ['接待人', summary.current_assignee_id],
    ['最后消息', summary.last_message],
    ['结束时间', summary.ended_at],
    ['更新时间', summary.updated_at],
  ];

  const rows = candidates
    .map(([label, value]) => {
      const formatted = toSummaryValue(value);
      return formatted ? { label, value: formatted } : null;
    })
    .filter(Boolean) as Array<{ label: string; value: string }>;

  if (rows.length > 0) {
    return rows;
  }

  const raw = Object.entries(summary).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      acc[key] = value;
    }
    return acc;
  }, {});

  return Object.keys(raw).length > 0
    ? [{ label: '原始数据', value: JSON.stringify(raw, null, 2) }]
    : [];
}

export function ChatWorkspace({ mode }: ChatWorkspaceProps) {
  const compact = mode === 'embedded';
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const satisfactionSectionRef = useRef<HTMLDivElement | null>(null);
  const ackedMessageIdsRef = useRef<Set<string>>(new Set());
  const workflowContextSlotsRef = useRef<Record<string, string>>({});
  const [profileIdInput, setProfileIdInput] = useState('');
  const [visitorDraft, setVisitorDraft] = useState<VisitorDraft>(() => createDefaultVisitorDraft());
  const [creatingSession, setCreatingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationRead | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfileRead | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [aiAdvice, setAiAdvice] = useState<AiAdviceState>({ status: 'idle' });
  const [handoffNotice, setHandoffNotice] = useState<string | null>(null);
  const [workflowContextSlots, setWorkflowContextSlots] = useState<Record<string, string>>({});
  const [satisfactionConversationId, setSatisfactionConversationId] = useState('');
  const [satisfactionScore, setSatisfactionScore] = useState('5');
  const [satisfactionComment, setSatisfactionComment] = useState('');
  const [satisfactionSubmitting, setSatisfactionSubmitting] = useState(false);
  const [satisfactionError, setSatisfactionError] = useState<string | null>(null);
  const [satisfactionResult, setSatisfactionResult] = useState<unknown>(undefined);
  const [satisfactionSubmitted, setSatisfactionSubmitted] = useState(false);
  const clientId = useMemo(
    () => `customer-h5-${globalThis.crypto?.randomUUID?.().slice(0, 8) ?? `${Date.now()}`}`,
    [],
  );

  const gateway = useMessageGateway({
    conversationId: conversation ? String(conversation.id) : null,
    clientId,
    role: 'customer',
  });

  const summaryQuery = useQuery({
    queryKey: ['customer-h5', 'conversation-summary', conversation?.id],
    queryFn: async () => {
      if (!conversation) {
        return undefined;
      }

      return getConversationSummary(conversation.id);
    },
    enabled: Boolean(conversation),
  });

  const historyQuery = useQuery({
    queryKey: ['customer-h5', 'conversation-messages', conversation?.id],
    queryFn: async () => {
      if (!conversation) {
        return undefined;
      }

      return getConversationMessages(conversation.id);
    },
    enabled: Boolean(conversation),
  });

  useEffect(() => {
    if (gateway.status === 'open') {
      textareaRef.current?.focus();
    }
  }, [gateway.status]);

  useEffect(() => {
    setSatisfactionConversationId(conversation ? String(conversation.id) : '');
  }, [conversation?.id]);

  useEffect(() => {
    ackedMessageIdsRef.current.clear();
  }, [conversation?.id]);

  useEffect(() => {
    workflowContextSlotsRef.current = workflowContextSlots;
  }, [workflowContextSlots]);

  function mergeWorkflowContextSlots(nextSlots: Record<string, string> | undefined) {
    if (!nextSlots) {
      return;
    }

    workflowContextSlotsRef.current = {
      ...workflowContextSlotsRef.current,
      ...nextSlots,
    };
    setWorkflowContextSlots(workflowContextSlotsRef.current);
  }

  async function handleCreateSession() {
    setCreatingSession(true);
    setSessionError(null);
    setCustomerProfile(null);
    setConversation(null);
    setHandoffNotice(null);
    setAiAdvice({ status: 'idle' });
    workflowContextSlotsRef.current = {};
    setWorkflowContextSlots({});

    try {
      let profileId = Number(profileIdInput.trim());

      if (!profileIdInput.trim()) {
        const createdProfile = await createCustomerProfile({
          external_id: visitorDraft.externalId.trim(),
          name: visitorDraft.name.trim(),
          email: visitorDraft.email.trim() || null,
          phone: visitorDraft.phone.trim() || null,
          status: 'active',
          tag_ids: [],
        });
        setCustomerProfile(createdProfile);
        profileId = createdProfile.id;
        setProfileIdInput(String(createdProfile.id));
      } else if (Number.isNaN(profileId) || profileId <= 0) {
        throw new Error('customer_profile id 必须是正整数，或者留空让前端自动创建');
      }

      const createdConversation = await createConversation({
        customer_profile_id: profileId,
      });

      setConversation(createdConversation);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : '创建会话失败');
    } finally {
      setCreatingSession(false);
    }
  }

  async function handleSendMessage(event?: FormEvent) {
    event?.preventDefault();

    const text = draftMessage.trim();
    if (!text || !conversation) {
      return;
    }

    try {
      gateway.sendMessage(text);
      setDraftMessage('');
      void runAiFollowUp(text);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : '发送消息失败');
    }
  }

  async function runAiFollowUp(query: string) {
    setAiAdvice({ status: 'loading', query });

    try {
      const currentWorkflowContext = workflowContextSlotsRef.current;
      const useComplexWorkflow = shouldUseComplexWorkflow(query) || Boolean(currentWorkflowContext.issue_category);
      const decision = useComplexWorkflow
        ? await requestWorkflowTriage(query, currentWorkflowContext)
        : await requestAiDecision({
            query,
            endpoint: 'answer',
          });

      if (decision.decision === 'answer' && decision.answer) {
        await appendConversationMessage(conversation!.id, {
          sender_id: 'ai-bot',
          sender_role: 'assistant',
          text: decision.answer,
        });
        setAiAdvice({ status: 'success', query, response: decision });
        setHandoffNotice(null);
        if (decision.workflow_mode === 'langgraph') {
          mergeWorkflowContextSlots((decision as AiDecisionRead & { merged_slots?: Record<string, string> }).merged_slots);
        }
        return;
      }

      if (decision.decision === 'clarify' && decision.clarification) {
        await appendConversationMessage(conversation!.id, {
          sender_id: 'ai-bot',
          sender_role: 'assistant',
          text: decision.clarification,
        });
        setAiAdvice({ status: 'success', query, response: decision });
        setHandoffNotice('AI 需要更多信息，已返回补充提问。');
        if (decision.workflow_mode === 'langgraph') {
          mergeWorkflowContextSlots((decision as AiDecisionRead & { merged_slots?: Record<string, string> }).merged_slots);
        }
        return;
      }

      const message = buildHandoffMessage(decision);
      setAiAdvice({ status: 'handoff', query, response: decision, message });
      setHandoffNotice(message);
      if (decision.workflow_mode === 'langgraph') {
        mergeWorkflowContextSlots((decision as AiDecisionRead & { merged_slots?: Record<string, string> }).merged_slots);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 决策请求失败';
      setAiAdvice({ status: 'error', query, message });
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  }

  async function handleSubmitSatisfaction(event: FormEvent) {
    event.preventDefault();
    setSatisfactionSubmitting(true);
    setSatisfactionError(null);
    setSatisfactionSubmitted(false);

    try {
      const conversationId = satisfactionConversationId.trim();
      if (!conversationId) {
        throw new Error('conversation id 不能为空');
      }

      const score = Number(satisfactionScore);
      if (!Number.isInteger(score) || score < 1 || score > 5) {
        throw new Error('score 只能是 1 到 5');
      }

      const response = await submitConversationSatisfaction(conversationId, {
        score,
        comment: satisfactionComment.trim() || null,
      });
      setSatisfactionResult(response);
      setSatisfactionSubmitted(true);
    } catch (error) {
      setSatisfactionError(error instanceof Error ? error.message : '满意度提交失败');
      setSatisfactionResult(undefined);
      setSatisfactionSubmitted(false);
    } finally {
      setSatisfactionSubmitting(false);
    }
  }

  function scrollToSatisfaction() {
    satisfactionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const historyMessages = useMemo(
    () =>
      historyQuery.data?.items.map((message) => ({
        id: message.id,
        conversationId: message.conversation_id,
        senderId: message.sender_id,
        senderRole: message.sender_role,
        text: message.text,
        createdAt: message.created_at,
        status: message.status,
        ackedBy: message.acked_by,
        ackedAt: message.acked_at,
      })) ?? [],
    [historyQuery.data],
  );
  const combinedMessages = useMemo(
    () => mergeChatMessages(historyMessages, gateway.messages),
    [gateway.messages, historyMessages],
  );
  const effectiveConversationStatus = summaryQuery.data?.status ?? conversation?.status ?? null;
  const activeCustomerProfileId = conversation?.customer_profile_id ?? customerProfile?.id ?? null;
  const conversationState = conversation ? `#${conversation.id} · ${effectiveConversationStatus ?? conversation.status}` : '未创建';
  const summaryRows = buildSummaryRows(summaryQuery.data);
  const hasMessages = combinedMessages.length > 0;
  const historyLoading = Boolean(conversation) && historyQuery.isLoading;
  const inputDisabled = !conversation || effectiveConversationStatus === 'ended';
  const historyError = historyQuery.isError
    ? historyQuery.error instanceof Error
      ? historyQuery.error.message
      : '历史消息读取失败'
    : null;

  useEffect(() => {
    if (!conversation || gateway.status !== 'open') {
      return;
    }

    for (const message of combinedMessages) {
      const shouldAck =
        message.senderRole !== 'customer' &&
        message.senderId !== clientId &&
        message.status !== 'read' &&
        message.ackedBy !== clientId &&
        !ackedMessageIdsRef.current.has(message.id);

      if (!shouldAck) {
        continue;
      }

      gateway.sendAck(message.id);
      ackedMessageIdsRef.current.add(message.id);
    }
  }, [clientId, combinedMessages, conversation, gateway]);

  return (
    <div
      className={[
        'grid gap-4',
        compact ? 'xl:grid-cols-[340px_minmax(0,1fr)]' : 'xl:grid-cols-[380px_minmax(0,1fr)]',
      ].join(' ')}
    >
      <aside className="space-y-4">
        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-soft backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">访客会话</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                {compact ? '嵌入式聊天' : '独立访客聊天'}
              </h2>
            </div>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
              {mode === 'embedded' ? 'Embedded' : 'Standalone'}
            </span>
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            先创建 customer profile，再创建 conversation，随后自动连接 message-gateway websocket。
          </p>

          <dl className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-2xl bg-slate-50 p-3">
              <dt className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Platform API</dt>
              <dd className="mt-1 break-all text-xs font-medium text-slate-800">{platformApiBaseUrl}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <dt className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Gateway WS</dt>
              <dd className="mt-1 break-all text-xs font-medium text-slate-800">{messageGatewayWsUrl}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <dt className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Conversation</dt>
              <dd className="mt-1 text-xs font-medium text-slate-800">{conversationState}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-soft backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-950">创建会话</h3>
            <span
              className={[
                'rounded-full px-3 py-1 text-xs font-medium',
                gateway.status === 'open'
                  ? 'bg-emerald-100 text-emerald-700'
                  : gateway.status === 'error'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-slate-100 text-slate-700',
              ].join(' ')}
            >
              {statusLabel(gateway.status)}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                customer_profile id
              </span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                inputMode="numeric"
                placeholder="留空则自动创建访客资料"
                value={profileIdInput}
                onChange={(event) => setProfileIdInput(event.target.value)}
              />
            </label>

            {!profileIdInput.trim() ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                    external id
                  </span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    value={visitorDraft.externalId}
                    onChange={(event) =>
                      setVisitorDraft((current) => ({ ...current, externalId: event.target.value }))
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                    visitor name
                  </span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    value={visitorDraft.name}
                    onChange={(event) =>
                      setVisitorDraft((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                    email
                  </span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    inputMode="email"
                    value={visitorDraft.email}
                    onChange={(event) =>
                      setVisitorDraft((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                    phone
                  </span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    inputMode="tel"
                    value={visitorDraft.phone}
                    onChange={(event) =>
                      setVisitorDraft((current) => ({ ...current, phone: event.target.value }))
                    }
                  />
                </label>
              </div>
            ) : (
              <p className="rounded-2xl bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-900">
                已填写 customer_profile id，点击后直接创建 conversation，不会再自动创建 profile。
              </p>
            )}

            <button
              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={creatingSession}
              onClick={handleCreateSession}
            >
              {creatingSession ? '创建中...' : '创建并连接会话'}
            </button>

            {sessionError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {sessionError}
              </div>
            ) : null}

            {customerProfile ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                自动创建 profile 成功，id: <span className="font-semibold">{customerProfile.id}</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-soft backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-950">会话摘要</h3>
            <button
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-200 disabled:opacity-60"
              disabled={!conversation}
              onClick={() => summaryQuery.refetch()}
              type="button"
            >
              刷新
            </button>
          </div>

          {!conversation ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
              先创建会话后才会读取摘要。
            </div>
          ) : summaryQuery.isLoading ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              正在读取摘要...
            </div>
          ) : summaryQuery.isError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-6 text-rose-700">
              摘要读取失败：{summaryQuery.error instanceof Error ? summaryQuery.error.message : '未知错误'}
            </div>
          ) : summaryRows.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
              当前会话暂无摘要数据。
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {summaryRows.map((item) => (
                <div key={item.label} className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section ref={satisfactionSectionRef} className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-soft backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-950">满意度提交</h3>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              会话结束后使用
            </span>
          </div>

          <form className="mt-4 space-y-3" onSubmit={handleSubmitSatisfaction}>
            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                conversation id
              </span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                placeholder="可手动输入历史会话 id"
                value={satisfactionConversationId}
                onChange={(event) => setSatisfactionConversationId(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                score
              </span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                value={satisfactionScore}
                onChange={(event) => setSatisfactionScore(event.target.value)}
              >
                <option value="1">1 - 很差</option>
                <option value="2">2 - 较差</option>
                <option value="3">3 - 一般</option>
                <option value="4">4 - 满意</option>
                <option value="5">5 - 非常满意</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                comment
              </span>
              <textarea
                className="min-h-[110px] w-full rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                placeholder="可选补充说明"
                value={satisfactionComment}
                onChange={(event) => setSatisfactionComment(event.target.value)}
              />
            </label>

            <p className="text-xs leading-5 text-slate-500">
              接口路径：`POST /conversation/conversations/:id/satisfaction`
            </p>

            <button
              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={satisfactionSubmitting}
              type="submit"
            >
              {satisfactionSubmitting ? '提交中...' : '提交满意度'}
            </button>

            {satisfactionError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {satisfactionError}
              </div>
            ) : null}

            {satisfactionSubmitted && !satisfactionError ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {renderSubmitResult(satisfactionResult)}
              </div>
            ) : null}

            {effectiveConversationStatus !== 'ended' ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                当前会话状态仍是 {effectiveConversationStatus ?? 'unknown'}。满意度通常在会话结束后提交，当前仅提供入口。
              </div>
            ) : null}
          </form>
        </section>
      </aside>

      <section className="flex min-h-[640px] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-soft backdrop-blur">
        <header className="border-b border-slate-200/80 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Chat</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                {conversation ? `会话 #${conversation.id}` : '等待创建会话'}
              </h3>
            </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1">client {clientId}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              socket {statusLabel(gateway.status)}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              messages {combinedMessages.length}
            </span>
          </div>
        </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
              type="button"
              onClick={() => {
                setHandoffNotice('转人工入口已打开，后端接入后可在这里切换到人工接待。');
              }}
            >
              转人工
            </button>
            <Link
              className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
              to="/leave-message"
            >
              留言
            </Link>
            <button
              className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
              type="button"
              onClick={scrollToSatisfaction}
            >
              满意度
            </button>
          </div>

          {handoffNotice ? (
            <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-900">
              {handoffNotice}
            </div>
          ) : null}

          {aiAdvice.status !== 'idle' ? (
            <div
              className={[
                'mt-3 rounded-2xl border px-4 py-3 text-sm leading-6',
                aiAdvice.status === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : aiAdvice.status === 'loading'
                    ? 'border-slate-200 bg-slate-50 text-slate-700'
                    : aiAdvice.status === 'error'
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-amber-200 bg-amber-50 text-amber-900',
              ].join(' ')}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.24em]">AI 建议</p>
              {aiAdvice.status === 'loading' ? <p className="mt-2">正在分析刚刚发送的问题...</p> : null}
              {aiAdvice.status === 'success' ? (
                <>
                  <p className="mt-2 whitespace-pre-wrap">{aiAdvice.response.answer}</p>
                  <p className="mt-1 text-xs opacity-80">
                    决策：{aiAdvice.response.decision}
                    {aiAdvice.response.workflow_mode ? ` · 流程 ${aiAdvice.response.workflow_mode}` : ''}
                    {aiAdvice.response.flow_category ? ` · 类别 ${aiAdvice.response.flow_category}` : ''}
                    · 置信度 {aiAdvice.response.confidence.toFixed(2)}
                  </p>
                </>
              ) : null}
              {aiAdvice.status === 'handoff' ? (
                <>
                  <p className="mt-2">{aiAdvice.message}</p>
                  <p className="mt-1 text-xs opacity-80">
                    决策：{aiAdvice.response.decision}
                    {aiAdvice.response.workflow_mode ? ` · 流程 ${aiAdvice.response.workflow_mode}` : ''}
                    {aiAdvice.response.flow_category ? ` · 类别 ${aiAdvice.response.flow_category}` : ''}
                    · 置信度 {aiAdvice.response.confidence.toFixed(2)}
                  </p>
                </>
              ) : null}
              {aiAdvice.status === 'error' ? <p className="mt-2">{aiAdvice.message}</p> : null}
            </div>
          ) : null}

          {gateway.ack ? (
            <p className="mt-3 text-sm text-slate-600">
              已连接到 conversation {gateway.ack.conversation_id}，client {gateway.ack.client_id}
              ，role {gateway.ack.role}。
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              创建会话后会自动连接 websocket。当前页面仅依赖平台 API 与 message-gateway。
            </p>
          )}

          <div className="mt-3">
            <VoiceComposer
              conversationId={conversation?.id ?? null}
              conversationStatus={effectiveConversationStatus}
              customerProfileId={activeCustomerProfileId}
            />
          </div>

          {historyError ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              历史消息读取失败：{historyError}。实时消息仍可继续展示。
            </div>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {historyLoading && !hasMessages ? (
            <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
              <div className="max-w-md">
                <p className="text-sm font-medium text-slate-900">正在读取历史消息</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  会先从 message-gateway 拉取当前会话历史，再叠加 websocket 实时消息。
                </p>
              </div>
            </div>
          ) : hasMessages ? (
            <div className="space-y-3">
              {combinedMessages.map((message) => {
                const isCustomer = message.senderRole === 'customer';
                const readStatus = formatMessageReadStatus(message);
                return (
                  <article
                    key={message.id}
                    className={['flex', isCustomer ? 'justify-end' : 'justify-start'].join(' ')}
                  >
                    <div
                      className={[
                        'max-w-[82%] rounded-3xl px-4 py-3 shadow-sm',
                        isCustomer ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] opacity-70">
                        <span>{isCustomer ? 'customer' : message.senderRole}</span>
                        <span>·</span>
                        <span>{formatTime(message.createdAt)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.text}</p>
                      <div
                        className={[
                          'mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide',
                          isCustomer ? 'bg-white/15 text-white' : 'bg-slate-200 text-slate-700',
                        ].join(' ')}
                      >
                        {readStatus}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : historyError ? (
            <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-amber-200 bg-amber-50 px-6 py-16 text-center">
              <div className="max-w-md">
                <p className="text-sm font-medium text-amber-900">暂无历史消息</p>
                <p className="mt-2 text-sm leading-6 text-amber-800">
                  历史接口异常时，实时 websocket 消息仍会继续展示。请稍后重试刷新历史。
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
              <div className="max-w-md">
                <p className="text-sm font-medium text-slate-900">聊天区已就绪</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  创建会话后，输入消息并回车发送。收到的消息会实时出现在这里。
                </p>
              </div>
            </div>
          )}
        </div>

        <form className="border-t border-slate-200/80 p-4 sm:p-5" onSubmit={handleSendMessage}>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
            <label className="sr-only" htmlFor="customer-message">
              message
            </label>
            <textarea
              ref={textareaRef}
              id="customer-message"
              className="min-h-[108px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100"
              disabled={inputDisabled}
              placeholder={
                !conversation
                  ? '先创建会话再输入消息'
                  : effectiveConversationStatus === 'ended'
                    ? '会话已结束，可提交满意度或前往留言'
                    : '输入消息，回车发送，Shift+Enter 换行'
              }
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              onKeyDown={handleKeyDown}
            />

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs leading-5 text-slate-500">
                输入框已接入真实发送链路，复杂流程会沿 LangGraph 补槽，普通问题仍走 DecisionPipeline。
              </p>
              <button
                className="inline-flex items-center justify-center rounded-2xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={inputDisabled || !draftMessage.trim() || aiAdvice.status === 'loading'}
                type="submit"
              >
                {aiAdvice.status === 'loading' ? '处理中...' : '发送消息'}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function buildHandoffMessage(decision: AiDecisionRead): string {
  if (decision.decision === 'handoff' && decision.next_prompt?.trim()) {
    return decision.next_prompt.trim();
  }

  if (decision.clarification?.trim()) {
    return `${decision.clarification.trim()} 建议转人工继续处理当前问题。`;
  }

  if (decision.decision === 'reject') {
    return '暂时无法给出可靠答案，建议转人工继续处理当前问题。';
  }

  return '建议转人工继续处理当前问题。';
}
