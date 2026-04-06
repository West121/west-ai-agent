export const platformApiBaseUrl = normalizeBaseUrl(
  import.meta.env.VITE_PLATFORM_API_BASE_URL ?? 'http://localhost:8000',
);

export const messageGatewayWsUrl = normalizeBaseUrl(
  import.meta.env.VITE_MESSAGE_GATEWAY_WS_URL ?? 'ws://localhost:8010/ws',
);

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}
