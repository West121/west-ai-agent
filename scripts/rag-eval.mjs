import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateRagCaseResult, formatRagSummary, summarizeRagResults } from './rag-eval-lib.mjs';
import { ensureKnowledgeDocumentsIndexed } from './service-bootstrap.mjs';
import { jsonHeaders, normalizeBaseUrl, requestJson } from './test-lib.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const result = {
    casesPath: path.join(rootDir, 'tests', 'fixtures', 'rag-eval-cases.json'),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? 'http://127.0.0.1:8000',
    aiServiceBaseUrl: process.env.AI_SERVICE_BASE_URL ?? 'http://127.0.0.1:8020',
    bootstrapKnowledge: process.env.RAG_EVAL_BOOTSTRAP_KNOWLEDGE !== 'false',
    reportPath: process.env.RAG_EVAL_REPORT_PATH ?? null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--cases' && argv[index + 1]) {
      result.casesPath = argv[index + 1];
      index += 1;
    } else if (arg === '--platform-api' && argv[index + 1]) {
      result.platformApiBaseUrl = argv[index + 1];
      index += 1;
    } else if (arg === '--ai-service' && argv[index + 1]) {
      result.aiServiceBaseUrl = argv[index + 1];
      index += 1;
    } else if (arg === '--no-bootstrap') {
      result.bootstrapKnowledge = false;
    } else if (arg === '--report' && argv[index + 1]) {
      result.reportPath = argv[index + 1];
      index += 1;
    }
  }

  return result;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const raw = await readFile(options.casesPath, 'utf8');
  const dataset = JSON.parse(raw);
  const documents = Array.isArray(dataset.documents) ? dataset.documents : [];

  if (options.bootstrapKnowledge) {
    try {
      const bootstrap = await ensureKnowledgeDocumentsIndexed({
        platformApiBaseUrl: options.platformApiBaseUrl,
        documents,
      });
      if (bootstrap.length > 0) {
        console.log(`Bootstrapped knowledge index: ${bootstrap.length} documents prepared for RAG eval`);
      }
    } catch (error) {
      console.warn(`Knowledge bootstrap skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const cases = Array.isArray(dataset.cases) ? dataset.cases : [];
  if (cases.length === 0) {
    throw new Error(`No RAG cases found in ${options.casesPath}`);
  }

  const results = [];
  for (const spec of cases) {
    const endpoint = spec.endpoint === 'answer' ? 'chat/answer' : 'decision';
    const response = await requestJson(`${normalizeBaseUrl(options.aiServiceBaseUrl)}/${endpoint}`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        query: spec.query,
      }),
    });
    const evaluation = evaluateRagCaseResult(spec, response);
    results.push(evaluation);

    const icon = evaluation.passed ? 'PASS' : 'FAIL';
    console.log(
      `[${icon}] ${evaluation.id} | ${endpoint} | decision=${evaluation.decision} | top_score=${evaluation.topScore.toFixed(3)}`,
    );
    if (!evaluation.passed) {
      for (const problem of evaluation.problems) {
        console.log(`  - ${problem}`);
      }
    }
  }

  const summary = summarizeRagResults(results);
  console.log(formatRagSummary(summary));

  if (options.reportPath) {
    await writeFile(
      options.reportPath,
      JSON.stringify(
        {
          dataset: dataset.name ?? 'rag-eval',
          summary,
          results,
        },
        null,
        2,
      ),
    );
    console.log(`Report written to ${options.reportPath}`);
  }

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
