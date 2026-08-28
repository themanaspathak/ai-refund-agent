import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const refunds = await db.refund.findMany({
      include: {
        order: {
          include: {
            customer: true,
            items: { include: { product: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalApprovedAmount = refunds
      .filter((r) => r.status === "APPROVED" || r.status === "PENDING_RETURN")
      .reduce((sum, r) => sum + r.amount, 0);

    const approvedCount = refunds.filter((r) => r.status === "APPROVED" || r.status === "PENDING_RETURN").length;
    const deniedCount = refunds.filter((r) => r.status === "DENIED").length;
    const escalatedCount = refunds.filter((r) => r.status === "ESCALATED").length;

    return NextResponse.json({
      refunds,
      metrics: {
        totalApprovedAmount: Number(totalApprovedAmount.toFixed(2)),
        approvedCount,
        deniedCount,
        escalatedCount,
        totalRefunds: refunds.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { refundId, status, note } = body;

    if (!refundId || !status) {
      return NextResponse.json({ error: "refundId and status are required" }, { status: 400 });
    }

    const updatedRefund = await db.refund.update({
      where: { id: refundId },
      data: { status },
      include: { order: true },
    });

    if (status === "APPROVED") {
      await db.order.update({
        where: { id: updatedRefund.orderId },
        data: { status: "REFUNDED" },
      });
    }

    return NextResponse.json({ success: true, refund: updatedRefund });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
