import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'platform_api_client.dart';
import 'platform_models.dart';

abstract class MessageGatewayRepository {
  Future<List<PlatformChatMessage>> listMessages(String conversationId);

  Stream<MessageGatewayEvent> connect({
    required String conversationId,
    required String clientId,
    required String role,
  });

  void sendMessage(String text);

  void sendAck(String messageId);

  Future<void> disconnect();
}

class LiveMessageGatewayRepository implements MessageGatewayRepository {
  LiveMessageGatewayRepository({
    required PlatformApiClient httpClient,
    required String httpBaseUrl,
    required String wsBaseUrl,
  })  : _httpClient = httpClient,
        _httpBaseUri = Uri.parse(httpBaseUrl.endsWith('/') ? httpBaseUrl : '$httpBaseUrl/'),
        _wsBaseUri = Uri.parse(wsBaseUrl);

  final PlatformApiClient _httpClient;
  final Uri _httpBaseUri;
  final Uri _wsBaseUri;

  WebSocket? _socket;
  StreamController<MessageGatewayEvent>? _controller;
  StreamSubscription<dynamic>? _subscription;

  @override
  Future<List<PlatformChatMessage>> listMessages(String conversationId) async {
    final response = await _httpClient.request(
      _httpPath('messages/$conversationId'),
      method: 'GET',
    );
    final payload = response is Map<String, dynamic> ? response : const <String, dynamic>{};
    final items = payload['items'];
    if (items is! List<dynamic>) {
      return const <PlatformChatMessage>[];
    }

    return items
        .whereType<Map<String, dynamic>>()
        .map(PlatformChatMessage.fromJson)
        .toList(growable: false);
  }

  @override
  Stream<MessageGatewayEvent> connect({
    required String conversationId,
    required String clientId,
    required String role,
  }) {
    unawaited(disconnect());
    final controller = StreamController<MessageGatewayEvent>.broadcast();
    _controller = controller;

    () async {
      try {
        final socket = await WebSocket.connect(
          _socketUrl(conversationId: conversationId, clientId: clientId, role: role),
        );
        _socket = socket;

        _subscription = socket.listen(
          (dynamic raw) {
            if (raw is! String) {
              return;
            }

            try {
              final decoded = jsonDecode(raw);
              if (decoded is! Map<String, dynamic>) {
                return;
              }
              controller.add(MessageGatewayEvent.fromJson(decoded));
            } catch (error, stackTrace) {
              controller.addError(error, stackTrace);
            }
          },
          onError: controller.addError,
          onDone: () {
            if (!controller.isClosed) {
              controller.add(const MessageGatewayDisconnectedEvent());
              unawaited(controller.close());
            }
          },
        );
      } catch (error, stackTrace) {
        if (!controller.isClosed) {
          controller.addError(error, stackTrace);
          unawaited(controller.close());
        }
      }
    }();

    controller.onCancel = disconnect;
    return controller.stream;
  }

  @override
  void sendMessage(String text) {
    final socket = _socket;
    if (socket == null) {
      throw StateError('message gateway is not connected');
    }
    socket.add(jsonEncode({'type': 'message.send', 'text': text}));
  }

  @override
  void sendAck(String messageId) {
    final socket = _socket;
    if (socket == null) {
      return;
    }
    socket.add(jsonEncode({'type': 'message.ack', 'message_id': messageId}));
  }

  @override
  Future<void> disconnect() async {
    await _subscription?.cancel();
    _subscription = null;
    await _socket?.close();
    _socket = null;
    final controller = _controller;
    _controller = null;
    if (controller != null && !controller.isClosed) {
      await controller.close();
    }
  }

  String _httpPath(String path) {
    final resolved = _httpBaseUri.resolve(path);
    final fullPath = resolved.path.startsWith('/') ? resolved.path.substring(1) : resolved.path;
    if (resolved.query.isEmpty) {
      return fullPath;
    }
    return '$fullPath?${resolved.query}';
  }

  String _socketUrl({
    required String conversationId,
    required String clientId,
    required String role,
  }) {
    final uri = _wsBaseUri.replace(
      path: '${_wsBaseUri.path.replaceAll(RegExp(r'/$'), '')}/$conversationId',
      queryParameters: <String, String>{
        'client_id': clientId,
        'role': role,
      },
    );
    return uri.toString();
  }
}
