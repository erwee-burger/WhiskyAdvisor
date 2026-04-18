import type { ModelMessage } from "@ai-sdk/provider-utils";
import { openai } from "@ai-sdk/openai";
import { createUIMessageStreamResponse, streamText } from "ai";

import { buildTastingBottleContext, buildPalateContextBlock, buildRecentTastingSessionsBlock } from "@/lib/advisor-context";
import { getServerEnv } from "@/lib/env";
import { getDashboardData, getRecentTastingSessions } from "@/lib/repository";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    // Validate: check if messages is array
    const uiMessages = Array.isArray(body?.messages) ? body.messages : [];
    if (uiMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: "No messages provided" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const { OPENAI_MODEL } = getServerEnv();

    try {
      const [dashboard, recentSessions] = await Promise.all([
        getDashboardData(),
        getRecentTastingSessions(5)
      ]);

      const { collection, profile } = dashboard;

      const systemPrompt = `You are a tasting session advisor for a private whisky collection.

CONTEXT: The collector is based in South Africa. Prices are in ZAR (R). Standard bottle 750ml, 43%+ ABV.

${buildPalateContextBlock(profile)}

${buildTastingBottleContext(collection)}

${buildRecentTastingSessionsBlock(recentSessions)}

RULES:
- Only suggest bottles from the AVAILABLE BOTTLES list above using their exact [id:...] identifiers.
- When suggesting bottles for a session, format each bottle as:
  ### Bottle Name
  - Why it fits: reason tied to occasion or palate
- After your bottle recommendations, ALWAYS include a JSON block on its own line with the suggested bottle IDs:
  {"bottleSuggestions": [{"id": "item-id-here", "name": "Bottle Name"}]}
- Consider tasting order: lighter/unpeated before heavier/peated, lower ABV before cask strength.
- Keep answers concise and scannable.
- End each response with 2-3 follow-up chips: {"suggestions": ["...", "...", "..."]}`;

      const messages: ModelMessage[] = uiMessages.map((message: Record<string, unknown>) => {
        const content =
          (message.parts as Array<{text?: string}>)?.map((part: Record<string, unknown>) => ("text" in part ? (part as { text: string }).text : "")).join(" ") || "";
        const role: "user" | "assistant" = message.role === "assistant" ? "assistant" : "user";
        return { role, content };
      });

      const result = streamText({
        model: openai(OPENAI_MODEL),
        system: systemPrompt,
        messages
      });

      return createUIMessageStreamResponse({ stream: result.toUIMessageStream() });
    } catch {
      console.error("Failed to load advisor context");
      return new Response(
        JSON.stringify({ error: "Failed to load collection context" }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }
  } catch {
    console.error("Advisor endpoint error");
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
