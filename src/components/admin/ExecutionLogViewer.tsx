"use client";

import { useState, useEffect } from "react";
import { Wrench, CheckCircle2, AlertTriangle, ShieldAlert, Eye, Search, Filter, RefreshCw } from "lucide-react";
import { LogDetailModal } from "./LogDetailModal";

interface ExecutionLogViewerProps {
  initialLogs?: any[];
}

export function ExecutionLogViewer({ initialLogs = [] }: ExecutionLogViewerProps) {
  const [logs, setLogs] = useState<any[]>(initialLogs);
  const [loading, setLoading] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const outcomeParam = selectedOutcome !== "ALL" ? `?outcome=${selectedOutcome}` : "";
      const res = await fetch(`/api/admin/logs${outcomeParam}`);
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedOutcome]);

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.toolName.toLowerCase().includes(q) ||
      log.conversationId.toLowerCase().includes(q) ||
      (log.denialReason && log.denialReason.toLowerCase().includes(q)) ||
      (log.llmReasoning && log.llmReasoning.toLowerCase().includes(q))
    );
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-emerald-400" />
            Agent Execution & Reasoning Trace
          </h2>
          <p className="text-xs text-slate-400">
            Step-by-step audit log of agent tool calls, LLM thoughts, and deterministic policy evaluations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Outcome Filter Buttons */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            {["ALL", "PASS", "FAIL", "ESCALATE"].map((outcome) => (
              <button
                key={outcome}
                onClick={() => setSelectedOutcome(outcome)}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  selectedOutcome === outcome
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {outcome}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter logs by tool name, session ID, or reasoning..."
          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Logs Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[11px] border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Step</th>
              <th className="px-4 py-3">Tool Name</th>
              <th className="px-4 py-3">Deterministic Outcome</th>
              <th className="px-4 py-3">Agent Reasoning / Notes</th>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/50 transition">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-300">
                    #{log.stepNumber}
                  </td>
                  <td className="px-4 py-3 font-mono text-emerald-400 font-medium">
                    {log.toolName}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono border ${
                        log.policyOutcome === "PASS"
                          ? "bg-emerald-950/60 text-emerald-300 border-emerald-800"
                          : log.policyOutcome === "ESCALATE"
                          ? "bg-purple-950/60 text-purple-300 border-purple-800"
                          : "bg-rose-950/60 text-rose-300 border-rose-800"
                      }`}
                    >
                      {log.policyOutcome === "PASS" ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : log.policyOutcome === "ESCALATE" ? (
                        <ShieldAlert className="w-3 h-3 text-purple-400" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                      )}
                      <span>{log.policyOutcome === "PASS" ? "PASSED" : log.policyOutcome}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 max-w-md truncate">
                    {log.llmReasoning || log.denialReason || "Executed backend tool validation."}
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 transition"
                      title="Inspect full JSON payload & parameters"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No execution logs match the current query or filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Inspector */}
      {selectedLog && (
        <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}
