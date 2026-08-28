import { NextRequest, NextResponse } from "next/server";
import { runRefundAgent } from "@/lib/agent/runner";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversationId: inputConvId, customerEmail, message } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message string is required" }, { status: 400 });
    }

    let conversationId = inputConvId;

    // Create a new conversation if none provided
    if (!conversationId) {
      const email = customerEmail || "alice@example.com";
      let customer = await db.customer.findUnique({ where: { email } });

      if (!customer) {
        customer = await db.customer.create({
          data: {
            email,
            name: "Demo Customer",
          },
        });
      }

      const newConversation = await db.conversation.create({
        data: {
          customerId: customer.id,
          status: "ACTIVE",
          messages: {
            create: [
              {
                sender: "AGENT",
                content: "Hello! I am RefundBot, your AI Support Agent. How can I help you today?",
              },
            ],
          },
        },
      });

      conversationId = newConversation.id;
    }

    const result = await runRefundAgent({
      conversationId,
      userMessage: message,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in /api/chat:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process chat message" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
    }

    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      include: {
        customer: true,
        order: { include: { items: { include: { product: true } } } },
        messages: { orderBy: { createdAt: "asc" } },
        logs: { orderBy: { stepNumber: "asc" } },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json({ conversation });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
