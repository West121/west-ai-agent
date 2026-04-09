import { useEffect, useState } from 'react';

import {
  appendVoiceTranscript as requestAppendVoiceTranscript,
  finalizeVoiceTurn as requestFinalizeVoiceTurn,
  startVoiceSession as requestStartVoiceSession,
  type VoiceSessionBootstrapRead,
  type VoiceTranscriptRead,
  type VoiceTurnRead,
} from '@/lib/customer-h5-api';

export type VoiceSessionState =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'partial'
  | 'finalizing'
  | 'speaking'
  | 'handoff'
  | 'error';

export interface VoiceTranscriptEntry {
  id: string;
  speaker: 'customer' | 'assistant' | 'system';
  kind: 'partial' | 'final' | 'assistant' | 'handoff' | 'info';
  text: string;
  normalizedText: string | null;
  createdAt: string;
  meta?: {
    decision?: string;
    audioMimeType?: string | null;
    audioDurationMs?: number | null;
  };
}

interface UseVoiceSessionOptions {
  conversationId: number | null;
  customerProfileId: number | null;
}

function createVoiceTranscriptId(prefix: string): string {
  const suffix = globalThis.crypto?.randomUUID?.().slice(0, 8) ?? `${Date.now()}`;
  return `${prefix}-${suffix}`;
}

function mapVoiceTranscriptEntry(segment: VoiceTranscriptRead, kind: VoiceTranscriptEntry['kind']): VoiceTranscriptEntry {
  return {
    id: `voice-segment-${segment.id}`,
    speaker: segment.speaker === 'assistant' ? 'assistant' : segment.speaker === 'system' ? 'system' : 'customer',
    kind,
    text: segment.text,
    normalizedText: segment.normalized_text,
    createdAt: segment.created_at,
  };
}

function upsertTranscriptEntry(current: VoiceTranscriptEntry[], incoming: VoiceTranscriptEntry): VoiceTranscriptEntry[] {
  const index = current.findIndex((item) => item.id === incoming.id);
  if (index === -1) {
    return [...current, incoming];
  }

  const next = current.slice();
  next[index] = {
    ...next[index],
    ...incoming,
  };
  return next;
}

function useVoiceSession({ conversationId, customerProfileId }: UseVoiceSessionOptions) {
  const [session, setSession] = useState<VoiceSessionBootstrapRead | null>(null);
  const [status, setStatus] = useState<VoiceSessionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<VoiceTranscriptEntry[]>([]);
  const [lastTurn, setLastTurn] = useState<VoiceTurnRead | null>(null);

  useEffect(() => {
    setSession(null);
    setStatus('idle');
    setError(null);
    setTranscripts([]);
    setLastTurn(null);
  }, [conversationId, customerProfileId]);

  function ensureConversationContext() {
    if (conversationId === null || customerProfileId === null) {
      throw new Error('需要先创建 customer profile 和 conversation');
    }
  }

  async function startVoiceSession(livekitRoom?: string | null) {
    ensureConversationContext();
    const activeConversationId = conversationId as number;
    const activeCustomerProfileId = customerProfileId as number;
    setStatus('starting');
    setError(null);

    try {
      const bootstrap = await requestStartVoiceSession({
        conversation_id: activeConversationId,
        customer_profile_id: activeCustomerProfileId,
        livekit_room: livekitRoom ?? null,
      });
      setSession(bootstrap);
      setStatus('listening');
      return bootstrap;
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : '语音会话创建失败';
      setError(message);
      setStatus('error');
      throw startError;
    }
  }

  async function appendPartialTranscript(transcriptText: string) {
    if (!session) {
      throw new Error('请先开始语音会话');
    }

    const trimmed = transcriptText.trim();
    if (!trimmed) {
      return undefined;
    }

    setStatus('partial');
    setError(null);

    try {
      const segment = await requestAppendVoiceTranscript(session.voice_session_id, {
        transcript_text: trimmed,
        speaker: 'customer',
      });
      const entry = mapVoiceTranscriptEntry(segment, 'partial');
      setTranscripts((current) => upsertTranscriptEntry(current, entry));
      setStatus('listening');
      return segment;
    } catch (appendError) {
      const message = appendError instanceof Error ? appendError.message : '追加转写失败';
      setError(message);
      setStatus('error');
      throw appendError;
    }
  }

  async function finalizeVoiceTurn(transcriptText: string) {
    if (!session) {
      throw new Error('请先开始语音会话');
    }

    ensureConversationContext();
    const activeConversationId = conversationId as number;
    const trimmed = transcriptText.trim();
    if (!trimmed) {
      throw new Error('转写内容不能为空');
    }

    setStatus('finalizing');
    setError(null);

    try {
      const result = await requestFinalizeVoiceTurn(session.voice_session_id, {
        conversation_id: activeConversationId,
        transcript_text: trimmed,
      });
      setLastTurn(result);

      const createdAt = new Date().toISOString();
      const customerEntry: VoiceTranscriptEntry = {
        id: createVoiceTranscriptId('voice-final'),
        speaker: 'customer',
        kind: 'final',
        text: result.transcript,
        normalizedText: result.normalized_text,
        createdAt,
      };
      setTranscripts((current) => {
        const nextEntries = upsertTranscriptEntry(current, customerEntry);

        if (result.answer) {
          nextEntries.push({
            id: createVoiceTranscriptId('voice-answer'),
            speaker: 'assistant',
            kind: 'assistant',
            text: result.answer,
            normalizedText: result.answer,
            createdAt,
            meta: {
              decision: result.decision,
              audioMimeType: result.audio_mime_type,
              audioDurationMs: result.audio_duration_ms,
            },
          });
        } else if (result.clarification) {
          nextEntries.push({
            id: createVoiceTranscriptId('voice-clarify'),
            speaker: 'assistant',
            kind: 'assistant',
            text: result.clarification,
            normalizedText: result.clarification,
            createdAt,
            meta: {
              decision: result.decision,
              audioMimeType: result.audio_mime_type,
              audioDurationMs: result.audio_duration_ms,
            },
          });
        } else if (result.handoff) {
          nextEntries.push({
            id: createVoiceTranscriptId('voice-handoff'),
            speaker: 'system',
            kind: 'handoff',
            text: '已切换为人工接待。',
            normalizedText: result.normalized_text,
            createdAt,
            meta: {
              decision: result.decision,
            },
          });
        }

        return nextEntries;
      });
      setStatus(result.handoff ? 'handoff' : result.answer || result.clarification ? 'speaking' : 'listening');
      return result;
    } catch (finalizeError) {
      const message = finalizeError instanceof Error ? finalizeError.message : '语音转写提交失败';
      setError(message);
      setStatus('error');
      throw finalizeError;
    }
  }

  function resetVoiceSession() {
    setSession(null);
    setStatus('idle');
    setError(null);
    setTranscripts([]);
    setLastTurn(null);
  }

  return {
    session,
    status,
    error,
    transcripts,
    lastTurn,
    startVoiceSession,
    appendPartialTranscript,
    finalizeVoiceTurn,
    resetVoiceSession,
  };
}

export { useVoiceSession };
