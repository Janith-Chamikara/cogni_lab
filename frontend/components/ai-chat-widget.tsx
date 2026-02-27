"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import {
  buildChatPayload,
  buildDynamicHints,
  getAiPageContext,
  getPageSnapshot,
  inferPageType,
  setAiPageContext,
} from "@/lib/ai-context";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

const normalizeAiReply = (content: string) =>
  content
    .replace(/\*\*/g, "")
    .replace(/^\s*\d+\.\s+/gm, "- ")
    .replace(/^\s*•\s+/gm, "- ")
    .trim();

export function AiChatWidget() {
  const pathname = usePathname();
  const isAuthPage =
    pathname?.startsWith("/sign-in") || pathname?.startsWith("/sign-up");

  const { getToken } = useAuth();
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [isChatSending, setIsChatSending] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi, how can I help you today?" },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    if (!pathname) return;
    setAiPageContext({
      route: pathname,
      pageTitle: typeof document !== "undefined" ? document.title : undefined,
      pageType: inferPageType(pathname),
    });
  }, [pathname]);

  const handleChatSend = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || isChatSending) return;

    const newMessage = { role: "user" as const, content: trimmed };
    const nextMessages = [...chatMessages, newMessage];

    setChatMessages(nextMessages);
    setChatInput("");
    setIsChatSending(true);

    try {
      const token = await getToken();
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

      if (!token) {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Please sign in to use AI chat." },
        ]);
        return;
      }

      if (!baseUrl) {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Missing NEXT_PUBLIC_API_BASE_URL." },
        ]);
        return;
      }

      const context = getAiPageContext();
      const pageText = getPageSnapshot({ maxChars: 900 });
      const dynamicHints = buildDynamicHints({
        lastUserMessage: trimmed,
        context,
      });
      const mergedHints = Array.from(
        new Set([...(context.hints ?? []), ...dynamicHints]),
      );
      const payloadMessages = buildChatPayload(nextMessages, {
        ...context,
        route: pathname ?? context.route,
        pageTitle:
          typeof document !== "undefined" ? document.title : context.pageTitle,
        pageText,
        hints: mergedHints.length ? mergedHints : undefined,
      });

      const response = await fetch(`${baseUrl}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: payloadMessages }),
      });

      if (!response.ok) {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: "AI request failed." },
        ]);
        return;
      }

      const data = await response.json();
      const reply = normalizeAiReply(
        data?.reply || "Sorry, I couldn't respond.",
      );
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply },
      ]);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Failed to reach the AI service." },
      ]);
    } finally {
      setIsChatSending(false);
    }
  };

  if (isAuthPage) return null;

  return (
    <div id="ai-chat-widget">
      <button
        type="button"
        onClick={() => setIsAiChatOpen((open) => !open)}
        className="fixed bottom-6 right-6 z-50 flex h-20 w-20 items-center justify-center rounded-full border border-white/40 bg-white/90 shadow-lg transition active:scale-95 hover:shadow-xl"
        aria-label="Toggle AI chat"
      >
        <Image
          src="/Avatar.png"
          alt="AI Assistant"
          width={64}
          height={64}
          className="rounded-full object-cover"
          priority
        />
      </button>

      {isAiChatOpen && (
        <div className="fixed bottom-[120px] right-6 z-50 h-[388px] w-[414px] max-h-[calc(100vh-160px)] max-w-[calc(100vw-48px)] rounded-[12px] border border-black/10 bg-white shadow-xl">
          <div className="flex h-full flex-col p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="relative h-9 w-9 overflow-hidden rounded-full border border-black/10">
                <Image
                  src="/Avatar.png"
                  alt="Assistant"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="text-sm font-semibold">Assistant</div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto pr-2">
              {chatMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`mb-2 flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                      message.role === "user"
                        ? "bg-[#1b1b1b] text-white"
                        : "bg-[#f2f2f2] text-black"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {isChatSending && (
                <div className="text-xs animate-pulse text-muted-foreground">
                  Assistant is thinking...
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                placeholder="Type your message..."
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleChatSend();
                }}
                className="h-10 flex-1 rounded-lg border border-black/10 bg-white px-3 text-sm text-black outline-none placeholder:text-neutral-400"
              />
              <button
                type="button"
                onClick={handleChatSend}
                disabled={isChatSending || !chatInput.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/10 bg-white text-black shadow-sm hover:bg-neutral-50 disabled:opacity-50"
                aria-label="Send"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22l-4-9-9-4z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
