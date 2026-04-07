import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile_flutter/app.dart';
import 'package:mobile_flutter/core/platform/mobile_app_controller.dart';

import 'support/fakes.dart';

void main() {
  testWidgets('routes to login by default', (tester) async {
    final controller = MobileAppController(
      repository: FakePlatformRepository(),
      messageGatewayRepository: FakeMessageGatewayRepository(),
      clientId: 'widget-test',
    );

    await tester.pumpWidget(MobileFlutterApp(controller: controller));
    await tester.pumpAndSettle();

    expect(find.text('企业客服移动端'), findsOneWidget);
    expect(find.text('进入应用'), findsOneWidget);
  });

  testWidgets('login loads shell and renders home metrics', (tester) async {
    final controller = MobileAppController(
      repository: FakePlatformRepository(),
      messageGatewayRepository: FakeMessageGatewayRepository(),
      clientId: 'widget-test',
    );

    await tester.pumpWidget(MobileFlutterApp(controller: controller));
    await tester.pumpAndSettle();

    await tester.tap(find.text('进入应用'));
    await tester.pumpAndSettle();

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.text('首页'), findsWidgets);
    expect(controller.state.dashboard.customerCount, 2);
  });
}
