import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestAiDecision } from '@/lib/customer-h5-api';

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
});
