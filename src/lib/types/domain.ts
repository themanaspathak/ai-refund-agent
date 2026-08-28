export type ItemCategory =
  | "ELECTRONICS"
  | "CLOTHING"
  | "DIGITAL"
  | "FINAL_SALE"
  | "PERISHABLE";

export type OrderStatus =
  | "DELIVERED"
  | "SHIPPED"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "DENIED";

export type RefundReason =
  | "DEFECTIVE"
  | "WRONG_SIZE"
  | "CHANGE_OF_MIND"
  | "LATE_DELIVERY"
  | "NOT_AS_DESCRIBED"
  | "PROMPT_INJECTION_ATTEMPT"
  | "OTHER";

export type ItemCondition =
  | "UNOPENED"
  | "OPENED_LIKE_NEW"
  | "DAMAGED"
  | "MISSING_PARTS";

export type RefundStatus = "APPROVED" | "DENIED" | "PENDING_RETURN" | "ESCALATED";

export interface PolicyCheckResult {
  eligible: boolean;
  maxRefundableAmount: number;
  restockingFee: number;
  requiresPhysicalReturn: boolean;
  violations: string[];
  appliedRules: string[];
}

export interface RefundResult {
  success: boolean;
  status: RefundStatus;
  refundId?: string;
  amountApproved: number;
  restockingFeeApplied: number;
  message: string;
  violations?: string[];
  trackingNumber?: string;
}
