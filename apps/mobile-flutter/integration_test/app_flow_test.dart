import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile_flutter/app.dart';
import 'package:mobile_flutter/core/platform/mobile_app_controller.dart';

import '../test/support/fakes.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('login, switch tabs, and send a chat message', (tester) async {
    final gateway = FakeMessageGatewayRepository();
    final controller = MobileAppController(
      repository: FakePlatformRepository(),
      messageGatewayRepository: gateway,
      clientId: 'integration-test',
    );

    await tester.pumpWidget(MobileFlutterApp(controller: controller));
    await tester.pumpAndSettle();

    await tester.tap(find.text('进入应用'));
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.chat_bubble_outline));
    await tester.pumpAndSettle();

    expect(find.text('会话 #301 · app'), findsOneWidget);
    expect(find.text('退款多久到账？'), findsOneWidget);

    await tester.enterText(find.byType(TextField).last, '请稍等，我来帮你核实');
    await tester.tap(find.text('发送'));
    await tester.pump();

    expect(gateway.sentMessages, ['请稍等，我来帮你核实']);

    await tester.tap(find.text('我的'));
    await tester.pumpAndSettle();
    expect(find.text('快速留言'), findsOneWidget);
  });
}
