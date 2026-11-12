/**
 * Remembers which product the visitor is currently viewing, so the floating
 * chat button (which lives in the page frame) can mention it. Browser-only,
 * nothing is stored or sent anywhere.
 */
export type ChatProduct = { name: string; code: string; url: string };

let current: ChatProduct | null = null;
const listeners = new Set<() => void>();

export function setChatProduct(product: ChatProduct | null) {
  current = product;
  listeners.forEach((l) => l());
}

export function subscribeChatProduct(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getChatProduct(): ChatProduct | null {
  return current;
}

export function getServerChatProduct(): ChatProduct | null {
  return null;
}
