"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, ShieldCheck, FileText, DollarSign, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";

export function Navbar() {
  const pathname = usePathname();
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const handleSeed = async () => {
    setIsSeeding(true);
    setSeedMessage(null);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSeedMessage("DB Re-seeded!");
        setTimeout(() => setSeedMessage(null), 3000);
        window.location.reload();
      } else {
        alert("Failed to seed database: " + data.error);
      }
    } catch (e: any) {
      alert("Error seeding DB: " + e.message);
    } finally {
      setIsSeeding(false);
    }
  };

  const navLinks = [
    { href: "/customer", label: "Customer Chat", icon: Bot },
    { href: "/admin", label: "Admin Overview", icon: ShieldCheck },
    { href: "/admin/logs", label: "Agent Reasoning Logs", icon: FileText },
    { href: "/admin/refunds", label: "Refunds & Escalations", icon: DollarSign },
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-emerald-400 hover:text-emerald-300 transition">
            <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <span>RefundBot AI</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal border border-slate-700">
              Deterministic Guard
            </span>
          </Link>

          {/* Nav Links */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition ${
                    isActive
                      ? "bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{link.label}</span>
                </Link>
              );
            })}

            {/* DB Re-seed Button */}
            <button
              onClick={handleSeed}
              disabled={isSeeding}
              className="ml-2 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs rounded-md border border-slate-700 transition"
              title="Reset SQLite database with standard test scenarios"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSeeding ? "animate-spin text-emerald-400" : ""}`} />
              <span>{isSeeding ? "Seeding..." : seedMessage || "Reset DB"}</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
