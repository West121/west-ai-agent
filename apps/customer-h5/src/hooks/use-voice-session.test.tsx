import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useVoiceSession } from '@/hooks/use-voice-session';
import * as customerApi from '@/lib/customer-h5-api';

describe('useVoiceSession', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts a session, appends partial transcripts and finalizes a turn', async () => {
    vi.spyOn(customerApi, 'startVoiceSession').mockResolvedValue({
      voice_session_id: 88,
      livekit_room: 'voice-88',
      status: 'connecting',
    });
    vi.spyOn(customerApi, 'appendVoiceTranscript').mockResolvedValue({
      id: 7,
      voice_session_id: 88,
      speaker: 'customer',
      text: '苹果手机',
      normalized_text: 'iPhone',
      is_final: false,
      start_ms: 0,
      end_ms: 1200,
      created_at: '2026-04-09T01:00:00.000Z',
    });
    vi.spyOn(customerApi, 'finalizeVoiceTurn').mockResolvedValue({
      decision: 'answer',
      transcript: '苹果手机怎么选？',
      normalized_text: 'iPhone 手机怎么选？',
      answer: '建议根据预算和拍照需求选择。',
      clarification: null,
      handoff: false,
      audio_mime_type: 'audio/mpeg',
      audio_duration_ms: 1320,
    });

    const { result } = renderHook(() =>
      useVoiceSession({
        conversationId: 2001,
        customerProfileId: 101,
      }),
    );

    await act(async () => {
      await result.current.startVoiceSession('voice-88');
    });

    expect(result.current.session?.voice_session_id).toBe(88);
    expect(result.current.status).toBe('listening');

    await act(async () => {
      await result.current.appendPartialTranscript('苹果手机');
    });

    expect(result.current.transcripts).toHaveLength(1);
    expect(result.current.transcripts[0]?.kind).toBe('partial');
    expect(result.current.transcripts[0]?.normalizedText).toBe('iPhone');

    await act(async () => {
      await result.current.finalizeVoiceTurn('苹果手机怎么选？');
    });

    expect(result.current.lastTurn?.decision).toBe('answer');
    expect(result.current.status).toBe('speaking');
    expect(result.current.transcripts).toHaveLength(3);
    expect(result.current.transcripts[1]?.speaker).toBe('customer');
    expect(result.current.transcripts[2]?.speaker).toBe('assistant');
    expect(result.current.transcripts[2]?.text).toContain('预算');
  });
});
