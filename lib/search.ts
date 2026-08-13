// lib/search.ts — uses Responses API so web_search_preview works with GPT-5.4
import { getServerEnv } from "@/lib/env";

// Web search can be invoked multiple times in one advisor turn (the model may
// call it 2-3 times while building a tasting list). Neither OpenAI call had a
// timeout, so a single slow/stalled request could silently eat the entire
// serverless function budget with nothing ever streamed back to the client.
// Bound each call so a stall fails fast instead of hanging the whole chat.
// Kept tight: the model can chain up to 3 tool calls in one turn (see
// stepCountIs(3) in app/api/advisor/chat/route.ts), so worst case is
// 3 * (PRIMARY_TIMEOUT_MS + FALLBACK_TIMEOUT_MS) before generation even
// starts. Needs to stay well under the route's function duration budget.
const PRIMARY_TIMEOUT_MS = 12_000;
const FALLBACK_TIMEOUT_MS = 8_000;

export async function webSearch(query: string): Promise<string> {
  const { OPENAI_API_KEY, OPENAI_MODEL } = getServerEnv();

  if (!OPENAI_API_KEY) return "";

  // Try Responses API (GPT-5.4 + web_search_preview)
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        tools: [{ type: "web_search_preview" }],
        input: query
      }),
      signal: AbortSignal.timeout(PRIMARY_TIMEOUT_MS)
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

  // Fall back to Chat Completions using the configured model
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: OPENAI_MODEL, messages: [{ role: "user", content: query }] }),
      signal: AbortSignal.timeout(FALLBACK_TIMEOUT_MS)
    });
    if (!response.ok) return "";
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? "";
  } catch {
    return "";
  }
}
