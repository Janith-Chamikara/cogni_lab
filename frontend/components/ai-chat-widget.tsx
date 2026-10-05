"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { Check, RotateCcw, Send, Square, X } from "lucide-react";
import {
  buildChatRequest,
  getAiPageContext,
  inferPageType,
  type AiChatMessage,
} from "@/lib/ai-context";
import {
  clearVisualGuidance,
  collectGuidanceSnapshot,
  executeGuidance,
} from "@/lib/ai-guidance";
import { AiGuidanceOverlay } from "./ai-guidance-overlay";
import { AiMessageContent } from "./ai-message-content";

type Message = AiChatMessage & { toolsUsed?: string[] };
const welcome: Message = {
  role: "assistant",
  content:
    "Hi! What are you working on today?\n\nWe can work through a tricky step, check a calculation, or look at what’s happening in your circuit. If you can’t find a control, I can point it out in blue.\n\nTell me where you’re stuck, and we’ll take it one step at a time.",
};
const evidenceLabels: Record<string, string> = {
  inspect_lab: "Lab guide consulted",
  inspect_workspace: "Workspace checked",
  calculate: "Calculation checked",
  guide_ui: "Visual guidance",
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
  const router = useRouter();
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
    clearVisualGuidance();
    try {
      const snapshot = collectGuidanceSnapshot(content);
      const token = await getToken();
      if (!token) throw new Error("Sign in again, then we can continue.");
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!baseUrl)
        throw new Error(
          "I’m not set up here yet. Please let your instructor know.",
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
        body: JSON.stringify(
          buildChatRequest(next, getAiPageContext(), snapshot?.screen),
        ),
      });
      if (!response.ok) {
        const errors: Record<number, string> = {
          400: "I couldn’t read your current lab setup. Refresh the lab, then ask again.",
          401: "Your sign-in has expired. Sign in again, then we can continue.",
          403: "This request isn’t available to your account. Please check with your instructor.",
          404: "This lab is no longer available. Return to your dashboard and reopen it.",
          429: "I’m busy right now. Give it a moment, then try again.",
          502: "I couldn’t finish that answer. Try again, or ask about one part at a time.",
          503: "I can’t connect right now. Please try again shortly.",
          504: "That took longer than expected. Try again, or ask about one part at a time.",
        };
        throw new Error(
          errors[response.status] ??
            "I couldn’t respond just now. Please try again.",
        );
      }
      const data: unknown = await response.json();
      const result = data as {
        reply?: unknown;
        toolsUsed?: unknown;
        guidance?: unknown;
      } | null;
      if (!result || typeof result.reply !== "string" || !result.reply.trim())
        throw new Error("I couldn’t finish that answer. Please try again.");
      if (requestRef.current !== controller) return;
      const reply = result.reply.trim().slice(0, 4000);
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
      if (result.guidance) {
        const panel = document
          .getElementById("ai-chat-panel")
          ?.getBoundingClientRect();
        const targetId =
          typeof result.guidance === "object" &&
          result.guidance !== null &&
          "targetId" in result.guidance
            ? result.guidance.targetId
            : undefined;
        const target =
          typeof targetId === "string"
            ? snapshot?.elements.get(targetId)?.element.getBoundingClientRect()
            : undefined;
        if (
          panel &&
          target &&
          target.left < panel.right &&
          target.right > panel.left &&
          target.top < panel.bottom &&
          target.bottom > panel.top
        )
          setOpen(false);
        await executeGuidance(
          result.guidance,
          snapshot,
          content,
          (href) => router.push(href),
          controller.signal,
        );
      }
    } catch (failure) {
      if (requestRef.current !== controller) return;
      setError(
        controller.signal.aborted
          ? "Stopped. You can retry when you’re ready."
          : failure instanceof Error && failure.name === "TimeoutError"
            ? "That took longer than expected. Please try again."
            : failure instanceof TypeError
              ? "I couldn’t connect. Check your connection, then try again."
              : failure instanceof Error
                ? failure.message
                : "I couldn’t respond just now. Please try again.",
      );
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setSending(false);
      }
    }
  };

  const newChat = () => {
    clearVisualGuidance();
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
            className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-muted/20 p-4"
          >
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`min-w-0 rounded-2xl text-sm ${message.role === "user" ? "max-w-[88%] whitespace-pre-wrap break-words rounded-br-md bg-primary px-3.5 py-2.5 leading-relaxed text-primary-foreground" : "w-full rounded-bl-md border border-border/60 bg-background px-4 py-3.5 text-foreground shadow-sm"}`}
                >
                  <span className="sr-only">
                    {message.role === "user" ? "You: " : "Assistant: "}
                  </span>
                  {message.role === "assistant" ? (
                    <AiMessageContent content={message.content} />
                  ) : (
                    message.content
                  )}
                </div>
                {Boolean(message.toolsUsed?.length) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.toolsUsed?.map((tool) => (
                      <span
                        key={tool}
                        className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        <Check
                          aria-hidden="true"
                          className="h-3 w-3 text-primary"
                        />
                        {evidenceLabels[tool]}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <p
                role="status"
                className="animate-pulse text-xs text-muted-foreground"
              >
                Let’s take a look…
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
                placeholder="What would you like a hand with?"
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
    <>
      <AiGuidanceOverlay key={userId} route={pathname} />
      <ChatSession
        key={`${userId}:${pathname}`}
        userId={userId}
        pathname={pathname}
      />
    </>
  );
}
