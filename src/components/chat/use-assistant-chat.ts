"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatHistory, ChatMessage, ChatReply } from "@/lib/chat";

/** How often to look for the owner's reply while the customer is waiting for one. */
const OWNER_POLL_MS = 10_000;
const TROUBLE = "Sorry, something went wrong. Please try again, or message us on WhatsApp below.";

/** Conversation state for the AI assistant panel: earlier messages, sending, and replies. */
export function useAssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [awaitingOwner, setAwaitingOwner] = useState(false);
  const loaded = useRef(false);
  /** Stored messages already on screen, so the owner's replies are added once. */
  const seen = useRef(new Set<string>());
  const counter = useRef(0);

  /** Fetch earlier messages once, the first time the panel is opened. */
  const loadHistory = useCallback(async () => {
    if (loaded.current) return;
    loaded.current = true;
    try {
      const res = await fetch("/api/chat", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as ChatHistory;
      for (const m of data.messages) seen.current.add(m.id);
      setMessages((current) => (current.length ? current : data.messages));
      setAwaitingOwner(data.awaitingOwner);
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
      setAwaitingOwner(data.awaitingOwner);
    } catch {
      setMessages((current) => [...current, local("assistant", TROUBLE)]);
      setHandoff(true);
    } finally {
      setSending(false);
    }
  }, []);

  // While the customer waits for the owner, look for the owner's reply now and then.
  useEffect(() => {
    if (!awaitingOwner) return;
    const check = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/chat", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as ChatHistory;
        const fresh = data.messages.filter((m) => m.from === "owner" && !seen.current.has(m.id));
        for (const m of data.messages) seen.current.add(m.id);
        if (fresh.length) setMessages((current) => [...current, ...fresh]);
        setAwaitingOwner(data.awaitingOwner);
      } catch {
        // Try again at the next interval.
      }
    };
    const timer = setInterval(check, OWNER_POLL_MS);
    return () => clearInterval(timer);
  }, [awaitingOwner]);

  return { messages, sending, handoff, loadHistory, send };
}
