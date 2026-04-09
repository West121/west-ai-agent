import { useEffect, useState, type FormEvent } from 'react';

import {
  useAppendVoiceTranscript,
  useCreateVoiceHandoff,
  useCreateVoiceSession,
  useVoiceAudioAssets,
  useVoiceHandoffs,
  useVoiceSessions,
  useVoiceTranscripts,
} from '@/hooks/use-platform-api';
import { formatDateTime, formatDateTimeRelative } from '@/lib/format';

function statusTone(status: string | null | undefined) {
  const normalized = (status ?? '').toLowerCase();
  if (normalized.includes('ended')) {
    return 'border-slate-200 bg-slate-50 text-slate-600';
  }
  if (normalized.includes('handoff') || normalized.includes('pending')) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (normalized.includes('speaking')) {
    return 'border-sky-200 bg-sky-50 text-sky-700';
  }
  if (normalized.includes('listening') || normalized.includes('connecting')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function speakerLabel(speaker: string) {
  if (speaker === 'agent') return '坐席';
  if (speaker === 'system') return '系统';
  return '用户';
}

function formatDuration(durationMs: number | null | undefined) {
  if (durationMs == null) {
    return '未知时长';
  }
  return `${Math.max(durationMs, 0)} ms`;
}

export type VoiceSessionPanelProps = {
  conversationId: number | null;
  customerProfileId: number | null;
  assignee?: string | null;
};

export function VoiceSessionPanel({ conversationId, customerProfileId, assignee }: VoiceSessionPanelProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [speaker, setSpeaker] = useState<'customer' | 'agent' | 'system'>('customer');
  const [transcriptText, setTranscriptText] = useState('');
  const [normalizedText, setNormalizedText] = useState('');
  const [isFinal, setIsFinal] = useState(true);
  const [handoffReason, setHandoffReason] = useState('');
  const [handoffSummary, setHandoffSummary] = useState('');
  const [handoffTarget, setHandoffTarget] = useState(assignee ?? '');
  const [feedback, setFeedback] = useState<string | null>(null);

  const sessionsQuery = useVoiceSessions({
    conversationId,
    customerProfileId,
  });
  const createSessionMutation = useCreateVoiceSession();
  const appendTranscriptMutation = useAppendVoiceTranscript();
  const createHandoffMutation = useCreateVoiceHandoff();

  const sessions = sessionsQuery.data ?? [];
  const selectedSession =
    sessions.find((item) => item.id === selectedSessionId) ?? sessions[0] ?? null;

  const transcriptsQuery = useVoiceTranscripts(selectedSession?.id);
  const assetsQuery = useVoiceAudioAssets(selectedSession?.id);
  const handoffsQuery = useVoiceHandoffs(selectedSession?.id);

  useEffect(() => {
    if (!selectedSession) {
      setSelectedSessionId(null);
      return;
    }
    if (selectedSessionId !== selectedSession.id) {
      setSelectedSessionId(selectedSession.id);
    }
  }, [selectedSession, selectedSessionId]);

  useEffect(() => {
    setHandoffTarget(assignee ?? '');
  }, [assignee]);

  useEffect(() => {
    setFeedback(null);
  }, [conversationId, customerProfileId]);

  async function handleCreateSession() {
    if (conversationId == null || customerProfileId == null) {
      setFeedback('当前会话缺少客户或会话 id，无法创建语音会话');
      return;
    }

    const session = await createSessionMutation.mutateAsync({
      conversation_id: conversationId,
      customer_profile_id: customerProfileId,
      channel: 'voice',
      status: 'connecting',
      livekit_room: `voice-room-${conversationId}`,
      stt_provider: 'sherpa-onnx',
      finalizer_provider: 'funasr',
      tts_provider: 'sherpa-onnx',
    });

    setSelectedSessionId(session.id);
    setFeedback(`已创建语音会话 #${session.id}`);
  }

  async function handleAppendTranscript(event: FormEvent) {
    event.preventDefault();
    if (!selectedSession) {
      setFeedback('先选择或创建一个语音会话');
      return;
    }

    const text = transcriptText.trim();
    if (!text) {
      return;
    }

    await appendTranscriptMutation.mutateAsync({
      voiceSessionId: selectedSession.id,
      payload: {
        speaker,
        text,
        normalized_text: normalizedText.trim() || null,
        is_final: isFinal,
      },
    });
    setTranscriptText('');
    setNormalizedText('');
    setIsFinal(true);
    setFeedback('已写入转写片段');
  }

  async function handleCreateHandoff(event: FormEvent) {
    event.preventDefault();
    if (!selectedSession) {
      setFeedback('先选择或创建一个语音会话');
      return;
    }

    const reason = handoffReason.trim();
    const summary = handoffSummary.trim();
    if (!reason || !summary) {
      setFeedback('转人工需要填写原因和摘要');
      return;
    }

    await createHandoffMutation.mutateAsync({
      voiceSessionId: selectedSession.id,
      payload: {
        reason,
        summary,
        handed_off_to: handoffTarget.trim() || assignee || null,
      },
    });
    setFeedback('已创建转人工记录');
  }

  const transcriptItems = transcriptsQuery.data ?? [];
  const assetItems = assetsQuery.data ?? [];
  const handoffItems = handoffsQuery.data ?? [];

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">Voice</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">语音会话面板</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            视觉化当前会话的语音状态、转写片段和转人工记录，保持与实时文本会话同一条业务链路。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            会话 {sessions.length} 条
          </span>
          <button
            type="button"
            onClick={() => void handleCreateSession()}
            disabled={createSessionMutation.isPending || conversationId == null || customerProfileId == null}
            className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {createSessionMutation.isPending ? '创建中...' : '开启语音会话'}
          </button>
        </div>
      </div>

      {feedback ? (
        <div className="mt-4 rounded-[1rem] border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          {feedback}
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <aside className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-slate-950">语音会话列表</h4>
            <button
              type="button"
              onClick={() => void sessionsQuery.refetch()}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-sky-200 hover:text-sky-700"
            >
              刷新
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {sessionsQuery.isLoading ? (
              <p className="text-sm text-slate-500">正在读取语音会话...</p>
            ) : sessionsQuery.isError ? (
              <div className="rounded-[1rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
                无法读取语音会话
              </div>
            ) : sessions.length > 0 ? (
              sessions.map((session) => {
                const selected = session.id === selectedSession?.id;
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setSelectedSessionId(session.id)}
                    className={[
                      'block w-full rounded-[1.15rem] border p-4 text-left transition',
                      selected
                        ? 'border-sky-200 bg-white shadow-sm'
                        : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/60',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-950">语音会话 #{session.id}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          房间 {session.livekit_room ?? '未分配'} · {formatDateTimeRelative(session.started_at)}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(session.status)}`}>
                        {session.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-50 px-2.5 py-1">转写 {session.transcript_count}</span>
                      <span className="rounded-full bg-slate-50 px-2.5 py-1">录音 {session.audio_asset_count}</span>
                      <span className="rounded-full bg-slate-50 px-2.5 py-1">接管 {session.handoff_count}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-[1rem] border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                当前会话还没有语音会话记录。点击“开启语音会话”创建第一条。
              </div>
            )}
          </div>
        </aside>

        <div className="grid gap-5">
          <section className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-slate-950">语音会话详情</h4>
              {selectedSession ? (
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(selectedSession.status)}`}>
                  {selectedSession.status}
                </span>
              ) : (
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">未选中</span>
              )}
            </div>

            {selectedSession ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-[1rem] bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">接入会话</p>
                  <p className="mt-2 text-sm font-medium text-slate-950">#{selectedSession.conversation_id}</p>
                  <p className="mt-1 text-sm text-slate-500">客户 #{selectedSession.customer_profile_id}</p>
                </div>
                <div className="rounded-[1rem] bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">实时配置</p>
                  <p className="mt-2 text-sm text-slate-700">STT: {selectedSession.stt_provider}</p>
                  <p className="mt-1 text-sm text-slate-700">TTS: {selectedSession.tts_provider}</p>
                </div>
                <div className="rounded-[1rem] bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">终稿修正</p>
                  <p className="mt-2 text-sm text-slate-700">{selectedSession.finalizer_provider}</p>
                  <p className="mt-1 text-sm text-slate-500">转人工：{selectedSession.handoff_pending ? '待接管' : '正常'}</p>
                </div>
                <div className="rounded-[1rem] border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">LiveKit 房间</p>
                  <p className="mt-2 text-sm font-medium text-slate-950">{selectedSession.livekit_room ?? '未绑定'}</p>
                  <p className="mt-1 text-sm text-slate-500">开始时间 {formatDateTime(selectedSession.started_at)}</p>
                </div>
                <div className="rounded-[1rem] border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">结束时间</p>
                  <p className="mt-2 text-sm font-medium text-slate-950">
                    {selectedSession.ended_at ? formatDateTime(selectedSession.ended_at) : '未结束'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">更新时间 {formatDateTime(selectedSession.updated_at)}</p>
                </div>
                <div className="rounded-[1rem] border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">资产数量</p>
                  <p className="mt-2 text-sm font-medium text-slate-950">音频 {selectedSession.audio_asset_count}</p>
                  <p className="mt-1 text-sm text-slate-500">录制 {selectedSession.audio_asset_count}</p>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-[1rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                先创建或选择一个语音会话。
              </div>
            )}
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-950">转写片段</h4>
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                  {transcriptItems.length} 条
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {transcriptsQuery.isLoading ? (
                  <p className="text-sm text-slate-500">正在读取转写片段...</p>
                ) : transcriptItems.length > 0 ? (
                  transcriptItems.map((item) => (
                    <article key={item.id} className="rounded-[1rem] bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-950">{speakerLabel(item.speaker)}</p>
                        <span className="text-xs text-slate-500">
                          {item.is_final ? '最终稿' : '实时稿'} · {formatDateTimeRelative(item.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.text}</p>
                      {item.normalized_text ? (
                        <p className="mt-2 text-xs leading-5 text-sky-700">标准化：{item.normalized_text}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-slate-500">
                        {formatDuration(item.start_ms)} - {formatDuration(item.end_ms)}
                      </p>
                    </article>
                  ))
                ) : (
                  <div className="rounded-[1rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    当前没有转写片段。
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-5">
              <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-slate-950">录音资产</h4>
                  <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                    {assetItems.length} 条
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {assetsQuery.isLoading ? (
                    <p className="text-sm text-slate-500">正在读取录音资产...</p>
                  ) : assetItems.length > 0 ? (
                    assetItems.map((item) => (
                      <article key={item.id} className="rounded-[1rem] bg-slate-50 p-4">
                        <p className="text-sm font-medium text-slate-950">{item.asset_type}</p>
                        <p className="mt-1 break-all text-sm text-slate-600">{item.file_key}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.mime_type} · {formatDuration(item.duration_ms)}
                        </p>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-[1rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      还没有录音资产。
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-slate-950">接管记录</h4>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                    {handoffItems.length} 条
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {handoffsQuery.isLoading ? (
                    <p className="text-sm text-slate-500">正在读取接管记录...</p>
                  ) : handoffItems.length > 0 ? (
                    handoffItems.map((item) => (
                      <article key={item.id} className="rounded-[1rem] bg-amber-50/70 p-4">
                        <p className="text-sm font-medium text-amber-900">{item.reason}</p>
                        <p className="mt-1 text-sm leading-6 text-amber-900/85">{item.summary}</p>
                        <p className="mt-2 text-xs text-amber-800">
                          {item.handed_off_to ?? '未指定接管人'} · {formatDateTimeRelative(item.created_at)}
                        </p>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-[1rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      当前没有接管记录。
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <form className="rounded-[1.35rem] border border-slate-200 bg-white p-4" onSubmit={handleAppendTranscript}>
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-950">追加转写</h4>
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                  写入 voice_transcript_segments
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">说话人</span>
                  <select
                    value={speaker}
                    onChange={(event) => setSpeaker(event.target.value as 'customer' | 'agent' | 'system')}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  >
                    <option value="customer">customer</option>
                    <option value="agent">agent</option>
                    <option value="system">system</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">最终稿</span>
                  <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={isFinal}
                      onChange={(event) => setIsFinal(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    该段已完成最终转写
                  </label>
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-slate-700">转写内容</span>
                  <textarea
                    value={transcriptText}
                    onChange={(event) => setTranscriptText(event.target.value)}
                    rows={4}
                    placeholder="输入一段语音转写文本，保存后会刷新语音会话片段"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-slate-700">标准化文本</span>
                  <textarea
                    value={normalizedText}
                    onChange={(event) => setNormalizedText(event.target.value)}
                    rows={3}
                    placeholder="可填实体标准化后的文本，例如 iPhone 16 Pro / Apple Store 浦东国金"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">面板中的语音片段写入后，会同步刷新会话详情和转人工状态。</p>
                <button
                  type="submit"
                  disabled={!selectedSession || !transcriptText.trim() || appendTranscriptMutation.isPending}
                  className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {appendTranscriptMutation.isPending ? '写入中...' : '保存转写'}
                </button>
              </div>
            </form>

            <form className="rounded-[1.35rem] border border-slate-200 bg-white p-4" onSubmit={handleCreateHandoff}>
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-950">转人工接管</h4>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                  handoff_pending {selectedSession?.handoff_pending ? 'true' : 'false'}
                </span>
              </div>
              <div className="mt-4 grid gap-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">接管原因</span>
                  <textarea
                    value={handoffReason}
                    onChange={(event) => setHandoffReason(event.target.value)}
                    rows={3}
                    placeholder="例如：语音识别无法判断型号，需要人工确认"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">接管摘要</span>
                  <textarea
                    value={handoffSummary}
                    onChange={(event) => setHandoffSummary(event.target.value)}
                    rows={4}
                    placeholder="概括当前语音会话的状态、用户诉求与已识别信息"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">接管人</span>
                  <input
                    value={handoffTarget}
                    onChange={(event) => setHandoffTarget(event.target.value)}
                    placeholder="agent-a"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">创建后会同步标记接管状态，供坐席继续实时接入。</p>
                <button
                  type="submit"
                  disabled={
                    !selectedSession ||
                    !handoffReason.trim() ||
                    !handoffSummary.trim() ||
                    createHandoffMutation.isPending
                  }
                  className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {createHandoffMutation.isPending ? '保存中...' : '创建接管'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </section>
  );
}
