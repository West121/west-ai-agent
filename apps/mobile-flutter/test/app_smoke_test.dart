import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_flutter/app.dart';

void main() {
  testWidgets('boots into the login experience', (tester) async {
    await tester.pumpWidget(const MobileFlutterApp());
    await tester.pumpAndSettle();

    expect(find.text('企业客服移动端'), findsOneWidget);
    expect(find.text('进入应用'), findsOneWidget);
  });
}
