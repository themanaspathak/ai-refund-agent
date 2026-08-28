export interface ToolCallLog {
  stepNumber: number;
  llmReasoning?: string;
  toolName: string;
  toolInput: Record<string, any>;
  toolOutput: Record<string, any>;
  policyOutcome: "PASS" | "FAIL" | "ESCALATE";
  denialReason?: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  sender: "CUSTOMER" | "AGENT" | "SYSTEM";
  content: string;
  createdAt: string;
  toolCalls?: ToolCallLog[];
}

export interface ChatResponse {
  conversationId: string;
  message: string;
  toolLogs: ToolCallLog[];
  status: "ACTIVE" | "RESOLVED" | "ESCALATED";
}
