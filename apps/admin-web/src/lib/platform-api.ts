export const platformApiBaseUrl =
  import.meta.env.VITE_PLATFORM_API_BASE_URL?.trim() || 'http://localhost:8000';

export const platformApiAccessTokenKey = 'admin-web.access-token';

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

export type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

export type PermissionOut = {
  name: string;
};

export type RoleOut = {
  id: number;
  name: string;
  permissions: PermissionOut[];
};

export type AuthUser = {
  id: number;
  username: string;
  role: RoleOut | null;
  is_active?: boolean;
  created_at?: string;
};

export type CurrentPermissions = {
  user: AuthUser;
  permissions: string[];
};

export type LoginInput = {
  username: string;
  password: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
  permissions: string[];
};

export type CustomerProfile = {
  id: number;
  external_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  tags: { id: number; name: string; created_at: string }[];
};

export type KnowledgeDocument = {
  id: number;
  tenant_id: string;
  type: string;
  title: string;
  source_kind: string;
  status: string;
  category: string;
  tags: string[];
  language: string;
  channels: string[];
  version: number;
  publish_version: number | null;
  content: string | null;
  index_status: string;
  indexed_chunk_count: number;
  last_indexed_at: string | null;
  last_index_task_id: string | null;
  last_index_error: string | null;
  last_index_result: Record<string, unknown> | null;
  imported_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeDocumentCreateInput = {
  tenant_id: string;
  type: string;
  title: string;
  category: string;
  tags: string[];
  language: string;
  channels: string[];
  content?: string | null;
};

export type PublishKnowledgeVersionInput = {
  publish_version: number;
};

export type KnowledgeIndexTaskResult = {
  document_id: number;
  task_id: string;
  status: string;
  indexed_chunk_count: number;
  indexed_at: string;
  result: Record<string, unknown>;
};

export type Conversation = {
  id: number;
  customer_profile_id: number;
  channel: string;
  assignee: string | null;
  status: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExportSourceKind = 'tickets' | 'leave_messages' | 'conversation_history' | 'knowledge_documents';

export type ExportTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ExportTask = {
  id: number;
  name: string;
  source_kind: ExportSourceKind;
  format: string;
  status: ExportTaskStatus;
  row_count: number | null;
  download_url: string | null;
  last_error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExportTaskCreateInput = {
  name: string;
  source_kind: ExportSourceKind;
  format: string;
};

export type ExportTaskDownload = {
  task_id: number;
  name: string;
  source_kind: ExportSourceKind;
  format: string;
  status: ExportTaskStatus;
  row_count: number;
  download_url: string;
  generated_at: string;
};

export type ChannelApp = {
  id: number;
  name: string;
  code: string;
  base_url: string;
  is_active: boolean;
};

export type ChannelAppListResponse = {
  items: ChannelApp[];
};

export type H5LinkResponse = {
  channel_app_id: number;
  path: string;
  h5_url: string;
};

export type Ticket = {
  id: number;
  title: string;
  status: string;
  priority: string;
  source: string;
  customer_profile_id: number | null;
  conversation_id: number | null;
  assignee: string | null;
  assignee_group: string | null;
  summary: string | null;
  sla_due_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TicketCreateInput = {
  title: string;
  status?: string;
  priority?: string;
  source?: string;
  customer_profile_id?: number | null;
  conversation_id?: number | null;
  assignee?: string | null;
  assignee_group?: string | null;
  summary?: string | null;
  sla_due_at?: string | null;
};

export type TicketUpdateInput = Partial<TicketCreateInput>;

export type TicketListResponse = {
  items: Ticket[];
};

export type LeaveMessage = {
  id: number;
  visitor_name: string;
  phone: string | null;
  email: string | null;
  source: string;
  status: string;
  subject: string;
  content: string | null;
  assigned_group: string | null;
  created_at: string;
  updated_at: string;
};

export type LeaveMessageCreateInput = {
  visitor_name: string;
  phone?: string | null;
  email?: string | null;
  source?: string;
  status?: string;
  subject: string;
  content: string;
  assigned_group?: string | null;
};

export type LeaveMessageUpdateInput = Partial<LeaveMessageCreateInput>;

export type LeaveMessageListResponse = {
  items: LeaveMessage[];
};

export type ConversationHistoryItem = {
  id: number;
  customer_profile_id: number;
  status: string;
  assignee: string | null;
  channel: string | null;
  summary: string | null;
  last_message_at: string | null;
  created_at: string;
  ended_at: string | null;
};

export type ConversationHistoryListResponse = {
  items: ConversationHistoryItem[];
};

export type ConversationSummaryResponse = {
  conversation_id: number;
  ai_summary: string | null;
  message_count: number;
  last_message_at: string | null;
  satisfaction_score: number | null;
};

export type ConversationTransferInput = {
  assignee?: string | null;
  reason?: string | null;
};

export type ConversationEndInput = {
  reason?: string | null;
};

export type SatisfactionRecord = {
  conversation_id: number;
  score: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type SatisfactionCreateInput = {
  score: number;
  comment?: string | null;
};

export type VideoSession = {
  id: number;
  customer_profile_id: number;
  conversation_id: number | null;
  assignee: string | null;
  status: string;
  ticket_id: number | null;
  ai_summary: string;
  operator_summary: string | null;
  issue_category: string | null;
  resolution: string | null;
  next_action: string | null;
  handoff_reason: string | null;
  follow_up_required: boolean;
  summary_updated_at: string | null;
  started_at: string;
  ended_at: string | null;
  ended_reason: string | null;
  created_at: string;
  updated_at: string;
  snapshot_count: number;
  latest_snapshot_at: string | null;
  recording_count: number;
  latest_recording_at: string | null;
};

export type VideoSessionListResponse = {
  items: VideoSession[];
};

export type VideoSessionStartInput = {
  customer_profile_id?: number | null;
  conversation_id?: number | null;
  assignee?: string | null;
};

export type VideoSessionEndInput = {
  reason?: string | null;
};

export type VideoSessionTransferTicketInput = {
  title?: string | null;
  status?: string;
  priority?: string;
  source?: string;
  assignee?: string | null;
  assignee_group?: string | null;
  summary?: string | null;
};

export type VideoSnapshot = {
  id: number;
  session_id: number;
  entry_type?: string;
  label: string;
  note: string | null;
  file_key?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  duration_seconds?: number | null;
  playback_url?: string | null;
  recorded_at?: string | null;
  created_at: string;
};

export type VideoSnapshotListResponse = {
  items: VideoSnapshot[];
};

export type VideoSnapshotCreateInput = {
  label?: string | null;
  note?: string | null;
};

export type VideoRecording = VideoSnapshot & {
  entry_type: 'recording';
  file_key: string | null;
  file_name: string | null;
  mime_type: string | null;
  duration_seconds: number | null;
  playback_url: string | null;
  recorded_at: string | null;
  retention_state: 'retained' | 'deleted';
  retention_reason: string | null;
  retained_at: string | null;
  deleted_at: string | null;
};

export type VideoRecordingListResponse = {
  items: VideoRecording[];
  total_count: number;
  retained_count: number;
  deleted_count: number;
  retention_state: string;
};

export type VideoRecordingRetentionInput = {
  retention_state: 'retained' | 'deleted';
  reason?: string | null;
};

export type VideoSessionSummaryInput = {
  ai_summary?: string | null;
  operator_summary?: string | null;
  issue_category?: string | null;
  resolution?: string | null;
  next_action?: string | null;
  handoff_reason?: string | null;
  follow_up_required?: boolean | null;
};

export type AnalyticsBreakdown = {
  label: string;
  value: number;
};

export type ConversationAnalyticsTrend = {
  date: string;
  created_count: number;
  ended_count: number;
  transferred_count: number;
  average_duration_minutes: number | null;
  summary_coverage_rate: number;
  satisfaction_coverage_rate: number;
};

export type ConversationAnalyticsOverview = {
  window_days: number;
  trend: ConversationAnalyticsTrend[];
  status_distribution: AnalyticsBreakdown[];
  channel_distribution: AnalyticsBreakdown[];
  duration: {
    count: number;
    average_minutes: number | null;
    max_minutes: number | null;
  };
  hit_rate: {
    summary_coverage_rate: number;
    satisfaction_coverage_rate: number;
    satisfaction_high_score_rate: number;
  };
  last_refreshed_at: string;
};

export type ServiceAnalyticsTrend = {
  date: string;
  ticket_count: number;
  leave_message_count: number;
  open_ticket_count: number;
  pending_leave_message_count: number;
  average_ticket_age_minutes: number | null;
  average_leave_message_age_minutes: number | null;
};

export type ServiceAnalyticsOverview = {
  window_days: number;
  trend: ServiceAnalyticsTrend[];
  distribution: {
    ticket_status: AnalyticsBreakdown[];
    ticket_priority: AnalyticsBreakdown[];
    ticket_source: AnalyticsBreakdown[];
    leave_message_status: AnalyticsBreakdown[];
    leave_message_source: AnalyticsBreakdown[];
  };
  duration: {
    ticket_count: number;
    leave_message_count: number;
    open_ticket_average_age_minutes: number | null;
    pending_leave_message_average_age_minutes: number | null;
    oldest_ticket_age_minutes: number | null;
    oldest_leave_message_age_minutes: number | null;
  };
  hit_rate: {
    ticket_assignment_rate: number;
    sla_compliance_rate: number;
    leave_assignment_rate: number;
  };
  last_refreshed_at: string;
};

function buildUrl(path: string): URL {
  return new URL(path.startsWith('/') ? path : `/${path}`, platformApiBaseUrl.endsWith('/') ? platformApiBaseUrl : `${platformApiBaseUrl}/`);
}

function readErrorDetail(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    const value = (payload as { detail?: unknown }).detail;
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
    if (Array.isArray(value) && value.length > 0) {
      return value
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && 'msg' in item) {
            return String((item as { msg?: unknown }).msg ?? '');
          }
          return '';
        })
        .filter(Boolean)
        .join(', ');
    }
  }
  return fallback;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = await response.text().catch(() => '');
  }

  throw new ApiError(response.status, readErrorDetail(payload, response.statusText || 'Request failed'));
}

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  const storedToken = globalThis.localStorage?.getItem(platformApiAccessTokenKey);
  if (storedToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${storedToken}`);
  }

  const init: RequestInit = {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    headers,
    signal: options.signal,
  };

  if (options.body !== undefined) {
    if (options.body instanceof FormData) {
      init.body = options.body;
    } else {
      headers.set('Content-Type', 'application/json');
      init.body = JSON.stringify(options.body);
    }
  }

  const response = await fetch(buildUrl(path), init);
  return parseResponse<T>(response);
}

export function getStoredAccessToken() {
  return globalThis.localStorage?.getItem(platformApiAccessTokenKey) ?? null;
}

export function clearStoredAccessToken() {
  globalThis.localStorage?.removeItem(platformApiAccessTokenKey);
}

export function setStoredAccessToken(token: string) {
  globalThis.localStorage?.setItem(platformApiAccessTokenKey, token);
}

export function normalizeAuthUsers(payload: unknown): AuthUser[] {
  if (Array.isArray(payload)) {
    return payload as AuthUser[];
  }
  if (payload && typeof payload === 'object') {
    const items = (payload as { items?: unknown; users?: unknown; data?: unknown }).items
      ?? (payload as { items?: unknown; users?: unknown; data?: unknown }).users
      ?? (payload as { items?: unknown; users?: unknown; data?: unknown }).data;
    if (Array.isArray(items)) {
      return items as AuthUser[];
    }
  }
  return [];
}
