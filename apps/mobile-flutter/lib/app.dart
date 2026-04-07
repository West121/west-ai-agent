import 'package:flutter/material.dart';

import 'core/platform/message_gateway_repository.dart';
import 'core/platform/mobile_app_controller.dart';
import 'core/platform/mobile_app_scope.dart';
import 'core/platform/platform_api_client.dart';
import 'core/platform/platform_config.dart';
import 'core/platform/platform_repository.dart';
import 'router.dart';

class MobileFlutterApp extends StatefulWidget {
  const MobileFlutterApp({
    super.key,
    this.controller,
  });

  final MobileAppController? controller;

  @override
  State<MobileFlutterApp> createState() => _MobileFlutterAppState();
}

class _MobileFlutterAppState extends State<MobileFlutterApp> {
  late final MobileAppController _controller;
  bool get _ownsController => widget.controller == null;

  @override
  void initState() {
    super.initState();
    _controller = widget.controller ?? _createLiveController();
  }

  @override
  void dispose() {
    if (_ownsController) {
      _controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MobileAppScope(
      controller: _controller,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'West AI Agent',
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2563EB)),
        ),
        initialRoute: AppRoutes.login,
        onGenerateRoute: AppRouter.onGenerateRoute,
      ),
    );
  }

  MobileAppController _createLiveController() {
    final config = PlatformApiConfig.fromEnvironment();
    final apiClient = PlatformApiClient(baseUrl: config.apiBaseUrl);
    final repository = PlatformRepository(apiClient);
    final gatewayHttpClient = PlatformApiClient(baseUrl: config.gatewayHttpBaseUrl);
    final gatewayRepository = LiveMessageGatewayRepository(
      httpClient: gatewayHttpClient,
      httpBaseUrl: config.gatewayHttpBaseUrl,
      wsBaseUrl: config.gatewayWsBaseUrl,
    );
    return MobileAppController(
      repository: repository,
      messageGatewayRepository: gatewayRepository,
    );
  }
}
