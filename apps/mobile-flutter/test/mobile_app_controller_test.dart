import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_flutter/core/platform/mobile_app_controller.dart';
import 'package:mobile_flutter/core/platform/platform_models.dart';

import 'support/fakes.dart';

void main() {
  group('MobileAppController', () {
    test('signIn loads dashboard, history, leave messages and current user data', () async {
      final platformRepository = FakePlatformRepository();
      final gatewayRepository = FakeMessageGatewayRepository();
      final controller = MobileAppController(
        repository: platformRepository,
        messageGatewayRepository: gatewayRepository,
        clientId: 'mobile-agent',
      );

      await controller.signIn(username: 'agent', password: 'secret');

      expect(controller.isAuthenticated, isTrue);
      expect(controller.state.dashboard.customerCount, 2);
      expect(controller.state.history, hasLength(2));
      expect(controller.state.leaveMessages, hasLength(1));
      expect(controller.state.channels, hasLength(1));
      expect(controller.state.users, hasLength(1));
      expect(platformRepository.loginCalls, 1);
      expect(platformRepository.dashboardCalls, 1);
      expect(platformRepository.historyCalls, 1);
    });

    test('selectConversation loads history messages and merges live gateway events', () async {
      final platformRepository = FakePlatformRepository();
      final gatewayRepository = FakeMessageGatewayRepository();
      final controller = MobileAppController(
        repository: platformRepository,
        messageGatewayRepository: gatewayRepository,
        clientId: 'mobile-agent',
      );

      await controller.signIn(username: 'agent', password: 'secret');
      final conversation = controller.state.history.first;

      await controller.selectConversation(conversation);
      await pumpEventQueue();

      expect(controller.state.selectedConversation?.id, conversation.id);
      expect(controller.state.conversationMessages, hasLength(1));
      expect(controller.state.gatewayStatus, MessageGatewayStatus.open);
      expect(gatewayRepository.connectedConversationId, conversation.id.toString());

      gatewayRepository.emit(
        const MessageGatewayMessageEvent(
          message: PlatformChatMessage(
            id: 'live-1',
            conversationId: '301',
            senderId: 'customer-1',
            senderRole: 'customer',
            text: '请尽快处理',
            status: 'sent',
            createdAt: null,
            ackedBy: null,
            ackedAt: null,
          ),
        ),
      );
      await pumpEventQueue();

      expect(controller.state.conversationMessages, hasLength(2));
      expect(gatewayRepository.ackedMessageIds, contains('live-1'));
    });

    test('sendChatMessage delegates to message gateway repository', () async {
      final platformRepository = FakePlatformRepository();
      final gatewayRepository = FakeMessageGatewayRepository();
      final controller = MobileAppController(
        repository: platformRepository,
        messageGatewayRepository: gatewayRepository,
        clientId: 'mobile-agent',
      );

      await controller.signIn(username: 'agent', password: 'secret');
      await controller.selectConversation(controller.state.history.first);

      controller.sendChatMessage('好的，已为你创建工单');

      expect(gatewayRepository.sentMessages, ['好的，已为你创建工单']);
    });
  });
}
