"use client";

import { useState } from "react";
import { ChatWidget } from "@/components/customer/ChatWidget";
import { ScenarioSelector, PresetScenario } from "@/components/customer/ScenarioSelector";
import { Bot, Sparkles } from "lucide-react";

export default function CustomerPage() {
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);

  const handleSelectScenario = (scenario: PresetScenario) => {
    setSelectedPrompt(scenario.prompt);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Bot className="w-6 h-6 text-emerald-400" />
            AI Customer Support Portal
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Interact with RefundBot. Every refund decision is deterministically validated by backend policy rules before database mutation.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono text-emerald-400">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>Gemini Tool Orchestration</span>
        </div>
      </div>

      {/* Preset Test Scenarios Selector */}
      <ScenarioSelector onSelectScenario={handleSelectScenario} />

      {/* Chat Widget */}
      <ChatWidget key={selectedPrompt || "default"} />
    </div>
  );
}
