import { renderWithProviders } from '@/test/render';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VoiceSessionPanel } from '@/components/voice-session-panel';

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  appendTranscript: vi.fn(),
  createHandoff: vi.fn(),
  refetchSessions: vi.fn(),
}));

vi.mock('@/hooks/use-platform-api', () => ({
  useVoiceSessions: () => ({
    data: [
      {
        id: 701,
        conversation_id: 101,
        customer_profile_id: 9,
        channel: 'voice',
        status: 'listening',
        livekit_room: 'voice-room-101',
        stt_provider: 'sherpa-onnx',
        finalizer_provider: 'funasr',
        tts_provider: 'sherpa-onnx',
        handoff_pending: false,
        transcript_count: 2,
        audio_asset_count: 1,
        handoff_count: 1,
        started_at: '2026-04-09T01:00:00.000Z',
        ended_at: null,
        created_at: '2026-04-09T01:00:00.000Z',
        updated_at: '2026-04-09T01:05:00.000Z',
      },
    ],
    isLoading: false,
    isError: false,
    refetch: mocks.refetchSessions,
  }),
  useVoiceTranscripts: () => ({
    data: [
      {
        id: 801,
        voice_session_id: 701,
        speaker: 'customer',
        text: '我想看 iPhone 16 Pro。',
        normalized_text: '我想看 iPhone 16 Pro。',
        is_final: true,
        start_ms: 0,
        end_ms: 1400,
        created_at: '2026-04-09T01:00:10.000Z',
      },
      {
        id: 802,
        voice_session_id: 701,
        speaker: 'agent',
        text: '可以，我帮你对比型号。',
        normalized_text: '可以，我帮你对比型号。',
        is_final: true,
        start_ms: 1500,
        end_ms: 2600,
        created_at: '2026-04-09T01:00:30.000Z',
      },
    ],
    isLoading: false,
    isError: false,
  }),
  useVoiceAudioAssets: () => ({
    data: [
      {
        id: 901,
        voice_session_id: 701,
        asset_type: 'recording',
        file_key: 'voice/701.webm',
        mime_type: 'audio/webm',
        duration_ms: 32000,
        created_at: '2026-04-09T01:01:00.000Z',
      },
    ],
    isLoading: false,
    isError: false,
  }),
  useVoiceHandoffs: () => ({
    data: [
      {
        id: 1001,
        voice_session_id: 701,
        reason: '用户要求人工确认型号',
        summary: '语音识别已确认用户在咨询 iPhone 16 Pro 的型号与售后。',
        handed_off_to: 'agent-a',
        created_at: '2026-04-09T01:02:00.000Z',
      },
    ],
    isLoading: false,
    isError: false,
  }),
  useCreateVoiceSession: () => ({
    mutateAsync: mocks.createSession.mockResolvedValue({
      id: 702,
      conversation_id: 101,
      customer_profile_id: 9,
      channel: 'voice',
      status: 'connecting',
      livekit_room: 'voice-room-101',
      stt_provider: 'sherpa-onnx',
      finalizer_provider: 'funasr',
      tts_provider: 'sherpa-onnx',
      handoff_pending: false,
      transcript_count: 0,
      audio_asset_count: 0,
      handoff_count: 0,
      started_at: '2026-04-09T01:10:00.000Z',
      ended_at: null,
      created_at: '2026-04-09T01:10:00.000Z',
      updated_at: '2026-04-09T01:10:00.000Z',
    }),
    isPending: false,
  }),
  useAppendVoiceTranscript: () => ({
    mutateAsync: mocks.appendTranscript.mockResolvedValue({
      id: 802,
      voice_session_id: 701,
      speaker: 'customer',
      text: '我想看 iPhone 16 Pro。',
      normalized_text: '我想看 iPhone 16 Pro。',
      is_final: true,
      start_ms: 0,
      end_ms: 1400,
      created_at: '2026-04-09T01:00:10.000Z',
    }),
    isPending: false,
  }),
  useCreateVoiceAudioAsset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateVoiceHandoff: () => ({
    mutateAsync: mocks.createHandoff.mockResolvedValue({
      id: 1002,
      voice_session_id: 701,
      reason: '需要人工确认门店',
      summary: '用户正在咨询门店地址和保修规则。',
      handed_off_to: 'agent-b',
      created_at: '2026-04-09T01:03:00.000Z',
    }),
    isPending: false,
  }),
}));

describe('VoiceSessionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sessions, transcripts, handoffs, and supports actions', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <VoiceSessionPanel conversationId={101} customerProfileId={9} assignee="agent-a" />,
    );

    expect(await screen.findByRole('heading', { name: '语音会话面板' })).toBeInTheDocument();
    expect(screen.getByText('语音会话 #701')).toBeInTheDocument();
    expect(screen.getByText('实时配置')).toBeInTheDocument();
    expect(screen.getByText('转写片段')).toBeInTheDocument();
    expect(screen.getByText('接管记录')).toBeInTheDocument();
    expect((await screen.findAllByText(/iPhone 16 Pro/)).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: '开启语音会话' }));
    expect(mocks.createSession).toHaveBeenCalledWith({
      conversation_id: 101,
      customer_profile_id: 9,
      channel: 'voice',
      status: 'connecting',
      livekit_room: 'voice-room-101',
      stt_provider: 'sherpa-onnx',
      finalizer_provider: 'funasr',
      tts_provider: 'sherpa-onnx',
    });

    await user.type(screen.getByLabelText('转写内容'), '我想看 iPhone 16 Pro。');
    await user.type(screen.getByLabelText('标准化文本'), '我想看 iPhone 16 Pro。');
    await user.click(screen.getByRole('button', { name: '保存转写' }));
    expect(mocks.appendTranscript).toHaveBeenCalledWith({
      voiceSessionId: 701,
      payload: {
        speaker: 'customer',
        text: '我想看 iPhone 16 Pro。',
        normalized_text: '我想看 iPhone 16 Pro。',
        is_final: true,
      },
    });

    await user.type(screen.getByLabelText('接管原因'), '需要人工确认门店');
    await user.type(screen.getByLabelText('接管摘要'), '用户正在咨询门店地址和保修规则。');
    const handoffTargetInput = screen.getByLabelText('接管人');
    await user.clear(handoffTargetInput);
    await user.type(handoffTargetInput, 'agent-b');
    await user.click(screen.getByRole('button', { name: '创建接管' }));
    expect(mocks.createHandoff).toHaveBeenCalledWith({
      voiceSessionId: 701,
      payload: {
        reason: '需要人工确认门店',
        summary: '用户正在咨询门店地址和保修规则。',
        handed_off_to: 'agent-b',
      },
    });
  });
});
