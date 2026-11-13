import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AgentModel, TurnRequest, TurnResult } from "../types";

const DEFAULT_MODEL = "claude-opus-5-5";
const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
type Effort = (typeof EFFORTS)[number];

/** A customer question should never need more than a handful of look-ups. */
const MAX_STEPS = 8;

function effort(): Effort {
  const value = process.env.AI_EFFORT as Effort | undefined;
  return value && EFFORTS.includes(value) ? value : "low";
}

/**
 * Claude through the official Anthropic SDK. The key is read from the
 * environment (ANTHROPIC_API_KEY) and never leaves the server.
 */
export function createAnthropicModel(): AgentModel {
  const client = new Anthropic({ timeout: 60_000, maxRetries: 2 });
  const model = process.env.AI_MODEL?.trim() || DEFAULT_MODEL;

  return {
    async runTurn(request: TurnRequest): Promise<TurnResult> {
      const tools: Anthropic.Beta.BetaTool[] = request.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Beta.BetaTool.InputSchema,
      }));
      const messages: Anthropic.Beta.BetaMessageParam[] = request.history.map((m) => ({
        role: m.role,
        content: m.text,
      }));

      for (let step = 0; step < MAX_STEPS; step++) {
        const response = await client.beta.messages.create({
          model,
          max_tokens: 16000,
          // If a safety check declines a harmless request, let the API retry it on its fallback model.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: request.system,
          tools,
          messages,
          thinking: { type: "adaptive" },
          output_config: { effort: effort() },
          // The instructions and tool list are identical on every request, so they are cached.
          cache_control: { type: "ephemeral" },
        });

        if (response.stop_reason === "refusal") return { text: "", outcome: "refused" };
        if (response.stop_reason === "max_tokens") return { text: "", outcome: "truncated" };

        if (response.stop_reason === "pause_turn") {
          messages.push({ role: "assistant", content: response.content });
          continue;
        }

        const toolUses = response.content.filter(
          (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
        );

        if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
          const text = response.content
            .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
            .map((b) => b.text)
            .join("\n")
            .trim();
          return { text, outcome: "ok" };
        }

        // Pass the assistant turn back unchanged, then answer every tool call in one message.
        messages.push({ role: "assistant", content: response.content });
        const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(
          toolUses.map(async (call) => {
            const outcome = await request.runTool(call.name, call.input);
            return {
              type: "tool_result" as const,
              tool_use_id: call.id,
              content: outcome.content,
              is_error: outcome.isError ?? false,
            };
          }),
        );
        messages.push({ role: "user", content: results });
      }

      return { text: "", outcome: "truncated" };
    },
  };
}
