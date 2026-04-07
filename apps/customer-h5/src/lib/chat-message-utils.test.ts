import { describe, expect, it } from 'vitest';

import { formatMessageReadStatus, mergeChatMessages } from '@/lib/chat-message-utils';

describe('chat-message-utils', () => {
  it('merges history and websocket messages by id using the most complete record', () => {
    const merged = mergeChatMessages(
      [
        {
          id: 'msg-1',
          conversationId: '42',
          senderId: 'agent-1',
          senderRole: 'agent',
          text: '您好，这里是客服',
          createdAt: '2026-04-06T10:00:00.000Z',
          status: 'sent',
          ackedBy: null,
          ackedAt: null,
        },
      ],
      [
        {
          id: 'msg-1',
          conversationId: '42',
          senderId: 'agent-1',
          senderRole: 'agent',
          text: '您好，这里是客服',
          createdAt: '2026-04-06T10:00:00.000Z',
          status: 'read',
          ackedBy: 'customer-h5-01',
          ackedAt: '2026-04-06T10:00:10.000Z',
        },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      status: 'read',
      ackedBy: 'customer-h5-01',
      ackedAt: '2026-04-06T10:00:10.000Z',
    });
  });

  it('formats read receipts for acknowledged messages', () => {
    const status = formatMessageReadStatus({
      id: 'msg-2',
      conversationId: '42',
      senderId: 'customer-1',
      senderRole: 'customer',
      text: '我想申请退款',
      createdAt: '2026-04-06T10:00:00.000Z',
      status: 'read',
      ackedBy: 'agent-1',
      ackedAt: '2026-04-06T10:00:20.000Z',
    });

    expect(status).toContain('已读');
    expect(status).toContain('agent-1');
  });
});
