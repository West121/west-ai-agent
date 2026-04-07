export type AIDecisionType = "answer" | "clarify" | "handoff" | "reject";

export interface AIReferenceDTO {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  score: number;
}

export interface AIDecisionDTO {
  decision: AIDecisionType;
  answer?: string;
  confidence?: number;
  references?: AIReferenceDTO[];
  reason?: string;
  followUpQuestion?: string;
  handoffSummary?: string;
}
