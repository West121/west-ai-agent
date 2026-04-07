import { spawn } from 'node:child_process';

import { startE2EStack, stopE2EStack } from './e2e-stack-lib.mjs';

async function runScript(meta) {
  await new Promise((resolve, reject) => {
    const child = spawn('node', ['./scripts/rag-eval.mjs'], {
      cwd: meta.config.rootDir,
      env: {
        ...process.env,
        PLATFORM_API_BASE_URL: meta.config.urls.platformApi,
        AI_SERVICE_BASE_URL: meta.config.urls.aiService,
      },
      stdio: 'inherit',
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`RAG eval exited with code ${code ?? 'unknown'}`));
    });
    child.on('error', reject);
  });
}

const meta = await startE2EStack();

try {
  await runScript(meta);
} finally {
  await stopE2EStack();
}
