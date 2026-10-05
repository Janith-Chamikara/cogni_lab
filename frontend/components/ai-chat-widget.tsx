"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { RotateCcw, Send, Square, X } from "lucide-react";
import {
  buildChatRequest,
  getAiPageContext,
  inferPageType,
  type AiChatMessage,
} from "@/lib/ai-context";

type Message = AiChatMessage & { toolsUsed?: string[] };
const welcome: Message = {
  role: "assistant",
  content:
    "Hi! I can explain lab steps, help troubleshoot your circuit, and work through calculations with you.",
};
const evidenceLabels: Record<string, string> = {
  inspect_lab: "Lab guide consulted",
  inspect_workspace: "Workspace checked",
  calculate: "Calculation checked",
};

const readHistory = (key: string): Message[] => {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (!Array.isArray(value)) return [welcome];
    const messages = value
      .filter((item: unknown): item is Message => {
        if (!item || typeof item !== "object") return false;
        const message = item as Partial<Message>;
        return (
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.length > 0 &&
          message.content.length <= 4000
        );
      })
      .slice(-40)
      .map((item) => ({
        role: item.role,
        content: item.content,
        toolsUsed: Array.isArray(item.toolsUsed)
          ? item.toolsUsed.filter(
              (tool) => typeof tool === "string" && evidenceLabels[tool],
            )
          : undefined,
      }));
    return messages.length ? messages : [welcome];
  } catch {
    return [welcome];
  }
};

function ChatSession({
  userId,
  pathname,
}: {
  userId: string;
  pathname: string;
}) {
  const { getToken } = useAuth();
  const storageKey = `cogni-ai:${userId}:${pathname}`;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [labName, setLabName] = useState<string | undefined>();
  const requestRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const saved = readHistory(storageKey);
    queueMicrotask(() => {
      setMessages(saved);
      setReady(true);
    });
    return () => {
      requestRef.current?.abort();
    };
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-40)));
    } catch {}
  }, [messages, ready, storageKey]);

  useEffect(() => {
    const update = () => setLabName(getAiPageContext().lab?.name);
    queueMicrotask(update);
    window.addEventListener("cogni-ai-context", update);
    return () => window.removeEventListener("cogni-ai-context", update);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending, error, open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  const send = async (prompt?: string, retry = false) => {
    const content = (prompt ?? input).trim();
    if (!content || content.length > 4000 || requestRef.current || !ready)
      return;
    const next = retry
      ? messages
      : [...messages, { role: "user" as const, content }];
    const controller = new AbortController();
    requestRef.current = controller;
    setMessages(next.slice(-40));
    if (!prompt) setInput("");
    setSending(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again to continue chatting.");
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!baseUrl)
        throw new Error(
          "The assistant is not configured yet. Please contact your instructor.",
        );
      controller.signal.throwIfAborted();
      const response = await fetch(`${baseUrl}/ai/chat`, {
        method: "POST",
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(70000),
        ]),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(buildChatRequest(next)),
      });
      if (!response.ok) {
        const errors: Record<number, string> = {
          400: "The lab context could not be read. Try refreshing the lab and asking again.",
          401: "Your session expired. Please sign in again.",
          403: "You do not have access to this assistant request.",
          404: "This lab is no longer available. Return to your dashboard and reopen it.",
          429: "The assistant is busy. Please wait a moment and retry.",
          502: "The assistant could not finish its answer. Please retry or ask a shorter question.",
          503: "The assistant is temporarily unavailable. Please retry shortly.",
          504: "The assistant took too long. Please retry or ask a shorter question.",
        };
        throw new Error(
          errors[response.status] ??
            "The assistant could not respond. Please retry.",
        );
      }
      const data: unknown = await response.json();
      const result = data as { reply?: unknown; toolsUsed?: unknown } | null;
      if (!result || typeof result.reply !== "string" || !result.reply.trim())
        throw new Error(
          "The assistant returned an empty answer. Please retry.",
        );
      if (requestRef.current !== controller) return;
      const reply = result.reply.replace(/\*\*/g, "").trim().slice(0, 4000);
      const toolsUsed = Array.isArray(result.toolsUsed)
        ? result.toolsUsed.filter(
            (tool): tool is string =>
              typeof tool === "string" && Boolean(evidenceLabels[tool]),
          )
        : [];
      setMessages(
        [
          ...next,
          { role: "assistant" as const, content: reply, toolsUsed },
        ].slice(-40),
      );
    } catch (failure) {
      if (requestRef.current !== controller) return;
      setError(
        controller.signal.aborted
          ? "Response stopped. Retry when you are ready."
          : failure instanceof Error && failure.name === "TimeoutError"
            ? "The assistant took too long. Please retry."
            : failure instanceof TypeError
              ? "Could not reach the assistant. Check your connection and retry."
              : failure instanceof Error
                ? failure.message
                : "The assistant could not respond. Please retry.",
      );
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setSending(false);
      }
    }
  };

  const newChat = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setSending(false);
    setMessages([welcome]);
    setInput("");
    setError(null);
    inputRef.current?.focus();
  };
  const isLab = inferPageType(pathname) === "student-lab";
  const suggestions = isLab
    ? ["Explain this step", "Give me a hint", "Help troubleshoot my circuit"]
    : [
        "What can I do here?",
        "Explain a lab concept",
        "Help with a calculation",
      ];
  const retryMessage =
    messages.at(-1)?.role === "user" ? messages.at(-1)?.content : undefined;

  return (
    <div id="ai-chat-widget">
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full border bg-background shadow-lg transition hover:shadow-xl focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={open ? "Close lab assistant" : "Open lab assistant"}
        aria-expanded={open}
        aria-controls="ai-chat-panel"
      >
        <Image
          src="/Avatar.png"
          alt=""
          width={52}
          height={52}
          className="rounded-full object-cover"
        />
      </button>
      {open && (
        <section
          id="ai-chat-panel"
          role="dialog"
          aria-labelledby="ai-chat-title"
          className="fixed bottom-[104px] right-3 z-50 flex h-[540px] w-[440px] max-h-[calc(100dvh-128px)] max-w-[calc(100vw-24px)] flex-col rounded-xl border bg-background shadow-xl sm:right-6"
        >
          <div className="flex items-center gap-3 border-b p-4">
            <Image
              src="/Avatar.png"
              alt=""
              width={36}
              height={36}
              className="rounded-full"
            />
            <div className="min-w-0 flex-1">
              <h2 id="ai-chat-title" className="text-sm font-semibold">
                Lab Assistant
              </h2>
              <p className="truncate text-xs text-muted-foreground">
                {labName ?? "Learning support"}
              </p>
            </div>
            <button
              type="button"
              onClick={newChat}
              disabled={!ready}
              className="rounded-md p-2 hover:bg-muted"
              aria-label="Start a new chat"
              title="New chat"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                toggleRef.current?.focus();
              }}
              className="rounded-md p-2 hover:bg-muted"
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div
            ref={scrollRef}
            role="log"
            aria-label="Conversation"
            aria-live="polite"
            aria-relevant="additions"
            className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
          >
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[92%] whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-sm leading-relaxed ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
                >
                  <span className="sr-only">
                    {message.role === "user" ? "You: " : "Assistant: "}
                  </span>
                  {message.content}
                </div>
                {Boolean(message.toolsUsed?.length) && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {message.toolsUsed
                      ?.map((tool) => evidenceLabels[tool])
                      .join(" · ")}
                  </p>
                )}
              </div>
            ))}
            {sending && (
              <p
                role="status"
                className="animate-pulse text-xs text-muted-foreground"
              >
                Checking your question…
              </p>
            )}
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 p-3 text-sm"
              >
                <p>{error}</p>
                {retryMessage && (
                  <button
                    type="button"
                    onClick={() => void send(retryMessage, true)}
                    disabled={sending}
                    className="mt-2 font-medium underline disabled:opacity-50"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="space-y-3 border-t p-3">
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void send(suggestion)}
                  disabled={sending || !ready}
                  className="rounded-full border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
              className="flex items-end gap-2"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    void send();
                  }
                }}
                maxLength={4000}
                rows={2}
                placeholder="Ask about your lab…"
                aria-label="Message to lab assistant"
                className="max-h-28 min-h-16 min-w-0 flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary"
              />
              {sending ? (
                <button
                  type="button"
                  onClick={() => requestRef.current?.abort()}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border hover:bg-muted"
                  aria-label="Stop response"
                >
                  <Square className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() || !ready}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </form>
          </div>
        </section>
      )}
    </div>
  );
}

export function AiChatWidget() {
  const pathname = usePathname();
  const { userId } = useAuth();
  if (
    !userId ||
    !pathname ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up")
  )
    return null;
  return (
    <ChatSession
      key={`${userId}:${pathname}`}
      userId={userId}
      pathname={pathname}
    />
  );
}
