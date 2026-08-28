import { db } from "@/lib/db";
import Link from "next/link";
import { ShieldCheck, DollarSign, AlertTriangle, ShieldAlert, FileText, ArrowRight } from "lucide-react";
import { ExecutionLogViewer } from "@/components/admin/ExecutionLogViewer";

export const revalidate = 0;

export default async function AdminDashboardPage() {
  const refunds = await db.refund.findMany({
    include: {
      order: {
        include: {
          customer: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const logs = await db.executionLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const parsedLogs = logs.map((l) => ({
    ...l,
    toolInput: JSON.parse(l.toolInput),
    toolOutput: JSON.parse(l.toolOutput),
  }));

  const totalApproved = refunds
    .filter((r) => r.status === "APPROVED" || r.status === "PENDING_RETURN")
    .reduce((sum, r) => sum + r.amount, 0);

  const approvedCount = refunds.filter((r) => r.status === "APPROVED" || r.status === "PENDING_RETURN").length;
  const deniedCount = refunds.filter((r) => r.status === "DENIED").length;
  const escalatedCount = refunds.filter((r) => r.status === "ESCALATED").length;

  return (
    <div className="space-y-6">
      {/* Dashboard Title Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            Admin Operations & Policy Control
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time telemetry, deterministic policy enforcement metrics, and supervisor escalation queue.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/admin/logs"
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition"
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>View Full Reasoning Logs</span>
          </Link>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Approved Amount */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Refunded</span>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-100 mt-2">${totalApproved.toFixed(2)}</p>
          <p className="text-[11px] text-emerald-400 mt-1 font-mono">{approvedCount} approved transactions</p>
        </div>

        {/* Policy Denials */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Deterministic Denials</span>
            <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-100 mt-2">{deniedCount}</p>
          <p className="text-[11px] text-rose-400 mt-1 font-mono">Blocked by Policy Engine</p>
        </div>

        {/* Human Escalations */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Escalated Tickets</span>
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-100 mt-2">{escalatedCount}</p>
          <p className="text-[11px] text-purple-400 mt-1 font-mono">Awaiting Supervisor Review</p>
        </div>

        {/* Total Telemetry Steps */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Agent Telemetry</span>
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-100 mt-2">{logs.length}</p>
          <p className="text-[11px] text-blue-400 mt-1 font-mono">Recorded tool executions</p>
        </div>
      </div>

      {/* Embedded Execution Log Viewer */}
      <ExecutionLogViewer initialLogs={parsedLogs} />
    </div>
  );
}
