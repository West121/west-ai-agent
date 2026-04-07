export function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function includesFragment(haystack, fragment) {
  return normalizeText(haystack).includes(normalizeText(fragment));
}

function readTopDocumentId(response) {
  return response?.retrieval_summary?.matched_documents?.[0]?.document_id ?? null;
}

function readTopDocumentTitle(response) {
  return response?.retrieval_summary?.matched_documents?.[0]?.title ?? null;
}

function readTopScore(response) {
  const value = Number(response?.retrieval_summary?.top_score ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function evaluateRagCaseResult(spec, response) {
  const expect = spec.expect ?? {};
  const problems = [];
  const decision = response?.decision ?? 'unknown';
  const answer = response?.answer ?? null;
  const topScore = readTopScore(response);
  const nextAction = response?.next_action ?? null;

  if (expect.decision && decision !== expect.decision) {
    problems.push(`decision mismatch: expected ${expect.decision}, got ${decision}`);
  }

  const answerFragments = Array.isArray(expect.answerContains)
    ? expect.answerContains
    : Array.isArray(expect.answerIncludes)
      ? expect.answerIncludes
      : [];
  if (answerFragments.length > 0) {
    if (!answer || !normalizeText(answer)) {
      problems.push('answer missing');
    } else {
      for (const fragment of answerFragments) {
        if (!includesFragment(answer, fragment)) {
          problems.push(`answer missing fragment: ${fragment}`);
        }
      }
    }
  }

  if (expect.answerEmpty === true && normalizeText(answer)) {
    problems.push('answer expected to be empty');
  }

  if (typeof expect.topScoreMin === 'number' && topScore < expect.topScoreMin) {
    problems.push(`top score below minimum: expected >= ${expect.topScoreMin}, got ${topScore}`);
  }

  if (typeof expect.topScoreMax === 'number' && topScore > expect.topScoreMax) {
    problems.push(`top score above maximum: expected <= ${expect.topScoreMax}, got ${topScore}`);
  }

  if (expect.topDocumentId && readTopDocumentId(response) !== expect.topDocumentId) {
    problems.push(`top document mismatch: expected ${expect.topDocumentId}, got ${readTopDocumentId(response) ?? 'none'}`);
  }

  if (expect.topDocumentTitleContains) {
    const title = readTopDocumentTitle(response) ?? '';
    if (!includesFragment(title, expect.topDocumentTitleContains)) {
      problems.push(`top document title missing fragment: ${expect.topDocumentTitleContains}`);
    }
  }

  if (expect.nextAction && nextAction !== expect.nextAction) {
    problems.push(`next action mismatch: expected ${expect.nextAction}, got ${nextAction ?? 'none'}`);
  }

  if (Array.isArray(expect.requiredSlots) && expect.requiredSlots.length > 0) {
    const requiredSlots = new Set(response?.required_slots ?? []);
    for (const slot of expect.requiredSlots) {
      if (!requiredSlots.has(slot)) {
        problems.push(`required slot missing: ${slot}`);
      }
    }
  }

  if (Array.isArray(expect.missingSlots) && expect.missingSlots.length > 0) {
    const missingSlots = new Set(response?.missing_slots ?? []);
    for (const slot of expect.missingSlots) {
      if (!missingSlots.has(slot)) {
        problems.push(`missing slot missing: ${slot}`);
      }
    }
  }

  if (typeof expect.handoffReady === 'boolean' && Boolean(response?.handoff_ready) !== expect.handoffReady) {
    problems.push(`handoff ready mismatch: expected ${expect.handoffReady}, got ${Boolean(response?.handoff_ready)}`);
  }

  if (expect.issueCategory && response?.extracted_slots?.issue_category !== expect.issueCategory) {
    problems.push(
      `issue category mismatch: expected ${expect.issueCategory}, got ${response?.extracted_slots?.issue_category ?? 'none'}`,
    );
  }

  if (expect.mergedSlots && typeof expect.mergedSlots === 'object') {
    for (const [key, value] of Object.entries(expect.mergedSlots)) {
      if (response?.merged_slots?.[key] !== value) {
        problems.push(`merged slot mismatch for ${key}: expected ${value}, got ${response?.merged_slots?.[key] ?? 'none'}`);
      }
    }
  }

  if (expect.noMatches === true && (response?.retrieval_summary?.matched_count ?? 0) !== 0) {
    problems.push(`expected no matches, got ${response?.retrieval_summary?.matched_count ?? 0}`);
  }

  const passed = problems.length === 0;

  return {
    id: spec.id,
    endpoint: spec.endpoint ?? 'decision',
    query: spec.query,
    passed,
    problems,
    decision,
    topScore,
    answer,
    expected: expect,
    response,
  };
}

export function summarizeRagResults(results) {
  const total = results.length;
  const passed = results.filter((result) => result.passed).length;
  const failed = total - passed;
  const averageTopScore = total === 0 ? 0 : results.reduce((sum, result) => sum + (result.topScore ?? 0), 0) / total;
  const decisionCounts = results.reduce(
    (acc, result) => {
      acc[result.decision] = (acc[result.decision] ?? 0) + 1;
      return acc;
    },
    { answer: 0, handoff: 0, clarify: 0, reject: 0 },
  );

  return {
    total,
    passed,
    failed,
    passRate: total === 0 ? 1 : passed / total,
    averageTopScore,
    decisionCounts,
    failedCases: results.filter((result) => !result.passed).map((result) => ({
      id: result.id,
      endpoint: result.endpoint,
      problems: result.problems,
    })),
  };
}

export function formatRagSummary(summary) {
  const lines = [
    'RAG eval summary',
    `- ${summary.passed}/${summary.total} passed (${Math.round(summary.passRate * 100)}%)`,
    `- failed: ${summary.failed}`,
    `- average top score: ${summary.averageTopScore.toFixed(3)}`,
    `- decisions: answer=${summary.decisionCounts.answer}, handoff=${summary.decisionCounts.handoff}, clarify=${summary.decisionCounts.clarify}, reject=${summary.decisionCounts.reject}`,
  ];

  if (summary.failedCases.length > 0) {
    lines.push('- failed cases:');
    for (const failedCase of summary.failedCases) {
      lines.push(`  - ${failedCase.id} (${failedCase.endpoint}): ${failedCase.problems.join('; ')}`);
    }
  }

  return lines.join('\n');
}
