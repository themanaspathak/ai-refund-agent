import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const { stdout, stderr } = await execAsync("npx tsx prisma/seed.ts");
    return NextResponse.json({
      success: true,
      message: "Database re-seeded successfully with test scenarios ORD-1001 to ORD-1005",
      output: stdout,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to seed database" }, { status: 500 });
  }
}
