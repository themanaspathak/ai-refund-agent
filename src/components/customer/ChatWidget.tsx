"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Wrench, ShieldCheck, ShieldAlert, AlertTriangle, Package, Calendar, Tag } from "lucide-react";
import { VoiceControls } from "./VoiceControls";
import { ToolCallLog } from "@/lib/types/agent";

export interface MessageItem {
  id: string;
  sender: "CUSTOMER" | "AGENT" | "SYSTEM";
  content: string;
  toolLogs?: ToolCallLog[];
  createdAt: string;
}

interface ChatWidgetProps {
  initialConversationId?: string;
  onOrderFound?: (order: any) => void;
}

export function ChatWidget({ initialConversationId, onOrderFound }: ChatWidgetProps) {
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "welcome-1",
      sender: "AGENT",
      content: "Hello! I am RefundBot, your AI Support Assistant. Please share your Order Number (e.g., ORD-1001, ORD-1002) and let me know how I can assist you with your refund or return.",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastAgentResponse, setLastAgentResponse] = useState<string | undefined>();
  const [currentOrder, setCurrentOrder] = useState<any | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isLoading) return;

    const userMsg: MessageItem = {
      id: `msg-${Date.now()}`,
      sender: "CUSTOMER",
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message: text,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        if (!conversationId && data.conversationId) {
          setConversationId(data.conversationId);
        }

        const agentMsg: MessageItem = {
          id: `msg-${Date.now() + 1}`,
          sender: "AGENT",
          content: data.response,
          toolLogs: data.toolLogs,
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, agentMsg]);
        setLastAgentResponse(data.response);

        // Fetch details if get_order_details tool was invoked
        const orderLog = data.toolLogs?.find((l: ToolCallLog) => l.toolName === "get_order_details");
        if (orderLog && orderLog.toolOutput?.order) {
          setCurrentOrder(orderLog.toolOutput.order);
          if (onOrderFound) onOrderFound(orderLog.toolOutput.order);
        }
      } else {
        const errorMsg: MessageItem = {
          id: `msg-err-${Date.now()}`,
          sender: "SYSTEM",
          content: `Error: ${data.error || "Failed to communicate with agent."}`,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          sender: "SYSTEM",
          content: `Network Error: ${err.message}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Chat Interface (2 Columns on large screens) */}
      <div className="lg:col-span-2 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl h-[680px]">
        {/* Chat Header */}
        <div className="bg-slate-950/80 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <Bot className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                RefundBot Agent
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />
                  Active Policy Engine
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {conversationId ? `Session ID: ${conversationId.slice(0, 8)}...` : "New Session"}
              </p>
            </div>
          </div>

          <VoiceControls
            onTranscript={(text) => handleSendMessage(text)}
            lastAgentResponse={lastAgentResponse}
          />
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-950/40">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === "CUSTOMER" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`flex gap-3 max-w-[85%] ${
                  msg.sender === "CUSTOMER" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                    msg.sender === "CUSTOMER"
                      ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
                      : msg.sender === "AGENT"
                      ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-400"
                      : "bg-rose-600/20 border-rose-500/40 text-rose-400"
                  }`}
                >
                  {msg.sender === "CUSTOMER" ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>

                {/* Bubble */}
                <div className="flex flex-col gap-1">
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.sender === "CUSTOMER"
                        ? "bg-blue-600 text-white rounded-tr-none shadow-md"
                        : msg.sender === "AGENT"
                        ? "bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-tl-none shadow-md"
                        : "bg-rose-950/50 border border-rose-800 text-rose-200 rounded-tl-none"
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Tool Execution Badges (Under Agent Messages) */}
                  {msg.toolLogs && msg.toolLogs.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5 pl-1">
                      {msg.toolLogs.map((log, idx) => (
                        <div
                          key={idx}
                          className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border font-mono ${
                            log.policyOutcome === "PASS"
                              ? "bg-emerald-950/60 text-emerald-300 border-emerald-800"
                              : log.policyOutcome === "ESCALATE"
                              ? "bg-purple-950/60 text-purple-300 border-purple-800"
                              : "bg-rose-950/60 text-rose-300 border-rose-800"
                          }`}
                          title={`Tool Input: ${JSON.stringify(log.toolInput)}\nOutcome: ${log.policyOutcome}`}
                        >
                          <Wrench className="w-3 h-3" />
                          <span>tool: {log.toolName}</span>
                          <span className="font-bold">
                            [{log.policyOutcome === "PASS" ? "PASSED" : log.policyOutcome}]
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Typing / Agent Processing Indicator */}
          {isLoading && (
            <div className="flex items-center gap-3 text-slate-400 text-xs pl-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center animate-pulse">
                <Bot className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/60 px-3 py-2 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Agent reasoning & evaluating refund rules...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message (e.g. 'I want a refund for ORD-1001')..."
            className="flex-1 bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !inputText.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white disabled:text-slate-500 px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2 shadow-sm"
          >
            <span>Send</span>
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Side Details Panel: Current Order Inspection */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col h-[680px]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-400" />
            Order Context Preview
          </h3>
          {currentOrder && (
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {currentOrder.orderNumber}
            </span>
          )}
        </div>

        {currentOrder ? (
          <div className="space-y-4 flex-1 overflow-y-auto text-xs">
            {/* Customer & Dates */}
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Customer:</span>
                <span className="text-slate-200 font-medium">{currentOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Purchase Date:</span>
                <span className="text-slate-200">
                  {new Date(currentOrder.purchaseDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Days Elapsed:</span>
                <span
                  className={`font-semibold ${
                    currentOrder.daysSinceDelivery > 30 ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {currentOrder.daysSinceDelivery} days (Limit: 30)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono border border-slate-700">
                  {currentOrder.status}
                </span>
              </div>
            </div>

            {/* Items List */}
            <div>
              <h4 className="font-medium text-slate-300 mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                Order Items ({currentOrder.items?.length || 0})
              </h4>
              <div className="space-y-2">
                {currentOrder.items?.map((item: any) => (
                  <div
                    key={item.id}
                    className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium text-slate-200">{item.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {item.sku} • {item.category}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-200">${item.unitPrice.toFixed(2)}</p>
                      {item.refunded && (
                        <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/30">
                          Refunded
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 space-y-1.5 pt-3">
              <div className="flex justify-between text-slate-400">
                <span>Order Total:</span>
                <span className="text-slate-200 font-semibold">${currentOrder.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Already Refunded:</span>
                <span className="text-amber-400 font-semibold">${(currentOrder.alreadyRefundedAmount || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
            <Package className="w-10 h-10 stroke-1 text-slate-600" />
            <p className="text-xs">No active order details loaded yet.</p>
            <p className="text-[11px] text-slate-600">
              When RefundBot executes <code className="text-emerald-400">get_order_details</code>, order metadata will display here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
