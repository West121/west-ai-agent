import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateRagCaseResult, formatRagSummary, summarizeRagResults } from '../../scripts/rag-eval-lib.mjs';

test('evaluateRagCaseResult marks a matching answer as passed', () => {
  const result = evaluateRagCaseResult(
    {
      id: 'refund-arrival-zh',
      endpoint: 'decision',
      query: '退款多久到账',
      expect: {
        decision: 'answer',
        answerContains: ['1 到 3 个工作日'],
        topDocumentTitleContains: '退款到账说明',
        topScoreMin: 0.6,
      },
    },
    {
      decision: 'answer',
      answer: '一般情况下原路退款会在 1 到 3 个工作日到账。',
      retrieval_summary: {
        top_score: 0.91,
        matched_count: 1,
        matched_documents: [
          {
            document_id: '1-faq-1',
            title: '退款到账说明',
          },
        ],
      },
    },
  );

  assert.equal(result.passed, true);
});

test('summarizeRagResults and formatRagSummary emit pass rate and failures', () => {
  const results = [
    {
      passed: true,
      topScore: 0.9,
      decision: 'answer',
      problems: [],
      id: 'ok',
      endpoint: 'decision',
    },
    {
      passed: false,
      topScore: 0.1,
      decision: 'reject',
      problems: ['top score below minimum'],
      id: 'bad',
      endpoint: 'answer',
    },
  ];

  const summary = summarizeRagResults(results);
  const text = formatRagSummary(summary);

  assert.equal(summary.total, 2);
  assert.equal(summary.failed, 1);
  assert.match(text, /1\/2 passed/);
  assert.match(text, /bad \(answer\): top score below minimum/);
});
