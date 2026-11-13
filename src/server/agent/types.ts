import "server-only";

/**
 * The agent core is neutral about both the channel (website, WhatsApp) and the
 * AI provider. A provider only has to implement AgentModel.
 */

export type HistoryMessage = { role: "user" | "assistant"; text: string };

export type AgentTool = {
  name: string;
  description: string;
  /** JSON Schema for the tool's input. */
  inputSchema: Record<string, unknown>;
};

export type ToolOutcome = { content: string; isError?: boolean };

export type TurnRequest = {
  system: string;
  /** Oldest first; the last entry is the customer's new message. */
  history: HistoryMessage[];
  tools: AgentTool[];
  runTool: (name: string, input: unknown) => Promise<ToolOutcome>;
};

export type TurnResult = {
  text: string;
  /** "refused" and "truncated" replies are not shown; the customer gets a safe fallback instead. */
  outcome: "ok" | "refused" | "truncated";
};

export interface AgentModel {
  runTurn(request: TurnRequest): Promise<TurnResult>;
}
