import { aiServiceBaseUrl, messageGatewayHttpBaseUrl, platformApiBaseUrl } from './runtime-config';

export interface CustomerProfileCreateInput {
  external_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
  tag_ids?: number[];
}

export interface CustomerProfileRead {
  id: number;
  external_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  tags: Array<{
    id: number;
    name: string;
    created_at: string;
  }>;
}

export interface ConversationCreateInput {
  customer_profile_id: number;
  assignee?: string | null;
}

export interface ConversationRead {
  id: number;
  customer_profile_id: number;
  assignee: string | null;
  status: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveMessageInput {
  visitor_name: string;
  phone?: string | null;
  email?: string | null;
  source: string;
  subject: string;
  content: string;
  assigned_group?: string | null;
}

export interface ConversationSatisfactionInput {
  score: number;
  comment?: string | null;
}

export interface ConversationSummaryRead {
  id?: number | string;
  conversation_id?: number | string;
  subject?: string | null;
  title?: string | null;
  status?: string | null;
  summary?: string | null;
  content?: string | null;
  customer_name?: string | null;
  visitor_name?: string | null;
  assigned_group?: string | null;
  current_assignee_type?: string | null;
  current_assignee_id?: string | number | null;
  last_message?: string | null;
  last_message_at?: string | null;
  ended_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

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

export interface AiDecisionRead {
  query: string;
  decision: 'answer' | 'handoff' | 'clarify' | 'reject';
  answer: string | null;
  clarification: string | null;
  confidence: number;
  retrieval_summary: {
    top_score: number;
    matched_count: number;
    matched_documents: Array<{
      document_id: string;
      title: string;
      score: number;
      matched_terms: string[];
      summary: string;
    }>;
  };
}

export interface AiDecisionRequest {
  query: string;
  endpoint?: 'answer' | 'decision';
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${platformApiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function requestOptionalJson<T>(path: string, init: RequestInit): Promise<T | undefined> {
  const response = await fetch(`${platformApiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const text = await response.text();
  if (!text.trim()) {
    return undefined;
  }

  return JSON.parse(text) as T;
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

async function gatewayRequestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${messageGatewayHttpBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function aiRequestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${aiServiceBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function createCustomerProfile(
  input: CustomerProfileCreateInput,
): Promise<CustomerProfileRead> {
  return requestJson<CustomerProfileRead>('/public/customer/profiles', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function createConversation(
  input: ConversationCreateInput,
): Promise<ConversationRead> {
  return requestJson<ConversationRead>('/public/conversation/conversations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function submitLeaveMessage(input: LeaveMessageInput): Promise<unknown> {
  return requestOptionalJson<unknown>('/public/service/leave-messages', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function submitConversationSatisfaction(
  conversationId: number | string,
  input: ConversationSatisfactionInput,
): Promise<unknown> {
  return requestOptionalJson<unknown>(`/public/conversation/conversations/${conversationId}/satisfaction`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getConversationSummary(
  conversationId: number | string,
): Promise<ConversationSummaryRead | undefined> {
  return requestOptionalJson<ConversationSummaryRead>(
    `/public/conversation/conversations/${conversationId}/summary`,
    {
      method: 'GET',
    },
  );
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
    body: JSON.stringify(input),
  });
}

export async function requestAiDecision({
  query,
  endpoint = 'answer',
}: AiDecisionRequest): Promise<AiDecisionRead> {
  const path = endpoint === 'decision' ? '/decision' : '/chat/answer';

  return aiRequestJson<AiDecisionRead>(path, {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
}

export async function getAiDecision(query: string): Promise<AiDecisionRead> {
  return requestAiDecision({ query, endpoint: 'answer' });
}
