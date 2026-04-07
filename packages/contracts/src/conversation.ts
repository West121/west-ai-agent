export type ConversationMode =
  | "bot_only"
  | "ai_first"
  | "human_only"
  | "human_takeover";

export type ConversationStatus =
  | "queued"
  | "active"
  | "waiting_customer"
  | "waiting_agent"
  | "ended";

export interface ConversationSummary {
  id: string;
  tenantId: string;
  customerId: string;
  channelId: string;
  subject: string;
  mode: ConversationMode;
  status: ConversationStatus;
  currentAssigneeType: "bot" | "agent" | "queue";
  currentAssigneeId?: string | null;
  startedAt: string;
  endedAt?: string | null;
}

export interface ConversationEventDTO {
  id: string;
  conversationId: string;
  type:
    | "created"
    | "assigned"
    | "transferred"
    | "handoff_requested"
    | "handoff_completed"
    | "ended";
  actorType: "system" | "bot" | "agent" | "customer";
  actorId?: string | null;
  payload?: Record<string, unknown>;
  createdAt: string;
}
