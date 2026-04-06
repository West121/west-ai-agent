import { platformApiBaseUrl } from './runtime-config';

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

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `${response.status} ${response.statusText}`.trim();

  try {
    const payload = (await response.json()) as { detail?: string };
    return payload.detail ?? fallback;
  } catch {
    return fallback;
  }
}

export async function createCustomerProfile(
  input: CustomerProfileCreateInput,
): Promise<CustomerProfileRead> {
  return requestJson<CustomerProfileRead>('/customer/profiles', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function createConversation(
  input: ConversationCreateInput,
): Promise<ConversationRead> {
  return requestJson<ConversationRead>('/conversation/conversations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
