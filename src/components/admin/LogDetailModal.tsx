"use client";

import { X, CheckCircle2, AlertTriangle, ShieldAlert, Code2 } from "lucide-react";

interface LogDetailModalProps {
  log: any;
  onClose: () => void;
}

export function LogDetailModal({ log, onClose }: LogDetailModalProps) {
  if (!log) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg border ${
                log.policyOutcome === "PASS"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : log.policyOutcome === "ESCALATE"
                  ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-400"
              }`}
            >
              {log.policyOutcome === "PASS" ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : log.policyOutcome === "ESCALATE" ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>

            <div>
              <h3 className="font-bold text-slate-100 text-sm">
                Execution Step #{log.stepNumber} - {log.toolName}
              </h3>
              <p className="text-xs font-mono text-slate-400">
                Log ID: {log.id} • {new Date(log.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Policy Outcome Banner */}
          <div
            className={`p-3 rounded-lg border flex items-center justify-between ${
              log.policyOutcome === "PASS"
                ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
                : log.policyOutcome === "ESCALATE"
                ? "bg-purple-950/40 border-purple-800 text-purple-300"
                : "bg-rose-950/40 border-rose-800 text-rose-300"
            }`}
          >
            <div>
              <span className="font-semibold text-sm">
                Deterministic Policy Status: {log.policyOutcome}
              </span>
              {log.denialReason && (
                <p className="mt-1 font-mono text-xs">{log.denialReason}</p>
              )}
            </div>
          </div>

          {/* LLM Reasoning */}
          {log.llmReasoning && (
            <div>
              <h4 className="font-semibold text-slate-300 mb-1.5">Agent Model Reasoning</h4>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300 leading-relaxed font-sans">
                {log.llmReasoning}
              </div>
            </div>
          )}

          {/* Tool Input Payload */}
          <div>
            <h4 className="font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-emerald-400" />
              Tool Input Arguments (JSON)
            </h4>
            <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-emerald-400 font-mono overflow-x-auto">
              {JSON.stringify(typeof log.toolInput === "string" ? JSON.parse(log.toolInput) : log.toolInput, null, 2)}
            </pre>
          </div>

          {/* Tool Output Payload */}
          <div>
            <h4 className="font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-blue-400" />
              Tool Execution Output (JSON)
            </h4>
            <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-blue-300 font-mono overflow-x-auto">
              {JSON.stringify(typeof log.toolOutput === "string" ? JSON.parse(log.toolOutput) : log.toolOutput, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
