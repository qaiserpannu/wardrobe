import "server-only";
import type { AgentModel } from "../types";
import { createAnthropicModel } from "./anthropic";
import { createTestModel } from "./test";

/**
 * Which AI provider is in use is decided by environment variables only, so
 * swapping provider never touches the agent itself.
 *   AI_PROVIDER=anthropic (default) needs ANTHROPIC_API_KEY
 *   AI_PROVIDER=test                is the automated-test stand-in
 */
function providerName(): "anthropic" | "test" | null {
  const name = (process.env.AI_PROVIDER ?? "anthropic").trim().toLowerCase();
  if (name === "test") return "test";
  if (name === "anthropic") {
    return process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN ? "anthropic" : null;
  }
  return null;
}

/** False when no provider is set up; the site then falls back to the plain WhatsApp button. */
export function isAgentConfigured(): boolean {
  return providerName() !== null;
}

let cached: AgentModel | undefined;

export function getAgentModel(): AgentModel {
  const name = providerName();
  if (!name) throw new Error("No AI provider is configured.");
  cached ??= name === "test" ? createTestModel() : createAnthropicModel();
  return cached;
}
