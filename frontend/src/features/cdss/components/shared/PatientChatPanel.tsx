"use client";

import { useEffect, useRef, useState } from "react";
import { BrainCircuit, Send, Trash2, Loader2, User, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { chatWithPatient, type ChatMessage } from "@/features/cdss/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";

interface PatientChatPanelProps {
  patientId: string;
  patientName?: string;
  /** Pre-seeded message that is auto-sent when the panel first mounts. */
  initialMessage?: string;
  className?: string;
}

const SUGGESTED_PROMPTS = [
  "Summarize the key clinical concerns for this patient.",
  "Are there any drug interaction risks I should know about?",
  "What follow-up actions are recommended based on the current data?",
  "Are there any care gaps or missing screenings for this patient?",
];

/** Render assistant messages with basic Markdown (headers, bullets, bold). */
function MessageContent({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-0.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <p key={i} className="mt-2 font-semibold text-sky-300 first:mt-0">
              {line.slice(3)}
            </p>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          const content = line.slice(2);
          const isCritical = /\bCRITICAL\b/.test(content);
          const isWarning = /\bWARNING\b/.test(content);
          return (
            <div key={i} className="flex items-start gap-1.5 pl-1">
              <span
                className={cn(
                  "mt-2 size-1.5 shrink-0 rounded-full",
                  isCritical ? "bg-red-400" : isWarning ? "bg-amber-400" : "bg-slate-400",
                )}
              />
              <span
                className={cn(
                  isCritical && "font-medium text-red-300",
                  isWarning && "font-medium text-amber-300",
                )}
              >
                {content}
              </span>
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i}>
            {parts.map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={j} className="font-semibold">
                  {part.slice(2, -2)}
                </strong>
              ) : (
                part
              ),
            )}
          </p>
        );
      })}
    </div>
  );
}

export function PatientChatPanel({
  patientId,
  patientName,
  initialMessage,
  className,
}: PatientChatPanelProps) {
  const token = useAuthStore((state) => state.token);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sentInitialRef = useRef(false);
  const loadingRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  useEffect(() => {
    if (initialMessage && !sentInitialRef.current) {
      sentInitialRef.current = true;
      void handleSend(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSend(messageOverride?: string) {
    const message = (messageOverride ?? input).trim();
    if (!message || loadingRef.current) return;

    loadingRef.current = true;
    setInput("");
    setError(null);
    setLoading(true);

    const historySnapshot = history;

    const userTurn: ChatMessage = { role: "user", content: message };
    setHistory((prev) => [...prev, userTurn]);

    try {
      const result = await chatWithPatient(patientId, message, historySnapshot, token);
      setHistory(result.history);
    } catch (err) {
      setHistory(historySnapshot);
      setError(err instanceof Error ? err.message : "Failed to get a response.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-slate-800/70 bg-slate-950 text-slate-100",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-sky-400" />
          <span className="text-sm font-semibold">AI Clinical Assistant</span>
          {patientName && (
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-300">
              {patientName}
            </span>
          )}
        </div>
        {history.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs text-slate-400 hover:text-red-400"
            onClick={() => { setHistory([]); setError(null); }}
          >
            <Trash2 className="h-3 w-3" /> Clear
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" style={{ height: "420px" }}>
        <div className="flex flex-col gap-3 px-4 py-3">
          {/* Empty state with suggested prompts */}
          {history.length === 0 && !loading && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <BrainCircuit className="h-9 w-9 text-slate-700" />
              <div>
                <p className="text-sm font-medium text-slate-400">Ask MedGemma anything</p>
                <p className="mt-1 text-xs text-slate-600">
                  Questions are grounded in this patient's live Knowledge Graph
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-sm">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-left text-xs text-slate-400 hover:border-sky-700/50 hover:bg-sky-950/30 hover:text-slate-300 transition-colors"
                    onClick={() => void handleSend(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conversation */}
          {history.map((message, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-2.5",
                message.role === "user" ? "flex-row-reverse" : "flex-row",
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  message.role === "user"
                    ? "bg-sky-600 text-white"
                    : "bg-slate-800 text-sky-400",
                )}
              >
                {message.role === "user" ? (
                  <User className="h-3.5 w-3.5" />
                ) : (
                  <Bot className="h-3.5 w-3.5" />
                )}
              </div>

              {/* Bubble */}
              <div
                className={cn(
                  "max-w-[78%] rounded-2xl px-3.5 py-2.5",
                  message.role === "user"
                    ? "rounded-tr-sm bg-sky-600 text-white"
                    : "rounded-tl-sm border border-slate-800 bg-slate-900 text-slate-200",
                )}
              >
                {message.role === "user" ? (
                  <p className="text-sm leading-relaxed">{message.content}</p>
                ) : (
                  <MessageContent text={message.content} />
                )}
              </div>
            </div>
          ))}

          {/* Loading bubble */}
          {loading && (
            <div className="flex items-start gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sky-400">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div className="rounded-2xl rounded-tl-sm border border-slate-800 bg-slate-900 px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
                  <span className="text-xs text-slate-400">MedGemma is thinking…</span>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-slate-800/70 px-3 py-2.5">
        <div className="flex items-end gap-2 rounded-xl border border-slate-700/60 bg-slate-900 px-3 py-2 focus-within:border-sky-600/50">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this patient…"
            disabled={loading}
            className="flex-1 resize-none bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none disabled:opacity-50"
            style={{ minHeight: "24px", maxHeight: "96px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
          />
          <Button
            size="icon"
            className="h-7 w-7 shrink-0 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40"
            onClick={() => void handleSend()}
            disabled={loading || !input.trim()}
            aria-label="Send"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-slate-600">
          Shift+Enter for new line · Enter to send · Grounded in Knowledge Graph
        </p>
      </div>
    </div>
  );
}
