import { useEffect, useRef, useState } from 'react';

import { messageGatewayWsUrl } from '@/lib/runtime-config';

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: string;
  text: string;
  createdAt: string;
  status: string;
  ackedBy: string | null;
  ackedAt: string | null;
}

type SocketStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

interface UseMessageGatewayParams {
  conversationId: string | null;
  clientId: string;
  role: 'agent' | 'customer';
}

interface MessageNewPayload {
  id: string;
  type: 'message.new';
  conversation_id: string;
  sender_id: string;
  sender_role: string;
  text: string;
  created_at?: string;
  status?: string;
  acked_by?: string | null;
  acked_at?: string | null;
}

interface MessageAckPayload {
  type: 'message.ack';
  conversation_id: string;
  message_id: string;
  status?: string;
  acked_by?: string | null;
  acked_at?: string | null;
}

interface ConnectionAckPayload {
  type: 'connection.ack';
  conversation_id: string;
  client_id: string;
  role: string;
}

type GatewayEvent =
  | MessageNewPayload
  | MessageAckPayload
  | ConnectionAckPayload
  | { type: 'pong' }
  | { type: 'error'; detail?: string };

function isMessageNewPayload(payload: unknown): payload is MessageNewPayload {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const record = payload as Record<string, unknown>;
  return (
    record.type === 'message.new' &&
    typeof record.id === 'string' &&
    typeof record.conversation_id === 'string' &&
    typeof record.sender_id === 'string' &&
    typeof record.sender_role === 'string' &&
    typeof record.text === 'string'
  );
}

function isMessageAckPayload(payload: unknown): payload is MessageAckPayload {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const record = payload as Record<string, unknown>;
  return record.type === 'message.ack' && typeof record.message_id === 'string';
}

function buildSocketUrl(conversationId: string, clientId: string, role: string): string {
  const socketUrl = new URL(messageGatewayWsUrl);
  socketUrl.pathname = `${socketUrl.pathname.replace(/\/$/, '')}/${conversationId}`;
  socketUrl.searchParams.set('client_id', clientId);
  socketUrl.searchParams.set('role', role);
  return socketUrl.toString();
}

export function useMessageGateway({ conversationId, clientId, role }: UseMessageGatewayParams) {
  const socketRef = useRef<WebSocket | null>(null);
  const activeRef = useRef(false);
  const [status, setStatus] = useState<SocketStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    activeRef.current = true;
    setMessages([]);
    setError(null);

    if (!conversationId) {
      setStatus('idle');
      socketRef.current?.close();
      socketRef.current = null;
      return;
    }

    setStatus('connecting');
    const socket = new WebSocket(buildSocketUrl(conversationId, clientId, role));
    socketRef.current = socket;

    socket.onopen = () => {
      if (!activeRef.current) return;
      setStatus('open');
    };

    socket.onmessage = (event) => {
      if (!activeRef.current) return;

      try {
        const parsed = JSON.parse(event.data) as GatewayEvent;

        if (parsed.type === 'connection.ack') {
          setStatus('open');
          return;
        }

        if (isMessageNewPayload(parsed)) {
          setMessages((current) =>
            upsertMessage(current, {
              id: parsed.id,
              conversationId: parsed.conversation_id,
              senderId: parsed.sender_id,
              senderRole: parsed.sender_role,
              text: parsed.text,
              createdAt: parsed.created_at ?? new Date().toISOString(),
              status: parsed.status ?? 'sent',
              ackedBy: parsed.acked_by ?? null,
              ackedAt: parsed.acked_at ?? null,
            }),
          );
          return;
        }

        if (isMessageAckPayload(parsed)) {
          setMessages((current) =>
            current.map((message) =>
              message.id === parsed.message_id
                ? {
                    ...message,
                    status: parsed.status ?? 'read',
                    ackedBy: parsed.acked_by ?? message.ackedBy,
                    ackedAt: parsed.acked_at ?? message.ackedAt,
                  }
                : message,
            ),
          );
          return;
        }

        if (parsed.type === 'error') {
          setError(parsed.detail ?? 'message gateway returned an error');
        }
      } catch {
        setError('无法解析 websocket 消息');
      }
    };

    socket.onerror = () => {
      if (!activeRef.current) return;
      setStatus('error');
      setError('websocket 连接失败');
    };

    socket.onclose = () => {
      if (!activeRef.current) return;
      setStatus((current) => (current === 'error' ? current : 'closed'));
    };

    return () => {
      activeRef.current = false;
      socket.close();
      socketRef.current = null;
    };
  }, [clientId, conversationId, role]);

  function sendMessage(text: string) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !conversationId) {
      throw new Error('websocket 未连接');
    }

    socket.send(JSON.stringify({ type: 'message.send', text }));
  }

  function sendAck(messageId: string) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !conversationId) {
      return;
    }

    socket.send(JSON.stringify({ type: 'message.ack', message_id: messageId }));
  }

  return {
    status,
    error,
    messages,
    sendMessage,
    sendAck,
  };
}

function upsertMessage(current: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const index = current.findIndex((message) => message.id === incoming.id);
  if (index === -1) {
    return [...current, incoming];
  }

  const next = current.slice();
  next[index] = mergeMessage(next[index], incoming);
  return next;
}

function mergeMessage(existing: ChatMessage, incoming: ChatMessage): ChatMessage {
  const currentScore = messageCompleteness(existing);
  const incomingScore = messageCompleteness(incoming);

  if (incomingScore > currentScore) {
    return { ...existing, ...incoming };
  }
  if (incomingScore < currentScore) {
    return { ...incoming, ...existing };
  }
  return { ...existing, ...incoming };
}

function messageCompleteness(message: ChatMessage): number {
  return [message.createdAt, message.status, message.ackedBy, message.ackedAt, message.text].reduce(
    (score, value) => score + (value ? 1 : 0),
    0,
  );
}
