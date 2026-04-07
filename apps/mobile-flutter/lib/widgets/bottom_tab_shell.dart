import 'package:flutter/material.dart';

import '../core/platform/mobile_app_scope.dart';
import '../features/chat/chat_page.dart';
import '../features/history/history_page.dart';
import '../features/home/home_page.dart';
import '../features/profile/profile_page.dart';

class BottomTabShell extends StatefulWidget {
  const BottomTabShell({super.key, this.initialIndex = 0});

  final int initialIndex;

  @override
  State<BottomTabShell> createState() => _BottomTabShellState();
}

class _BottomTabShellState extends State<BottomTabShell> {
  late int _currentIndex = widget.initialIndex;

  static const _pages = <Widget>[
    HomePage(),
    ChatPage(),
    HistoryPage(),
    ProfilePage(),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      MobileAppScope.of(context).bootstrap();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _pages,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: '首页'),
          NavigationDestination(icon: Icon(Icons.chat_bubble_outline), label: '会话'),
          NavigationDestination(icon: Icon(Icons.history), label: '历史'),
          NavigationDestination(icon: Icon(Icons.person_outline), label: '我的'),
        ],
      ),
    );
  }
}
