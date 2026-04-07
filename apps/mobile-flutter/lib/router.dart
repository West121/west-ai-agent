import 'package:flutter/material.dart';

import 'features/chat/chat_page.dart';
import 'features/history/history_page.dart';
import 'features/home/home_page.dart';
import 'features/login/login_page.dart';
import 'features/profile/profile_page.dart';
import 'widgets/bottom_tab_shell.dart';

class AppRoutes {
  static const login = '/login';
  static const shell = '/shell';
  static const home = '/home';
  static const chat = '/chat';
  static const history = '/history';
  static const profile = '/profile';
}

class AppRouter {
  static Route<dynamic> onGenerateRoute(RouteSettings settings) {
    switch (settings.name) {
      case AppRoutes.login:
        return MaterialPageRoute<void>(
          builder: (_) => const LoginPage(),
          settings: settings,
        );
      case AppRoutes.shell:
        return MaterialPageRoute<void>(
          builder: (_) => const BottomTabShell(),
          settings: settings,
        );
      case AppRoutes.home:
        return MaterialPageRoute<void>(
          builder: (_) => const HomePage(),
          settings: settings,
        );
      case AppRoutes.chat:
        return MaterialPageRoute<void>(
          builder: (_) => const ChatPage(),
          settings: settings,
        );
      case AppRoutes.history:
        return MaterialPageRoute<void>(
          builder: (_) => const HistoryPage(),
          settings: settings,
        );
      case AppRoutes.profile:
        return MaterialPageRoute<void>(
          builder: (_) => const ProfilePage(),
          settings: settings,
        );
      default:
        return MaterialPageRoute<void>(
          builder: (_) => const LoginPage(),
          settings: settings,
        );
    }
  }

  static Route<void> routeForTab(int index) {
    switch (index) {
      case 0:
        return MaterialPageRoute<void>(
          builder: (_) => const BottomTabShell(initialIndex: 0),
        );
      case 1:
        return MaterialPageRoute<void>(
          builder: (_) => const BottomTabShell(initialIndex: 1),
        );
      case 2:
        return MaterialPageRoute<void>(
          builder: (_) => const BottomTabShell(initialIndex: 2),
        );
      case 3:
        return MaterialPageRoute<void>(
          builder: (_) => const BottomTabShell(initialIndex: 3),
        );
      default:
        return MaterialPageRoute<void>(
          builder: (_) => const BottomTabShell(initialIndex: 0),
        );
    }
  }
}
