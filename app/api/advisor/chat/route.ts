import type { ModelMessage } from "@ai-sdk/provider-utils";
import { openai } from "@ai-sdk/openai";
import { createUIMessageStreamResponse, stepCountIs, streamText, tool } from "ai";
import type { UIMessage } from "ai";
import { z } from "zod";
import {
  buildBottleDetailBlock,
  buildCollectionSummary,
  buildDealsContextBlock,
  buildDrinkNowBlock,
  buildFullBottleContextBlock,
  buildNamedTargetHistoryBlock,
  buildNeglectedSharedBottlesBlock,
  buildPalateContextBlock,
  buildRecentTastingSessionsBlock,
  buildRatingsBlock,
  buildSuggestionsBlock,
  buildWishlistBlock,
  detectContextTriggers
} from "@/lib/advisor-context";
import { getServerEnv } from "@/lib/env";
import { getLatestSuccessfulSnapshot } from "@/lib/news-store";
import { getNewsPreferences } from "@/lib/news-preferences-store";
import { getAdvisorSocialContext, getDashboardData, getItemById } from "@/lib/repository";
import { webSearch } from "@/lib/search";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const enableSearch = url.searchParams.get("search") === "1";

  const body = (await req.json()) as { messages: UIMessage[]; bottleId?: string };
  const uiMessages = body.messages || [];
  const bottleId = body.bottleId ?? null;

  const { OPENAI_MODEL } = getServerEnv();

  let query = "";
  for (let i = uiMessages.length - 1; i >= 0; i--) {
    const message = uiMessages[i];
    if (message.role === "user" && message.parts) {
      const textPart = message.parts.find((part) => part.type === "text");
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

  if (triggers.socialPlanning) {
    const socialContext = await getAdvisorSocialContext(query);
    contextBlocks.push(buildRecentTastingSessionsBlock(socialContext.recentSessions));
    contextBlocks.push(buildNeglectedSharedBottlesBlock(socialContext.longestNeglectedBottles));
    contextBlocks.push(buildDrinkNowBlock(collection));

    for (const target of socialContext.namedTargets) {
      contextBlocks.push(buildNamedTargetHistoryBlock(target));
    }
  }

  if (triggers.deals) {
    try {
      const newsPrefs = await getNewsPreferences();
      const snapshot = await getLatestSuccessfulSnapshot(newsPrefs);
      if (snapshot) {
        contextBlocks.push(
          buildDealsContextBlock(
            snapshot.specials,
            snapshot.newArrivals,
            snapshot.fetchedAt,
            newsPrefs
          )
        );
      }
    } catch {
      // Non-fatal: advisor still works without news context.
    }
  }

  if (triggers.bottleName) {
    const detail = buildBottleDetailBlock(triggers.bottleName, collection);
    if (detail) contextBlocks.push(detail);
  }

  const bottleFocus = bottleItem
    ? `\nFOCUS: The user is currently viewing "${bottleItem.expression.name}" on their bottle detail page. Ground your answers in this bottle's details. If they ask something not specific to it, you may draw on their broader collection context.`
    : "";

  const searchNote = enableSearch
    ? "\n\nWEB SEARCH: You have access to a web search tool. Use it when the user asks about things not covered by the collection context - distillery history, production methods, industry news, comparisons with bottles not in their collection, current pricing, recent releases, and similar topics. Search proactively when it would genuinely improve your answer."
    : "";

  const systemPrompt = `You are a personal whisky advisor for this collection.

PERSONALITY: You are warm, opinionated, and genuinely enthusiastic about whisky. You adapt your tone to match how the user speaks - casual when they are casual, technical when they go deep. Underneath everything, you have strong opinions and are happy to share them.${bottleFocus}${searchNote}

${contextBlocks.join("\n\n")}

RULES:
- Only advise based on what's in the collection context above
- If asked about something not in the context, say so honestly${enableSearch ? " - or use web search to find out" : ""}
- Never invent tasting notes or ratings the user hasn't written
- For social planning questions, favor owned bottles that are not finished, avoid repeating the exact same bottles people had recently, and use saved person preference tags only as a soft signal
- Keep answers easy to scan: use short paragraphs, headings, and bullet lists with blank lines between sections
- When recommending multiple bottles, give each bottle its own markdown section in this shape, with a blank line between bottles:
### Bottle Name
- Age: X years
- Cask: type
- ABV: X%
- Why it fits: tie it directly to their palate and collection

- When recommending a bottle, always give a reason tied to their actual palate
- At the end of each response, suggest 2-3 natural follow-up questions as a JSON block on its own line: {"suggestions": ["...", "...", "..."]}`;

  const messages: ModelMessage[] = uiMessages.map((message) => {
    const content =
      message.parts?.map((part) => ("text" in part ? (part as { text: string }).text : "")).join(" ") || "";

    return {
      role: message.role as "user" | "assistant",
      content
    };
  });

  const tools = enableSearch
    ? {
        searchWeb: tool({
          description:
            "Search the internet for whisky information - distillery history, tasting notes, production methods, industry news, bottles not in the collection, current pricing, new releases, awards, comparisons, and similar topics.",
          inputSchema: z.object({
            query: z.string().describe(
              "Search query. Be specific - include the distillery or bottle name when relevant."
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
    model: openai(OPENAI_MODEL),
    system: systemPrompt,
    messages,
    tools,
    ...(tools ? { stopWhen: stepCountIs(3) } : {})
  });

  return createUIMessageStreamResponse({
    stream: result.toUIMessageStream()
  });
}
