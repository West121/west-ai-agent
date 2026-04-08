function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

export const messageGatewayHttpBaseUrl = deriveHttpBaseUrl(
  import.meta.env.VITE_MESSAGE_GATEWAY_WS_URL ?? 'ws://localhost:8010/ws',
);

export const messageGatewayWsUrl = normalizeBaseUrl(
  import.meta.env.VITE_MESSAGE_GATEWAY_WS_URL ?? 'ws://localhost:8010/ws',
);

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
