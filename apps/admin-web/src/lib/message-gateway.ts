import { messageGatewayHttpBaseUrl } from '@/lib/runtime-config';

export interface ConversationMessageRead {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: string;
  text: string;
  status: string;
  created_at: string;
  acked_by: string | null;
  acked_at: string | null;
}

export interface ConversationMessagesResponse {
  conversation_id: string;
  items: ConversationMessageRead[];
}

interface RequestOptions {
  method?: string;
  body?: unknown;
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `${response.status} ${response.statusText}`.trim();

  try {
    const payload = (await response.json()) as { detail?: string };
    return payload.detail ?? fallback;
  } catch {
    return fallback;
  }
}

async function gatewayRequestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${messageGatewayHttpBaseUrl}${path}`, {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as T;
}

export async function getConversationMessages(
  conversationId: number | string,
): Promise<ConversationMessagesResponse> {
  return gatewayRequestJson<ConversationMessagesResponse>(`/messages/${conversationId}`, {
    method: 'GET',
  });
}

export async function appendConversationMessage(
  conversationId: number | string,
  input: {
    sender_id: string;
    sender_role: string;
    text: string;
  },
): Promise<ConversationMessageRead> {
  return gatewayRequestJson<ConversationMessageRead>(`/messages/${conversationId}`, {
    method: 'POST',
    body: input,
  });
}
