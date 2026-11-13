"use client";

import { useCallback, useRef, useState } from "react";
import type { ChatMessage, ChatReply } from "@/lib/chat";

const TROUBLE = "Sorry, something went wrong. Please try again, or message us on WhatsApp below.";

/** Conversation state for the AI assistant panel: earlier messages, sending, and replies. */
export function useAssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const loaded = useRef(false);
  const counter = useRef(0);

  /** Fetch earlier messages once, the first time the panel is opened. */
  const loadHistory = useCallback(async () => {
    if (loaded.current) return;
    loaded.current = true;
    try {
      const res = await fetch("/api/chat", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { messages: ChatMessage[] };
      setMessages((current) => (current.length ? current : data.messages));
    } catch {
      // A returning visitor simply starts fresh if history cannot be loaded.
    }
  }, []);

  const send = useCallback(async (text: string, productCode?: string) => {
    const local = (from: ChatMessage["from"], body: string): ChatMessage => ({
      id: `local-${++counter.current}`,
      from,
      text: body,
      products: [],
    });
    setMessages((current) => [...current, local("customer", text)]);
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, productCode }),
      });
      if (res.status === 429) {
        setMessages((current) => [...current, local("assistant", "Please wait a moment before sending another message.")]);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as ChatReply;
      setMessages((current) => [...current, data.message]);
      if (data.handoff) setHandoff(true);
    } catch {
      setMessages((current) => [...current, local("assistant", TROUBLE)]);
      setHandoff(true);
    } finally {
      setSending(false);
    }
  }, []);

  return { messages, sending, handoff, loadHistory, send };
}
