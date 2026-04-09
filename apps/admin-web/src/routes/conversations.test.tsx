import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';

import { ConversationsPage } from '@/routes/conversations';
import { renderWithProviders } from '@/test/render';

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

type VoiceTranscriptFixture = {
  id: number;
  voice_session_id: number;
  speaker: string;
  text: string;
  normalized_text: string | null;
  is_final: boolean;
  start_ms: number | null;
  end_ms: number | null;
  created_at: string;
};

type VoiceHandoffFixture = {
  id: number;
  voice_session_id: number;
  reason: string;
  summary: string;
  handed_off_to: string | null;
  created_at: string;
};

describe('ConversationsPage', () => {
  it('closes the transfer, end, summary refresh, and satisfaction viewing workflow', async () => {
    let assignee = 'agent-a';
    let status = 'open';
    let endedAt: string | null = null;
    let summaryRequestCount = 0;
    let voiceSessionId = 701;
    let voiceSessions = [
      {
        id: voiceSessionId,
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
        started_at: '2026-04-06T09:30:00.000Z',
        ended_at: null,
        created_at: '2026-04-06T09:30:00.000Z',
        updated_at: '2026-04-06T09:31:00.000Z',
      },
    ];
    let voiceTranscripts: VoiceTranscriptFixture[] = [
      {
        id: 801,
        voice_session_id: voiceSessionId,
        speaker: 'customer',
        text: '我想看 iPhone 16 Pro。',
        normalized_text: '我想看 iPhone 16 Pro。',
        is_final: true,
        start_ms: 0,
        end_ms: 1400,
        created_at: '2026-04-06T09:30:10.000Z',
      },
      {
        id: 802,
        voice_session_id: voiceSessionId,
        speaker: 'agent',
        text: '可以，我帮你对比型号。',
        normalized_text: '可以，我帮你对比型号。',
        is_final: true,
        start_ms: 1500,
        end_ms: 2600,
        created_at: '2026-04-06T09:30:30.000Z',
      },
    ];
    let voiceHandoffs: VoiceHandoffFixture[] = [
      {
        id: 1001,
        voice_session_id: voiceSessionId,
        reason: '用户要求人工确认型号',
        summary: '语音识别已确认用户在咨询 iPhone 16 Pro 的型号与售后。',
        handed_off_to: 'agent-a',
        created_at: '2026-04-06T09:31:00.000Z',
      },
    ];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const requestUrl = new URL(url, 'http://localhost:8000');
      const { pathname, searchParams } = requestUrl;

      if (method === 'GET' && pathname === '/conversation/conversations') {
        return jsonResponse([
          {
            id: 101,
            customer_profile_id: 9,
            channel: 'web',
            assignee,
            status,
            ended_at: endedAt,
            created_at: '2026-04-06T09:00:00.000Z',
            updated_at: '2026-04-06T10:00:00.000Z',
          },
        ]);
      }

      if (method === 'GET' && pathname === '/customer/profiles') {
        return jsonResponse([
          {
            id: 9,
            external_id: 'cust-9',
            name: '杭州来电用户',
            email: null,
            phone: null,
            status: 'active',
            created_at: '2026-04-01T09:00:00.000Z',
            updated_at: '2026-04-06T10:00:00.000Z',
            tags: [],
          },
        ]);
      }

      if (method === 'GET' && pathname === '/conversation/conversations/101/summary') {
        summaryRequestCount += 1;
        return jsonResponse({
          conversation_id: 101,
          ai_summary:
            summaryRequestCount >= 3 ? '人工接管后已更新摘要' : '初始摘要',
          message_count: summaryRequestCount >= 3 ? 6 : 4,
          last_message_at: '2026-04-06T10:05:00.000Z',
          satisfaction_score: 4,
        });
      }

      if (method === 'GET' && pathname === '/conversation/conversations/101/satisfaction') {
        return jsonResponse({
          conversation_id: 101,
          score: 4,
          comment: '客服响应及时',
          created_at: '2026-04-06T10:01:00.000Z',
          updated_at: '2026-04-06T10:02:00.000Z',
        });
      }

      if (method === 'GET' && pathname === '/voice/sessions') {
        const conversationFilter = searchParams.get('conversation_id');
        const customerFilter = searchParams.get('customer_profile_id');
        const statusFilter = searchParams.get('status');
        let items = voiceSessions;
        if (conversationFilter) {
          items = items.filter((session) => session.conversation_id === Number(conversationFilter));
        }
        if (customerFilter) {
          items = items.filter((session) => session.customer_profile_id === Number(customerFilter));
        }
        if (statusFilter) {
          items = items.filter((session) => session.status === statusFilter);
        }
        return jsonResponse({ items });
      }

      if (method === 'GET' && /^\/voice\/sessions\/\d+$/.test(pathname)) {
        const sessionId = Number(pathname.split('/').at(-1));
        const session = voiceSessions.find((item) => item.id === sessionId);
        if (!session) {
          throw new Error(`Unhandled request: ${method} ${pathname}`);
        }
        return jsonResponse(session);
      }

      if (method === 'GET' && pathname === '/voice/sessions/701/transcripts') {
        return jsonResponse({ items: voiceTranscripts.filter((item) => item.voice_session_id === 701) });
      }

      if (method === 'GET' && pathname === '/voice/sessions/701/assets') {
        return jsonResponse({
          items: [
            {
              id: 901,
              voice_session_id: 701,
              asset_type: 'recording',
              file_key: 'voice/701.webm',
              mime_type: 'audio/webm',
              duration_ms: 32000,
              created_at: '2026-04-06T09:31:10.000Z',
            },
          ],
        });
      }

      if (method === 'GET' && pathname === '/voice/sessions/701/handoff') {
        return jsonResponse({ items: voiceHandoffs.filter((item) => item.voice_session_id === 701) });
      }

      if (method === 'POST' && pathname === '/voice/sessions') {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          conversation_id: number;
          customer_profile_id: number;
          channel?: string;
          status?: string;
          livekit_room?: string | null;
          stt_provider?: string;
          finalizer_provider?: string;
          tts_provider?: string;
        };
        voiceSessionId += 1;
        const createdAt = '2026-04-06T10:00:00.000Z';
        const session = {
          id: voiceSessionId,
          conversation_id: body.conversation_id,
          customer_profile_id: body.customer_profile_id,
          channel: body.channel ?? 'voice',
          status: body.status ?? 'connecting',
          livekit_room: body.livekit_room ?? `voice-room-${body.conversation_id}`,
          stt_provider: body.stt_provider ?? 'sherpa-onnx',
          finalizer_provider: body.finalizer_provider ?? 'funasr',
          tts_provider: body.tts_provider ?? 'sherpa-onnx',
          handoff_pending: false,
          transcript_count: 0,
          audio_asset_count: 0,
          handoff_count: 0,
          started_at: createdAt,
          ended_at: null,
          created_at: createdAt,
          updated_at: createdAt,
        };
        voiceSessions = [session, ...voiceSessions];
        return jsonResponse(session, { status: 201 });
      }

      if (method === 'POST' && pathname === '/voice/sessions/701/transcripts') {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          speaker?: string;
          text: string;
          normalized_text?: string | null;
          is_final?: boolean;
          start_ms?: number | null;
          end_ms?: number | null;
        };
        const transcript = {
          id: 803,
          voice_session_id: 701,
          speaker: body.speaker ?? 'customer',
          text: body.text,
          normalized_text: body.normalized_text ?? null,
          is_final: body.is_final ?? false,
          start_ms: body.start_ms ?? null,
          end_ms: body.end_ms ?? null,
          created_at: '2026-04-06T10:00:10.000Z',
        };
        voiceTranscripts = [...voiceTranscripts, transcript];
        voiceSessions = voiceSessions.map((session) =>
          session.id === 701
            ? {
                ...session,
                transcript_count: session.transcript_count + 1,
                updated_at: '2026-04-06T10:00:10.000Z',
              }
            : session,
        );
        return jsonResponse(transcript, { status: 201 });
      }

      if (method === 'POST' && pathname === '/voice/sessions/701/handoff') {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          reason: string;
          summary: string;
          handed_off_to?: string | null;
        };
        const handoff = {
          id: 1002,
          voice_session_id: 701,
          reason: body.reason,
          summary: body.summary,
          handed_off_to: body.handed_off_to ?? null,
          created_at: '2026-04-06T10:01:00.000Z',
        };
        voiceHandoffs = [...voiceHandoffs, handoff];
        voiceSessions = voiceSessions.map((session) =>
          session.id === 701
            ? {
                ...session,
                handoff_pending: true,
                handoff_count: session.handoff_count + 1,
                updated_at: '2026-04-06T10:01:00.000Z',
              }
            : session,
        );
        return jsonResponse(handoff, { status: 201 });
      }

      if (method === 'POST' && pathname === '/conversation/conversations/101/transfer') {
        const body = JSON.parse(String(init?.body ?? '{}')) as { assignee?: string; reason?: string };
        expect(body).toEqual({ assignee: 'agent-b', reason: '升级到人工复核' });
        assignee = body.assignee ?? assignee;
        status = 'transferred';
        return jsonResponse({
          id: 101,
          customer_profile_id: 9,
          channel: 'web',
          assignee,
          status,
          ended_at: endedAt,
          created_at: '2026-04-06T09:00:00.000Z',
          updated_at: '2026-04-06T10:10:00.000Z',
        });
      }

      if (method === 'POST' && pathname === '/conversation/conversations/101/end') {
        const body = JSON.parse(String(init?.body ?? '{}')) as { reason?: string };
        expect(body).toEqual({ reason: '用户确认问题已解决' });
        status = 'ended';
        endedAt = '2026-04-06T10:12:00.000Z';
        return jsonResponse({
          id: 101,
          customer_profile_id: 9,
          channel: 'web',
          assignee,
          status,
          ended_at: endedAt,
          created_at: '2026-04-06T09:00:00.000Z',
          updated_at: '2026-04-06T10:12:00.000Z',
        });
      }

      throw new Error(`Unhandled request: ${method} ${pathname}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<ConversationsPage />);

    expect(await screen.findByText('会话工作台')).toBeInTheDocument();
    expect(await screen.findByText('客服响应及时')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '语音会话面板' })).toBeInTheDocument();
    expect(screen.getByText('语音会话 #701')).toBeInTheDocument();
    expect(screen.getByText('转写片段')).toBeInTheDocument();
    expect(screen.getByText('接管记录')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('转接到'));
    await userEvent.type(screen.getByLabelText('转接到'), 'agent-b');
    await userEvent.type(screen.getByLabelText('处理备注'), '升级到人工复核');
    await userEvent.click(screen.getByRole('button', { name: '转接会话' }));

    await waitFor(() => {
      expect(screen.getByText('transferred')).toBeInTheDocument();
      expect(screen.getByText('agent-b')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: '刷新摘要' }));
    expect(await screen.findByText('人工接管后已更新摘要')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('处理备注'));
    await userEvent.type(screen.getByLabelText('处理备注'), '用户确认问题已解决');
    await userEvent.click(screen.getByRole('button', { name: '结束会话' }));

    await waitFor(() => {
      expect(screen.getAllByText('ended').length).toBeGreaterThan(0);
      expect(screen.getByText('2026/04/06 18:12')).toBeInTheDocument();
    });
  });
});
