import { spawn } from 'node:child_process';

import { startE2EStack, stopE2EStack } from './e2e-stack-lib.mjs';

const args = process.argv.slice(2);

function runPlaywright(meta) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'pnpm',
      ['exec', 'playwright', 'test', ...args],
      {
        cwd: meta.config.rootDir,
        env: {
          ...process.env,
          ADMIN_WEB_URL: meta.config.urls.adminWeb,
          CUSTOMER_H5_URL: meta.config.urls.customerH5,
          PLATFORM_API_BASE_URL: meta.config.urls.platformApi,
          MESSAGE_GATEWAY_BASE_URL: meta.config.urls.messageGateway,
          MESSAGE_GATEWAY_WS_URL: meta.config.urls.messageGatewayWs,
          AI_SERVICE_BASE_URL: meta.config.urls.aiService,
        },
        stdio: 'inherit',
      },
    );

    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`Playwright exited with code ${code ?? 'unknown'}`));
    });
    child.on('error', reject);
  });
}

const meta = await startE2EStack();

try {
  await runPlaywright(meta);
} finally {
  await stopE2EStack();
}
