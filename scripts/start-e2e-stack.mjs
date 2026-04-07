import { startE2EStack } from './e2e-stack-lib.mjs';

const meta = await startE2EStack();

console.log(
  JSON.stringify(
    {
      startedAt: meta.startedAt,
      adminWebUrl: meta.config.urls.adminWeb,
      customerH5Url: meta.config.urls.customerH5,
      platformApiUrl: meta.config.urls.platformApi,
      messageGatewayUrl: meta.config.urls.messageGateway,
      aiServiceUrl: meta.config.urls.aiService,
    },
    null,
    2,
  ),
);
