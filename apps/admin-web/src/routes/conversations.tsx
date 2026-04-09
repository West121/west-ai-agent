import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { useQuery } from '@tanstack/react-query';

import {
  useConversationSatisfaction,
  useConversationSummary,
  useConversations,
  useCustomers,
  useEndConversation,
  useTransferConversation,
} from '@/hooks/use-platform-api';
import { useMessageGateway, type ChatMessage } from '@/hooks/use-message-gateway';
import { formatDateTime, formatDateTimeRelative } from '@/lib/format';
import { ApiError } from '@/lib/platform-api';
import { appendConversationMessage, getConversationMessages } from '@/lib/message-gateway';
import { VoiceSessionPanel } from '@/components/voice-session-panel';

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('ended') || normalized.includes('closed')) {
    return 'bg-slate-200 text-slate-700';
  }
  if (normalized.includes('handoff') || normalized.includes('pending')) {
    return 'bg-amber-100 text-amber-700';
  }
  return 'bg-emerald-100 text-emerald-700';
}

export function ConversationsPage() {
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [transferAssignee, setTransferAssignee] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replyError, setReplyError] = useState<string | null>(null);
  const [sendingReply, setSendingReply] = useState(false);
  const conversationsQuery = useConversations();
  const customersQuery = useCustomers();
  const transferMutation = useTransferConversation();
  const endMutation = useEndConversation();

  const conversations = conversationsQuery.data ?? [];
  const customers = customersQuery.data ?? [];

  useEffect(() => {
    if (conversations.length > 0 && selectedId === null) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  const customerMap = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );

  const filteredConversations = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return conversations;
    }

    return conversations.filter((item) => {
      const customer = customerMap.get(item.customer_profile_id);
      const haystack = [
        item.id,
        item.customer_profile_id,
        item.assignee ?? '',
        item.status,
        customer?.name ?? '',
        customer?.external_id ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedKeyword);
    });
  }, [conversations, customerMap, keyword]);

  const selectedConversation =
    filteredConversations.find((item) => item.id === selectedId) ?? filteredConversations[0] ?? null;

  useEffect(() => {
    if (!selectedConversation) {
      return;
    }
    if (selectedId !== selectedConversation.id) {
      setSelectedId(selectedConversation.id);
    }
  }, [selectedConversation, selectedId]);

  const summaryQuery = useConversationSummary(selectedConversation?.id);
  const satisfactionQuery = useConversationSatisfaction(selectedConversation?.id);
  const agentClientId = useMemo(
    () => `admin-agent-${globalThis.crypto?.randomUUID?.().slice(0, 8) ?? `${Date.now()}`}`,
    [],
  );
  const gateway = useMessageGateway({
    conversationId: selectedConversation ? String(selectedConversation.id) : null,
    clientId: agentClientId,
    role: 'agent',
  });
  const historyQuery = useQuery({
    queryKey: ['admin-web', 'conversation-messages', selectedConversation?.id],
    enabled: typeof selectedConversation?.id === 'number',
    queryFn: () => getConversationMessages(selectedConversation!.id),
  });

  useEffect(() => {
    if (selectedConversation) {
      setTransferAssignee(selectedConversation.assignee ?? '');
      setActionReason('');
      setOperationMessage(null);
      setReplyDraft('');
      setReplyError(null);
    }
  }, [selectedConversation?.id, selectedConversation?.assignee]);

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

  useEffect(() => {
    if (!selectedConversation || gateway.status !== 'open') {
      return;
    }

    for (const message of combinedMessages) {
      const shouldAck =
        message.senderRole !== 'agent' &&
        message.senderId !== agentClientId &&
        message.status !== 'read' &&
        message.ackedBy !== agentClientId;

      if (!shouldAck) {
        continue;
      }

      gateway.sendAck(message.id);
    }
  }, [agentClientId, combinedMessages, gateway, selectedConversation]);

  async function handleTransferConversation() {
    if (!selectedConversation) {
      return;
    }

    await transferMutation.mutateAsync({
      conversationId: selectedConversation.id,
      payload: {
        assignee: transferAssignee.trim() || null,
        reason: actionReason.trim() || null,
      },
    });
    setOperationMessage('会话已转接，列表和摘要已刷新。');
  }

  async function handleEndConversation() {
    if (!selectedConversation) {
      return;
    }

    await endMutation.mutateAsync({
      conversationId: selectedConversation.id,
      payload: {
        reason: actionReason.trim() || null,
      },
    });
    setOperationMessage('会话已结束，状态与时间已同步。');
  }

  async function handleSendReply(event: FormEvent) {
    event.preventDefault();

    const text = replyDraft.trim();
    if (!text || !selectedConversation) {
      return;
    }

    setSendingReply(true);
    setReplyError(null);

    try {
      gateway.sendMessage(text);
      await appendConversationMessage(selectedConversation.id, {
        sender_id: agentClientId,
        sender_role: 'agent',
        text,
      });
      setReplyDraft('');
      void historyQuery.refetch();
      void summaryQuery.refetch();
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : '发送回复失败');
    } finally {
      setSendingReply(false);
    }
  }

  if (conversationsQuery.isLoading || customersQuery.isLoading) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="h-4 w-24 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-4 h-8 w-80 max-w-full animate-pulse rounded-2xl bg-slate-100" />
        <div className="mt-6 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="h-96 animate-pulse rounded-[1.35rem] bg-slate-100" />
          <div className="h-96 animate-pulse rounded-[1.35rem] bg-slate-100" />
        </div>
      </section>
    );
  }

  if (conversationsQuery.isError || customersQuery.isError) {
    return (
      <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="text-sm font-semibold uppercase tracking-[0.24em]">会话失败</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">无法读取会话工作台数据</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-800">
          {conversationsQuery.error instanceof ApiError
            ? conversationsQuery.error.detail
            : customersQuery.error instanceof ApiError
              ? customersQuery.error.detail
              : '请求会话或客户数据失败'}
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Conversations</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">会话工作台</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              直接连接会话列表、客户档案和摘要接口，用现有数据拼出一个可操作的会话视图。
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            会话总数：{conversations.length}
            <div className="mt-1 text-xs text-slate-500">
              开放会话：{conversations.filter((item) => item.status !== 'ended').length}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索会话 id、客户、状态或负责人"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">会话列表</h3>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
              {filteredConversations.length} 条
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {filteredConversations.length > 0 ? (
              filteredConversations.map((conversation) => {
                const customer = customerMap.get(conversation.customer_profile_id);
                const selected = conversation.id === selectedConversation?.id;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setSelectedId(conversation.id)}
                    className={[
                      'block w-full rounded-[1.25rem] border p-4 text-left transition',
                      selected
                        ? 'border-sky-200 bg-sky-50 shadow-sm'
                        : 'border-slate-200 bg-slate-50 hover:border-sky-200 hover:bg-white',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">
                          会话 #{conversation.id} · {customer?.name ?? `客户 ${conversation.customer_profile_id}`}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {customer?.external_id ?? '未知客户'} · {conversation.assignee ?? '未分配'}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(conversation.status)}`}
                      >
                        {conversation.status}
                      </span>
                    </div>
                    <div className="mt-3 text-xs text-slate-500">
                      创建于 {formatDateTimeRelative(conversation.created_at)} · 更新于{' '}
                      {formatDateTimeRelative(conversation.updated_at)}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                当前没有匹配的会话。
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">会话详情</h3>
            {selectedConversation ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                summary {summaryQuery.data ? '已加载' : summaryQuery.isLoading ? '加载中' : '待拉取'}
              </span>
            ) : null}
          </div>

          {selectedConversation ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">客户</p>
                  <p className="mt-1 text-base font-medium text-slate-900">
                    {customerMap.get(selectedConversation.customer_profile_id)?.name ??
                      `客户 ${selectedConversation.customer_profile_id}`}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {customerMap.get(selectedConversation.customer_profile_id)?.external_id ?? '未知 external id'}
                  </p>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">负责人</p>
                  <p className="mt-1 text-base font-medium text-slate-900">
                    {selectedConversation.assignee ?? '未分配'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">状态：{selectedConversation.status}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-500">创建时间</p>
                  <p className="mt-2 text-sm leading-6 text-slate-900">
                    {formatDateTime(selectedConversation.created_at)}
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-500">结束时间</p>
                  <p className="mt-2 text-sm leading-6 text-slate-900">
                    {selectedConversation.ended_at ? formatDateTime(selectedConversation.ended_at) : '尚未结束'}
                  </p>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-900">实时对话</p>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                      gateway {gateway.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => historyQuery.refetch()}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-sky-200 hover:text-sky-700"
                    >
                      刷新消息
                    </button>
                  </div>
                </div>

                <div className="mt-4 max-h-[26rem] space-y-3 overflow-y-auto rounded-[1rem] bg-slate-50/80 p-4">
                  {historyQuery.isLoading ? (
                    <p className="text-sm text-slate-500">正在读取消息历史...</p>
                  ) : historyQuery.isError ? (
                    <div className="rounded-[1rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
                      {historyQuery.error instanceof Error ? historyQuery.error.message : '读取消息历史失败'}
                    </div>
                  ) : combinedMessages.length > 0 ? (
                    combinedMessages.map((message) => {
                      const isAgent = message.senderRole === 'agent';
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={[
                              'max-w-[82%] rounded-[1.15rem] border px-4 py-3 shadow-sm',
                              isAgent
                                ? 'border-sky-200 bg-sky-50 text-slate-900'
                                : 'border-slate-200 bg-white text-slate-900',
                            ].join(' ')}
                          >
                            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                              <span>{isAgent ? 'agent' : message.senderRole}</span>
                              <span>·</span>
                              <span>{formatDateTimeRelative(message.createdAt)}</span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.text}</p>
                            <div className="mt-2 text-[11px] text-slate-500">
                              {formatMessageReadStatus(message)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-500">当前会话还没有消息。先在 H5 侧发送消息，再从这里转人工接待。</p>
                  )}
                </div>

                <form className="mt-4 space-y-3" onSubmit={handleSendReply}>
                  <textarea
                    value={replyDraft}
                    onChange={(event) => setReplyDraft(event.target.value)}
                    rows={4}
                    placeholder="输入人工客服回复内容，发送后会实时推送到用户侧。"
                    disabled={!selectedConversation || selectedConversation.status === 'ended'}
                    className="w-full rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      当前接待人：{selectedConversation.assignee ?? '未分配'} · 状态：{selectedConversation.status}
                    </p>
                    <button
                      type="submit"
                      disabled={!replyDraft.trim() || sendingReply || selectedConversation.status === 'ended'}
                      className="inline-flex items-center justify-center rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {sendingReply ? '发送中...' : '发送回复'}
                    </button>
                  </div>
                </form>

                {gateway.error ? (
                  <div className="mt-3 rounded-[1rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
                    {gateway.error}
                  </div>
                ) : null}

                {replyError ? (
                  <div className="mt-3 rounded-[1rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
                    {replyError}
                  </div>
                ) : null}
              </div>

              <VoiceSessionPanel
                conversationId={selectedConversation.id}
                customerProfileId={selectedConversation.customer_profile_id}
                assignee={selectedConversation.assignee}
              />

              <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-900">AI 摘要</p>
                  <button
                    type="button"
                    onClick={() => summaryQuery.refetch()}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-sky-200 hover:text-sky-700"
                  >
                    刷新摘要
                  </button>
                </div>

                {summaryQuery.isLoading ? (
                  <p className="mt-4 text-sm leading-6 text-slate-500">正在读取摘要...</p>
                ) : summaryQuery.isError ? (
                  <div className="mt-4 rounded-[1rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
                    {summaryQuery.error instanceof ApiError
                      ? summaryQuery.error.detail
                      : '读取会话摘要失败'}
                  </div>
                ) : summaryQuery.data ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-[1rem] bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                      {summaryQuery.data.ai_summary ?? '暂无 AI 摘要'}
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-[1rem] border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">消息数</p>
                        <p className="mt-2 text-xl font-semibold text-slate-950">
                          {summaryQuery.data.message_count}
                        </p>
                      </div>
                      <div className="rounded-[1rem] border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">满意度</p>
                        <p className="mt-2 text-xl font-semibold text-slate-950">
                          {summaryQuery.data.satisfaction_score ?? '暂无'}
                        </p>
                      </div>
                      <div className="rounded-[1rem] border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">最后消息</p>
                        <p className="mt-2 text-sm leading-6 text-slate-900">
                          {summaryQuery.data.last_message_at
                            ? formatDateTime(summaryQuery.data.last_message_at)
                            : '暂无'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-slate-500">当前会话暂无摘要数据。</p>
                )}
              </div>

              <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-900">会话操作</p>
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                    POST transfer / end
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">转接到</span>
                    <input
                      value={transferAssignee}
                      onChange={(event) => setTransferAssignee(event.target.value)}
                      placeholder="agent-b"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-slate-700">处理备注</span>
                    <textarea
                      value={actionReason}
                      onChange={(event) => setActionReason(event.target.value)}
                      rows={3}
                      placeholder="填写转接或结束的原因"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleTransferConversation}
                    disabled={transferMutation.isPending || endMutation.isPending}
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {transferMutation.isPending ? '转接中...' : '转接会话'}
                  </button>
                  <button
                    type="button"
                    onClick={handleEndConversation}
                    disabled={transferMutation.isPending || endMutation.isPending}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-rose-200 hover:text-rose-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {endMutation.isPending ? '结束中...' : '结束会话'}
                  </button>
                </div>

                {transferMutation.isError ? (
                  <div className="mt-4 rounded-[1rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
                    {transferMutation.error instanceof ApiError
                      ? transferMutation.error.detail
                      : '转接会话失败'}
                  </div>
                ) : null}

                {endMutation.isError ? (
                  <div className="mt-4 rounded-[1rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
                    {endMutation.error instanceof ApiError ? endMutation.error.detail : '结束会话失败'}
                  </div>
                ) : null}

                {operationMessage ? (
                  <div className="mt-4 rounded-[1rem] border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
                    {operationMessage}
                  </div>
                ) : null}
              </div>

              <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-900">满意度查看</p>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                    GET satisfaction
                  </span>
                </div>

                {satisfactionQuery.isLoading ? (
                  <p className="mt-4 text-sm leading-6 text-slate-500">正在读取满意度记录...</p>
                ) : satisfactionQuery.isError ? (
                  <div className="mt-4 rounded-[1rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
                    {satisfactionQuery.error instanceof ApiError
                      ? satisfactionQuery.error.detail
                      : '读取满意度失败'}
                  </div>
                ) : satisfactionQuery.data ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[1rem] bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">评分</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">
                        {satisfactionQuery.data.score}
                      </p>
                    </div>
                    <div className="rounded-[1rem] bg-slate-50 p-4 md:col-span-2">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">评价备注</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {satisfactionQuery.data.comment ?? '暂无评价备注'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-slate-500">当前会话暂无满意度记录。</p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              当前没有可查看的会话。
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function mergeChatMessages(...groups: ChatMessage[][]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();

  for (const group of groups) {
    for (const message of group) {
      const existing = byId.get(message.id);
      if (!existing) {
        byId.set(message.id, message);
        continue;
      }
      byId.set(message.id, mergeSingleMessage(existing, message));
    }
  }

  return Array.from(byId.values()).sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}

function mergeSingleMessage(current: ChatMessage, incoming: ChatMessage): ChatMessage {
  const currentScore = messageCompleteness(current);
  const incomingScore = messageCompleteness(incoming);

  if (incomingScore > currentScore) {
    return { ...current, ...incoming };
  }
  if (incomingScore < currentScore) {
    return { ...incoming, ...current };
  }
  return { ...current, ...incoming };
}

function messageCompleteness(message: ChatMessage): number {
  return [message.createdAt, message.status, message.ackedBy, message.ackedAt, message.text].reduce(
    (score, value) => score + (value ? 1 : 0),
    0,
  );
}

function formatMessageReadStatus(message: ChatMessage): string {
  const status = message.status?.toLowerCase().trim();
  const ackedBy = message.ackedBy?.trim();
  const ackedAt = message.ackedAt?.trim();

  if (status === 'read') {
    const detail = [ackedBy, ackedAt ? formatDateTimeRelative(ackedAt) : null].filter(Boolean).join(' · ');
    return detail ? `已读 · ${detail}` : '已读';
  }
  if (status === 'delivered') {
    return '已送达';
  }
  return '待回执';
}
