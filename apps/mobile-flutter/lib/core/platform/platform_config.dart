class PlatformApiConfig {
  const PlatformApiConfig({
    required this.apiBaseUrl,
    required this.gatewayHttpBaseUrl,
    required this.gatewayWsBaseUrl,
  });

  factory PlatformApiConfig.fromEnvironment() {
    const apiBaseUrl = String.fromEnvironment(
      'PLATFORM_API_BASE_URL',
      defaultValue: 'http://localhost:8000',
    );
    const gatewayHttpBaseUrl = String.fromEnvironment(
      'MESSAGE_GATEWAY_HTTP_BASE_URL',
      defaultValue: 'http://localhost:8010',
    );
    const gatewayWsBaseUrl = String.fromEnvironment(
      'MESSAGE_GATEWAY_WS_BASE_URL',
      defaultValue: 'ws://localhost:8010/ws',
    );

    return const PlatformApiConfig(
      apiBaseUrl: apiBaseUrl,
      gatewayHttpBaseUrl: gatewayHttpBaseUrl,
      gatewayWsBaseUrl: gatewayWsBaseUrl,
    );
  }

  final String apiBaseUrl;
  final String gatewayHttpBaseUrl;
  final String gatewayWsBaseUrl;
}
