export type KnowledgeDocumentType = "faq" | "article" | "flow" | "shortcut";
export type KnowledgeStatus = "draft" | "in_review" | "published" | "archived";

export interface KnowledgeDocumentDTO {
  id: string;
  tenantId: string;
  type: KnowledgeDocumentType;
  title: string;
  status: KnowledgeStatus;
  category: string;
  tags: string[];
  language: string;
  channels: string[];
  version: number;
  updatedAt: string;
}

export interface KnowledgeChunkDTO {
  id: string;
  documentId: string;
  publishVersion: number;
  titlePath: string[];
  content: string;
  keywords: string[];
  metadata: Record<string, unknown>;
}
