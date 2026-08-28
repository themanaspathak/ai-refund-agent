import { NextRequest, NextResponse } from "next/server";
import { seedDatabase } from "../../../../prisma/seed";

export async function POST(req: NextRequest) {
  try {
    await seedDatabase();
    return NextResponse.json({
      success: true,
      message: "Database re-seeded successfully with 15 CRM customer profiles and orders ORD-1001 through ORD-1015",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to seed database" }, { status: 500 });
  }
}

