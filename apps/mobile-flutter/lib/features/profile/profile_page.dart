import 'package:flutter/material.dart';

import '../../core/platform/mobile_app_scope.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final TextEditingController _visitorController = TextEditingController(text: '匿名访客');
  final TextEditingController _subjectController = TextEditingController(text: '客服留言');
  final TextEditingController _contentController = TextEditingController();

  @override
  void dispose() {
    _visitorController.dispose();
    _subjectController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = MobileAppScope.of(context);

    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final state = controller.state;
        final session = state.session;

        return Scaffold(
          appBar: AppBar(
            title: const Text('我的'),
            actions: [
              TextButton(
                onPressed: controller.signOut,
                child: const Text('退出'),
              ),
            ],
          ),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              _ProfileHero(
                username: session?.user.username ?? '未登录',
                roleName: session?.user.role?.name ?? 'unknown',
                permissionCount: session?.permissions.length ?? 0,
              ),
              const SizedBox(height: 16),
              _SectionCard(
                title: '权限',
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: (session?.permissions ?? const <String>[])
                      .map(
                        (permission) => Chip(
                          label: Text(permission),
                          backgroundColor: const Color(0xFFF8FAFC),
                        ),
                      )
                      .toList(growable: false),
                ),
              ),
              const SizedBox(height: 16),
              _SectionCard(
                title: '最近留言',
                child: state.leaveMessages.isEmpty
                    ? const _EmptyState(text: '暂无留言记录。')
                    : Column(
                        children: state.leaveMessages
                            .map(
                              (item) => _ListTileCard(
                                title: item.subject,
                                subtitle: item.visitorName,
                                meta: item.status,
                              ),
                            )
                            .toList(growable: false),
                      ),
              ),
              const SizedBox(height: 16),
              _SectionCard(
                title: '快速留言',
                child: Column(
                  children: [
                    TextField(
                      controller: _visitorController,
                      decoration: const InputDecoration(labelText: '访客姓名'),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _subjectController,
                      decoration: const InputDecoration(labelText: '主题'),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _contentController,
                      minLines: 3,
                      maxLines: 5,
                      decoration: const InputDecoration(labelText: '内容'),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.tonal(
                        onPressed: state.isBusy
                            ? null
                            : () async {
                                final messenger = ScaffoldMessenger.of(context);
                                await controller.submitLeaveMessage(
                                  visitorName: _visitorController.text.trim(),
                                  subject: _subjectController.text.trim(),
                                  content: _contentController.text.trim(),
                                );
                                if (!context.mounted) return;
                                messenger.showSnackBar(const SnackBar(content: Text('留言已提交')));
                              },
                        child: const Text('提交留言'),
                      ),
                    ),
                  ],
                ),
              ),
              if (state.errorMessage != null) ...[
                const SizedBox(height: 16),
                _ErrorBanner(message: state.errorMessage!),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({
    required this.username,
    required this.roleName,
    required this.permissionCount,
  });

  final String username;
  final String roleName;
  final int permissionCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFF1D4ED8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(username, style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          Text('角色：$roleName · 权限：$permissionCount', style: const TextStyle(color: Colors.white70)),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _ListTileCard extends StatelessWidget {
  const _ListTileCard({required this.title, required this.subtitle, required this.meta});

  final String title;
  final String subtitle;
  final String meta;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text(subtitle, style: const TextStyle(color: Color(0xFF64748B))),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Text(meta),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(text, style: const TextStyle(color: Color(0xFF64748B))),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF1F2),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFFDA4AF)),
      ),
      child: Text(message, style: const TextStyle(color: Color(0xFF9F1239))),
    );
  }
}
