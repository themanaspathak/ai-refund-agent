import { FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { z } from "zod";
import { db } from "../db";
import { RefundPolicyEngine } from "../policy/engine";
import { ItemCondition, RefundReason } from "../types/domain";

// 1. Zod Validation Schemas
export const GetOrderDetailsSchema = z.object({
  orderNumber: z.string().min(1, "Order number is required"),
});

export const CheckRefundPolicySchema = z.object({
  orderNumber: z.string().min(1, "Order number is required"),
  itemIds: z.array(z.string()).optional(),
  reason: z.enum([
    "DEFECTIVE",
    "WRONG_SIZE",
    "CHANGE_OF_MIND",
    "LATE_DELIVERY",
    "NOT_AS_DESCRIBED",
    "PROMPT_INJECTION_ATTEMPT",
    "OTHER",
  ]),
  itemCondition: z.enum(["UNOPENED", "OPENED_LIKE_NEW", "DAMAGED", "MISSING_PARTS"]).optional(),
});

export const ProcessRefundSchema = z.object({
  orderNumber: z.string().min(1, "Order number is required"),
  itemIds: z.array(z.string()).optional(),
  requestedAmount: z.number().positive(),
  reason: z.string(),
  itemCondition: z.enum(["UNOPENED", "OPENED_LIKE_NEW", "DAMAGED", "MISSING_PARTS"]),
  idempotencyKey: z.string().min(1, "Idempotency key is required"),
});

export const EscalateToHumanSchema = z.object({
  orderNumber: z.string().optional(),
  reason: z.string().min(1, "Escalation reason is required"),
  customerSentiment: z.enum(["NEUTRAL", "FRUSTRATED", "ANGRY"]).optional(),
});

export const IssueReturnLabelSchema = z.object({
  orderNumber: z.string().min(1, "Order number is required"),
  itemIds: z.array(z.string()).min(1, "At least one item ID is required"),
});

// 2. Gemini Function Declarations (Tools)
export const AGENT_TOOLS_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "get_order_details",
    description: "Fetch comprehensive information for a customer order by order number (e.g. ORD-1001).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        orderNumber: {
          type: SchemaType.STRING,
          description: "The unique order number (e.g. ORD-1001, ORD-1002)",
        },
      },
      required: ["orderNumber"],
    },
  },
  {
    name: "check_refund_policy",
    description: "Dry-run policy evaluation to test whether an order or specific items are eligible for refund without mutating database.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        orderNumber: { type: SchemaType.STRING, description: "Order number" },
        itemIds: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: "Optional list of item IDs to check",
        },
        reason: {
          type: SchemaType.STRING,
          description: "Reason for refund request (DEFECTIVE, WRONG_SIZE, CHANGE_OF_MIND, LATE_DELIVERY, NOT_AS_DESCRIBED)",
        },
        itemCondition: {
          type: SchemaType.STRING,
          description: "Condition of the item (UNOPENED, OPENED_LIKE_NEW, DAMAGED, MISSING_PARTS)",
        },
      },
      required: ["orderNumber", "reason"],
    },
  },
  {
    name: "process_refund",
    description: "Executes a financial refund transaction. MUST pass through deterministic backend RefundPolicyEngine validation before database mutation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        orderNumber: { type: SchemaType.STRING, description: "Order number" },
        itemIds: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: "Optional item IDs to refund",
        },
        requestedAmount: { type: SchemaType.NUMBER, description: "Exact refund amount requested" },
        reason: { type: SchemaType.STRING, description: "Detailed reason for refund" },
        itemCondition: {
          type: SchemaType.STRING,
          description: "Condition of the item (UNOPENED, OPENED_LIKE_NEW, DAMAGED, MISSING_PARTS)",
        },
        idempotencyKey: {
          type: SchemaType.STRING,
          description: "Unique string key for transaction idempotency to prevent duplicate refunds",
        },
      },
      required: ["orderNumber", "requestedAmount", "reason", "itemCondition", "idempotencyKey"],
    },
  },
  {
    name: "escalate_to_human",
    description: "Escalates the support ticket to human supervisor queue for manual review or supervisor intervention.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        orderNumber: { type: SchemaType.STRING, description: "Associated order number" },
        reason: { type: SchemaType.STRING, description: "Reason for escalation" },
        customerSentiment: { type: SchemaType.STRING, description: "NEUTRAL, FRUSTRATED, or ANGRY" },
      },
      required: ["reason"],
    },
  },
  {
    name: "issue_return_label",
    description: "Generates a pre-paid return shipping label for items that must be shipped back before payout.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        orderNumber: { type: SchemaType.STRING, description: "Order number" },
        itemIds: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: "Item IDs requiring return shipment",
        },
      },
      required: ["orderNumber", "itemIds"],
    },
  },
];

// 3. Tool Executor Function
export async function executeAgentTool(
  name: string,
  args: Record<string, any>,
  conversationId: string
): Promise<{ output: Record<string, any>; policyOutcome: "PASS" | "FAIL" | "ESCALATE"; denialReason?: string }> {
  try {
    switch (name) {
      case "get_order_details": {
        const parsed = GetOrderDetailsSchema.parse(args);
        const order = await db.order.findUnique({
          where: { orderNumber: parsed.orderNumber },
          include: {
            customer: true,
            items: { include: { product: true } },
            refunds: true,
          },
        });

        if (!order) {
          return {
            output: { success: false, error: `Order ${parsed.orderNumber} not found.` },
            policyOutcome: "FAIL",
            denialReason: "ORDER_NOT_FOUND",
          };
        }

        const baseDate = order.deliveryDate || order.purchaseDate;
        const daysSinceDelivery = Math.floor(
          Math.abs(Date.now() - new Date(baseDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        const alreadyRefundedAmount = order.refunds
          .filter((r) => r.status === "APPROVED" || r.status === "PENDING_RETURN")
          .reduce((sum, r) => sum + r.amount, 0);

        return {
          output: {
            success: true,
            order: {
              id: order.id,
              orderNumber: order.orderNumber,
              customerName: order.customer.name,
              customerEmail: order.customer.email,
              purchaseDate: order.purchaseDate.toISOString(),
              deliveryDate: order.deliveryDate?.toISOString() || null,
              status: order.status,
              returnWindowDays: order.returnWindowDays,
              daysSinceDelivery,
              totalAmount: order.totalAmount,
              alreadyRefundedAmount,
              items: order.items.map((i) => ({
                id: i.id,
                name: i.product.name,
                sku: i.product.sku,
                category: i.product.category,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                refunded: i.refunded,
              })),
            },
          },
          policyOutcome: "PASS",
        };
      }

      case "check_refund_policy": {
        const parsed = CheckRefundPolicySchema.parse(args);
        const result = await RefundPolicyEngine.checkPolicy({
          orderNumber: parsed.orderNumber,
          itemIds: parsed.itemIds,
          reason: parsed.reason as RefundReason,
          itemCondition: parsed.itemCondition as ItemCondition,
        });

        return {
          output: { success: true, ...result },
          policyOutcome: result.eligible ? "PASS" : "FAIL",
          denialReason: result.violations.join(", "),
        };
      }

      case "process_refund": {
        const parsed = ProcessRefundSchema.parse(args);
        const result = await RefundPolicyEngine.processRefund({
          orderNumber: parsed.orderNumber,
          itemIds: parsed.itemIds,
          requestedAmount: parsed.requestedAmount,
          reason: parsed.reason,
          itemCondition: parsed.itemCondition as ItemCondition,
          idempotencyKey: parsed.idempotencyKey,
        });

        const outcomeMap: Record<string, "PASS" | "FAIL" | "ESCALATE"> = {
          APPROVED: "PASS",
          PENDING_RETURN: "PASS",
          DENIED: "FAIL",
          ESCALATED: "ESCALATE",
        };

        return {
          output: result,
          policyOutcome: outcomeMap[result.status] || "FAIL",
          denialReason: result.violations?.join(", "),
        };
      }

      case "escalate_to_human": {
        const parsed = EscalateToHumanSchema.parse(args);
        if (parsed.orderNumber) {
          await db.order.updateMany({
            where: { orderNumber: parsed.orderNumber },
            data: { status: "ESCALATED" },
          });
        }

        await db.conversation.update({
          where: { id: conversationId },
          data: { status: "ESCALATED" },
        });

        const ticketId = `ESC-TCK-${Math.floor(10000 + Math.random() * 90000)}`;

        return {
          output: {
            escalated: true,
            ticketId,
            message: `Ticket ${ticketId} created. Conversation routed to human supervisor queue.`,
          },
          policyOutcome: "ESCALATE",
        };
      }

      case "issue_return_label": {
        const parsed = IssueReturnLabelSchema.parse(args);
        const trackingNumber = `LABEL-${Math.floor(10000000 + Math.random() * 90000000)}`;
        return {
          output: {
            success: true,
            trackingNumber,
            labelUrl: `https://shipping-provider.example.com/labels/${trackingNumber}.pdf`,
            instructions: "Print return label, attach to original parcel, and drop off at any authorized parcel drop-off location.",
          },
          policyOutcome: "PASS",
        };
      }

      default:
        return {
          output: { success: false, error: `Unknown tool '${name}'` },
          policyOutcome: "FAIL",
          denialReason: "UNKNOWN_TOOL",
        };
    }
  } catch (error: any) {
    return {
      output: { success: false, error: error.message || "Tool execution failed" },
      policyOutcome: "FAIL",
      denialReason: `SCHEMA_OR_EXECUTION_ERROR: ${error.message}`,
    };
  }
}
