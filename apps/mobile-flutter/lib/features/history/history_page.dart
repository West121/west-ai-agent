import 'package:flutter/material.dart';

import '../../core/platform/mobile_app_scope.dart';
import '../../core/platform/platform_models.dart';

String _formatDateTime(DateTime? value) {
  if (value == null) {
    return '暂无';
  }
  final local = value.toLocal();
  return '${local.year}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')} '
      '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
}

class HistoryPage extends StatefulWidget {
  const HistoryPage({super.key});

  @override
  State<HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends State<HistoryPage> {
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
        MobileAppScope.of(context).refreshHistory();
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

        return Scaffold(
          appBar: AppBar(
            title: const Text('历史'),
            actions: [
              IconButton(
                onPressed: controller.refreshHistory,
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              _SummaryCard(title: '历史会话', value: state.history.length.toString(), subtitle: '点击条目即可加载摘要。'),
              const SizedBox(height: 16),
              ...state.history.map(
                (item) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _HistoryTile(
                    item: item,
                    selected: state.selectedConversation?.id == item.id,
                    onTap: () => controller.selectConversation(item),
                  ),
                ),
              ),
              if (state.history.isEmpty) const _EmptyState(text: '暂无历史会话。'),
              const SizedBox(height: 16),
              if (state.selectedSummary != null)
                _SelectedSummaryCard(summary: state.selectedSummary!)
              else
                const _EmptyState(text: '选择一个会话查看 AI 摘要。'),
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

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.title, required this.value, required this.subtitle});

  final String title;
  final String value;
  final String subtitle;

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
          const SizedBox(height: 8),
          Text(value, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(subtitle, style: const TextStyle(color: Color(0xFF64748B))),
        ],
      ),
    );
  }
}

class _SelectedSummaryCard extends StatelessWidget {
  const _SelectedSummaryCard({required this.summary});

  final PlatformConversationSummary summary;

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
          Text('当前摘要', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          Text(summary.aiSummary),
          const SizedBox(height: 12),
          _Row(label: '消息数', value: summary.messageCount.toString()),
          _Row(label: '满意度', value: summary.satisfactionScore?.toString() ?? '未评价'),
          _Row(label: '最后消息', value: _formatDateTime(summary.lastMessageAt)),
        ],
      ),
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.item, required this.selected, required this.onTap});

  final PlatformConversationHistoryItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFEFF6FF) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: selected ? const Color(0xFF93C5FD) : const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('会话 #${item.id}', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text('${item.channel} · ${item.assignee ?? '未分配'} · ${item.status}'),
                  const SizedBox(height: 6),
                  Text(item.summary, maxLines: 2, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(_formatDateTime(item.lastMessageAt), style: Theme.of(context).textTheme.labelSmall),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Text(item.satisfactionScore?.toString() ?? '未评'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF64748B))),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
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
