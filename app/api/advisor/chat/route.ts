import { streamText, createUIMessageStreamResponse, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { UIMessage } from "ai";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import {
  detectContextTriggers,
  buildCollectionSummary,
  buildPalateContextBlock,
  buildSuggestionsBlock,
  buildDrinkNowBlock,
  buildWishlistBlock,
  buildRatingsBlock,
  buildBottleDetailBlock,
  buildFullBottleContextBlock
} from "@/lib/advisor-context";
import { getDashboardData, getItemById } from "@/lib/repository";
import { webSearch } from "@/lib/search";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const enableSearch = url.searchParams.get("search") === "1";

  const body = (await req.json()) as { messages: UIMessage[]; bottleId?: string };
  const uiMessages = body.messages || [];
  const bottleId = body.bottleId ?? null;

  // Extract the last user message as the query for context triggering
  let query = "";
  for (let i = uiMessages.length - 1; i >= 0; i--) {
    const msg = uiMessages[i];
    if (msg.role === "user" && msg.parts) {
      const textPart = msg.parts.find((p) => p.type === "text");
      if (textPart && "text" in textPart) {
        query = (textPart as { text: string }).text;
        break;
      }
    }
  }

  const dashboard = await getDashboardData();
  const { collection, profile, drinkNow, buyNext } = dashboard;

  const triggers = detectContextTriggers(query);

  const bottleItem = bottleId ? await getItemById(bottleId) : null;

  const contextBlocks: string[] = [
    buildPalateContextBlock(profile),
    buildCollectionSummary(collection),
    buildSuggestionsBlock(drinkNow, buyNext)
  ];

  if (bottleItem) {
    contextBlocks.unshift(buildFullBottleContextBlock(bottleItem));
  }

  if (triggers.drinkNow) {
    contextBlocks.push(buildDrinkNowBlock(collection));
  }

  if (triggers.wishlist) {
    contextBlocks.push(buildWishlistBlock(collection));
  }

  if (triggers.analytics) {
    const { buildCollectionAnalytics } = await import("@/lib/analytics");
    const analytics = buildCollectionAnalytics(collection);
    contextBlocks.push(`FULL ANALYTICS:\n${JSON.stringify(analytics, null, 2)}`);
  }

  if (triggers.tastings) {
    contextBlocks.push(buildRatingsBlock(collection));
  }

  if (triggers.bottleName) {
    const detail = buildBottleDetailBlock(triggers.bottleName, collection);
    if (detail) contextBlocks.push(detail);
  }

  const bottleFocus = bottleItem
    ? `\nFOCUS: The user is currently viewing "${bottleItem.expression.name}" on their bottle detail page. Ground your answers in this bottle's details. If they ask something not specific to it, you may draw on their broader collection context.`
    : "";

  const searchNote = enableSearch
    ? "\n\nWEB SEARCH: You have access to a web search tool. Use it when the user asks about things not covered by the collection context — distillery history, production methods, industry news, comparisons with bottles not in their collection, current pricing, recent releases, etc. Search proactively when it would genuinely improve your answer."
    : "";

  const systemPrompt = `You are a personal whisky advisor for this collection.

PERSONALITY: You are warm, opinionated, and genuinely enthusiastic about whisky. You adapt your tone to match how the user speaks — casual when they are casual, technical when they go deep. Underneath everything, you have strong opinions and aren't afraid to share them.${bottleFocus}${searchNote}

${contextBlocks.join("\n\n")}

RULES:
- Only advise based on what's in the collection context above
- If asked about something not in the context, say so honestly${enableSearch ? " — or use web search to find out" : ""}
- Never invent tasting notes or ratings the user hasn't written
- Keep responses conversational — no bullet-point walls unless the user asks
- When recommending a bottle, always give a reason tied to their actual palate
- At the end of each response, suggest 2-3 natural follow-up questions as a JSON block on its own line: {"suggestions": ["...", "...", "..."]}`;

  // Convert UIMessage to the format expected by streamText
  const messages: ModelMessage[] = uiMessages.map(m => {
    const content = m.parts
      ?.map(p => ("text" in p ? (p as { text: string }).text : ""))
      .join(" ") || "";

    return {
      role: m.role as "user" | "assistant",
      content
    };
  });

  const tools = enableSearch
    ? {
        searchWeb: tool({
          description:
            "Search the internet for whisky information — distillery history, tasting notes, production methods, industry news, bottles not in the collection, current pricing, new releases, awards, comparisons, etc.",
          inputSchema: z.object({
            query: z.string().describe(
              "Search query. Be specific — include the distillery or bottle name when relevant."
            )
          }),
          execute: async ({ query }: { query: string }): Promise<string> => {
            const results = await webSearch(query);
            return results || "No results found for that query.";
          }
        })
      }
    : undefined;

  const result = streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages,
    tools,
    maxSteps: tools ? 3 : 1
  });

  return createUIMessageStreamResponse({
    stream: result.toUIMessageStream()
  });
}
