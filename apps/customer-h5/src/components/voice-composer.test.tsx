import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { VoiceComposer } from '@/components/voice-composer';
import { useVoiceSession } from '@/hooks/use-voice-session';

vi.mock('@/hooks/use-voice-session', () => ({
  useVoiceSession: vi.fn(),
}));

const mockUseVoiceSession = vi.mocked(useVoiceSession);

describe('VoiceComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the voice entry state before the session starts', () => {
    mockUseVoiceSession.mockReturnValue({
      session: null,
      status: 'idle',
      error: null,
      transcripts: [],
      lastTurn: null,
      startVoiceSession: vi.fn(),
      appendPartialTranscript: vi.fn(),
      finalizeVoiceTurn: vi.fn(),
      resetVoiceSession: vi.fn(),
    });

    render(
      <VoiceComposer conversationId={2001} customerProfileId={101} conversationStatus="open" />,
    );

    expect(screen.getByText('智能语音客服')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始语音会话' })).toBeInTheDocument();
    expect(screen.getByText('开始语音会话后，实时转写和 AI 回复会在这里展示。')).toBeInTheDocument();
  });

  it('renders transcript entries and the latest AI result', () => {
    mockUseVoiceSession.mockReturnValue({
      session: {
        voice_session_id: 88,
        livekit_room: 'voice-88',
        status: 'connecting',
      },
      status: 'speaking',
      error: null,
      transcripts: [
        {
          id: 'voice-segment-7',
          speaker: 'customer',
          kind: 'partial',
          text: '苹果手机',
          normalizedText: 'iPhone',
          createdAt: '2026-04-09T01:00:00.000Z',
        },
        {
          id: 'voice-answer-1',
          speaker: 'assistant',
          kind: 'assistant',
          text: '建议根据预算和拍照需求选择。',
          normalizedText: '建议根据预算和拍照需求选择。',
          createdAt: '2026-04-09T01:00:01.000Z',
          meta: {
            decision: 'answer',
            audioMimeType: 'audio/mpeg',
            audioDurationMs: 1320,
          },
        },
      ],
      lastTurn: {
        decision: 'answer',
        transcript: '苹果手机怎么选？',
        normalized_text: 'iPhone 手机怎么选？',
        answer: '建议根据预算和拍照需求选择。',
        clarification: null,
        handoff: false,
        audio_mime_type: 'audio/mpeg',
        audio_duration_ms: 1320,
      },
      startVoiceSession: vi.fn(),
      appendPartialTranscript: vi.fn(),
      finalizeVoiceTurn: vi.fn(),
      resetVoiceSession: vi.fn(),
    });

    render(
      <VoiceComposer conversationId={2001} customerProfileId={101} conversationStatus="open" />,
    );

    expect(screen.getByText('会话 88')).toBeInTheDocument();
    expect(screen.getByText('苹果手机')).toBeInTheDocument();
    expect(screen.getAllByText('建议根据预算和拍照需求选择。').length).toBeGreaterThan(0);
    expect(screen.getByText('最新 AI 结果')).toBeInTheDocument();
    expect(screen.getByText(/audio\/mpeg/)).toBeInTheDocument();
  });
});
