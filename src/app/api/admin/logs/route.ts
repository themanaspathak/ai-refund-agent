import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    const outcome = searchParams.get("outcome");

    const where: any = {};
    if (conversationId) where.conversationId = conversationId;
    if (outcome) where.policyOutcome = outcome.toUpperCase();

    const logs = await db.executionLog.findMany({
      where,
      include: {
        conversation: {
          include: {
            customer: true,
            order: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const parsedLogs = logs.map((log) => ({
      ...log,
      toolInput: JSON.parse(log.toolInput),
      toolOutput: JSON.parse(log.toolOutput),
    }));

    return NextResponse.json({ logs: parsedLogs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
