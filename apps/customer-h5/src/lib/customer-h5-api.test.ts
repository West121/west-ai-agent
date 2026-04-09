import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  appendVoiceTranscript,
  finalizeVoiceTurn,
  requestAiDecision,
  startVoiceSession,
} from '@/lib/customer-h5-api';

describe('requestAiDecision', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls ai-service chat answer endpoint by default', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          decision: 'answer',
          answer: '一般情况下原路退款会在 1 到 3 个工作日到账。',
          confidence: 0.92,
          retrieval_summary: {
            top_score: 0.92,
            matched_count: 1,
            matched_documents: [],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    const result = await requestAiDecision({ query: '退款多久到账？' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8020/chat/answer',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ query: '退款多久到账？' }),
      }),
    );
    expect(result.decision).toBe('answer');
    expect(result.answer).toContain('退款');
  });

  it('can call decision endpoint explicitly', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          decision: 'handoff',
          answer: null,
          confidence: 0.41,
          retrieval_summary: {
            top_score: 0.41,
            matched_count: 1,
            matched_documents: [],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    const result = await requestAiDecision({ query: '这个问题比较复杂', endpoint: 'decision' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8020/decision',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ query: '这个问题比较复杂' }),
      }),
    );
    expect(result.decision).toBe('handoff');
  });

  it('can call workflow triage endpoint for complex flows', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          decision: 'clarify',
          answer: null,
          clarification: '请补充订单号和手机号。',
          workflow_mode: 'langgraph',
          confidence: 0.78,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    const result = await requestAiDecision({ query: '退款但我还没收到，怎么办', endpoint: 'triage' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8020/workflow/triage',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ query: '退款但我还没收到，怎么办', context_slots: {} }),
      }),
    );
    expect(result.workflow_mode).toBe('langgraph');
  });

  it('can start a voice session against voice-realtime-service', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          voice_session_id: 88,
          livekit_room: 'voice-88',
          status: 'connecting',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    const result = await startVoiceSession({
      conversation_id: 2001,
      customer_profile_id: 101,
      livekit_room: 'voice-88',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:18030/sessions/start',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          conversation_id: 2001,
          customer_profile_id: 101,
          livekit_room: 'voice-88',
        }),
      }),
    );
    expect(result.voice_session_id).toBe(88);
  });

  it('can append a voice transcript chunk', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 7,
          voice_session_id: 88,
          speaker: 'customer',
          text: '苹果手机',
          normalized_text: 'iPhone',
          is_final: false,
          start_ms: 0,
          end_ms: 1200,
          created_at: '2026-04-09T01:00:00.000Z',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    const result = await appendVoiceTranscript(88, {
      transcript_text: '苹果手机',
      speaker: 'customer',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:18030/sessions/88/partial',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          speaker: 'customer',
          transcript_text: '苹果手机',
        }),
      }),
    );
    expect(result.id).toBe(7);
    expect(result.normalized_text).toBe('iPhone');
  });

  it('can finalize a voice turn and receive a spoken reply summary', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          decision: 'answer',
          transcript: '苹果手机怎么选？',
          normalized_text: 'iPhone 手机怎么选？',
          answer: '建议根据预算和拍照需求选择。',
          clarification: null,
          handoff: false,
          audio_mime_type: 'audio/mpeg',
          audio_duration_ms: 1320,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    const result = await finalizeVoiceTurn(88, {
      conversation_id: 2001,
      transcript_text: '苹果手机怎么选？',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:18030/sessions/88/finalize',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          conversation_id: 2001,
          transcript_text: '苹果手机怎么选？',
        }),
      }),
    );
    expect(result.decision).toBe('answer');
    expect(result.audio_mime_type).toBe('audio/mpeg');
  });
});
