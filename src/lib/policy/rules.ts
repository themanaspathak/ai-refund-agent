import { ItemCategory, ItemCondition, RefundReason } from "../types/domain";

export const POLICY_CONSTANTS = {
  DEFAULT_RETURN_WINDOW_DAYS: 30,
  HIGH_VALUE_THRESHOLD: 100.0,
  ELECTRONICS_RESTOCKING_FEE_PCT: 0.15,
  MAX_REFUNDS_PER_MONTH: 3,
  MAX_REFUND_AMOUNT_PER_MONTH: 500.0,
};

export function isCategoryReturnable(category: string, reason: RefundReason): { returnable: boolean; reason?: string } {
  const cat = category.toUpperCase() as ItemCategory;
  if (cat === "FINAL_SALE") {
    return { returnable: false, reason: "Item was purchased as Final Sale and cannot be returned." };
  }
  if (cat === "DIGITAL") {
    if (reason === "DEFECTIVE") {
      return { returnable: true };
    }
    return { returnable: false, reason: "Digital products are non-refundable once delivered unless defective." };
  }
  if (cat === "PERISHABLE") {
    return { returnable: false, reason: "Perishable items cannot be returned due to hygiene & safety rules." };
  }
  return { returnable: true };
}

export function isReturnWindowValid(deliveryDate: Date | null, purchaseDate: Date, returnWindowDays: number, reason: RefundReason): { valid: boolean; daysPassed: number; reason?: string } {
  const baseDate = deliveryDate || purchaseDate;
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - baseDate.getTime());
  const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (daysPassed > returnWindowDays) {
    if (reason === "DEFECTIVE") {
      // Defective items may be granted extended inspection, but still log window notice
      return { valid: true, daysPassed };
    }
    return {
      valid: false,
      daysPassed,
      reason: `Return window exceeded (${daysPassed} days since delivery/purchase, max allowed is ${returnWindowDays} days).`,
    };
  }

  return { valid: true, daysPassed };
}
