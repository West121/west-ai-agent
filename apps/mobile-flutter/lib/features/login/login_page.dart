import 'package:flutter/material.dart';

import '../../core/platform/mobile_app_scope.dart';
import '../../router.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final TextEditingController _usernameController = TextEditingController(text: 'admin');
  final TextEditingController _passwordController = TextEditingController(text: 'admin123');

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = MobileAppScope.of(context);

    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        return Scaffold(
          body: SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Icon(Icons.shield_outlined, size: 64),
                      const SizedBox(height: 16),
                      Text(
                        '企业客服移动端',
                        style: Theme.of(context).textTheme.headlineSmall,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '默认接入 platform-api 的 admin 账号，可直接验证登录和状态加载。',
                        style: Theme.of(context).textTheme.bodyMedium,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      TextField(
                        controller: _usernameController,
                        decoration: const InputDecoration(labelText: '用户名'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _passwordController,
                        decoration: const InputDecoration(labelText: '密码'),
                        obscureText: true,
                      ),
                      const SizedBox(height: 20),
                      FilledButton(
                        onPressed: controller.state.isBusy
                            ? null
                            : () async {
                                try {
                                  await controller.signIn(
                                    username: _usernameController.text.trim(),
                                    password: _passwordController.text,
                                  );
                                  if (!context.mounted) return;
                                  Navigator.of(context).pushReplacementNamed(AppRoutes.shell);
                                } catch (_) {}
                              },
                        child: Text(controller.state.isBusy ? '登录中...' : '进入应用'),
                      ),
                      if (controller.state.errorMessage != null) ...[
                        const SizedBox(height: 12),
                        Text(
                          controller.state.errorMessage!,
                          style: TextStyle(color: Theme.of(context).colorScheme.error),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
