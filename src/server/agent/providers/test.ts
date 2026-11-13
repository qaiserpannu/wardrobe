import "server-only";
import type { AgentModel, TurnRequest, TurnResult } from "../types";

/**
 * A stand-in for the AI model, used ONLY by the automated browser tests
 * (AI_PROVIDER=test). It follows fixed keyword rules so tests are repeatable
 * and cost nothing. It is not an assistant and must never be used on a live site.
 */
export function createTestModel(): AgentModel {
  return {
    async runTurn(request: TurnRequest): Promise<TurnResult> {
      const last = request.history[request.history.length - 1]?.text ?? "";
      const lower = last.toLowerCase();
      const code = last.match(/PLW-\d{4}/i)?.[0].toUpperCase();
      const call = async (name: string, input: unknown) => JSON.parse((await request.runTool(name, input)).content);

      if (lower.includes("made-up")) return { text: "You might like PLW-9999, a diamond gown for $5.", outcome: "ok" };
      if (lower.includes("refuse-me")) return { text: "", outcome: "refused" };

      if (/\b(human|person|owner)\b/.test(lower)) {
        const r = await call("request_human", { conversation_summary: "Customer asked for a person." });
        return { text: r.tell_the_customer, outcome: "ok" };
      }
      if (/\b(return|refund|ship|deliver)/.test(lower)) {
        await call("escalate_question", { question: last.slice(0, 200), conversation_summary: "Asked about a policy." });
        return { text: "I need to confirm that with the owner, and I've passed your question on.", outcome: "ok" };
      }
      if (code && /\b(buy|take it|reserve)\b/.test(lower)) {
        const outcome = await request.runTool("record_purchase_interest", {
          product_id: code,
          request_type: lower.includes("reserve") ? "reservation_request" : "purchase_request",
          customer_request: last.slice(0, 200),
          conversation_summary: "Customer wants this item.",
        });
        if (outcome.isError) return { text: `Sorry, ${code} is not available to buy right now.`, outcome: "ok" };
        return {
          text: `I've passed your request for ${code} to the owner, who will confirm and arrange pickup. It is not reserved yet.`,
          outcome: "ok",
        };
      }
      if (code) {
        const r = await call("get_product", { product_id: code });
        if (!r.found) return { text: "I can't find an item with that ID in the shop.", outcome: "ok" };
        return { text: `${r.product.product_id} is ${r.product.name}, ${r.product.price}, currently ${r.product.status}.`, outcome: "ok" };
      }
      const keywords = lower.replace(/[^a-z ]/g, " ").split(/\s+/).filter((w) => w.length > 3).slice(-1)[0] ?? "";
      const r = await call("search_products", { keywords });
      if (r.total_matches === 0) return { text: "I couldn't find anything matching that right now.", outcome: "ok" };
      const ids = r.products.slice(0, 3).map((p: { product_id: string }) => p.product_id);
      return { text: `I found ${r.total_matches} available. Have a look at ${ids.join(", ")}.`, outcome: "ok" };
    },
  };
}
