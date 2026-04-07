import 'package:flutter/foundation.dart';

@immutable
class PlatformPermission {
  const PlatformPermission({required this.name});

  factory PlatformPermission.fromJson(Map<String, dynamic> json) {
    return PlatformPermission(name: _readString(json, 'name'));
  }

  final String name;
}

@immutable
class PlatformRole {
  const PlatformRole({
    required this.id,
    required this.name,
    required this.permissions,
  });

  factory PlatformRole.fromJson(Map<String, dynamic> json) {
    final permissions = _readList(json, 'permissions')
        .map((value) => PlatformPermission.fromJson(_readMap(value)))
        .toList(growable: false);
    return PlatformRole(
      id: _readInt(json, 'id'),
      name: _readString(json, 'name'),
      permissions: permissions,
    );
  }

  final int id;
  final String name;
  final List<PlatformPermission> permissions;
}

@immutable
class PlatformUser {
  const PlatformUser({
    required this.id,
    required this.username,
    required this.role,
    required this.isActive,
    required this.createdAt,
  });

  factory PlatformUser.fromJson(Map<String, dynamic> json) {
    final roleJson = json['role'];
    return PlatformUser(
      id: _readInt(json, 'id'),
      username: _readString(json, 'username'),
      role: roleJson is Map<String, dynamic> ? PlatformRole.fromJson(roleJson) : null,
      isActive: _readBool(json, 'is_active', defaultValue: true),
      createdAt: _readDateTime(json, 'created_at'),
    );
  }

  final int id;
  final String username;
  final PlatformRole? role;
  final bool isActive;
  final DateTime? createdAt;
}

@immutable
class PlatformAuthSession {
  const PlatformAuthSession({
    required this.accessToken,
    required this.user,
    required this.permissions,
  });

  factory PlatformAuthSession.fromJson(Map<String, dynamic> json) {
    return PlatformAuthSession(
      accessToken: _readString(json, 'access_token'),
      user: PlatformUser.fromJson(_readMap(json['user'])),
      permissions: _readList(json, 'permissions').map((value) => value.toString()).toList(growable: false),
    );
  }

  final String accessToken;
  final PlatformUser user;
  final List<String> permissions;
}

@immutable
class PlatformChannelApp {
  const PlatformChannelApp({
    required this.id,
    required this.name,
    required this.code,
    required this.baseUrl,
    required this.isActive,
  });

  factory PlatformChannelApp.fromJson(Map<String, dynamic> json) {
    return PlatformChannelApp(
      id: _readInt(json, 'id'),
      name: _readString(json, 'name'),
      code: _readString(json, 'code'),
      baseUrl: _readString(json, 'base_url'),
      isActive: _readBool(json, 'is_active', defaultValue: true),
    );
  }

  final int id;
  final String name;
  final String code;
  final String baseUrl;
  final bool isActive;
}

@immutable
class PlatformCustomerProfile {
  const PlatformCustomerProfile({
    required this.id,
    required this.externalId,
    required this.name,
    required this.email,
    required this.phone,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
  });

  factory PlatformCustomerProfile.fromJson(Map<String, dynamic> json) {
    return PlatformCustomerProfile(
      id: _readInt(json, 'id'),
      externalId: _readString(json, 'external_id'),
      name: _readString(json, 'name'),
      email: _readNullableString(json, 'email'),
      phone: _readNullableString(json, 'phone'),
      status: _readString(json, 'status'),
      createdAt: _readDateTime(json, 'created_at'),
      updatedAt: _readDateTime(json, 'updated_at'),
    );
  }

  final int id;
  final String externalId;
  final String name;
  final String? email;
  final String? phone;
  final String status;
  final DateTime? createdAt;
  final DateTime? updatedAt;
}

@immutable
class PlatformKnowledgeDocument {
  const PlatformKnowledgeDocument({
    required this.id,
    required this.tenantId,
    required this.type,
    required this.title,
    required this.status,
    required this.category,
    required this.tags,
    required this.language,
    required this.channels,
    required this.version,
    required this.publishVersion,
    required this.content,
    required this.createdAt,
    required this.updatedAt,
  });

  factory PlatformKnowledgeDocument.fromJson(Map<String, dynamic> json) {
    return PlatformKnowledgeDocument(
      id: _readInt(json, 'id'),
      tenantId: _readString(json, 'tenant_id'),
      type: _readString(json, 'type'),
      title: _readString(json, 'title'),
      status: _readString(json, 'status'),
      category: _readString(json, 'category'),
      tags: _readList(json, 'tags').map((value) => value.toString()).toList(growable: false),
      language: _readString(json, 'language'),
      channels: _readList(json, 'channels').map((value) => value.toString()).toList(growable: false),
      version: _readInt(json, 'version'),
      publishVersion: _readNullableInt(json, 'publish_version'),
      content: _readNullableString(json, 'content'),
      createdAt: _readDateTime(json, 'created_at'),
      updatedAt: _readDateTime(json, 'updated_at'),
    );
  }

  final int id;
  final String tenantId;
  final String type;
  final String title;
  final String status;
  final String category;
  final List<String> tags;
  final String language;
  final List<String> channels;
  final int version;
  final int? publishVersion;
  final String? content;
  final DateTime? createdAt;
  final DateTime? updatedAt;
}

@immutable
class PlatformConversation {
  const PlatformConversation({
    required this.id,
    required this.customerProfileId,
    required this.channel,
    required this.assignee,
    required this.status,
    required this.endedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory PlatformConversation.fromJson(Map<String, dynamic> json) {
    return PlatformConversation(
      id: _readInt(json, 'id'),
      customerProfileId: _readInt(json, 'customer_profile_id'),
      channel: _readString(json, 'channel', defaultValue: 'web'),
      assignee: _readNullableString(json, 'assignee'),
      status: _readString(json, 'status'),
      endedAt: _readDateTime(json, 'ended_at'),
      createdAt: _readDateTime(json, 'created_at'),
      updatedAt: _readDateTime(json, 'updated_at'),
    );
  }

  final int id;
  final int customerProfileId;
  final String channel;
  final String? assignee;
  final String status;
  final DateTime? endedAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;
}

@immutable
class PlatformConversationSummary {
  const PlatformConversationSummary({
    required this.conversationId,
    required this.aiSummary,
    required this.messageCount,
    required this.lastMessageAt,
    required this.satisfactionScore,
  });

  factory PlatformConversationSummary.fromJson(Map<String, dynamic> json) {
    return PlatformConversationSummary(
      conversationId: _readInt(json, 'conversation_id'),
      aiSummary: _readString(json, 'ai_summary'),
      messageCount: _readInt(json, 'message_count', defaultValue: 0),
      lastMessageAt: _readDateTime(json, 'last_message_at'),
      satisfactionScore: _readNullableInt(json, 'satisfaction_score'),
    );
  }

  final int conversationId;
  final String aiSummary;
  final int messageCount;
  final DateTime? lastMessageAt;
  final int? satisfactionScore;
}

@immutable
class PlatformConversationHistoryItem {
  const PlatformConversationHistoryItem({
    required this.id,
    required this.customerProfileId,
    required this.status,
    required this.assignee,
    required this.channel,
    required this.summary,
    required this.lastMessageAt,
    required this.createdAt,
    required this.endedAt,
    required this.satisfactionScore,
  });

  factory PlatformConversationHistoryItem.fromJson(Map<String, dynamic> json) {
    return PlatformConversationHistoryItem(
      id: _readInt(json, 'id'),
      customerProfileId: _readInt(json, 'customer_profile_id'),
      status: _readString(json, 'status'),
      assignee: _readNullableString(json, 'assignee'),
      channel: _readString(json, 'channel', defaultValue: 'web'),
      summary: _readString(json, 'summary', defaultValue: '暂无摘要'),
      lastMessageAt: _readDateTime(json, 'last_message_at'),
      createdAt: _readDateTime(json, 'created_at'),
      endedAt: _readDateTime(json, 'ended_at'),
      satisfactionScore: _readNullableInt(json, 'satisfaction_score'),
    );
  }

  final int id;
  final int customerProfileId;
  final String status;
  final String? assignee;
  final String channel;
  final String summary;
  final DateTime? lastMessageAt;
  final DateTime? createdAt;
  final DateTime? endedAt;
  final int? satisfactionScore;
}

@immutable
class PlatformChatMessage {
  const PlatformChatMessage({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.senderRole,
    required this.text,
    required this.status,
    required this.createdAt,
    required this.ackedBy,
    required this.ackedAt,
  });

  factory PlatformChatMessage.fromJson(Map<String, dynamic> json) {
    return PlatformChatMessage(
      id: _readString(json, 'id'),
      conversationId: _readString(json, 'conversation_id'),
      senderId: _readString(json, 'sender_id'),
      senderRole: _readString(json, 'sender_role'),
      text: _readString(json, 'text'),
      status: _readString(json, 'status', defaultValue: 'sent'),
      createdAt: _readDateTime(json, 'created_at'),
      ackedBy: _readNullableString(json, 'acked_by'),
      ackedAt: _readDateTime(json, 'acked_at'),
    );
  }

  final String id;
  final String conversationId;
  final String senderId;
  final String senderRole;
  final String text;
  final String status;
  final DateTime? createdAt;
  final String? ackedBy;
  final DateTime? ackedAt;

  PlatformChatMessage copyWith({
    String? status,
    String? ackedBy,
    DateTime? ackedAt,
  }) {
    return PlatformChatMessage(
      id: id,
      conversationId: conversationId,
      senderId: senderId,
      senderRole: senderRole,
      text: text,
      status: status ?? this.status,
      createdAt: createdAt,
      ackedBy: ackedBy ?? this.ackedBy,
      ackedAt: ackedAt ?? this.ackedAt,
    );
  }
}

enum MessageGatewayStatus {
  idle,
  connecting,
  open,
  closed,
  error,
}

@immutable
sealed class MessageGatewayEvent {
  const MessageGatewayEvent();

  factory MessageGatewayEvent.fromJson(Map<String, dynamic> json) {
    final type = _readString(json, 'type');
    switch (type) {
      case 'connection.ack':
        return MessageGatewayConnectionAckEvent(
          conversationId: _readString(json, 'conversation_id'),
          clientId: _readString(json, 'client_id'),
          role: _readString(json, 'role'),
        );
      case 'message.new':
        return MessageGatewayMessageEvent(
          message: PlatformChatMessage.fromJson(json),
        );
      case 'message.ack':
        return MessageGatewayAckEvent(
          conversationId: _readString(json, 'conversation_id'),
          messageId: _readString(json, 'message_id'),
          status: _readString(json, 'status', defaultValue: 'read'),
          ackedBy: _readNullableString(json, 'acked_by'),
          ackedAt: _readDateTime(json, 'acked_at'),
        );
      case 'pong':
        return const MessageGatewayPongEvent();
      default:
        return MessageGatewayErrorEvent(
          detail: _readString(json, 'detail', defaultValue: 'unsupported event'),
        );
    }
  }
}

@immutable
class MessageGatewayConnectionAckEvent extends MessageGatewayEvent {
  const MessageGatewayConnectionAckEvent({
    required this.conversationId,
    required this.clientId,
    required this.role,
  });

  final String conversationId;
  final String clientId;
  final String role;
}

@immutable
class MessageGatewayMessageEvent extends MessageGatewayEvent {
  const MessageGatewayMessageEvent({required this.message});

  final PlatformChatMessage message;
}

@immutable
class MessageGatewayAckEvent extends MessageGatewayEvent {
  const MessageGatewayAckEvent({
    required this.conversationId,
    required this.messageId,
    required this.status,
    required this.ackedBy,
    required this.ackedAt,
  });

  final String conversationId;
  final String messageId;
  final String status;
  final String? ackedBy;
  final DateTime? ackedAt;
}

@immutable
class MessageGatewayPongEvent extends MessageGatewayEvent {
  const MessageGatewayPongEvent();
}

@immutable
class MessageGatewayErrorEvent extends MessageGatewayEvent {
  const MessageGatewayErrorEvent({required this.detail});

  final String detail;
}

@immutable
class MessageGatewayDisconnectedEvent extends MessageGatewayEvent {
  const MessageGatewayDisconnectedEvent();
}

@immutable
class PlatformLeaveMessage {
  const PlatformLeaveMessage({
    required this.id,
    required this.visitorName,
    required this.phone,
    required this.email,
    required this.source,
    required this.status,
    required this.subject,
    required this.content,
    required this.assignedGroup,
    required this.createdAt,
    required this.updatedAt,
  });

  factory PlatformLeaveMessage.fromJson(Map<String, dynamic> json) {
    return PlatformLeaveMessage(
      id: _readInt(json, 'id'),
      visitorName: _readString(json, 'visitor_name'),
      phone: _readNullableString(json, 'phone'),
      email: _readNullableString(json, 'email'),
      source: _readString(json, 'source', defaultValue: 'h5'),
      status: _readString(json, 'status'),
      subject: _readString(json, 'subject'),
      content: _readString(json, 'content'),
      assignedGroup: _readNullableString(json, 'assigned_group'),
      createdAt: _readDateTime(json, 'created_at'),
      updatedAt: _readDateTime(json, 'updated_at'),
    );
  }

  final int id;
  final String visitorName;
  final String? phone;
  final String? email;
  final String source;
  final String status;
  final String subject;
  final String content;
  final String? assignedGroup;
  final DateTime? createdAt;
  final DateTime? updatedAt;
}

@immutable
class PlatformSatisfactionRecord {
  const PlatformSatisfactionRecord({
    required this.conversationId,
    required this.score,
    required this.comment,
    required this.createdAt,
    required this.updatedAt,
  });

  factory PlatformSatisfactionRecord.fromJson(Map<String, dynamic> json) {
    return PlatformSatisfactionRecord(
      conversationId: _readInt(json, 'conversation_id'),
      score: _readInt(json, 'score'),
      comment: _readNullableString(json, 'comment'),
      createdAt: _readDateTime(json, 'created_at'),
      updatedAt: _readDateTime(json, 'updated_at'),
    );
  }

  final int conversationId;
  final int score;
  final String? comment;
  final DateTime? createdAt;
  final DateTime? updatedAt;
}

@immutable
class PlatformTicket {
  const PlatformTicket({
    required this.id,
    required this.title,
    required this.status,
    required this.priority,
    required this.source,
    required this.customerProfileId,
    required this.conversationId,
    required this.assignee,
    required this.assigneeGroup,
    required this.summary,
    required this.slaDueAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory PlatformTicket.fromJson(Map<String, dynamic> json) {
    return PlatformTicket(
      id: _readInt(json, 'id'),
      title: _readString(json, 'title'),
      status: _readString(json, 'status'),
      priority: _readString(json, 'priority', defaultValue: 'normal'),
      source: _readString(json, 'source', defaultValue: 'web'),
      customerProfileId: _readNullableInt(json, 'customer_profile_id'),
      conversationId: _readNullableInt(json, 'conversation_id'),
      assignee: _readNullableString(json, 'assignee'),
      assigneeGroup: _readNullableString(json, 'assignee_group'),
      summary: _readNullableString(json, 'summary'),
      slaDueAt: _readDateTime(json, 'sla_due_at'),
      createdAt: _readDateTime(json, 'created_at'),
      updatedAt: _readDateTime(json, 'updated_at'),
    );
  }

  final int id;
  final String title;
  final String status;
  final String priority;
  final String source;
  final int? customerProfileId;
  final int? conversationId;
  final String? assignee;
  final String? assigneeGroup;
  final String? summary;
  final DateTime? slaDueAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;
}

@immutable
class PlatformDashboardSnapshot {
  const PlatformDashboardSnapshot({
    required this.customerCount,
    required this.knowledgeCount,
    required this.channelCount,
    required this.conversationCount,
    required this.activeChannelCount,
    required this.draftKnowledgeCount,
    required this.publishedKnowledgeCount,
    required this.openConversationCount,
    required this.topChannels,
    required this.topKnowledgeDocuments,
    required this.topCustomers,
    required this.topConversations,
    required this.topTickets,
    required this.topLeaveMessages,
    required this.lastRefreshedAt,
  });

  factory PlatformDashboardSnapshot.empty() {
    return PlatformDashboardSnapshot(
      customerCount: 0,
      knowledgeCount: 0,
      channelCount: 0,
      conversationCount: 0,
      activeChannelCount: 0,
      draftKnowledgeCount: 0,
      publishedKnowledgeCount: 0,
      openConversationCount: 0,
      topChannels: const [],
      topKnowledgeDocuments: const [],
      topCustomers: const [],
      topConversations: const [],
      topTickets: const [],
      topLeaveMessages: const [],
      lastRefreshedAt: DateTime.now(),
    );
  }

  final int customerCount;
  final int knowledgeCount;
  final int channelCount;
  final int conversationCount;
  final int activeChannelCount;
  final int draftKnowledgeCount;
  final int publishedKnowledgeCount;
  final int openConversationCount;
  final List<PlatformChannelApp> topChannels;
  final List<PlatformKnowledgeDocument> topKnowledgeDocuments;
  final List<PlatformCustomerProfile> topCustomers;
  final List<PlatformConversation> topConversations;
  final List<PlatformTicket> topTickets;
  final List<PlatformLeaveMessage> topLeaveMessages;
  final DateTime lastRefreshedAt;
}

Map<String, dynamic> _readMap(Object? value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  return <String, dynamic>{};
}

List<dynamic> _readList(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is List<dynamic>) {
    return value;
  }
  return const <dynamic>[];
}

String _readString(Map<String, dynamic> json, String key, {String defaultValue = ''}) {
  final value = json[key];
  if (value == null) {
    return defaultValue;
  }
  return value.toString();
}

String? _readNullableString(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value == null) {
    return null;
  }
  final text = value.toString();
  return text.isEmpty ? null : text;
}

int _readInt(Map<String, dynamic> json, String key, {int defaultValue = 0}) {
  final value = json[key];
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  if (value is String) {
    return int.tryParse(value) ?? defaultValue;
  }
  return defaultValue;
}

int? _readNullableInt(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value == null) {
    return null;
  }
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(value.toString());
}

bool _readBool(Map<String, dynamic> json, String key, {bool defaultValue = false}) {
  final value = json[key];
  if (value is bool) {
    return value;
  }
  if (value is String) {
    final normalized = value.toLowerCase();
    if (normalized == 'true' || normalized == '1') {
      return true;
    }
    if (normalized == 'false' || normalized == '0') {
      return false;
    }
  }
  return defaultValue;
}

DateTime? _readDateTime(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value == null) {
    return null;
  }
  if (value is DateTime) {
    return value;
  }
  return DateTime.tryParse(value.toString());
}
