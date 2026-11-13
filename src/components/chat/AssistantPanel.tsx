"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { WhatsAppIcon } from "@/components/ui/icons";
import { CHAT_MAX_LENGTH, type ChatMessage } from "@/lib/chat";
import type { ChatProduct } from "./chat-product-store";
import { ChatProductCard } from "./ChatProductCard";

type Props = {
  greeting: string;
  messages: ChatMessage[];
  sending: boolean;
  handoff: boolean;
  product: ChatProduct | null;
  whatsappLink: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onSend: (text: string) => void;
};

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.from === "customer";
  return (
    <li className={`flex flex-col gap-2 ${mine ? "items-end" : "items-start"}`} data-testid={`chat-message-${message.from}`}>
      <p
        className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
          mine ? "rounded-br-sm bg-accent text-white" : "rounded-tl-sm bg-sand"
        }`}
      >
        {message.text}
      </p>
      {message.products.length > 0 && (
        <ul className="w-full space-y-2">
          {message.products.map((p) => (
            <li key={p.code}>
              <ChatProductCard product={p} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** The conversation with the AI assistant, plus a route to a person at all times. */
export function AssistantPanel({ greeting, messages, sending, handoff, product, whatsappLink, inputRef, onSend }: Props) {
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, sending]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    onSend(text);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" data-testid="chat-log">
        <ul className="space-y-3" role="log" aria-live="polite" aria-label="Conversation">
          <Bubble message={{ id: "greeting", from: "assistant", text: greeting, products: [] }} />
          {messages.map((m) => (
            <Bubble key={m.id} message={m} />
          ))}
          {sending && (
            <li className="flex" data-testid="chat-typing">
              <p className="rounded-2xl rounded-tl-sm bg-sand px-4 py-2.5 text-sm text-muted">
                <span className="sr-only">The assistant is replying</span>
                <span aria-hidden className="inline-flex gap-1">
                  <span className="size-1.5 animate-pulse rounded-full bg-muted" />
                  <span className="size-1.5 animate-pulse rounded-full bg-muted [animation-delay:150ms]" />
                  <span className="size-1.5 animate-pulse rounded-full bg-muted [animation-delay:300ms]" />
                </span>
              </p>
            </li>
          )}
        </ul>
        <div ref={end} />
      </div>

      <div className="border-t border-line p-3">
        {product && (
          <p className="mb-2 px-1 text-xs text-muted" data-testid="chat-product">
            You are viewing <strong className="font-medium text-ink">{product.name}</strong> (ID: {product.code}).
          </p>
        )}
        <form onSubmit={submit} className="flex items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Your message
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={CHAT_MAX_LENGTH}
            placeholder="Type your message"
            data-testid="chat-input"
            className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-canvas px-4 py-2.5 text-base sm:text-sm"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            data-testid="chat-send"
            className="min-h-11 rounded-full bg-accent px-5 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
          >
            Send
          </button>
        </form>
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="chat-start"
          className={`mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${
            handoff
              ? "bg-whatsapp text-white hover:bg-whatsapp-dark"
              : "border border-whatsapp text-whatsapp-dark hover:bg-whatsapp hover:text-white"
          }`}
        >
          <WhatsAppIcon /> Talk to a person on WhatsApp
        </a>
        <p className="mt-2 text-center text-[0.7rem] leading-snug text-muted" data-testid="chat-disclosure">
          You are chatting with an AI assistant. It can make mistakes; the owner confirms every sale.
        </p>
      </div>
    </>
  );
}
