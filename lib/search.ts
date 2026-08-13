// lib/search.ts — uses Responses API so web_search_preview works with GPT-5.4
import { getServerEnv } from "@/lib/env";

// Per-call ceilings. These only matter when no shared deadline is passed in
// (or there's still plenty of budget left) — see the deadline param below.
const PRIMARY_TIMEOUT_MS = 12_000;
const FALLBACK_TIMEOUT_MS = 8_000;

// Below this much remaining budget, don't bother starting a new network
// call at all — it can't complete usefully, so just return "" immediately
// and let the model finalize its answer with whatever it already has.
const MIN_CALL_MS = 2_000;

/**
 * @param query The search query.
 * @param deadlineAt Optional epoch-ms deadline shared across every webSearch
 *   call in one advisor turn. The model may call this tool many times while
 *   working through a page (stepCountIs in the chat route), and per-call
 *   timeouts alone don't bound the total — N calls at ~20s each still adds
 *   up to N*20s. Passing a shared deadline means every call after the
 *   budget is spent is a fast no-op instead of another slow round trip, so
 *   raising the step count is safe without risking the whole request hanging
 *   past the route's maxDuration.
 */
export async function webSearch(query: string, deadlineAt?: number): Promise<string> {
  const { OPENAI_API_KEY, OPENAI_MODEL } = getServerEnv();

  if (!OPENAI_API_KEY) return "";

  const remainingMs = () => (deadlineAt ? deadlineAt - Date.now() : Infinity);

  if (remainingMs() < MIN_CALL_MS) return "";

  // Try Responses API (GPT-5.4 + web_search_preview)
  try {
    const primaryTimeout = Math.min(PRIMARY_TIMEOUT_MS, remainingMs());
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        tools: [{ type: "web_search_preview" }],
        input: query
      }),
      signal: AbortSignal.timeout(primaryTimeout)
    });

    if (response.ok) {
      const data = await response.json() as {
        output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }>;
      };
      if (Array.isArray(data.output)) {
        for (let i = data.output.length - 1; i >= 0; i--) {
          const item = data.output[i];
          if (item.type === "message" && Array.isArray(item.content)) {
            const part = item.content.find((c) => c.type === "output_text");
            if (part?.text) return part.text;
          }
        }
      }
    }
  } catch {
    // Timed out, aborted, or network error — fall through to the fallback.
  }

  if (remainingMs() < MIN_CALL_MS) return "";

  // Fall back to Chat Completions using the configured model
  try {
    const fallbackTimeout = Math.min(FALLBACK_TIMEOUT_MS, remainingMs());
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: OPENAI_MODEL, messages: [{ role: "user", content: query }] }),
      signal: AbortSignal.timeout(fallbackTimeout)
    });
    if (!response.ok) return "";
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? "";
  } catch {
    return "";
  }
}
