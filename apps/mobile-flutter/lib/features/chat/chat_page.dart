import 'package:flutter/material.dart';

import '../../core/platform/mobile_app_scope.dart';
import '../../core/platform/platform_models.dart';

String _formatDateTime(DateTime? value) {
  if (value == null) {
    return '暂无';
  }
  final local = value.toLocal();
  return '${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')} '
      '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
}

class ChatPage extends StatefulWidget {
  const ChatPage({super.key});

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final TextEditingController _messageController = TextEditingController();
  final TextEditingController _assigneeController = TextEditingController(text: 'agent-seed');
  final TextEditingController _reasonController = TextEditingController();
  bool _autoSelectedFirstConversation = false;

  @override
  void dispose() {
    _messageController.dispose();
    _assigneeController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = MobileAppScope.of(context);

    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final state = controller.state;

        if (!_autoSelectedFirstConversation && state.selectedConversation == null && state.history.isNotEmpty) {
          _autoSelectedFirstConversation = true;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              controller.selectConversation(state.history.first);
            }
          });
        }

        final selectedConversation = state.selectedConversation;

        return Scaffold(
          appBar: AppBar(
            title: const Text('会话'),
            actions: [
              IconButton(
                onPressed: state.isBusy ? null : controller.refreshHistory,
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          body: LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth >= 960;
              final historyPane = _HistoryPane(
                items: state.history,
                selectedConversationId: selectedConversation?.id,
                onTap: controller.selectConversation,
              );
              final conversationPane = _ConversationPane(
                selectedConversation: selectedConversation,
                selectedSummary: state.selectedSummary,
                messages: state.conversationMessages,
                gatewayStatus: state.gatewayStatus,
                gatewayError: state.gatewayError,
                isBusy: state.isBusy,
                assigneeController: _assigneeController,
                reasonController: _reasonController,
                messageController: _messageController,
                onSendMessage: () {
                  controller.sendChatMessage(_messageController.text);
                  _messageController.clear();
                },
                onTransfer: () => controller.transferSelectedConversation(
                  assignee: _emptyToNull(_assigneeController.text),
                  reason: _emptyToNull(_reasonController.text),
                ),
                onEndConversation: () => controller.endSelectedConversation(
                  reason: _emptyToNull(_reasonController.text),
                ),
              );

              if (wide) {
                return Row(
                  children: [
                    SizedBox(width: 320, child: historyPane),
                    const VerticalDivider(width: 1),
                    Expanded(child: conversationPane),
                  ],
                );
              }

              return Column(
                children: [
                  Flexible(
                    flex: 4,
                    child: historyPane,
                  ),
                  const Divider(height: 1),
                  Expanded(
                    flex: 6,
                    child: conversationPane,
                  ),
                ],
              );
            },
          ),
        );
      },
    );
  }
}

class _HistoryPane extends StatelessWidget {
  const _HistoryPane({
    required this.items,
    required this.selectedConversationId,
    required this.onTap,
  });

  final List<PlatformConversationHistoryItem> items;
  final int? selectedConversationId;
  final ValueChanged<PlatformConversationHistoryItem> onTap;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const Center(child: Text('暂无会话'));
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final item = items[index];
        final selected = item.id == selectedConversationId;
        return InkWell(
          onTap: () => onTap(item),
          borderRadius: BorderRadius.circular(18),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: selected ? const Color(0xFFEFF6FF) : Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: selected ? const Color(0xFF93C5FD) : const Color(0xFFE2E8F0),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '会话 #${item.id}',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(
                  '${item.channel} · ${item.assignee ?? '未分配'} · ${item.status}',
                  style: const TextStyle(color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 8),
                Text(
                  item.summary,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _ConversationPane extends StatelessWidget {
  const _ConversationPane({
    required this.selectedConversation,
    required this.selectedSummary,
    required this.messages,
    required this.gatewayStatus,
    required this.gatewayError,
    required this.isBusy,
    required this.assigneeController,
    required this.reasonController,
    required this.messageController,
    required this.onSendMessage,
    required this.onTransfer,
    required this.onEndConversation,
  });

  final PlatformConversationHistoryItem? selectedConversation;
  final PlatformConversationSummary? selectedSummary;
  final List<PlatformChatMessage> messages;
  final MessageGatewayStatus gatewayStatus;
  final String? gatewayError;
  final bool isBusy;
  final TextEditingController assigneeController;
  final TextEditingController reasonController;
  final TextEditingController messageController;
  final VoidCallback onSendMessage;
  final VoidCallback onTransfer;
  final VoidCallback onEndConversation;

  @override
  Widget build(BuildContext context) {
    if (selectedConversation == null) {
      return const Center(child: Text('请选择左侧会话开始处理'));
    }

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 14),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '会话 #${selectedConversation!.id} · ${selectedConversation!.channel}',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                    ),
                  ),
                  _GatewayBadge(status: gatewayStatus),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                selectedSummary?.aiSummary ?? selectedConversation!.summary,
                style: const TextStyle(color: Color(0xFF475569)),
              ),
              if (gatewayError != null) ...[
                const SizedBox(height: 10),
                Text(gatewayError!, style: const TextStyle(color: Color(0xFFB91C1C))),
              ],
            ],
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              ...messages.map((message) => _MessageBubble(message: message)),
              const SizedBox(height: 16),
              _ActionCard(
                assigneeController: assigneeController,
                reasonController: reasonController,
                isBusy: isBusy,
                onTransfer: onTransfer,
                onEndConversation: onEndConversation,
              ),
            ],
          ),
        ),
        _Composer(
          controller: messageController,
          enabled: !isBusy,
          onSendMessage: onSendMessage,
        ),
      ],
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});

  final PlatformChatMessage message;

  @override
  Widget build(BuildContext context) {
    final isAgent = message.senderRole == 'agent';
    return Align(
      alignment: isAgent ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        constraints: const BoxConstraints(maxWidth: 440),
        decoration: BoxDecoration(
          color: isAgent ? const Color(0xFFDBEAFE) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: isAgent ? const Color(0xFF93C5FD) : const Color(0xFFE2E8F0)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(message.text),
            const SizedBox(height: 8),
            Text(
              '${message.senderRole} · ${message.status} · ${_formatDateTime(message.createdAt)}',
              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.assigneeController,
    required this.reasonController,
    required this.isBusy,
    required this.onTransfer,
    required this.onEndConversation,
  });

  final TextEditingController assigneeController;
  final TextEditingController reasonController;
  final bool isBusy;
  final VoidCallback onTransfer;
  final VoidCallback onEndConversation;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('会话操作', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          TextField(
            controller: assigneeController,
            decoration: const InputDecoration(labelText: '转接客服'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: reasonController,
            decoration: const InputDecoration(labelText: '备注'),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.tonal(
                  onPressed: isBusy ? null : onTransfer,
                  child: const Text('转人工'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: isBusy ? null : onEndConversation,
                  child: const Text('结束会话'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.enabled,
    required this.onSendMessage,
  });

  final TextEditingController controller;
  final bool enabled;
  final VoidCallback onSendMessage;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
        ),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                enabled: enabled,
                minLines: 1,
                maxLines: 4,
                decoration: const InputDecoration(
                  hintText: '输入消息并通过 message-gateway 发送',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.all(Radius.circular(20)),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            FilledButton(
              onPressed: enabled ? onSendMessage : null,
              child: const Text('发送'),
            ),
          ],
        ),
      ),
    );
  }
}

class _GatewayBadge extends StatelessWidget {
  const _GatewayBadge({required this.status});

  final MessageGatewayStatus status;

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (status) {
      MessageGatewayStatus.idle => ('待连接', const Color(0xFFCBD5E1)),
      MessageGatewayStatus.connecting => ('连接中', const Color(0xFFF59E0B)),
      MessageGatewayStatus.open => ('已连接', const Color(0xFF16A34A)),
      MessageGatewayStatus.closed => ('已断开', const Color(0xFF94A3B8)),
      MessageGatewayStatus.error => ('异常', const Color(0xFFDC2626)),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontWeight: FontWeight.w700),
      ),
    );
  }
}

String? _emptyToNull(String value) {
  final normalized = value.trim();
  return normalized.isEmpty ? null : normalized;
}
