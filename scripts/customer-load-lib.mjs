export function summarizeCustomerLoadResults(results) {
  const totalSessions = results.length;
  const passedSessions = results.filter((result) => result.passed).length;
  const failedSessions = totalSessions - passedSessions;
  const totalTurns = results.reduce((sum, result) => sum + result.turns, 0);
  const totalDuration = results.reduce((sum, result) => sum + result.durationMs, 0);
  const maxDurationMs = results.length === 0 ? 0 : Math.max(...results.map((result) => result.durationMs));
  const sortedDurations = [...results.map((result) => result.durationMs)].sort((left, right) => left - right);
  const p95DurationMs = sortedDurations.length === 0
    ? 0
    : sortedDurations[Math.min(sortedDurations.length - 1, Math.ceil(sortedDurations.length * 0.95) - 1)];
  const turnLatencies = results.flatMap((result) => result.turnLatencies ?? []);
  const aiLatencies = results.flatMap((result) => result.aiLatencies ?? []);
  const decisionCounts = results.reduce(
    (acc, result) => {
      for (const [decision, count] of Object.entries(result.decisionCounts)) {
        acc[decision] = (acc[decision] ?? 0) + count;
      }
      return acc;
    },
    { answer: 0, handoff: 0, clarify: 0, reject: 0 },
  );

  return {
    totalSessions,
    passedSessions,
    failedSessions,
    totalTurns,
    averageDurationMs: totalSessions === 0 ? 0 : Math.round(totalDuration / totalSessions),
    maxDurationMs,
    p95DurationMs,
    throughputTurnsPerSecond: totalDuration === 0 ? 0 : (totalTurns / totalDuration) * 1000,
    turnLatency: summarizeSeries(turnLatencies),
    aiLatency: summarizeSeries(aiLatencies),
    decisionCounts,
    failedSessionsDetail: results.filter((result) => !result.passed).map((result) => ({
      sessionId: result.sessionId,
      errors: result.errors,
    })),
  };
}

export function formatCustomerLoadSummary(summary) {
  const failedSessionsDetail = Array.isArray(summary.failedSessionsDetail) ? summary.failedSessionsDetail : [];
  const lines = [
    'Customer load summary',
    `- ${summary.passedSessions}/${summary.totalSessions} sessions passed`,
    `- failed sessions: ${summary.failedSessions}`,
    `- total turns: ${summary.totalTurns}`,
    `- average duration: ${summary.averageDurationMs}ms`,
    `- p95 duration: ${summary.p95DurationMs}ms`,
    `- max duration: ${summary.maxDurationMs}ms`,
    `- throughput: ${summary.throughputTurnsPerSecond.toFixed(2)} turns/s`,
    `- turn latency avg/p95/max: ${summary.turnLatency.avg.toFixed(1)}ms / ${summary.turnLatency.p95.toFixed(1)}ms / ${summary.turnLatency.max.toFixed(1)}ms`,
    `- decisions: answer=${summary.decisionCounts.answer}, handoff=${summary.decisionCounts.handoff}, clarify=${summary.decisionCounts.clarify}, reject=${summary.decisionCounts.reject}`,
  ];

  if (summary.aiLatency && (summary.aiLatency.avg > 0 || summary.aiLatency.p95 > 0)) {
    lines.push(
      `- ai latency avg/p95/max: ${summary.aiLatency.avg.toFixed(1)}ms / ${summary.aiLatency.p95.toFixed(1)}ms / ${summary.aiLatency.max.toFixed(1)}ms`,
    );
  }

  if (failedSessionsDetail.length > 0) {
    lines.push('- failed sessions:');
    for (const failed of failedSessionsDetail) {
      lines.push(`  - ${failed.sessionId}: ${failed.errors.join('; ')}`);
    }
  }

  return lines.join('\n');
}

function summarizeSeries(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return { avg: 0, p95: 0, max: 0 };
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  const sorted = [...values].sort((left, right) => left - right);
  return {
    avg: total / values.length,
    p95: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)],
    max: Math.max(...values),
  };
}
