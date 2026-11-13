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
  /** "owner" is the shop owner writing in person from the admin inbox. */
  from: "customer" | "assistant" | "owner";
  text: string;
  products: ChatProductCard[];
};

export type ChatReply = {
  message: ChatMessage;
  handoff: boolean;
  /** The customer is waiting for the owner; the widget checks back for the owner's reply. */
  awaitingOwner: boolean;
};

export type ChatHistory = { messages: ChatMessage[]; awaitingOwner: boolean };

export const CHAT_MAX_LENGTH = 1000;
