import 'package:flutter/widgets.dart';

import 'mobile_app_controller.dart';

class MobileAppScope extends InheritedNotifier<MobileAppController> {
  const MobileAppScope({
    super.key,
    required MobileAppController controller,
    required super.child,
  }) : super(notifier: controller);

  static MobileAppController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<MobileAppScope>();
    assert(scope != null, 'MobileAppScope not found in widget tree');
    return scope!.notifier!;
  }
}

