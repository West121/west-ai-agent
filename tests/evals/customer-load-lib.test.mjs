import assert from 'node:assert/strict';
import test from 'node:test';

import { formatCustomerLoadSummary, summarizeCustomerLoadResults } from '../../scripts/customer-load-lib.mjs';

test('summarizeCustomerLoadResults aggregates throughput and latency', () => {
  const summary = summarizeCustomerLoadResults([
    {
      passed: true,
      turns: 3,
      durationMs: 3000,
      turnLatencies: [100, 120, 140],
      aiLatencies: [200, 220],
      decisionCounts: { answer: 2, handoff: 1, clarify: 0, reject: 0 },
      sessionId: 'session-a',
      errors: [],
    },
    {
      passed: false,
      turns: 2,
      durationMs: 1500,
      turnLatencies: [90, 110],
      aiLatencies: [180],
      decisionCounts: { answer: 1, handoff: 0, clarify: 1, reject: 0 },
      sessionId: 'session-b',
      errors: ['turn mismatch'],
    },
  ]);

  assert.equal(summary.totalSessions, 2);
  assert.equal(summary.failedSessions, 1);
  assert.equal(summary.totalTurns, 5);
  assert.equal(summary.decisionCounts.answer, 3);
  assert.equal(summary.turnLatency.max, 140);
  assert.equal(summary.aiLatency.p95, 220);

  const text = formatCustomerLoadSummary(summary);
  assert.match(text, /2 sessions passed/);
  assert.match(text, /failed sessions: 1/);
  assert.match(text, /session-b: turn mismatch/);
});
