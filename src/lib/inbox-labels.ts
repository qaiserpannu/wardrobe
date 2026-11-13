/** Plain-language names for conversation records, shared by the dashboard and the inbox. */

export const REQUEST_LABELS = {
  purchase_request: "Wants to buy",
  cannot_answer: "Question for you",
  human_requested: "Asked for a person",
} as const;

export const STATE_LABELS = {
  agent: "Assistant is answering",
  waiting_for_owner: "Waiting for you",
  owner: "You are answering",
  closed: "Closed",
} as const;

export const CHANNEL_LABELS = { web: "Website chat", whatsapp: "WhatsApp" } as const;

export const STAGE_LABELS = {
  inquiry: "Asked about it",
  purchase_request: "Wants to buy it",
  reservation_request: "Asked to reserve it",
  completed: "Completed",
} as const;
