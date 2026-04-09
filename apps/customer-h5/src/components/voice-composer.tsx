import { useState, type FormEvent } from 'react';

import { voiceRealtimeServiceBaseUrl } from '@/lib/runtime-config';
import { useVoiceSession } from '@/hooks/use-voice-session';

interface VoiceComposerProps {
  conversationId: number | null;
  customerProfileId: number | null;
  conversationStatus?: string | null;
}

function voiceStateLabel(value: ReturnType<typeof useVoiceSession>['status']) {
  switch (value) {
    case 'idle':
      return '待开启';
    case 'starting':
      return '启动中';
    case 'listening':
      return '监听中';
    case 'partial':
      return '实时转写';
    case 'finalizing':
      return '终稿处理中';
    case 'speaking':
      return '播报中';
    case 'handoff':
      return '已转人工';
    case 'error':
      return '异常';
    default:
      return value;
  }
}

function transcriptKindLabel(kind: string) {
  switch (kind) {
    case 'partial':
      return '实时';
    case 'final':
      return '终稿';
    case 'assistant':
      return 'AI 回复';
    case 'handoff':
      return '转人工';
    case 'info':
      return '状态';
    default:
      return kind;
  }
}

function speakerLabel(speaker: string) {
  switch (speaker) {
    case 'customer':
      return '访客';
    case 'assistant':
      return 'AI';
    case 'system':
      return '系统';
    default:
      return speaker;
  }
}

export function VoiceComposer({
  conversationId,
  customerProfileId,
  conversationStatus,
}: VoiceComposerProps) {
  const [draft, setDraft] = useState('');
  const voice = useVoiceSession({ conversationId, customerProfileId });
  const sessionReady = Boolean(voice.session);
  const canUseVoice =
    conversationId !== null && customerProfileId !== null && conversationStatus !== 'ended';
  const currentRoom = voice.session?.livekit_room ?? `voice-${conversationId ?? 'pending'}`;
  const busy = voice.status === 'starting' || voice.status === 'finalizing';
  const transcriptControlsDisabled = !canUseVoice || !sessionReady || busy;

  async function handleStartSession() {
    await voice.startVoiceSession(currentRoom);
  }

  async function handleAppendPartial(event: FormEvent) {
    event.preventDefault();
    if (!sessionReady) {
      return;
    }

    const text = draft.trim();
    if (!text) {
      return;
    }

    await voice.appendPartialTranscript(text);
  }

  async function handleFinalizeTurn() {
    if (!sessionReady) {
      return;
    }

    const text = draft.trim();
    if (!text) {
      return;
    }

    await voice.finalizeVoiceTurn(text);
    setDraft('');
  }

  function handleReset() {
    setDraft('');
    voice.resetVoiceSession();
  }

  return (
    <section className="rounded-3xl border border-cyan-200/70 bg-gradient-to-br from-cyan-50/90 via-white to-slate-50 p-4 shadow-soft backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Voice Mode</p>
          <h4 className="mt-2 text-base font-semibold tracking-tight text-slate-950">智能语音客服</h4>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            本地私有实时语音模式，支持转写草稿、终稿修正和转人工回退。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
            {voiceStateLabel(voice.status)}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
            {voiceRealtimeServiceBaseUrl}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center justify-center rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canUseVoice || sessionReady || busy}
              onClick={handleStartSession}
              type="button"
            >
              {voice.status === 'starting' ? '启动中...' : '开始语音会话'}
            </button>
            <button
              className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!sessionReady && voice.status === 'idle'}
              onClick={handleReset}
              type="button"
            >
              重置语音
            </button>
          </div>

          {!canUseVoice ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-3 text-sm leading-6 text-slate-600">
              {conversationStatus === 'ended'
                ? '当前会话已结束，语音模式仅可查看历史转写。'
                : '先创建会话和 customer profile，再开启语音模式。'}
            </div>
          ) : null}

          <form className="space-y-3" onSubmit={handleAppendPartial}>
            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                实时转写草稿
              </span>
              <textarea
                className="min-h-[116px] w-full rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100"
                disabled={transcriptControlsDisabled}
                placeholder={
                  !sessionReady
                    ? '先点击“开始语音会话”'
                    : '输入模拟识别文本，先追加实时转写，或直接完成本轮语音'
                }
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs leading-5 text-slate-500">
                对接实时识别、终稿修正和语音播报时，这里会显示当前回合的语音转写与 AI 结果。
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={transcriptControlsDisabled || !draft.trim()}
                  type="submit"
                >
                  追加转写
                </button>
                <button
                  className="inline-flex items-center justify-center rounded-2xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={transcriptControlsDisabled || !draft.trim()}
                  onClick={handleFinalizeTurn}
                  type="button"
                >
                  {voice.status === 'finalizing' ? '完成中...' : '完成本轮'}
                </button>
              </div>
            </div>
          </form>

          {voice.error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
              {voice.error}
            </div>
          ) : null}

          {voice.lastTurn ? (
            <div
              data-testid="voice-last-turn"
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.24em]">最新 AI 结果</p>
              <p className="mt-2 whitespace-pre-wrap">{voice.lastTurn.answer ?? voice.lastTurn.clarification ?? voice.lastTurn.transcript}</p>
              <p className="mt-1 text-xs opacity-80">
                决策：{voice.lastTurn.decision}
                {voice.lastTurn.handoff ? ' · 已转人工' : ''}
                {voice.lastTurn.audio_mime_type ? ` · ${voice.lastTurn.audio_mime_type}` : ''}
                {voice.lastTurn.audio_duration_ms ? ` · ${voice.lastTurn.audio_duration_ms}ms` : ''}
              </p>
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/90 p-3">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Transcript</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {voice.session ? `会话 ${voice.session.voice_session_id}` : '等待开始语音'}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {sessionReady ? currentRoom : '未连接'}
            </span>
          </div>

          <div className="mt-3 max-h-[340px] space-y-2 overflow-y-auto pr-1">
            {voice.transcripts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm leading-6 text-slate-600">
                开始语音会话后，实时转写和 AI 回复会在这里展示。
              </div>
            ) : (
              voice.transcripts.map((item) => (
                <article
                  key={item.id}
                  className={[
                    'rounded-2xl border px-4 py-3 text-sm leading-6',
                    item.speaker === 'assistant'
                      ? 'border-cyan-200 bg-cyan-50 text-cyan-950'
                      : item.speaker === 'system'
                        ? 'border-amber-200 bg-amber-50 text-amber-950'
                        : item.kind === 'partial'
                          ? 'border-slate-200 bg-slate-50 text-slate-700'
                          : 'border-slate-200 bg-white text-slate-900',
                  ].join(' ')}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {speakerLabel(item.speaker)}
                      </span>
                      <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                        {transcriptKindLabel(item.kind)}
                      </span>
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      {new Intl.DateTimeFormat('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(item.createdAt))}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap">{item.text}</p>
                  {item.normalizedText ? (
                    <p className="mt-2 text-xs leading-5 text-slate-500">标准化：{item.normalizedText}</p>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
