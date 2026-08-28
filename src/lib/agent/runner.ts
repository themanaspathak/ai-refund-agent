import { db } from "../db";
import { genAI, GEMINI_MODEL_NAME } from "../gemini";
import { ToolCallLog } from "../types/agent";
import { AgentExecutionLogger } from "./logger";
import { SYSTEM_PROMPT } from "./systemPrompt";
import { AGENT_TOOLS_DECLARATIONS, executeAgentTool } from "./tools";

export async function runRefundAgent(params: {
  conversationId: string;
  userMessage: string;
}): Promise<{
  conversationId: string;
  response: string;
  toolLogs: ToolCallLog[];
  status: "ACTIVE" | "RESOLVED" | "ESCALATED";
}> {
  const { conversationId, userMessage } = params;

  // 1. Fetch conversation and history from DB
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      order: true,
    },
  });

  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found.`);
  }

  // 2. Save Customer Message to DB
  await db.message.create({
    data: {
      conversationId,
      sender: "CUSTOMER",
      content: userMessage,
    },
  });

  const toolLogs: ToolCallLog[] = [];
  let stepNumber = conversation.messages.length + 1;
  let finalResponseText = "";
  let conversationStatus: "ACTIVE" | "RESOLVED" | "ESCALATED" = (conversation.status as any) || "ACTIVE";

  // Check if Gemini API Key is present
  if (genAI && process.env.GEMINI_API_KEY) {
    try {
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL_NAME,
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ functionDeclarations: AGENT_TOOLS_DECLARATIONS }],
      });

      // Prepare Gemini Chat History
      const history = conversation.messages.map((m) => ({
        role: m.sender === "CUSTOMER" ? "user" : "model",
        parts: [{ text: m.content }],
      }));

      const chat = model.startChat({ history });

      let result = await chat.sendMessage(userMessage);
      let response = await result.response;
      let functionCalls = response.functionCalls();

      let iterations = 0;
      const MAX_ITERATIONS = 5;

      while (functionCalls && functionCalls.length > 0 && iterations < MAX_ITERATIONS) {
        iterations++;

        for (const call of functionCalls) {
          const toolName = call.name;
          const toolArgs = call.args as Record<string, any>;

          // Execute tool on backend
          const execution = await executeAgentTool(toolName, toolArgs, conversationId);

          // Log execution step in DB
          await AgentExecutionLogger.logStep({
            conversationId,
            stepNumber: stepNumber++,
            llmReasoning: `Model selected tool '${toolName}' based on turn intent.`,
            toolName,
            toolInput: toolArgs,
            toolOutput: execution.output,
            policyOutcome: execution.policyOutcome,
            denialReason: execution.denialReason,
          });

          toolLogs.push({
            stepNumber: stepNumber - 1,
            llmReasoning: `Model selected tool '${toolName}'.`,
            toolName,
            toolInput: toolArgs,
            toolOutput: execution.output,
            policyOutcome: execution.policyOutcome,
            denialReason: execution.denialReason,
            timestamp: new Date().toISOString(),
          });

          if (execution.policyOutcome === "ESCALATE") {
            conversationStatus = "ESCALATED";
          }

          // Return tool result to Gemini model
          result = await chat.sendMessage([
            {
              functionResponse: {
                name: toolName,
                response: execution.output,
              },
            },
          ]);

          response = await result.response;
        }

        functionCalls = response.functionCalls();
      }

      finalResponseText = response.text();
    } catch (apiError: any) {
      console.warn("Gemini API call warning/error, switching to agent fallback engine:", apiError.message);
      // Fallback agent logic below
      finalResponseText = await runAgentFallback({
        conversationId,
        userMessage,
        stepNumber,
        toolLogs,
      });
    }
  } else {
    // Zero-config fallback orchestrator when GEMINI_API_KEY is not set
    finalResponseText = await runAgentFallback({
      conversationId,
      userMessage,
      stepNumber,
      toolLogs,
    });
  }

  // Save AGENT Message to DB
  await db.message.create({
    data: {
      conversationId,
      sender: "AGENT",
      content: finalResponseText,
      toolCalls: toolLogs.length > 0 ? JSON.stringify(toolLogs) : null,
    },
  });

  // Update conversation status
  await db.conversation.update({
    where: { id: conversationId },
    data: { status: conversationStatus },
  });

  return {
    conversationId,
    response: finalResponseText,
    toolLogs,
    status: conversationStatus,
  };
}

/**
 * Robust, deterministic fallback orchestrator when Gemini API key is omitted or hits limits.
 * Simulates LLM function calling and evaluates backend rules deterministically.
 */
async function runAgentFallback(params: {
  conversationId: string;
  userMessage: string;
  stepNumber: number;
  toolLogs: ToolCallLog[];
}): Promise<string> {
  const { conversationId, userMessage, toolLogs } = params;
  let currentStep = params.stepNumber;

  // Extract Order Number (e.g. ORD-1001, ORD-1002, etc.)
  const orderMatch = userMessage.match(/ORD-\d{4}/i);
  const orderNumber = orderMatch ? orderMatch[0].toUpperCase() : null;

  if (!orderNumber) {
    return "Hello! I am RefundBot, your AI Customer Support Assistant. Please provide your Order Number (e.g., ORD-1001) so I can assist you with your refund or return inquiry.";
  }

  // 1. Invoke get_order_details tool
  const orderExec = await executeAgentTool("get_order_details", { orderNumber }, conversationId);
  await AgentExecutionLogger.logStep({
    conversationId,
    stepNumber: currentStep++,
    llmReasoning: "Fallback Intent: User provided order number. Fetching order details from database.",
    toolName: "get_order_details",
    toolInput: { orderNumber },
    toolOutput: orderExec.output,
    policyOutcome: orderExec.policyOutcome,
    denialReason: orderExec.denialReason,
  });

  toolLogs.push({
    stepNumber: currentStep - 1,
    llmReasoning: "Fetched order details from DB.",
    toolName: "get_order_details",
    toolInput: { orderNumber },
    toolOutput: orderExec.output,
    policyOutcome: orderExec.policyOutcome,
    denialReason: orderExec.denialReason,
    timestamp: new Date().toISOString(),
  });

  if (!orderExec.output.success) {
    return `I looked up ${orderNumber}, but could not find it in our records. Please double-check your order number.`;
  }

  const order = orderExec.output.order;

  // Check if intent is refund/return
  const lowerMsg = userMessage.toLowerCase();
  const isRefundIntent =
    lowerMsg.includes("refund") ||
    lowerMsg.includes("return") ||
    lowerMsg.includes("money back") ||
    lowerMsg.includes("defective") ||
    lowerMsg.includes("broken") ||
    lowerMsg.includes("wrong") ||
    lowerMsg.includes("override");

  if (!isRefundIntent) {
    return `I found order **${order.orderNumber}** (Total: \$${order.totalAmount.toFixed(2)}, Status: ${order.status}). How can I assist you with this order today?`;
  }

  // Determine Reason & Condition
  let reason = "CHANGE_OF_MIND";
  if (lowerMsg.includes("defective") || lowerMsg.includes("broken") || lowerMsg.includes("damaged")) {
    reason = "DEFECTIVE";
  } else if (lowerMsg.includes("size") || lowerMsg.includes("fit")) {
    reason = "WRONG_SIZE";
  }

  let itemCondition = "UNOPENED";
  if (lowerMsg.includes("opened") || lowerMsg.includes("box")) {
    itemCondition = "OPENED_LIKE_NEW";
  } else if (lowerMsg.includes("damaged") || lowerMsg.includes("used")) {
    itemCondition = "DAMAGED";
  }

  // Check Prompt Injection Attempt
  if (lowerMsg.includes("override") || lowerMsg.includes("admin") || lowerMsg.includes("system prompt")) {
    reason = "PROMPT_INJECTION_ATTEMPT";
  }

  // 2. Invoke process_refund tool with idempotency key
  const idempotencyKey = `REF-${orderNumber}-${Date.now()}`;
  const requestedAmount = order.totalAmount - (order.alreadyRefundedAmount || 0);

  const refundExec = await executeAgentTool(
    "process_refund",
    {
      orderNumber,
      requestedAmount,
      reason,
      itemCondition,
      idempotencyKey,
    },
    conversationId
  );

  await AgentExecutionLogger.logStep({
    conversationId,
    stepNumber: currentStep++,
    llmReasoning: "Fallback Intent: User requested refund. Executing process_refund tool through deterministic policy engine.",
    toolName: "process_refund",
    toolInput: { orderNumber, requestedAmount, reason, itemCondition, idempotencyKey },
    toolOutput: refundExec.output,
    policyOutcome: refundExec.policyOutcome,
    denialReason: refundExec.denialReason,
  });

  toolLogs.push({
    stepNumber: currentStep - 1,
    llmReasoning: "Executed process_refund tool.",
    toolName: "process_refund",
    toolInput: { orderNumber, requestedAmount, reason, itemCondition, idempotencyKey },
    toolOutput: refundExec.output,
    policyOutcome: refundExec.policyOutcome,
    denialReason: refundExec.denialReason,
    timestamp: new Date().toISOString(),
  });

  const res = refundExec.output;

  if (res.status === "APPROVED") {
    return `Great news! Your refund request for **${orderNumber}** has been **APPROVED** in the amount of **\$${res.amountApproved.toFixed(2)}**. The refund has been processed to your original payment method. ${res.restockingFeeApplied > 0 ? `(Note: A 15% restocking fee of \$${res.restockingFeeApplied.toFixed(2)} was applied per policy).` : ""}`;
  } else if (res.status === "PENDING_RETURN") {
    return `Your refund request for **${orderNumber}** has been provisionally approved for **\$${res.amountApproved.toFixed(2)}**! Since this is a high-value item, physical return is required. We have issued a return label with tracking **${res.trackingNumber}**. Once received and scanned, your payout will be released.`;
  } else if (res.status === "ESCALATED") {
    return `Your refund request for **${orderNumber}** has been **ESCALATED to a Human Supervisor** due to security policy flags. A support ticket has been created and our team will contact you shortly.`;
  } else {
    return `I'm sorry, but your refund request for **${orderNumber}** could not be approved. **Reason:** ${res.message || res.violations?.join(", ") || "Policy violation"}. If you feel this is an error, please let me know and I can escalate your request to a human supervisor.`;
  }
}
