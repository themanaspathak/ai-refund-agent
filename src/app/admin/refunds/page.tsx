"use client";

import { useState, useEffect } from "react";
import { DollarSign, ShieldAlert, CheckCircle2, AlertTriangle, RefreshCw, UserCheck } from "lucide-react";

export default function AdminRefundsPage() {
  const [refunds, setRefunds] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const fetchRefunds = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/refunds");
      const data = await res.json();
      if (res.ok) {
        setRefunds(data.refunds || []);
        setMetrics(data.metrics || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, []);

  const handleUpdateStatus = async (refundId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/admin/refunds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundId, status: newStatus }),
      });

      if (res.ok) {
        fetchRefunds();
      } else {
        const err = await res.json();
        alert("Failed to update status: " + err.error);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const filteredRefunds = refunds.filter((r) => {
    if (statusFilter === "ALL") return true;
    return r.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-400" />
            Refund Management & Supervisor Escalations
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Review all financial mutations and perform human supervisor overrides on escalated cases.
          </p>
        </div>

        <button
          onClick={fetchRefunds}
          disabled={loading}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition flex items-center gap-1.5 text-xs font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Metrics Summary Bar */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <p className="text-xs text-slate-400">Total Approved Payout</p>
            <p className="text-xl font-bold text-emerald-400 mt-1">${metrics.totalApprovedAmount.toFixed(2)}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <p className="text-xs text-slate-400">Approved Count</p>
            <p className="text-xl font-bold text-slate-100 mt-1">{metrics.approvedCount}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <p className="text-xs text-slate-400">Denied Count</p>
            <p className="text-xl font-bold text-rose-400 mt-1">{metrics.deniedCount}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <p className="text-xs text-slate-400">Escalated to Human</p>
            <p className="text-xl font-bold text-purple-400 mt-1">{metrics.escalatedCount}</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 w-fit text-xs">
        {["ALL", "APPROVED", "PENDING_RETURN", "DENIED", "ESCALATED"].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              statusFilter === st ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Refunds Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Refund ID</th>
                <th className="px-4 py-3">Order Number</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Policy Status</th>
                <th className="px-4 py-3">Reason / Code</th>
                <th className="px-4 py-3">Created At</th>
                <th className="px-4 py-3 text-right">Human Supervisor Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
              {filteredRefunds.length > 0 ? (
                filteredRefunds.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-mono text-slate-300 font-medium">
                      {r.id.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3 font-mono text-emerald-400 font-semibold">
                      {r.order?.orderNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      {r.order?.customer?.name} ({r.order?.customer?.email})
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-100 font-mono">
                      ${r.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono border ${
                          r.status === "APPROVED"
                            ? "bg-emerald-950/60 text-emerald-300 border-emerald-800"
                            : r.status === "PENDING_RETURN"
                            ? "bg-blue-950/60 text-blue-300 border-blue-800"
                            : r.status === "ESCALATED"
                            ? "bg-purple-950/60 text-purple-300 border-purple-800 font-bold animate-pulse"
                            : "bg-rose-950/60 text-rose-300 border-rose-800"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 max-w-xs truncate font-mono text-[11px]">
                      {r.policyCode}: {r.reason}
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === "ESCALATED" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleUpdateStatus(r.id, "APPROVED")}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium text-[11px] transition flex items-center gap-1 shadow-sm"
                          >
                            <UserCheck className="w-3 h-3" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(r.id, "DENIED")}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded font-medium text-[11px] transition"
                          >
                            Deny
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-mono">Finalized</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No refunds found for the selected status filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
