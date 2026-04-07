import 'package:flutter/material.dart';

import '../../core/platform/mobile_app_scope.dart';

String _formatDateTime(DateTime? value) {
  if (value == null) {
    return '暂无';
  }
  final local = value.toLocal();
  return '${local.year}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')} '
      '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  bool _bootstrapped = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_bootstrapped) {
      return;
    }
    _bootstrapped = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        MobileAppScope.of(context).bootstrap();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final controller = MobileAppScope.of(context);

    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final state = controller.state;
        final dashboard = state.dashboard;

        return Scaffold(
          appBar: AppBar(
            title: const Text('首页'),
            actions: [
              IconButton(
                onPressed: state.isBusy ? null : controller.refreshDashboard,
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          body: RefreshIndicator(
            onRefresh: controller.refreshDashboard,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              children: [
                _HeroCard(
                  username: state.session?.user.username ?? '未登录',
                  permissionCount: state.session?.permissions.length ?? 0,
                  lastRefreshedAt: dashboard.lastRefreshedAt,
                ),
                const SizedBox(height: 16),
                GridView.count(
                  crossAxisCount: MediaQuery.of(context).size.width > 500 ? 2 : 1,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 2.8,
                  children: [
                    _MetricCard(label: '客户', value: dashboard.customerCount.toString()),
                    _MetricCard(label: '知识', value: dashboard.knowledgeCount.toString()),
                    _MetricCard(label: '渠道', value: dashboard.channelCount.toString()),
                    _MetricCard(label: '会话', value: dashboard.conversationCount.toString()),
                    _MetricCard(label: '工单', value: dashboard.topTickets.length.toString()),
                    _MetricCard(label: '留言', value: dashboard.topLeaveMessages.length.toString()),
                  ],
                ),
                const SizedBox(height: 16),
                _SectionCard(
                  title: '运营摘要',
                  children: [
                    _InfoRow(label: '活跃渠道', value: dashboard.activeChannelCount.toString()),
                    _InfoRow(label: '草稿知识', value: dashboard.draftKnowledgeCount.toString()),
                    _InfoRow(label: '已发布知识', value: dashboard.publishedKnowledgeCount.toString()),
                    _InfoRow(label: '开放会话', value: dashboard.openConversationCount.toString()),
                  ],
                ),
                const SizedBox(height: 16),
                _SectionCard(
                  title: '最近客户',
                  children: dashboard.topCustomers
                      .map(
                        (item) => _ListTileCard(
                          title: item.name,
                          subtitle: item.externalId,
                          meta: item.status,
                        ),
                      )
                      .toList(growable: false),
                ),
                const SizedBox(height: 16),
                _SectionCard(
                  title: '最近会话',
                  children: dashboard.topConversations
                      .map(
                        (item) => _ListTileCard(
                          title: '会话 #${item.id}',
                          subtitle: '${item.channel} · ${item.assignee ?? '未分配'}',
                          meta: item.status,
                        ),
                      )
                      .toList(growable: false),
                ),
                const SizedBox(height: 16),
                _SectionCard(
                  title: '最近工单',
                  children: dashboard.topTickets
                      .map(
                        (item) => _ListTileCard(
                          title: item.title,
                          subtitle: item.summary ?? '暂无摘要',
                          meta: item.status,
                        ),
                      )
                      .toList(growable: false),
                ),
                const SizedBox(height: 16),
                _SectionCard(
                  title: '最近留言',
                  children: dashboard.topLeaveMessages
                      .map(
                        (item) => _ListTileCard(
                          title: item.subject,
                          subtitle: item.visitorName,
                          meta: item.status,
                        ),
                      )
                      .toList(growable: false),
                ),
                if (state.errorMessage != null) ...[
                  const SizedBox(height: 16),
                  _ErrorBanner(message: state.errorMessage!),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.username,
    required this.permissionCount,
    required this.lastRefreshedAt,
  });

  final String username;
  final int permissionCount;
  final DateTime? lastRefreshedAt;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFF2563EB)],
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
          Text(
            '权限 $permissionCount 项 · 数据来自平台 API',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.white70),
          ),
          const SizedBox(height: 12),
          Text(
            '最近刷新：${_formatDateTime(lastRefreshedAt)}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.white70),
          ),
        ],
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label, style: Theme.of(context).textTheme.labelMedium?.copyWith(color: const Color(0xFF64748B))),
          const SizedBox(height: 6),
          Text(value, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.children});

  final String title;
  final List<Widget> children;

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
          ...children,
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
                Text(subtitle, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: const Color(0xFF64748B))),
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

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
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
