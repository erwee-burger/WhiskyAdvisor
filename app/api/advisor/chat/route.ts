import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import {
  detectContextTriggers,
  buildCollectionSummary,
  buildPalateContextBlock,
  buildSuggestionsBlock,
  buildDrinkNowBlock,
  buildWishlistBlock,
  buildTastingsBlock,
  buildBottleDetailBlock
} from "@/lib/advisor-context";
import { getDashboardData } from "@/lib/repository";
import type { TastingEntry, CollectionViewItem } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { messages, query } = (await req.json()) as { messages: ModelMessage[]; query: string };

  const dashboard = await getDashboardData();
  const { collection, profile, drinkNow, buyNext } = dashboard;

  const triggers = detectContextTriggers(query);

  const contextBlocks: string[] = [
    buildPalateContextBlock(profile),
    buildCollectionSummary(collection),
    buildSuggestionsBlock(drinkNow, buyNext)
  ];

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
    const allTastings = collection.flatMap((i: CollectionViewItem) => i.tastingEntries)
      .sort((a: TastingEntry, b: TastingEntry) => b.tastedAt.localeCompare(a.tastedAt));
    contextBlocks.push(buildTastingsBlock(allTastings, collection));
  }

  if (triggers.bottleName) {
    const detail = buildBottleDetailBlock(triggers.bottleName, collection);
    if (detail) contextBlocks.push(detail);
  }

  const systemPrompt = `You are a personal whisky advisor for this collection.

PERSONALITY: You are warm, opinionated, and genuinely enthusiastic about whisky. You adapt your tone to match how the user speaks — casual when they are casual, technical when they go deep. Underneath everything, you have strong opinions and aren't afraid to share them.

${contextBlocks.join("\n\n")}

RULES:
- Only advise based on what's in the collection context above
- If asked about something not in the context, say so honestly
- Never invent tasting notes or ratings the user hasn't written
- Keep responses conversational — no bullet-point walls unless the user asks
- When recommending a bottle, always give a reason tied to their actual palate
- At the end of each response, suggest 2-3 natural follow-up questions as a JSON block on its own line: {"suggestions": ["...", "...", "..."]}`;

  // Replace __opening__ sentinel with a greet instruction
  const processedMessages: ModelMessage[] = messages.map(m =>
    m.content === "__opening__"
      ? { ...m, content: "Please greet me warmly and share one genuinely interesting insight from my collection. Keep it to 2-3 sentences. End with a follow-up suggestions JSON block." }
      : m
  ) as ModelMessage[];

  const result = streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages: processedMessages
  });

  return result.toTextStreamResponse();
}
