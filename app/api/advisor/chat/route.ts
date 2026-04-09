import { streamText, createUIMessageStreamResponse } from "ai";
import { openai } from "@ai-sdk/openai";
import type { UIMessage } from "ai";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import {
  detectContextTriggers,
  buildCollectionSummary,
  buildPalateContextBlock,
  buildSuggestionsBlock,
  buildDrinkNowBlock,
  buildWishlistBlock,
  buildTastingsBlock,
  buildBottleDetailBlock,
  buildFullBottleContextBlock
} from "@/lib/advisor-context";
import { getDashboardData, getItemById } from "@/lib/repository";
import type { TastingEntry, CollectionViewItem } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
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
    const allTastings = collection.flatMap((i: CollectionViewItem) => i.tastingEntries)
      .sort((a: TastingEntry, b: TastingEntry) => b.tastedAt.localeCompare(a.tastedAt));
    contextBlocks.push(buildTastingsBlock(allTastings, collection));
  }

  if (triggers.bottleName) {
    const detail = buildBottleDetailBlock(triggers.bottleName, collection);
    if (detail) contextBlocks.push(detail);
  }

  const bottleFocus = bottleItem
    ? `\nFOCUS: The user is currently viewing "${bottleItem.expression.name}" on their bottle detail page. Ground your answers in this bottle's details. If they ask something not specific to it, you may draw on their broader collection context.`
    : "";

  const systemPrompt = `You are a personal whisky advisor for this collection.

PERSONALITY: You are warm, opinionated, and genuinely enthusiastic about whisky. You adapt your tone to match how the user speaks — casual when they are casual, technical when they go deep. Underneath everything, you have strong opinions and aren't afraid to share them.${bottleFocus}

${contextBlocks.join("\n\n")}

RULES:
- Only advise based on what's in the collection context above
- If asked about something not in the context, say so honestly
- Never invent tasting notes or ratings the user hasn't written
- Keep responses conversational — no bullet-point walls unless the user asks
- When recommending a bottle, always give a reason tied to their actual palate
- At the end of each response, suggest 2-3 natural follow-up questions as a JSON block on its own line: {"suggestions": ["...", "...", "..."]}`;

  // Convert UIMessage to the format expected by streamText
  const messages: ModelMessage[] = uiMessages.map(m => {
    // Handle __opening__ sentinel
    if (m.parts && m.parts.length === 1 && "text" in m.parts[0] && (m.parts[0] as { text: string }).text === "__opening__") {
      return {
        role: m.role as "user" | "assistant",
        content: "Please greet me warmly and share one genuinely interesting insight from my collection. Keep it to 2-3 sentences. End with a follow-up suggestions JSON block."
      };
    }

    // Convert parts to content string
    const content = m.parts
      ?.map(p => ("text" in p ? (p as { text: string }).text : ""))
      .join(" ") || "";

    return {
      role: m.role as "user" | "assistant",
      content
    };
  });

  const result = streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages
  });

  return createUIMessageStreamResponse({
    stream: result.toUIMessageStream()
  });
}
