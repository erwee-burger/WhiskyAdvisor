import { NextResponse } from "next/server";
import { getNewsItems } from "@/lib/news-store";
import { getDashboardData } from "@/lib/repository";
import { buildPalateContextBlock } from "@/lib/advisor-context";
import type { NewsSuggestion } from "@/lib/types";

export const runtime = "nodejs";

type AiPick = { name?: unknown; reason?: unknown };

function extractJsonArray(text: string): AiPick[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    return JSON.parse(match[0]) as AiPick[];
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const [rawItems, dashboard] = await Promise.all([
      getNewsItems(),
      getDashboardData()
    ]);

    if (rawItems.length === 0) {
      return NextResponse.json({ picks: [] });
    }

    const palateBlock = buildPalateContextBlock(dashboard.profile);

    // Limit to 20 items to keep the prompt manageable
    const sample = rawItems.slice(0, 20);
    const itemList = sample
      .map((item, i) =>
        `${i + 1}. ${item.name} | R${item.price}${item.discount_pct ? ` (-${item.discount_pct}%)` : ""} | ${item.kind === "special" ? "Special" : "New release"} | ${item.source}`
      )
      .join("\n");

    const prompt = [
      "You are a personal whisky advisor. Based on the user's palate profile below,",
      "pick the top 5 items from the list that best match their taste.",
      "Return ONLY a JSON array (no markdown). Each element:",
      '{ "name": string, "reason": string }',
      "The reason should be one concise sentence explaining why it suits their palate.",
      "Use the exact product name as it appears in the list.",
      "",
      palateBlock,
      "",
      "AVAILABLE ITEMS:",
      itemList
    ].join("\n");

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ picks: [] });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      return NextResponse.json({ picks: [] });
    }

    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = payload.choices?.[0]?.message?.content ?? "[]";
    const picks = extractJsonArray(text);

    // Match AI picks back to full item data
    const suggestions: NewsSuggestion[] = [];
    for (const p of picks) {
      if (typeof p.name !== "string" || typeof p.reason !== "string") continue;
      const name = p.name;
      const match = rawItems.find(
        item => item.name.toLowerCase() === name.toLowerCase()
      ) ?? rawItems.find(
        item => item.name.toLowerCase().includes(name.toLowerCase())
      );
      if (!match) continue;
      suggestions.push({
        name: match.name,
        url: match.url,
        price: match.price,
        kind: match.kind as "special" | "new_release",
        source: match.source,
        discountPct: match.discount_pct ?? undefined,
        reason: p.reason
      });
      if (suggestions.length >= 5) break;
    }

    return NextResponse.json({ picks: suggestions });
  } catch (err) {
    console.error("[api/news/suggestions] GET failed:", err);
    return NextResponse.json({ picks: [] });
  }
}
