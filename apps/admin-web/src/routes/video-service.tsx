import { useEffect, useMemo, useState } from 'react';
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
  useUpsertVideoSessionSummary,
  useUploadVideoRecording,
  useUpdateVideoRecordingRetention,
  useVideoRecordings,
  useVideoSessionSummary,
  useVideoSessions,
  useVideoSnapshots,
} from '@/hooks/use-platform-api';
import { useVideoCall } from '@/hooks/use-video-call';
import { formatDateTime } from '@/lib/format';
import { ApiError, platformApiBaseUrl, type Ticket, type VideoSession } from '@/lib/platform-api';

function describeError(error: unknown) {
  if (error instanceof ApiError) {
    return error.detail;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return '请求视频客服接口失败';
}

function playbackUrl(value: string | null | undefined) {
  if (!value) return '';
  if (/^https?:\/\//.test(value)) return value;
  return `${platformApiBaseUrl}${value.startsWith('/') ? value : `/${value}`}`;
}

function tone(status: string | null | undefined) {
  if (status === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'ended') return 'border-slate-200 bg-slate-50 text-slate-600';
  return 'border-sky-200 bg-sky-50 text-sky-700';
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
  const uploadRecordingMutation = useUploadVideoRecording();
  const updateRecordingRetentionMutation = useUpdateVideoRecordingRetention();
  const updateSummaryMutation = useUpsertVideoSessionSummary();

  const conversations = conversationsQuery.data ?? [];
  const customers = customersQuery.data ?? [];
  const tickets = ticketsQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const currentSessionData = currentSessionQuery.data ?? null;
  const activeConversation = conversations.find((item) => item.status.toLowerCase() !== 'ended') ?? conversations[0] ?? null;
  const customer = customers.find((item) => item.id === activeConversation?.customer_profile_id) ?? customers[0] ?? null;

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [sessionDraft, setSessionDraft] = useState<VideoSession | null>(null);
  const [ticketDraft, setTicketDraft] = useState<Ticket | null>(null);
  const [ticketDraftSessionId, setTicketDraftSessionId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string>('等待开始视频服务');
  const [selectedRecordingId, setSelectedRecordingId] = useState<number | null>(null);
  const [recordingFilter, setRecordingFilter] = useState<'retained' | 'deleted' | 'all'>('retained');
  const [recordingKeyword, setRecordingKeyword] = useState('');
  const [summaryDraft, setSummaryDraft] = useState({
    operator_summary: '',
    issue_category: '',
    resolution: '',
    next_action: '',
    handoff_reason: '',
    follow_up_required: false,
  });

  useEffect(() => {
    const currentSelectionExists = selectedSessionId !== null && sessions.some((session) => session.id === selectedSessionId);
    if (!currentSelectionExists) {
      setSelectedSessionId(sessionDraft?.id ?? currentSessionData?.id ?? sessions[0]?.id ?? null);
    }
  }, [currentSessionData?.id, selectedSessionId, sessionDraft?.id, sessions]);

  const sessionPreview = sessionDraft ?? currentSessionData ?? null;
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? sessionPreview ?? sessions[0] ?? null;
  const snapshotsQuery = useVideoSnapshots(selectedSession?.id);
  const recordingsQuery = useVideoRecordings(selectedSession?.id, recordingFilter, recordingKeyword);
  const summaryQuery = useVideoSessionSummary(selectedSession?.id);
  const snapshots = snapshotsQuery.data ?? [];
  const recordings = recordingsQuery.data ?? [];
  const summary = summaryQuery.data ?? selectedSession;
  const linkedTicket = selectedSession?.ticket_id
    ? tickets.find((ticket) => ticket.id === selectedSession.ticket_id) ?? (ticketDraftSessionId === selectedSession.id ? ticketDraft : null)
    : ticketDraftSessionId === selectedSession?.id
      ? ticketDraft
      : null;

  useEffect(() => {
    if (!summary) return;
    setSummaryDraft({
      operator_summary: summary.operator_summary ?? '',
      issue_category: summary.issue_category ?? '',
      resolution: summary.resolution ?? '',
      next_action: summary.next_action ?? '',
      handoff_reason: summary.handoff_reason ?? '',
      follow_up_required: summary.follow_up_required ?? false,
    });
  }, [summary?.id, summary?.operator_summary, summary?.issue_category, summary?.resolution, summary?.next_action, summary?.handoff_reason, summary?.follow_up_required]);

  useEffect(() => {
    if (selectedRecordingId !== null && recordings.some((item) => item.id === selectedRecordingId)) {
      return;
    }
    setSelectedRecordingId(recordings[0]?.id ?? null);
  }, [recordings, selectedRecordingId]);

  const selectedRecording = recordings.find((item) => item.id === selectedRecordingId) ?? recordings[0] ?? null;
  const roomId = useMemo(
    () => (selectedSession?.conversation_id != null ? String(selectedSession.conversation_id) : selectedSession?.id != null ? `video-${selectedSession.id}` : null),
    [selectedSession?.conversation_id, selectedSession?.id],
  );
  const videoCall = useVideoCall({
    roomId,
    onRecordingReady: async ({ blob, durationSeconds, mimeType }) => {
      if (!selectedSession) {
        throw new Error('没有可上传的会话');
      }
      const file = new File([blob], `video-session-${selectedSession.id}.webm`, { type: mimeType });
      const recording = await uploadRecordingMutation.mutateAsync({
        sessionId: selectedSession.id,
        file,
        label: `浏览器录制 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
        note: '由坐席端浏览器录制并上传',
        durationSeconds,
      });
      setSelectedRecordingId(recording.id);
      setFeedback(`录制已上传，时长 ${durationSeconds} 秒`);
    },
  });

  const hasSelectedSession = selectedSession?.id != null;
  const coreLoading =
    conversationsQuery.isLoading ||
    customersQuery.isLoading ||
    ticketsQuery.isLoading ||
    sessionsQuery.isLoading ||
    currentSessionQuery.isLoading;
  const detailLoading = hasSelectedSession && (snapshotsQuery.isLoading || recordingsQuery.isLoading || summaryQuery.isLoading);

  if (coreLoading) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
        <div className="h-8 w-56 animate-pulse rounded-2xl bg-slate-100" />
      </section>
    );
  }

  const coreQueryError = [
    conversationsQuery,
    customersQuery,
    ticketsQuery,
    sessionsQuery,
    currentSessionQuery,
  ]
    .map((item) => item.error)
    .find((item) => item != null);

  if (conversationsQuery.isError || customersQuery.isError || ticketsQuery.isError || sessionsQuery.isError || currentSessionQuery.isError) {
    return (
      <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="text-sm font-semibold uppercase tracking-[0.24em]">视频客服失败</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">无法生成视频客服页面</h2>
        <p className="mt-3 text-sm leading-6 text-rose-800">{describeError(coreQueryError)}</p>
      </section>
    );
  }

  const detailQueryError = [
    snapshotsQuery,
    recordingsQuery,
    summaryQuery,
  ]
    .map((item) => item.error)
    .find((item) => item != null);

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
      setSelectedSessionId(session.id);
      setFeedback(`已开始视频会话 #${session.id}`);
    } catch (error) {
      setFeedback(describeError(error));
    }
  }

  async function handleEndSession() {
    if (!selectedSession) {
      setFeedback('当前没有活跃会话');
      return;
    }
    try {
      videoCall.disconnect();
      const session = await endSessionMutation.mutateAsync({
        sessionId: selectedSession.id,
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
    if (!selectedSession) {
      setFeedback('请先开始视频服务，再创建抓拍记录');
      return;
    }
    try {
      const snapshot = await createSnapshotMutation.mutateAsync({
        sessionId: selectedSession.id,
        payload: {
          label: `抓拍 ${snapshots.length + 1}`,
          note: `来自视频客服会话 #${selectedSession.id} 的人工抓拍`,
        },
      });
      setFeedback(`已创建抓拍记录「${snapshot.label}」`);
    } catch (error) {
      setFeedback(describeError(error));
    }
  }

  async function handleTransferTicket() {
    if (!selectedSession) {
      setFeedback('请先开始视频服务，再转工单');
      return;
    }
    try {
      const ticket = await transferTicketMutation.mutateAsync({
        sessionId: selectedSession.id,
        payload: {
          title: `视频会话 #${selectedSession.id} 工单`,
          priority: 'high',
          source: 'video',
          assignee: activeConversation?.assignee ?? selectedSession.assignee ?? 'video-agent',
          assignee_group: '视频客服',
          summary: `会话 #${selectedSession.id} 已转工单，当前客户：${customer?.name ?? '未知'}`,
        },
      });
      setTicketDraft(ticket);
      setTicketDraftSessionId(selectedSession.id);
      setFeedback(`已转工单 #${ticket.id}`);
    } catch (error) {
      setFeedback(describeError(error));
    }
  }

  async function handleSaveSummary() {
    if (!selectedSession || !summary) {
      setFeedback('当前没有可保存的会后摘要');
      return;
    }
    try {
      await updateSummaryMutation.mutateAsync({
        sessionId: selectedSession.id,
        payload: {
          ai_summary: summary.ai_summary,
          operator_summary: summaryDraft.operator_summary,
          issue_category: summaryDraft.issue_category,
          resolution: summaryDraft.resolution,
          next_action: summaryDraft.next_action,
          handoff_reason: summaryDraft.handoff_reason,
          follow_up_required: summaryDraft.follow_up_required,
        },
      });
      setFeedback('会后摘要已保存');
    } catch (error) {
      setFeedback(describeError(error));
    }
  }

  async function handleToggleRecordingRetention(recordingId: number, currentState: 'retained' | 'deleted') {
    try {
      const nextState = currentState === 'deleted' ? 'retained' : 'deleted';
      await updateRecordingRetentionMutation.mutateAsync({
        recordingId,
        payload: {
          retention_state: nextState,
          reason: nextState === 'deleted' ? '由坐席端标记删除' : undefined,
        },
      });
      setRecordingFilter(nextState);
      setSelectedRecordingId(recordingId);
      setFeedback(nextState === 'deleted' ? '录制已标记为删除' : '录制已恢复为保留');
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
              通过 1v1 WebRTC、WebSocket 信令、浏览器录制上传和回放列表完成真实视频服务工作台。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {selectedSession?.status === 'active' ? (
              <button type="button" onClick={handleEndSession} className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
                结束服务
              </button>
            ) : (
              <button type="button" onClick={handleStartSession} className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
                开始视频服务
              </button>
            )}
            <Link to="/service-ops" className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100">
              返回服务运营台
            </Link>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">{feedback}</div>
        {videoCall.error ? (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{videoCall.error}</div>
        ) : null}
        {detailQueryError ? (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            辅助数据加载失败，已降级显示当前视频会话。{describeError(detailQueryError)}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <p className="text-sm text-slate-500">1v1 WebRTC</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">
                {selectedSession ? `会话 #${selectedSession.id}` : '等待接入客户'}
              </h3>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone(selectedSession?.status)}`}>
              {videoCall.connectionState}
            </span>
          </div>
          <div className="grid gap-4 p-5 xl:grid-cols-2">
            <div className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-slate-950">
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-xs uppercase tracking-[0.28em] text-slate-400">
                <span>坐席本地预览</span>
                <span>{customer?.name ?? '未匹配客户'}</span>
              </div>
              <video ref={videoCall.localVideoRef} autoPlay muted playsInline className="aspect-video w-full bg-slate-900 object-cover" />
            </div>
            <div className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-slate-950">
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-xs uppercase tracking-[0.28em] text-slate-400">
                <span>访客远端画面</span>
                <span>{selectedSession?.assignee ?? '等待接通'}</span>
              </div>
              <video ref={videoCall.remoteVideoRef} autoPlay playsInline className="aspect-video w-full bg-slate-900 object-cover" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 border-t border-slate-200 px-5 py-4">
            <button type="button" onClick={videoCall.connect} disabled={!selectedSession || selectedSession.status !== 'active'} className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300">
              发起 1v1 通话
            </button>
            <button type="button" onClick={videoCall.disconnect} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300">
              断开通话
            </button>
            <button type="button" onClick={videoCall.startRecording} disabled={videoCall.recordingState !== 'idle' || !selectedSession || selectedSession.status !== 'active'} className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100">
              开始录制
            </button>
            <button type="button" onClick={videoCall.stopRecording} disabled={videoCall.recordingState !== 'recording'} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100">
              停止录制
            </button>
            <button type="button" onClick={handleCreateSnapshot} disabled={!selectedSession || selectedSession.status !== 'active'} className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:bg-slate-100">
              抓拍记录
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
              <p>当前状态：{selectedSession?.status ?? 'idle'}</p>
              <p>负责人：{selectedSession?.assignee ?? activeConversation?.assignee ?? '未分配'}</p>
              <p>渠道：{activeConversation?.channel ?? 'video'}</p>
              <p>录制数：{summary?.recording_count ?? recordings.length}</p>
              <p>抓拍数：{summary?.snapshot_count ?? snapshots.length}</p>
              <p>当前工单：{selectedSession?.ticket_id ? `#${selectedSession.ticket_id}` : '暂无'}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={handleTransferTicket} disabled={!selectedSession || selectedSession.status !== 'active'} className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300">
                转工单
              </button>
              <Link to="/history" className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100">
                查看历史
              </Link>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">会话列表</h3>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">history</span>
            </div>
            <div className="mt-4 space-y-3">
              {sessions.length > 0 ? sessions.map((session) => {
                const isSelected = session.id === selectedSession?.id;
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setSelectedSessionId(session.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${isSelected ? 'border-sky-200 bg-sky-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-900">会话 #{session.id}</p>
                      <span className="text-xs text-slate-500">{session.status}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{session.assignee ?? '未分配'} · {formatDateTime(session.started_at)}</p>
                  </button>
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">暂无会话，先点击开始视频服务。</div>
              )}
            </div>
            {detailLoading ? (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">正在同步抓拍、录制和摘要详情…</div>
            ) : null}
          </section>
        </aside>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">录制回放</h3>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">recordings</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {[
              { label: '保留中', value: 'retained' as const },
              { label: '已删除', value: 'deleted' as const },
              { label: '全部', value: 'all' as const },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setRecordingFilter(item.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  recordingFilter === item.value ? 'bg-sky-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            ))}
            <input
              value={recordingKeyword}
              onChange={(event) => setRecordingKeyword(event.target.value)}
              placeholder="搜索录制、备注、文件名"
              className="min-w-[16rem] flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-300"
            />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-3">
              {recordings.length > 0 ? recordings.map((recording) => (
                <button key={recording.id} type="button" onClick={() => setSelectedRecordingId(recording.id)} className={`w-full rounded-2xl border px-4 py-3 text-left transition ${recording.id === selectedRecording?.id ? 'border-sky-200 bg-sky-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">{recording.label}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${recording.retention_state === 'deleted' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {recording.retention_state === 'deleted' ? '已删除' : '保留中'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{recording.note ?? '无备注'}</p>
                  <p className="mt-2 text-xs text-slate-500">{recording.file_name ?? 'video.webm'} · {recording.duration_seconds ?? 0}s</p>
                </button>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">暂无录制文件，先通过浏览器开始录制。</div>
              )}
            </div>
            <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
              {selectedRecording ? (
                <div>
                  <video controls playsInline src={playbackUrl(selectedRecording.playback_url)} className="aspect-video w-full rounded-2xl bg-slate-900 object-cover" />
                  <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-900">{selectedRecording.label}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${selectedRecording.retention_state === 'deleted' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {selectedRecording.retention_state === 'deleted' ? '已删除' : '保留中'}
                      </span>
                    </div>
                    <p>{selectedRecording.note ?? '无备注'}</p>
                    <p className="text-xs text-slate-500">{selectedRecording.file_name ?? 'video.webm'} · {selectedRecording.duration_seconds ?? 0} 秒</p>
                    <p className="text-xs text-slate-500">播放 URL：{selectedRecording.playback_url ?? '自动生成'}</p>
                    <p className="text-xs text-slate-500">文件键：{selectedRecording.file_key ?? '未上传'}</p>
                    <p className="text-xs text-slate-500">删除原因：{selectedRecording.retention_reason ?? '无'}</p>
                    <p className="text-xs text-slate-500">删除时间：{selectedRecording.deleted_at ? formatDateTime(selectedRecording.deleted_at) : '无'}</p>
                    <p className="text-xs text-slate-500">保留时间：{selectedRecording.retained_at ? formatDateTime(selectedRecording.retained_at) : '无'}</p>
                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => void handleToggleRecordingRetention(selectedRecording.id, selectedRecording.retention_state)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                          selectedRecording.retention_state === 'deleted'
                            ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                            : 'bg-rose-600 text-white hover:bg-rose-500'
                        }`}
                      >
                        {selectedRecording.retention_state === 'deleted' ? '保留回放' : '删除回放'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">暂无可播放的录制文件。</div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">会后摘要与抓拍</h3>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">summary</span>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-3">
              {snapshots.length > 0 ? snapshots.map((snapshot) => (
                <article key={snapshot.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-medium text-slate-900">{snapshot.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{snapshot.note ?? '无备注'}</p>
                  <p className="mt-2 text-xs text-slate-500">{formatDateTime(snapshot.created_at)}</p>
                </article>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">还没有抓拍记录。</div>
              )}
            </div>
            <form
              className="space-y-3 rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveSummary();
              }}
            >
              <div>
                <label htmlFor="video-ai-summary" className="text-sm font-medium text-slate-700">AI 摘要</label>
                <textarea id="video-ai-summary" value={summary?.ai_summary ?? ''} readOnly rows={3} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none" />
              </div>
              <div>
                <label htmlFor="video-operator-summary" className="text-sm font-medium text-slate-700">人工摘要</label>
                <textarea id="video-operator-summary" value={summaryDraft.operator_summary} onChange={(event) => setSummaryDraft((current) => ({ ...current, operator_summary: event.target.value }))} rows={3} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input aria-label="问题分类" value={summaryDraft.issue_category} onChange={(event) => setSummaryDraft((current) => ({ ...current, issue_category: event.target.value }))} placeholder="问题分类" className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none" />
                <input aria-label="下一步动作" value={summaryDraft.next_action} onChange={(event) => setSummaryDraft((current) => ({ ...current, next_action: event.target.value }))} placeholder="下一步动作" className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none" />
              </div>
              <textarea aria-label="处理结果" value={summaryDraft.resolution} onChange={(event) => setSummaryDraft((current) => ({ ...current, resolution: event.target.value }))} rows={2} placeholder="处理结果" className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none" />
              <textarea aria-label="转人工/转工单原因" value={summaryDraft.handoff_reason} onChange={(event) => setSummaryDraft((current) => ({ ...current, handoff_reason: event.target.value }))} rows={2} placeholder="转人工/转工单原因" className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none" />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={summaryDraft.follow_up_required} onChange={(event) => setSummaryDraft((current) => ({ ...current, follow_up_required: event.target.checked }))} />
                需要后续跟进
              </label>
              <button type="submit" className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
                保存会后摘要
              </button>
            </form>
          </div>
        </section>
      </div>
    </section>
  );
}
