import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { getCollectionView, getTastingGroups, getTastingPlaces, getTastingPeople } from "@/lib/repository";

interface BriefingRequest {
  bottleItemIds: string[];
  placeId?: string | null;
  groupId?: string | null;
  attendeePersonIds?: string[];
  occasionType?: string | null;
}

function isValidBriefingRequest(data: unknown): data is BriefingRequest {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.bottleItemIds)) return false;
  if (obj.bottleItemIds.length === 0) return false;
  if (!obj.bottleItemIds.every((id) => typeof id === "string")) return false;

  if (obj.placeId !== undefined && obj.placeId !== null && typeof obj.placeId !== "string") return false;
  if (obj.groupId !== undefined && obj.groupId !== null && typeof obj.groupId !== "string") return false;
  if (obj.attendeePersonIds !== undefined && !Array.isArray(obj.attendeePersonIds)) return false;
  if (Array.isArray(obj.attendeePersonIds) && !obj.attendeePersonIds.every((id) => typeof id === "string")) return false;
  if (obj.occasionType !== undefined && obj.occasionType !== null && typeof obj.occasionType !== "string") return false;

  return true;
}

const briefingResponseSchema = z.object({
  suggestedName: z.string().min(1),
  briefing: z.object({
    tastingOrder: z.array(z.object({
      bottleName: z.string(),
      reason: z.string()
    })),
    bottleProfiles: z.array(z.object({
      bottleName: z.string(),
      keyNotes: z.array(z.string()),
      watchFor: z.string(),
      background: z.string()
    })),
    tips: z.array(z.string())
  })
});

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!isValidBriefingRequest(body)) {
      return NextResponse.json({ error: "Invalid request format" }, { status: 400 });
    }

    const { bottleItemIds, placeId, groupId, attendeePersonIds = [], occasionType } = body;

    const { OPENAI_MODEL, OPENAI_API_KEY } = getServerEnv();
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured");
      return NextResponse.json({ error: "Service configuration error" }, { status: 500 });
    }

    try {
      const [collection, groups, places, people] = await Promise.all([
        getCollectionView(),
        getTastingGroups(),
        getTastingPlaces(),
        getTastingPeople()
      ]);

      const selectedBottles = collection.filter((item) => bottleItemIds.includes(item.item.id));
      if (selectedBottles.length === 0) {
        return NextResponse.json({ error: "No matching bottles found" }, { status: 404 });
      }

      const place = placeId ? places.find((p) => p.id === placeId) : null;
      const group = groupId ? groups.find((g) => g.id === groupId) : null;
      const attendees = people.filter((p) => attendeePersonIds.includes(p.id));

      if (placeId && !place) {
        return NextResponse.json({ error: "Place not found" }, { status: 404 });
      }
      if (groupId && !group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }
      if (attendeePersonIds.length > 0 && attendees.length === 0) {
        return NextResponse.json({ error: "Attendees not found" }, { status: 404 });
      }

      const bottleDescriptions = selectedBottles.map((i) => {
        const e = i.expression;
        const tags = e.tags.join(", ");
        return `- ${e.name} | ${e.distilleryName ?? "unknown distillery"} | ${e.abv ? `${e.abv}%` : "ABV unknown"} | ${e.ageStatement ? `${e.ageStatement}yo` : "NAS"} | tags: ${tags || "none"}`;
      }).join("\n");

      const contextLines = [
        `Bottles (${selectedBottles.length}):`,
        bottleDescriptions,
        place ? `Place: ${place.name}` : "",
        group ? `Group: ${group.name}` : "",
        attendees.length > 0
          ? `Attendees: ${attendees.map((a) => `${a.name}${a.preferenceTags.length ? ` (likes ${a.preferenceTags.join(", ")})` : ""}`).join(", ")}`
          : "",
        occasionType ? `Occasion: ${occasionType}` : ""
      ].filter(Boolean).join("\n");

      const prompt = `You are a whisky tasting host. Given the following tasting context, return a JSON object (and nothing else) in this exact shape:

{
  "suggestedName": "A short evocative tasting name (max 6 words, based on the bottles, place, occasion, or group)",
  "briefing": {
    "tastingOrder": [
      { "bottleName": "exact bottle name only", "reason": "why this position in the order" }
    ],
    "bottleProfiles": [
      {
        "bottleName": "exact bottle name only",
        "keyNotes": ["note1", "note2", "note3"],
        "watchFor": "one sentence on what to pay attention to",
        "background": "one sentence of interesting context"
      }
    ],
    "tips": ["tip1", "tip2"]
  }
}

TASTING CONTEXT:
${contextLines}

Rules:
- bottleName must be only the product name.
- Do not append producer, ABV, age, tags, or any other metadata into bottleName.
- Put explanatory detail into reason, watchFor, and background instead.

Return only the JSON object. No markdown, no explanation.`;

      const { text } = await generateText({
        model: openai(OPENAI_MODEL),
        prompt
      });

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        console.error("Failed to parse AI response as JSON");
        return NextResponse.json({ error: "Could not parse AI response" }, { status: 500 });
      }

      const validated = briefingResponseSchema.safeParse(parsed);
      if (!validated.success) {
        console.error("AI response failed validation");
        return NextResponse.json({ error: "Invalid AI response format" }, { status: 500 });
      }

      return NextResponse.json(validated.data);
    } catch {
      console.error("Failed to generate briefing");
      return NextResponse.json({ error: "Failed to generate briefing" }, { status: 500 });
    }
  } catch {
    console.error("Briefing endpoint error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
