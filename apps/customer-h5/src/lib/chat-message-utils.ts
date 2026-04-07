import type { ChatMessage } from '@/hooks/use-message-gateway';

export function mergeChatMessages(...groups: ChatMessage[][]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();

  for (const group of groups) {
    for (const message of group) {
      const existing = byId.get(message.id);

      if (!existing) {
        byId.set(message.id, message);
        continue;
      }

      byId.set(message.id, mergeSingleMessage(existing, message));
    }
  }

  return Array.from(byId.values()).sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}

export function formatMessageReadStatus(message: ChatMessage): string {
  const status = message.status?.toLowerCase().trim();
  const ackedBy = message.ackedBy?.trim();
  const ackedAt = message.ackedAt?.trim();

  if (status === 'read') {
    const detail = [ackedBy, ackedAt ? formatTime(ackedAt) : null].filter(Boolean).join(' · ');
    return detail ? `已读 · ${detail}` : '已读';
  }

  if (status === 'delivered') {
    const detail = [ackedBy, ackedAt ? formatTime(ackedAt) : null].filter(Boolean).join(' · ');
    return detail ? `已送达 · ${detail}` : '已送达';
  }

  if (ackedAt || ackedBy) {
    const detail = [ackedBy, ackedAt ? formatTime(ackedAt) : null].filter(Boolean).join(' · ');
    return detail ? `待回执 · ${detail}` : '待回执';
  }

  if (status === 'sent') {
    return '待回执';
  }

  return status ? `状态：${status}` : '待回执';
}

function mergeSingleMessage(current: ChatMessage, incoming: ChatMessage): ChatMessage {
  const currentScore = messageCompleteness(current);
  const incomingScore = messageCompleteness(incoming);

  if (incomingScore > currentScore) {
    return {
      ...current,
      ...incoming,
    };
  }

  if (incomingScore < currentScore) {
    return {
      ...incoming,
      ...current,
    };
  }

  return {
    ...current,
    ...incoming,
  };
}

function messageCompleteness(message: ChatMessage): number {
  return [
    message.createdAt,
    message.status,
    message.ackedBy,
    message.ackedAt,
    message.text,
  ].reduce((score, value) => score + (value ? 1 : 0), 0);
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
