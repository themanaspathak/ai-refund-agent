import { db } from "@/lib/db";
import { ExecutionLogViewer } from "@/components/admin/ExecutionLogViewer";

export const revalidate = 0;

export default async function AdminLogsPage() {
  const logs = await db.executionLog.findMany({
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

  const parsedLogs = logs.map((l) => ({
    ...l,
    toolInput: JSON.parse(l.toolInput),
    toolOutput: JSON.parse(l.toolOutput),
  }));

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <h1 className="text-xl font-bold text-slate-100">Agent Reasoning & Tool Execution Logs</h1>
        <p className="text-xs text-slate-400 mt-1">
          Inspect the agent's step-by-step chain of thought, Gemini function calls, tool parameters, and deterministic policy outcomes.
        </p>
      </div>

      <ExecutionLogViewer initialLogs={parsedLogs} />
    </div>
  );
}
