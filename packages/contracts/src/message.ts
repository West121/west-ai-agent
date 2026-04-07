export type MessageType =
  | "text"
  | "image"
  | "file"
  | "voice"
  | "location"
  | "card"
  | "system";

export interface MessageAttachment {
  id: string;
  type: Exclude<MessageType, "text" | "system" | "card">;
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
}

export interface MessageDTO {
  id: string;
  conversationId: string;
  type: MessageType;
  senderType: "customer" | "agent" | "bot" | "system";
  senderId?: string | null;
  text?: string;
  attachments?: MessageAttachment[];
  cardPayload?: Record<string, unknown>;
  createdAt: string;
  deliveredAt?: string | null;
  readAt?: string | null;
}
