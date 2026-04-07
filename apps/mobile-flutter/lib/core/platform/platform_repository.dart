import 'platform_api_client.dart';
import 'platform_models.dart';

abstract class PlatformRepositoryContract {
  String? get accessToken;

  void setAccessToken(String? value);

  Future<PlatformAuthSession> login({
    required String username,
    required String password,
  });

  Future<PlatformUser> currentUser();

  Future<List<PlatformUser>> listUsers();

  Future<PlatformDashboardSnapshot> loadDashboard();

  Future<List<PlatformConversationHistoryItem>> listConversationHistory();

  Future<PlatformConversationSummary> getConversationSummary(int conversationId);

  Future<PlatformConversation> createConversation({
    required int customerProfileId,
    String? assignee,
    String channel = 'h5',
  });

  Future<void> transferConversation({
    required int conversationId,
    String? assignee,
    String? reason,
  });

  Future<void> endConversation({
    required int conversationId,
    String? reason,
  });

  Future<PlatformSatisfactionRecord> submitSatisfaction({
    required int conversationId,
    required int score,
    String? comment,
  });

  Future<List<PlatformLeaveMessage>> listLeaveMessages();

  Future<PlatformLeaveMessage> createLeaveMessage({
    required String visitorName,
    String? phone,
    String? email,
    String source = 'customer_h5',
    String subject = '人工客服留言',
    required String content,
    String? assignedGroup,
  });

  Future<List<PlatformTicket>> listTickets();

  Future<List<PlatformChannelApp>> listChannels();
}

class PlatformRepository implements PlatformRepositoryContract {
  PlatformRepository(this._client);

  final PlatformApiClient _client;

  @override
  String? get accessToken => _client.accessToken;

  @override
  void setAccessToken(String? value) {
    _client.setAccessToken(value);
  }

  @override
  Future<PlatformAuthSession> login({
    required String username,
    required String password,
  }) async {
    final response = await _client.request(
      '/auth/login',
      method: 'POST',
      body: {'username': username, 'password': password},
    );
    final session = PlatformAuthSession.fromJson(_asMap(response));
    setAccessToken(session.accessToken);
    return session;
  }

  @override
  Future<PlatformUser> currentUser() async {
    final response = await _client.getJsonObject('/auth/me/permissions');
    return PlatformUser.fromJson(_asMap(response['user']));
  }

  @override
  Future<List<PlatformUser>> listUsers() async {
    final response = await _client.getJsonObject('/auth/users');
    return _asList(response['items']).map((item) => PlatformUser.fromJson(_asMap(item))).toList(growable: false);
  }

  @override
  Future<PlatformDashboardSnapshot> loadDashboard() async {
    final customersResponse = await _client.getJsonList('/customer/profiles');
    final knowledgeResponse = await _client.getJsonList('/knowledge/documents');
    final channelsResponse = await _client.getJsonObject('/channels/apps');
    final conversationsResponse = await _client.getJsonList('/conversation/conversations');
    final ticketsResponse = await _client.getJsonObject('/service/tickets');
    final leaveMessagesResponse = await _client.getJsonObject('/service/leave-messages');

    final customers = customersResponse
        .map((item) => PlatformCustomerProfile.fromJson(_asMap(item)))
        .toList(growable: false);
    final knowledgeDocuments = knowledgeResponse
        .map((item) => PlatformKnowledgeDocument.fromJson(_asMap(item)))
        .toList(growable: false);
    final channels = _asList(channelsResponse['items'])
        .map((item) => PlatformChannelApp.fromJson(_asMap(item)))
        .toList(growable: false);
    final conversations = conversationsResponse
        .map((item) => PlatformConversation.fromJson(_asMap(item)))
        .toList(growable: false);
    final tickets = _asList(ticketsResponse['items'])
        .map((item) => PlatformTicket.fromJson(_asMap(item)))
        .toList(growable: false);
    final leaveMessages = _asList(leaveMessagesResponse['items'])
        .map((item) => PlatformLeaveMessage.fromJson(_asMap(item)))
        .toList(growable: false);

    return PlatformDashboardSnapshot(
      customerCount: customers.length,
      knowledgeCount: knowledgeDocuments.length,
      channelCount: channels.length,
      conversationCount: conversations.length,
      activeChannelCount: channels.where((item) => item.isActive).length,
      draftKnowledgeCount: knowledgeDocuments.where((item) => item.status == 'draft').length,
      publishedKnowledgeCount: knowledgeDocuments.where((item) => item.status == 'published').length,
      openConversationCount: conversations.where((item) => item.status != 'ended').length,
      topChannels: channels.take(4).toList(growable: false),
      topKnowledgeDocuments: knowledgeDocuments.take(4).toList(growable: false),
      topCustomers: customers.take(4).toList(growable: false),
      topConversations: conversations.take(4).toList(growable: false),
      topTickets: tickets.take(4).toList(growable: false),
      topLeaveMessages: leaveMessages.take(4).toList(growable: false),
      lastRefreshedAt: DateTime.now(),
    );
  }

  @override
  Future<List<PlatformConversationHistoryItem>> listConversationHistory() async {
    final response = await _client.getJsonObject('/conversation/conversations/history');
    return _asList(response['items'])
        .map((item) => PlatformConversationHistoryItem.fromJson(_asMap(item)))
        .toList(growable: false);
  }

  @override
  Future<PlatformConversationSummary> getConversationSummary(int conversationId) async {
    final response = await _client.getJsonObject('/conversation/conversations/$conversationId/summary');
    return PlatformConversationSummary.fromJson(response);
  }

  @override
  Future<PlatformConversation> createConversation({
    required int customerProfileId,
    String? assignee,
    String channel = 'h5',
  }) async {
    final response = await _client.request(
      '/conversation/conversations',
      method: 'POST',
      body: {
        'customer_profile_id': customerProfileId,
        'assignee': assignee,
        'channel': channel,
      },
    );
    return PlatformConversation.fromJson(_asMap(response));
  }

  @override
  Future<void> transferConversation({
    required int conversationId,
    String? assignee,
    String? reason,
  }) async {
    await _client.request(
      '/conversation/conversations/$conversationId/transfer',
      method: 'POST',
      body: {'assignee': assignee, 'reason': reason},
    );
  }

  @override
  Future<void> endConversation({
    required int conversationId,
    String? reason,
  }) async {
    await _client.request(
      '/conversation/conversations/$conversationId/end',
      method: 'POST',
      body: {'reason': reason},
    );
  }

  @override
  Future<PlatformSatisfactionRecord> submitSatisfaction({
    required int conversationId,
    required int score,
    String? comment,
  }) async {
    final response = await _client.request(
      '/conversation/conversations/$conversationId/satisfaction',
      method: 'POST',
      body: {'score': score, 'comment': comment},
    );
    return PlatformSatisfactionRecord.fromJson(_asMap(response));
  }

  @override
  Future<List<PlatformLeaveMessage>> listLeaveMessages() async {
    final response = await _client.getJsonObject('/service/leave-messages');
    return _asList(response['items'])
        .map((item) => PlatformLeaveMessage.fromJson(_asMap(item)))
        .toList(growable: false);
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
    final response = await _client.request(
      '/service/leave-messages',
      method: 'POST',
      body: {
        'visitor_name': visitorName,
        'phone': phone,
        'email': email,
        'source': source,
        'subject': subject,
        'content': content,
        'assigned_group': assignedGroup,
      },
    );
    return PlatformLeaveMessage.fromJson(_asMap(response));
  }

  @override
  Future<List<PlatformTicket>> listTickets() async {
    final response = await _client.getJsonObject('/service/tickets');
    return _asList(response['items'])
        .map((item) => PlatformTicket.fromJson(_asMap(item)))
        .toList(growable: false);
  }

  @override
  Future<List<PlatformChannelApp>> listChannels() async {
    final response = await _client.getJsonObject('/channels/apps');
    return _asList(response['items'])
        .map((item) => PlatformChannelApp.fromJson(_asMap(item)))
        .toList(growable: false);
  }
}

Map<String, dynamic> _asMap(Object? value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  return <String, dynamic>{};
}

List<dynamic> _asList(Object? value) {
  if (value is List<dynamic>) {
    return value;
  }
  return const <dynamic>[];
}
