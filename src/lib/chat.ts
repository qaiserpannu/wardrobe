/** Shapes shared by the chat API and the chat widget. */

export type ChatProductCard = {
  code: string;
  name: string;
  href: string;
  price: string;
  size: string | null;
  condition: string;
  status: "available" | "pending" | "sold";
  image: { url: string; alt: string } | null;
};

export type ChatMessage = {
  id: string;
  from: "customer" | "assistant";
  text: string;
  products: ChatProductCard[];
};

export type ChatReply = { message: ChatMessage; handoff: boolean };

export const CHAT_MAX_LENGTH = 1000;
