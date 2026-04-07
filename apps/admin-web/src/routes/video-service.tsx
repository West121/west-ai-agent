import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';

import {
  useConversations,
  useCreateVideoSnapshot,
  useCurrentVideoSession,
  useCustomers,
  useEndVideoSession,
  useStartVideoSession,
  useTickets,
  useTransferVideoSessionTicket,
  useVideoSessions,
  useVideoSnapshots,
} from '@/hooks/use-platform-api';
import { formatDateTime } from '@/lib/format';
import { ApiError, type Ticket, type VideoSession } from '@/lib/platform-api';

function describeError(error: unknown) {
  if (error instanceof ApiError) {
    return error.detail;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return '请求视频客服接口失败';
}

export function VideoServicePage() {
  const conversationsQuery = useConversations();
  const customersQuery = useCustomers();
  const ticketsQuery = useTickets();
  const sessionsQuery = useVideoSessions();
  const currentSessionQuery = useCurrentVideoSession();
  const startSessionMutation = useStartVideoSession();
  const endSessionMutation = useEndVideoSession();
  const createSnapshotMutation = useCreateVideoSnapshot();
  const transferTicketMutation = useTransferVideoSessionTicket();

  const conversations = conversationsQuery.data ?? [];
  const customers = customersQuery.data ?? [];
  const tickets = ticketsQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const currentSessionData = currentSessionQuery.data ?? null;
  const activeConversation = conversations.find((item) => item.status.toLowerCase() !== 'ended') ?? conversations[0] ?? null;
  const customer =
    customers.find((item) => item.id === activeConversation?.customer_profile_id) ?? customers[0] ?? null;

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [sessionDraft, setSessionDraft] = useState<VideoSession | null>(null);
  const [ticketDraft, setTicketDraft] = useState<Ticket | null>(null);
  const [ticketDraftSessionId, setTicketDraftSessionId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string>('等待开始视频服务');

  useEffect(() => {
    const currentSelectionExists = selectedSessionId !== null && sessions.some((session) => session.id === selectedSessionId);
    if (currentSelectionExists) {
      return;
    }
    setSelectedSessionId(sessionDraft?.id ?? currentSessionData?.id ?? sessions[0]?.id ?? null);
  }, [currentSessionData?.id, selectedSessionId, sessionDraft?.id, sessions]);

  const sessionPreview = sessionDraft ?? currentSessionData ?? null;
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? sessionPreview ?? sessions[0] ?? null;
  const snapshotsQuery = useVideoSnapshots(selectedSession?.id);
  const snapshots = snapshotsQuery.data ?? [];
  const linkedTicket = selectedSession?.ticket_id
    ? tickets.find((ticket) => ticket.id === selectedSession.ticket_id) ?? (ticketDraftSessionId === selectedSession.id ? ticketDraft : null)
    : ticketDraftSessionId === selectedSession?.id
      ? ticketDraft
      : null;
  const channelLabel = activeConversation?.channel ?? (selectedSession?.conversation_id ? 'video' : '未知');
  const isLoading =
    conversationsQuery.isLoading ||
    customersQuery.isLoading ||
    ticketsQuery.isLoading ||
    sessionsQuery.isLoading ||
    currentSessionQuery.isLoading ||
    (selectedSession?.id != null && snapshotsQuery.isLoading);

  if (isLoading) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="h-8 w-56 animate-pulse rounded-2xl bg-slate-100" />
      </section>
    );
  }

  const apiError =
    conversationsQuery.error instanceof ApiError
      ? conversationsQuery.error
      : customersQuery.error instanceof ApiError
        ? customersQuery.error
        : ticketsQuery.error instanceof ApiError
          ? ticketsQuery.error
          : sessionsQuery.error instanceof ApiError
            ? sessionsQuery.error
            : currentSessionQuery.error instanceof ApiError
              ? currentSessionQuery.error
              : snapshotsQuery.error instanceof ApiError
                ? snapshotsQuery.error
                : null;

  if (
    conversationsQuery.isError ||
    customersQuery.isError ||
    ticketsQuery.isError ||
    sessionsQuery.isError ||
    currentSessionQuery.isError ||
    snapshotsQuery.isError
  ) {
    return (
      <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="text-sm font-semibold uppercase tracking-[0.24em]">视频客服失败</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">无法生成视频客服页面</h2>
        <p className="mt-3 text-sm leading-6 text-rose-800">{apiError ? apiError.detail : '请求视频客服接口失败'}</p>
      </section>
    );
  }

  const currentSessionId = sessionPreview?.status === 'active' ? sessionPreview.id : null;
  const sessionCount = sessions.length;
  const snapshotCount = selectedSession?.snapshot_count ?? snapshots.length;
  const sessionStatusTone =
    selectedSession?.status === 'active'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : selectedSession?.status === 'ended'
        ? 'border-slate-200 bg-slate-50 text-slate-600'
        : 'border-sky-200 bg-sky-50 text-sky-700';

  async function handleStartSession() {
    if (!customer) {
      setFeedback('没有可用客户，无法开始视频服务');
      return;
    }
    try {
      const session = await startSessionMutation.mutateAsync({
        customer_profile_id: activeConversation?.customer_profile_id ?? customer.id,
        conversation_id: activeConversation?.id ?? null,
        assignee: activeConversation?.assignee ?? 'video-agent',
      });
      setSessionDraft(session);
      setTicketDraft(null);
      setTicketDraftSessionId(null);
      setSelectedSessionId(session.id);
      setFeedback(`已开始视频会话 #${session.id}`);
    } catch (error) {
      setFeedback(describeError(error));
    }
  }

  async function handleEndSession() {
    if (currentSessionId === null) {
      setFeedback('当前没有活跃会话');
      return;
    }
    try {
      const session = await endSessionMutation.mutateAsync({
        sessionId: currentSessionId,
        payload: { reason: '视频客服会话已结束' },
      });
      setSessionDraft(session);
      setSelectedSessionId(session.id);
      setFeedback(`已结束视频会话 #${session.id}`);
    } catch (error) {
      setFeedback(describeError(error));
    }
  }

  async function handleCreateSnapshot() {
    if (currentSessionId === null) {
      setFeedback('请先开始视频服务，再创建抓拍记录');
      return;
    }
    try {
      const snapshot = await createSnapshotMutation.mutateAsync({
        sessionId: currentSessionId,
        payload: {
          label: `抓拍 ${snapshotCount + 1}`,
          note: `来自视频客服会话 #${currentSessionId} 的人工抓拍`,
        },
      });
      setSessionDraft((draft) =>
        draft && draft.id === currentSessionId
          ? {
              ...draft,
              snapshot_count: draft.snapshot_count + 1,
              latest_snapshot_at: snapshot.created_at,
              updated_at: snapshot.created_at,
            }
          : draft,
      );
      setSelectedSessionId(currentSessionId);
      setFeedback(`已创建抓拍记录「${snapshot.label}」`);
    } catch (error) {
      setFeedback(describeError(error));
    }
  }

  async function handleTransferTicket() {
    if (currentSessionId === null) {
      setFeedback('请先开始视频服务，再转工单');
      return;
    }
    try {
      const ticket = await transferTicketMutation.mutateAsync({
        sessionId: currentSessionId,
        payload: {
          title: `视频会话 #${currentSessionId} 工单`,
          priority: 'high',
          source: 'video',
          assignee: activeConversation?.assignee ?? sessionPreview?.assignee ?? 'video-agent',
          assignee_group: '视频客服',
          summary: `会话 #${currentSessionId} 已转工单，当前客户：${customer?.name ?? '未知'}`,
        },
      });
      setSessionDraft((draft) =>
        draft && draft.id === currentSessionId
          ? {
              ...draft,
              ticket_id: ticket.id,
              updated_at: ticket.updated_at,
            }
          : draft,
      );
      setTicketDraft(ticket);
      setTicketDraftSessionId(currentSessionId);
      setSelectedSessionId(currentSessionId);
      setFeedback(`已转工单 #${ticket.id}`);
    } catch (error) {
      setFeedback(describeError(error));
    }
  }

  return (
    <section className="grid gap-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">Video Service</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">视频客服</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              这里通过真实后端会话、抓拍和转工单接口拼出最小可用闭环，适合人工坐席直接开始处理。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {currentSessionId === null ? (
              <button
                type="button"
                onClick={handleStartSession}
                disabled={startSessionMutation.isPending || customer === null}
                className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {startSessionMutation.isPending ? '开始中...' : '开始视频服务'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleEndSession}
                disabled={endSessionMutation.isPending}
                className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {endSessionMutation.isPending ? '结束中...' : '结束服务'}
              </button>
            )}
            <Link
              to="/service-ops"
              className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
            >
              返回服务运营台
            </Link>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          {feedback}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="bg-slate-950 px-5 py-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-300">主视频舞台</p>
                <h3 className="mt-1 text-xl font-semibold">{selectedSession ? `会话 #${selectedSession.id}` : '等待接入客户'}</h3>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sessionStatusTone}`}>
                {selectedSession?.status ?? 'idle'}
              </span>
            </div>
          </div>
          <div className="grid min-h-[360px] place-items-center bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_35%),linear-gradient(180deg,#0f172a,#111827)] p-8 text-slate-200">
            <div className="text-center">
              <p className="text-sm uppercase tracking-[0.32em] text-slate-400">Live Video Session</p>
              <p className="mt-4 text-2xl font-semibold">
                {selectedSession
                  ? `会话 #${selectedSession.id} · ${selectedSession.status}`
                  : '暂无视频会话'}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {customer?.name ?? '未匹配客户'} · {customer?.phone ?? customer?.email ?? '等待客户设备接入摄像头与麦克风'}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {selectedSession?.started_at ? `开始于 ${formatDateTime(selectedSession.started_at)}` : '点击开始视频服务后会创建真实会话记录'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 border-t border-slate-200 px-5 py-4">
            <button
              type="button"
              onClick={handleTransferTicket}
              disabled={currentSessionId === null || transferTicketMutation.isPending}
              className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {transferTicketMutation.isPending ? '转工单中...' : '转工单'}
            </button>
            <button
              type="button"
              onClick={handleCreateSnapshot}
              disabled={currentSessionId === null || createSnapshotMutation.isPending}
              className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              {createSnapshotMutation.isPending ? '抓拍中...' : '抓拍记录'}
            </button>
            <button
              type="button"
              onClick={handleEndSession}
              disabled={currentSessionId === null || endSessionMutation.isPending}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              结束当前会话
            </button>
          </div>
        </section>

        <aside className="grid gap-6">
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">会话概览</h3>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">session</span>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <p>当前活跃：{currentSessionId !== null ? `#${currentSessionId}` : '暂无'}</p>
              <p>当前状态：{sessionPreview?.status ?? 'idle'}</p>
              <p>负责人：{selectedSession?.assignee ?? activeConversation?.assignee ?? '未分配'}</p>
              <p>渠道：{channelLabel}</p>
              <p>客户：{customer?.name ?? '未匹配'}</p>
              <p>当前工单：{selectedSession?.ticket_id ? `#${selectedSession.ticket_id}` : '暂无'}</p>
              <p>会话总数：{sessionCount}</p>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">关联工单</h3>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">tickets</span>
            </div>
            <div className="mt-4 space-y-3">
              {linkedTicket ? (
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-medium text-slate-900">{linkedTicket.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    #{linkedTicket.id} · {linkedTicket.status} · {linkedTicket.priority}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  当前会话还没有转工单记录。
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">会话列表</h3>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">history</span>
            </div>
            <div className="mt-4 space-y-3">
              {sessions.length > 0 ? (
                sessions.map((session) => {
                  const isSelected = session.id === selectedSession?.id;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => setSelectedSessionId(session.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        isSelected
                          ? 'border-sky-200 bg-sky-50'
                          : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-900">会话 #{session.id}</p>
                        <span className="text-xs text-slate-500">{session.status}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {session.assignee ?? '未分配'} · {formatDateTime(session.started_at)}
                      </p>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  暂无会话，先点击开始视频服务。
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-950">抓拍记录</h3>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            共 {snapshotCount} 条
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {snapshots.length > 0 ? (
            snapshots.map((snapshot) => (
              <article key={snapshot.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-medium text-slate-900">{snapshot.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{snapshot.note ?? '无备注'}</p>
                <p className="mt-3 text-xs text-slate-500">{formatDateTime(snapshot.created_at)}</p>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              还没有抓拍记录。
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
