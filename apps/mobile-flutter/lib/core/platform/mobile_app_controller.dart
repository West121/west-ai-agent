import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';

import 'message_gateway_repository.dart';
import 'platform_models.dart';
import 'platform_repository.dart';

@immutable
class MobileAppViewState {
  const MobileAppViewState({
    required this.isBusy,
    required this.errorMessage,
    required this.session,
    required this.dashboard,
    required this.users,
    required this.channels,
    required this.tickets,
    required this.leaveMessages,
    required this.history,
    required this.selectedSummary,
    required this.selectedConversation,
    required this.selectedLeaveMessage,
    required this.conversationMessages,
    required this.gatewayStatus,
    required this.gatewayError,
  });

  factory MobileAppViewState.initial() {
    return MobileAppViewState(
      isBusy: false,
      errorMessage: null,
      session: null,
      dashboard: PlatformDashboardSnapshot.empty(),
      users: const [],
      channels: const [],
      tickets: const [],
      leaveMessages: const [],
      history: const [],
      selectedSummary: null,
      selectedConversation: null,
      selectedLeaveMessage: null,
      conversationMessages: const [],
      gatewayStatus: MessageGatewayStatus.idle,
      gatewayError: null,
    );
  }

  final bool isBusy;
  final String? errorMessage;
  final PlatformAuthSession? session;
  final PlatformDashboardSnapshot dashboard;
  final List<PlatformUser> users;
  final List<PlatformChannelApp> channels;
  final List<PlatformTicket> tickets;
  final List<PlatformLeaveMessage> leaveMessages;
  final List<PlatformConversationHistoryItem> history;
  final PlatformConversationSummary? selectedSummary;
  final PlatformConversationHistoryItem? selectedConversation;
  final PlatformLeaveMessage? selectedLeaveMessage;
  final List<PlatformChatMessage> conversationMessages;
  final MessageGatewayStatus gatewayStatus;
  final String? gatewayError;

  MobileAppViewState copyWith({
    bool? isBusy,
    String? errorMessage,
    PlatformAuthSession? session,
    PlatformDashboardSnapshot? dashboard,
    List<PlatformUser>? users,
    List<PlatformChannelApp>? channels,
    List<PlatformTicket>? tickets,
    List<PlatformLeaveMessage>? leaveMessages,
    List<PlatformConversationHistoryItem>? history,
    PlatformConversationSummary? selectedSummary,
    PlatformConversationHistoryItem? selectedConversation,
    PlatformLeaveMessage? selectedLeaveMessage,
    List<PlatformChatMessage>? conversationMessages,
    MessageGatewayStatus? gatewayStatus,
    String? gatewayError,
    bool clearError = false,
    bool clearSummary = false,
    bool clearConversation = false,
    bool clearLeaveMessage = false,
    bool clearGatewayError = false,
  }) {
    return MobileAppViewState(
      isBusy: isBusy ?? this.isBusy,
      errorMessage: clearError ? null : errorMessage ?? this.errorMessage,
      session: session ?? this.session,
      dashboard: dashboard ?? this.dashboard,
      users: users ?? this.users,
      channels: channels ?? this.channels,
      tickets: tickets ?? this.tickets,
      leaveMessages: leaveMessages ?? this.leaveMessages,
      history: history ?? this.history,
      selectedSummary: clearSummary ? null : selectedSummary ?? this.selectedSummary,
      selectedConversation: clearConversation ? null : selectedConversation ?? this.selectedConversation,
      selectedLeaveMessage: clearLeaveMessage ? null : selectedLeaveMessage ?? this.selectedLeaveMessage,
      conversationMessages: conversationMessages ?? this.conversationMessages,
      gatewayStatus: gatewayStatus ?? this.gatewayStatus,
      gatewayError: clearGatewayError ? null : gatewayError ?? this.gatewayError,
    );
  }
}

class MobileAppController extends ChangeNotifier {
  MobileAppController({
    required PlatformRepositoryContract repository,
    required MessageGatewayRepository messageGatewayRepository,
    String? clientId,
  })  : _repository = repository,
        _messageGatewayRepository = messageGatewayRepository,
        _clientId = clientId ?? 'mobile-agent-${DateTime.now().millisecondsSinceEpoch}-${Random().nextInt(9999)}',
        _state = MobileAppViewState.initial();

  final PlatformRepositoryContract _repository;
  final MessageGatewayRepository _messageGatewayRepository;
  final String _clientId;
  MobileAppViewState _state;
  StreamSubscription<MessageGatewayEvent>? _gatewaySubscription;

  MobileAppViewState get state => _state;
  bool get isAuthenticated => _state.session != null;

  void _setState(MobileAppViewState value) {
    _state = value;
    notifyListeners();
  }

  Future<void> bootstrap() async {
    if (!isAuthenticated) {
      return;
    }
    await _reloadAllData();
  }

  Future<void> signIn({
    required String username,
    required String password,
  }) async {
    _setState(_state.copyWith(isBusy: true, clearError: true));
    try {
      final session = await _repository.login(username: username, password: password);
      _setState(_state.copyWith(session: session, clearError: true));
      await _reloadAllData();
    } catch (error) {
      _setState(_state.copyWith(errorMessage: error.toString().replaceFirst('Exception: ', ''), isBusy: false));
      rethrow;
    } finally {
      _setState(_state.copyWith(isBusy: false));
    }
  }

  Future<void> signOut() async {
    await _disconnectGateway();
    _repository.setAccessToken(null);
    _setState(MobileAppViewState.initial());
  }

  @override
  void dispose() {
    unawaited(_disconnectGateway());
    super.dispose();
  }

  Future<void> refreshDashboard() async {
    await _wrapBusyAction(() async {
      final dashboard = await _repository.loadDashboard();
      final channels = await _repository.listChannels();
      final users = await _repository.listUsers();
      _setState(
        _state.copyWith(
          dashboard: dashboard,
          channels: channels,
          users: users,
          clearError: true,
        ),
      );
    });
  }

  Future<void> refreshHistory() async {
    await _wrapBusyAction(() async {
      final history = await _repository.listConversationHistory();
      _setState(_state.copyWith(history: history, clearError: true));
    });
  }

  Future<void> refreshTickets() async {
    await _wrapBusyAction(() async {
      final tickets = await _repository.listTickets();
      _setState(_state.copyWith(tickets: tickets, clearError: true));
    });
  }

  Future<void> refreshLeaveMessages() async {
    await _wrapBusyAction(() async {
      final leaveMessages = await _repository.listLeaveMessages();
      _setState(_state.copyWith(leaveMessages: leaveMessages, clearError: true));
    });
  }

  Future<void> selectConversation(PlatformConversationHistoryItem item) async {
    _setState(
      _state.copyWith(
        selectedConversation: item,
        clearSummary: true,
        clearError: true,
        conversationMessages: const [],
        gatewayStatus: MessageGatewayStatus.connecting,
        clearGatewayError: true,
      ),
    );
    try {
      final summaryFuture = _repository.getConversationSummary(item.id);
      final messagesFuture = _messageGatewayRepository.listMessages(item.id.toString());
      final results = await Future.wait<Object>([summaryFuture, messagesFuture]);
      final summary = results[0] as PlatformConversationSummary;
      final messages = results[1] as List<PlatformChatMessage>;
      _setState(
        _state.copyWith(
          selectedSummary: summary,
          conversationMessages: messages,
          clearError: true,
          clearGatewayError: true,
        ),
      );
      await _connectGateway(item.id.toString());
    } catch (error) {
      _setState(_state.copyWith(errorMessage: error.toString().replaceFirst('Exception: ', '')));
    }
  }

  Future<void> updateSelectedConversationSummary() async {
    final conversation = _state.selectedConversation;
    if (conversation == null) {
      return;
    }
    try {
      final summary = await _repository.getConversationSummary(conversation.id);
      _setState(_state.copyWith(selectedSummary: summary, clearError: true));
    } catch (error) {
      _setState(_state.copyWith(errorMessage: error.toString().replaceFirst('Exception: ', '')));
    }
  }

  void sendChatMessage(String text) {
    final normalized = text.trim();
    if (normalized.isEmpty || _state.selectedConversation == null) {
      return;
    }
    try {
      _messageGatewayRepository.sendMessage(normalized);
      _setState(_state.copyWith(clearGatewayError: true));
    } catch (error) {
      _setState(_state.copyWith(gatewayError: error.toString().replaceFirst('Exception: ', '')));
    }
  }

  Future<void> transferSelectedConversation({
    required String? assignee,
    required String? reason,
  }) async {
    final conversation = _state.selectedConversation;
    if (conversation == null) {
      return;
    }
    await _wrapBusyAction(() async {
      await _repository.transferConversation(
        conversationId: conversation.id,
        assignee: assignee,
        reason: reason,
      );
      await refreshHistory();
      await updateSelectedConversationSummary();
    });
  }

  Future<void> endSelectedConversation({required String? reason}) async {
    final conversation = _state.selectedConversation;
    if (conversation == null) {
      return;
    }
    await _wrapBusyAction(() async {
      await _repository.endConversation(conversationId: conversation.id, reason: reason);
      await refreshHistory();
      await updateSelectedConversationSummary();
    });
  }

  Future<void> submitSelectedConversationSatisfaction({
    required int score,
    required String? comment,
  }) async {
    final conversation = _state.selectedConversation;
    if (conversation == null) {
      return;
    }
    await _wrapBusyAction(() async {
      final satisfaction = await _repository.submitSatisfaction(
        conversationId: conversation.id,
        score: score,
        comment: comment,
      );
      _setState(
        _state.copyWith(
          selectedSummary: (_state.selectedSummary ??
                  PlatformConversationSummary(
                    conversationId: conversation.id,
                    aiSummary: conversation.summary,
                    messageCount: _state.conversationMessages.length,
                    lastMessageAt: conversation.lastMessageAt,
                    satisfactionScore: null,
                  ))
              .copyWith(satisfactionScore: satisfaction.score),
        ),
      );
      await refreshHistory();
    });
  }

  Future<void> submitLeaveMessage({
    required String visitorName,
    required String subject,
    required String content,
    String? phone,
    String? email,
    String? assignedGroup,
  }) async {
    await _wrapBusyAction(() async {
      await _repository.createLeaveMessage(
        visitorName: visitorName,
        subject: subject,
        content: content,
        phone: phone,
        email: email,
        assignedGroup: assignedGroup,
      );
      await refreshLeaveMessages();
    }, rethrowError: true);
  }

  Future<void> _reloadAllData() async {
    final tasks = await Future.wait<Object?>([
      _safeCall(() => _repository.loadDashboard()),
      _safeCall(() => _repository.listUsers()),
      _safeCall(() => _repository.listChannels()),
      _safeCall(() => _repository.listTickets()),
      _safeCall(() => _repository.listLeaveMessages()),
      _safeCall(() => _repository.listConversationHistory()),
    ]);

    final history = tasks[5] as List<PlatformConversationHistoryItem>? ?? const [];
    _setState(
      _state.copyWith(
        dashboard: tasks[0] as PlatformDashboardSnapshot? ?? PlatformDashboardSnapshot.empty(),
        users: tasks[1] as List<PlatformUser>? ?? const [],
        channels: tasks[2] as List<PlatformChannelApp>? ?? const [],
        tickets: tasks[3] as List<PlatformTicket>? ?? const [],
        leaveMessages: tasks[4] as List<PlatformLeaveMessage>? ?? const [],
        history: history,
        clearError: true,
      ),
    );

    final selectedConversation = _state.selectedConversation;
    if (selectedConversation != null) {
      final refreshed = history.where((item) => item.id == selectedConversation.id).firstOrNull;
      if (refreshed != null) {
        await selectConversation(refreshed);
      }
    }
  }

  Future<void> _connectGateway(String conversationId) async {
    await _disconnectGateway();
    _setState(_state.copyWith(gatewayStatus: MessageGatewayStatus.connecting, clearGatewayError: true));
    final stream = _messageGatewayRepository.connect(
      conversationId: conversationId,
      clientId: _clientId,
      role: 'agent',
    );

    _gatewaySubscription = stream.listen(
      _handleGatewayEvent,
      onError: (Object error, StackTrace stackTrace) {
        _setState(
          _state.copyWith(
            gatewayStatus: MessageGatewayStatus.error,
            gatewayError: error.toString(),
          ),
        );
      },
      onDone: () {
        _setState(_state.copyWith(gatewayStatus: MessageGatewayStatus.closed));
      },
    );
  }

  void _handleGatewayEvent(MessageGatewayEvent event) {
    switch (event) {
      case MessageGatewayConnectionAckEvent():
        _setState(_state.copyWith(gatewayStatus: MessageGatewayStatus.open, clearGatewayError: true));
      case MessageGatewayMessageEvent():
        final currentMessages = _upsertMessage(_state.conversationMessages, event.message);
        _setState(
          _state.copyWith(
            conversationMessages: currentMessages,
            selectedSummary: _state.selectedSummary?.copyWith(messageCount: currentMessages.length),
            clearGatewayError: true,
          ),
        );
        if (event.message.senderRole != 'agent') {
          _messageGatewayRepository.sendAck(event.message.id);
        }
      case MessageGatewayAckEvent():
        _setState(
          _state.copyWith(
            conversationMessages: _state.conversationMessages
                .map(
                  (message) => message.id == event.messageId
                      ? message.copyWith(
                          status: event.status,
                          ackedBy: event.ackedBy,
                          ackedAt: event.ackedAt,
                        )
                      : message,
                )
                .toList(growable: false),
            clearGatewayError: true,
          ),
        );
      case MessageGatewayErrorEvent():
        _setState(
          _state.copyWith(
            gatewayStatus: MessageGatewayStatus.error,
            gatewayError: event.detail,
          ),
        );
      case MessageGatewayDisconnectedEvent():
        _setState(_state.copyWith(gatewayStatus: MessageGatewayStatus.closed));
      case MessageGatewayPongEvent():
        break;
    }
  }

  List<PlatformChatMessage> _upsertMessage(
    List<PlatformChatMessage> current,
    PlatformChatMessage incoming,
  ) {
    final index = current.indexWhere((message) => message.id == incoming.id);
    if (index == -1) {
      return [...current, incoming];
    }
    final next = current.toList(growable: false).toList();
    next[index] = incoming;
    return next;
  }

  Future<void> _disconnectGateway() async {
    await _gatewaySubscription?.cancel();
    _gatewaySubscription = null;
    await _messageGatewayRepository.disconnect();
  }

  Future<void> _wrapBusyAction(
    Future<void> Function() action, {
    bool rethrowError = false,
  }) async {
    _setState(_state.copyWith(isBusy: true, clearError: true));
    try {
      await action();
    } catch (error) {
      _setState(_state.copyWith(errorMessage: error.toString().replaceFirst('Exception: ', '')));
      if (rethrowError) {
        rethrow;
      }
    } finally {
      _setState(_state.copyWith(isBusy: false));
    }
  }

  Future<Object?> _safeCall(Future<Object?> Function() action) async {
    try {
      return await action();
    } catch (_) {
      return null;
    }
  }
}

extension on PlatformConversationSummary {
  PlatformConversationSummary copyWith({
    int? satisfactionScore,
    int? messageCount,
  }) {
    return PlatformConversationSummary(
      conversationId: conversationId,
      aiSummary: aiSummary,
      messageCount: messageCount ?? this.messageCount,
      lastMessageAt: lastMessageAt,
      satisfactionScore: satisfactionScore ?? this.satisfactionScore,
    );
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
