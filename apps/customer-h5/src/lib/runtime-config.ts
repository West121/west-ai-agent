export const platformApiBaseUrl = normalizeBaseUrl(
  import.meta.env.VITE_PLATFORM_API_BASE_URL ?? 'http://localhost:8000',
);

export const messageGatewayWsUrl = normalizeBaseUrl(
  import.meta.env.VITE_MESSAGE_GATEWAY_WS_URL ?? 'ws://localhost:8010/ws',
);

export const messageGatewayHttpBaseUrl = deriveHttpBaseUrl(messageGatewayWsUrl);
export const aiServiceBaseUrl = normalizeBaseUrl(
  import.meta.env.VITE_AI_SERVICE_BASE_URL ?? 'http://localhost:8020',
);

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function deriveHttpBaseUrl(wsUrl: string): string {
  const url = new URL(wsUrl);

  if (url.protocol === 'ws:') {
    url.protocol = 'http:';
  } else if (url.protocol === 'wss:') {
    url.protocol = 'https:';
  }

  if (url.pathname === '/ws') {
    url.pathname = '/';
  } else if (url.pathname.endsWith('/ws')) {
    url.pathname = `${url.pathname.slice(0, -3) || '/'}`;
  }

  return normalizeBaseUrl(url.toString());
}
