import 'dart:async';

import 'package:mobile_flutter/core/platform/message_gateway_repository.dart';
import 'package:mobile_flutter/core/platform/platform_models.dart';
import 'package:mobile_flutter/core/platform/platform_repository.dart';

class FakePlatformRepository implements PlatformRepositoryContract {
  int loginCalls = 0;
  int dashboardCalls = 0;
  int historyCalls = 0;
  String? _token;

  @override
  String? get accessToken => _token;

  @override
  Future<PlatformConversation> createConversation({
    required int customerProfileId,
    String? assignee,
    String channel = 'h5',
  }) {
    throw UnimplementedError();
  }

  @override
  Future<PlatformLeaveMessage> createLeaveMessage({
    required String visitorName,
    String? phone,
    String? email,
    String source = 'customer_h5',
    String subject = '人工客服留言',
    required String content,
    String? assignedGroup,
  }) async {
    return PlatformLeaveMessage(
      id: 9,
      visitorName: visitorName,
      phone: phone,
      email: email,
      source: source,
      status: 'pending',
      subject: subject,
      content: content,
      assignedGroup: assignedGroup,
      createdAt: DateTime.parse('2026-04-06T08:00:00Z'),
      updatedAt: DateTime.parse('2026-04-06T08:00:00Z'),
    );
  }

  @override
  Future<PlatformUser> currentUser() async => _user;

  @override
  Future<void> endConversation({required int conversationId, String? reason}) async {}

  @override
  Future<PlatformConversationSummary> getConversationSummary(int conversationId) async {
    return PlatformConversationSummary(
      conversationId: conversationId,
      aiSummary: '已命中退款 FAQ',
      messageCount: 2,
      lastMessageAt: DateTime.parse('2026-04-06T08:10:00Z'),
      satisfactionScore: null,
    );
  }

  @override
  Future<List<PlatformChannelApp>> listChannels() async => [
        const PlatformChannelApp(
          id: 1,
          name: '官网 H5',
          code: 'h5',
          baseUrl: 'https://example.test',
          isActive: true,
        ),
      ];

  @override
  Future<List<PlatformConversationHistoryItem>> listConversationHistory() async {
    historyCalls += 1;
    return _history;
  }

  @override
  Future<List<PlatformLeaveMessage>> listLeaveMessages() async => [
        PlatformLeaveMessage(
          id: 1,
          visitorName: '张晓晴',
          phone: null,
          email: null,
          source: 'app',
          status: 'pending',
          subject: '退款咨询',
          content: '想了解退款时效',
          assignedGroup: '售后',
          createdAt: DateTime.parse('2026-04-06T08:00:00Z'),
          updatedAt: DateTime.parse('2026-04-06T08:00:00Z'),
        ),
      ];

  @override
  Future<List<PlatformTicket>> listTickets() async => [
        PlatformTicket(
          id: 1,
          title: '退款处理',
          status: 'open',
          priority: 'high',
          source: 'app',
          customerProfileId: 101,
          conversationId: 301,
          assignee: 'agent-1',
          assigneeGroup: '售后',
          summary: '退款进行中',
          slaDueAt: DateTime.parse('2026-04-07T08:00:00Z'),
          createdAt: DateTime.parse('2026-04-06T08:00:00Z'),
          updatedAt: DateTime.parse('2026-04-06T08:00:00Z'),
        ),
      ];

  @override
  Future<List<PlatformUser>> listUsers() async => [_user];

  @override
  Future<PlatformDashboardSnapshot> loadDashboard() async {
    dashboardCalls += 1;
    return PlatformDashboardSnapshot(
      customerCount: 2,
      knowledgeCount: 3,
      channelCount: 1,
      conversationCount: 2,
      activeChannelCount: 1,
      draftKnowledgeCount: 1,
      publishedKnowledgeCount: 2,
      openConversationCount: 1,
      topChannels: await listChannels(),
      topKnowledgeDocuments: const [],
      topCustomers: const [
        PlatformCustomerProfile(
          id: 101,
          externalId: 'customer-101',
          name: '张晓晴',
          email: null,
          phone: null,
          status: 'active',
          createdAt: null,
          updatedAt: null,
        ),
      ],
      topConversations: const [
        PlatformConversation(
          id: 301,
          customerProfileId: 101,
          channel: 'app',
          assignee: 'agent-1',
          status: 'active',
          endedAt: null,
          createdAt: null,
          updatedAt: null,
        ),
      ],
      topTickets: await listTickets(),
      topLeaveMessages: await listLeaveMessages(),
      lastRefreshedAt: DateTime.parse('2026-04-06T08:10:00Z'),
    );
  }

  @override
  Future<PlatformAuthSession> login({required String username, required String password}) async {
    loginCalls += 1;
    _token = 'token-1';
    return const PlatformAuthSession(
      accessToken: 'token-1',
      user: _user,
      permissions: ['dashboard.read', 'conversation.manage'],
    );
  }

  @override
  void setAccessToken(String? value) {
    _token = value;
  }

  @override
  Future<PlatformSatisfactionRecord> submitSatisfaction({
    required int conversationId,
    required int score,
    String? comment,
  }) async {
    return PlatformSatisfactionRecord(
      conversationId: conversationId,
      score: score,
      comment: comment,
      createdAt: DateTime.parse('2026-04-06T08:12:00Z'),
      updatedAt: DateTime.parse('2026-04-06T08:12:00Z'),
    );
  }

  @override
  Future<void> transferConversation({
    required int conversationId,
    String? assignee,
    String? reason,
  }) async {}

  static const PlatformUser _user = PlatformUser(
    id: 7,
    username: 'agent-1',
    role: PlatformRole(id: 1, name: 'agent', permissions: [PlatformPermission(name: 'conversation.manage')]),
    isActive: true,
    createdAt: null,
  );

  static const List<PlatformConversationHistoryItem> _history = [
    PlatformConversationHistoryItem(
      id: 301,
      customerProfileId: 101,
      status: 'active',
      assignee: 'agent-1',
      channel: 'app',
      summary: '用户咨询退款到账时效',
      lastMessageAt: null,
      createdAt: null,
      endedAt: null,
      satisfactionScore: null,
    ),
    PlatformConversationHistoryItem(
      id: 302,
      customerProfileId: 102,
      status: 'ended',
      assignee: 'agent-2',
      channel: 'web',
      summary: '发票补开已完成',
      lastMessageAt: null,
      createdAt: null,
      endedAt: null,
      satisfactionScore: 5,
    ),
  ];
}

class FakeMessageGatewayRepository implements MessageGatewayRepository {
  final StreamController<MessageGatewayEvent> controller = StreamController<MessageGatewayEvent>.broadcast();
  final List<String> sentMessages = <String>[];
  final List<String> ackedMessageIds = <String>[];
  String? connectedConversationId;

  @override
  Stream<MessageGatewayEvent> connect({
    required String conversationId,
    required String clientId,
    required String role,
  }) {
    connectedConversationId = conversationId;
    scheduleMicrotask(() {
      controller.add(
        MessageGatewayConnectionAckEvent(
          conversationId: conversationId,
          clientId: clientId,
          role: role,
        ),
      );
    });
    return controller.stream;
  }

  @override
  Future<void> disconnect() async {}

  void emit(MessageGatewayEvent event) {
    controller.add(event);
  }

  @override
  Future<List<PlatformChatMessage>> listMessages(String conversationId) async {
    return [
      const PlatformChatMessage(
        id: 'seed-1',
        conversationId: '301',
        senderId: 'customer-101',
        senderRole: 'customer',
        text: '退款多久到账？',
        status: 'read',
        createdAt: null,
        ackedBy: 'agent-1',
        ackedAt: null,
      ),
    ];
  }

  @override
  void sendAck(String messageId) {
    ackedMessageIds.add(messageId);
  }

  @override
  void sendMessage(String text) {
    sentMessages.add(text);
  }
}
