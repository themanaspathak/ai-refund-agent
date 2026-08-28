import { db } from "../db";

export class AgentExecutionLogger {
  static async logStep(params: {
    conversationId: string;
    stepNumber: number;
    llmReasoning?: string;
    toolName: string;
    toolInput: Record<string, any>;
    toolOutput: Record<string, any>;
    policyOutcome: "PASS" | "FAIL" | "ESCALATE";
    denialReason?: string;
  }) {
    try {
      return await db.executionLog.create({
        data: {
          conversationId: params.conversationId,
          stepNumber: params.stepNumber,
          llmReasoning: params.llmReasoning || null,
          toolName: params.toolName,
          toolInput: JSON.stringify(params.toolInput),
          toolOutput: JSON.stringify(params.toolOutput),
          policyOutcome: params.policyOutcome,
          denialReason: params.denialReason || null,
        },
      });
    } catch (error) {
      console.error("Failed to persist agent execution log:", error);
    }
  }

  static async getLogsForConversation(conversationId: string) {
    return await db.executionLog.findMany({
      where: { conversationId },
      orderBy: { stepNumber: "asc" },
    });
  }
}
