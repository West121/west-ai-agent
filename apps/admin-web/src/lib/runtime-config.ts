function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

export const messageGatewayWsUrl = normalizeBaseUrl(
  import.meta.env.VITE_MESSAGE_GATEWAY_WS_URL ?? 'ws://localhost:8010/ws',
);
