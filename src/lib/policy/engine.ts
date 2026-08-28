import { db } from "../db";
import { ItemCondition, PolicyCheckResult, RefundReason, RefundResult } from "../types/domain";
import { isCategoryReturnable, isReturnWindowValid, POLICY_CONSTANTS } from "./rules";

export class RefundPolicyEngine {
  /**
   * Dry-run policy check without mutating database state.
   */
  static async checkPolicy(params: {
    orderNumber: string;
    itemIds?: string[];
    reason: RefundReason;
    itemCondition?: ItemCondition;
  }): Promise<PolicyCheckResult> {
    const order = await db.order.findUnique({
      where: { orderNumber: params.orderNumber },
      include: {
        items: { include: { product: true } },
        refunds: true,
      },
    });

    if (!order) {
      return {
        eligible: false,
        maxRefundableAmount: 0,
        restockingFee: 0,
        requiresPhysicalReturn: false,
        violations: [`Order ${params.orderNumber} not found.`],
        appliedRules: [],
      };
    }

    const violations: string[] = [];
    const appliedRules: string[] = [];
    let restockingFee = 0;

    // 1. Calculate already refunded amount
    const alreadyRefunded = order.refunds
      .filter((r) => r.status === "APPROVED" || r.status === "PENDING_RETURN")
      .reduce((acc, r) => acc + r.amount, 0);

    const maxOriginalAmount = order.totalAmount - alreadyRefunded;

    // 2. Return Window Check
    const windowCheck = isReturnWindowValid(
      order.deliveryDate,
      order.purchaseDate,
      order.returnWindowDays,
      params.reason
    );
    appliedRules.push(`Return Window Check (${windowCheck.daysPassed} days elapsed / ${order.returnWindowDays} allowed)`);
    if (!windowCheck.valid && windowCheck.reason) {
      violations.push(windowCheck.reason);
    }

    // 3. Filter targeted items or all items
    const targetItems = params.itemIds && params.itemIds.length > 0
      ? order.items.filter((i) => params.itemIds!.includes(i.id))
      : order.items;

    let targetTotal = 0;
    for (const item of targetItems) {
      if (item.refunded) {
        violations.push(`Item ${item.product.name} (${item.product.sku}) has already been refunded.`);
        continue;
      }

      targetTotal += item.unitPrice * item.quantity;

      // Category check
      const catCheck = isCategoryReturnable(item.product.category, params.reason);
      appliedRules.push(`Category Check for ${item.product.name}: ${item.product.category}`);
      if (!catCheck.returnable && catCheck.reason) {
        violations.push(catCheck.reason);
      }

      // Restocking fee for electronics opened
      if (item.product.category === "ELECTRONICS" && params.itemCondition === "OPENED_LIKE_NEW") {
        const fee = item.unitPrice * item.quantity * POLICY_CONSTANTS.ELECTRONICS_RESTOCKING_FEE_PCT;
        restockingFee += fee;
        appliedRules.push(`15% Restocking Fee applied to open electronics (${item.product.name}): -$${fee.toFixed(2)}`);
      }
    }

    if (params.itemCondition === "DAMAGED" && params.reason !== "DEFECTIVE") {
      violations.push("Items damaged by customer use are not eligible for refund.");
    }

    const netRefundable = Math.max(0, Math.min(targetTotal, maxOriginalAmount) - restockingFee);
    const requiresPhysicalReturn = netRefundable > POLICY_CONSTANTS.HIGH_VALUE_THRESHOLD;

    if (requiresPhysicalReturn) {
      appliedRules.push(`High-Value Physical Return Required (Payout $${netRefundable.toFixed(2)} > $${POLICY_CONSTANTS.HIGH_VALUE_THRESHOLD})`);
    }

    return {
      eligible: violations.length === 0,
      maxRefundableAmount: Number(netRefundable.toFixed(2)),
      restockingFee: Number(restockingFee.toFixed(2)),
      requiresPhysicalReturn,
      violations,
      appliedRules,
    };
  }

  /**
   * Deterministic Refund Execution. Must be invoked before database mutation.
   */
  static async processRefund(params: {
    orderNumber: string;
    itemIds?: string[];
    requestedAmount: number;
    reason: string;
    itemCondition: ItemCondition;
    idempotencyKey: string;
  }): Promise<RefundResult> {
    // 1. Check idempotency
    const existingRefund = await db.refund.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });

    if (existingRefund) {
      return {
        success: existingRefund.status === "APPROVED" || existingRefund.status === "PENDING_RETURN",
        status: existingRefund.status as any,
        refundId: existingRefund.id,
        amountApproved: existingRefund.amount,
        restockingFeeApplied: 0,
        message: `Idempotent execution: Stored refund outcome returned (${existingRefund.status}).`,
      };
    }

    // 2. Fetch order & customer info
    const order = await db.order.findUnique({
      where: { orderNumber: params.orderNumber },
      include: {
        customer: true,
        items: { include: { product: true } },
        refunds: true,
      },
    });

    if (!order) {
      return {
        success: false,
        status: "DENIED",
        amountApproved: 0,
        restockingFeeApplied: 0,
        message: `Order ${params.orderNumber} does not exist in the database.`,
        violations: [`ORDER_NOT_FOUND`],
      };
    }

    // 3. Fraud Guard Check: Past 30 days refunds count
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentCustomerRefunds = await db.refund.findMany({
      where: {
        order: { customerId: order.customerId },
        createdAt: { gte: thirtyDaysAgo },
        status: { in: ["APPROVED", "PENDING_RETURN"] },
      },
    });

    const refundCount = recentCustomerRefunds.length;
    const totalRefundedPastMonth = recentCustomerRefunds.reduce((sum, r) => sum + r.amount, 0);

    if (refundCount >= POLICY_CONSTANTS.MAX_REFUNDS_PER_MONTH || totalRefundedPastMonth > POLICY_CONSTANTS.MAX_REFUND_AMOUNT_PER_MONTH) {
      // Create escalated refund record
      const refundRecord = await db.refund.create({
        data: {
          orderId: order.id,
          amount: 0,
          status: "ESCALATED",
          reason: params.reason,
          policyCode: "FRAUD_SUSPICION_THRESHOLD",
          idempotencyKey: params.idempotencyKey,
        },
      });

      // Update order status
      await db.order.update({
        where: { id: order.id },
        data: { status: "ESCALATED" },
      });

      return {
        success: false,
        status: "ESCALATED",
        refundId: refundRecord.id,
        amountApproved: 0,
        restockingFeeApplied: 0,
        message: `Security Flag: Customer has requested ${refundCount + 1} refunds in the past 30 days. Auto-escalating to human supervisor for verification.`,
        violations: [`FRAUD_THRESHOLD_EXCEEDED (${refundCount} refunds in 30 days)`],
      };
    }

    const validReasons = ["DEFECTIVE", "WRONG_SIZE", "CHANGE_OF_MIND", "LATE_DELIVERY", "NOT_AS_DESCRIBED", "PROMPT_INJECTION_ATTEMPT", "OTHER"];
    const upperReason = params.reason.toUpperCase();
    const reasonType = (validReasons.includes(upperReason) ? upperReason : "CHANGE_OF_MIND") as RefundReason;
    const policyResult = await this.checkPolicy({
      orderNumber: params.orderNumber,
      itemIds: params.itemIds,
      reason: reasonType,
      itemCondition: params.itemCondition,
    });

    if (!policyResult.eligible) {
      // Record denied refund
      const deniedRefund = await db.refund.create({
        data: {
          orderId: order.id,
          amount: 0,
          status: "DENIED",
          reason: params.reason,
          policyCode: "POLICY_VIOLATION",
          idempotencyKey: params.idempotencyKey,
        },
      });

      return {
        success: false,
        status: "DENIED",
        refundId: deniedRefund.id,
        amountApproved: 0,
        restockingFeeApplied: policyResult.restockingFee,
        message: `Refund Denied by Deterministic Engine: ${policyResult.violations.join(" | ")}`,
        violations: policyResult.violations,
      };
    }

    // 5. Verify Requested Amount does not exceed max allowed net refund
    const finalAmount = Math.min(params.requestedAmount, policyResult.maxRefundableAmount);

    if (finalAmount <= 0) {
      return {
        success: false,
        status: "DENIED",
        amountApproved: 0,
        restockingFeeApplied: policyResult.restockingFee,
        message: "Refund amount after policy adjustments & fees is $0.00.",
        violations: ["NET_REFUND_ZERO"],
      };
    }

    // 6. Check High-Value Physical Return Requirement
    const isHighValue = policyResult.requiresPhysicalReturn;
    const finalStatus = isHighValue ? "PENDING_RETURN" : "APPROVED";
    const trackingNumber = isHighValue ? `RET-TRK-${Math.floor(100000 + Math.random() * 900000)}` : undefined;

    // Execute Mutation inside DB transaction
    const [refundRecord] = await db.$transaction([
      db.refund.create({
        data: {
          orderId: order.id,
          amount: finalAmount,
          status: finalStatus,
          reason: params.reason,
          policyCode: isHighValue ? "APPROVED_PENDING_RETURN" : "APPROVED_INSTANT",
          idempotencyKey: params.idempotencyKey,
        },
      }),
      db.order.update({
        where: { id: order.id },
        data: {
          status: finalStatus === "APPROVED" ? "REFUNDED" : "RETURN_REQUESTED",
        },
      }),
      // Mark items as refunded if specific itemIds provided
      ...(params.itemIds && params.itemIds.length > 0
        ? [
            db.orderItem.updateMany({
              where: {
                orderId: order.id,
                id: { in: params.itemIds },
              },
              data: { refunded: true },
            }),
          ]
        : []),
    ]);

    return {
      success: true,
      status: finalStatus,
      refundId: refundRecord.id,
      amountApproved: finalAmount,
      restockingFeeApplied: policyResult.restockingFee,
      trackingNumber,
      message: isHighValue
        ? `Refund of $${finalAmount.toFixed(2)} is approved pending physical return. Return label issued with tracking ${trackingNumber}.`
        : `Refund of $${finalAmount.toFixed(2)} approved successfully and credited to customer.`,
    };
  }
}
