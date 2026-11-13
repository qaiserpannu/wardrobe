"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { CloseIcon, WhatsAppIcon } from "@/components/ui/icons";
import { buildChatLink, type ChatLinkConfig } from "@/integrations/whatsapp";
import { AssistantPanel } from "./AssistantPanel";
import {
  getChatProduct,
  getServerChatProduct,
  subscribeChatProduct,
} from "./chat-product-store";
import { useAssistantChat } from "./use-assistant-chat";

type Props = {
  siteName: string;
  title: string;
  greeting: string;
  position: "right" | "left";
  whatsapp: ChatLinkConfig;
  /** Present when the AI assistant is switched on and set up; otherwise the panel is WhatsApp-only. */
  assistant: { name: string; greeting: string } | null;
};

/**
 * Floating chat button. With the AI assistant on, the panel is a conversation
 * with it, with a WhatsApp link to a person always visible. Without it, the
 * panel is a greeting and a button that starts a WhatsApp conversation
 * (official click-to-chat link). On a product page both know which item the
 * visitor is looking at.
 */
export function ChatWidget({
  siteName,
  title,
  greeting,
  position,
  whatsapp,
  assistant,
}: Props) {
  const [open, setOpen] = useState(false);
  const product = useSyncExternalStore(
    subscribeChatProduct,
    getChatProduct,
    getServerChatProduct,
  );
  const panelId = useId();
  const launcher = useRef<HTMLButtonElement>(null);
  const start = useRef<HTMLAnchorElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const chat = useAssistantChat();
  const loadHistory = chat.loadHistory;

  const link = buildChatLink(whatsapp, product);

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) launcher.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    if (assistant) {
      input.current?.focus();
      void loadHistory();
    } else {
      start.current?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node))
        close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, assistant, loadHistory]);

  if (!link) return null;

  const side =
    position === "left"
      ? "left-4 sm:left-6 items-start"
      : "right-4 sm:right-6 items-end";

  return (
    <div
      ref={root}
      data-testid="chat-widget"
      className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex flex-col gap-3 sm:bottom-6 ${side} print:hidden`}
    >
      {open && (
        <section
          id={panelId}
          role="dialog"
          aria-label={title}
          data-testid="chat-panel"
          data-mode={assistant ? "assistant" : "whatsapp"}
          className={`flex w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-xl ${
            assistant ? "h-[min(36rem,calc(100dvh-7.5rem))]" : ""
          }`}
        >
          <header className="flex shrink-0 items-start justify-between gap-3 bg-accent px-5 py-4 text-white">
            <div>
              <p className="font-display text-xl leading-tight font-medium">
                {assistant ? assistant.name : title}
              </p>
              <p className="mt-0.5 text-xs text-white/80">
                {siteName} ·{" "}
                {assistant ? "here to help you find a piece" : "replies on WhatsApp"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => close(true)}
              aria-label="Close chat"
              className="-mt-1 -mr-2 flex size-10 items-center justify-center rounded-full hover:bg-white/15"
            >
              <CloseIcon className="size-5" />
            </button>
          </header>
          {assistant ? (
            <AssistantPanel
              name={assistant.name}
              greeting={assistant.greeting}
              messages={chat.messages}
              sending={chat.sending}
              handoff={chat.handoff}
              product={product}
              whatsappLink={link}
              inputRef={input}
              onSend={(text) => void chat.send(text, product?.code)}
            />
          ) : (
            <div className="space-y-4 p-5">
              <p className="rounded-2xl rounded-tl-sm bg-sand px-4 py-3 text-sm leading-relaxed">
                {greeting}
              </p>
              {product && (
                <p
                  className="text-xs leading-relaxed text-muted"
                  data-testid="chat-product"
                >
                  Your message will mention{" "}
                  <strong className="font-medium text-ink">
                    {product.name}
                  </strong>{" "}
                  (ID: {product.code}).
                </p>
              )}
              <a
                ref={start}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="chat-start"
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-whatsapp px-6 text-sm font-medium tracking-wide text-white transition-colors hover:bg-whatsapp-dark"
              >
                <WhatsAppIcon />{" "}
                {product
                  ? "Ask about this item on WhatsApp"
                  : "Start chat on WhatsApp"}
              </a>
              <p className="text-center text-xs text-muted">
                Opens WhatsApp in a new tab or in the app.
              </p>
            </div>
          )}
        </section>
      )}
      <button
        ref={launcher}
        type="button"
        onClick={() => (open ? close(false) : setOpen(true))}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label="Chat with us on WhatsApp"
        data-testid="chat-launcher"
        className="flex size-14 items-center justify-center rounded-full bg-whatsapp text-white shadow-lg ring-1 ring-black/5 transition-colors hover:bg-whatsapp-dark"
      >
        {open ? (
          <CloseIcon className="size-6" />
        ) : (
          <WhatsAppIcon className="size-7" />
        )}
      </button>
    </div>
  );
}
