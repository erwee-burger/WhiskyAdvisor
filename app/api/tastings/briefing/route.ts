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

interface BottleProfile {
  bottleName: string;
  keyNotes: string[];
  watchFor: string;
  background: string;
}

interface Briefing {
  tastingOrder: Array<{ bottleName: string; reason: string }>;
  bottleProfiles: BottleProfile[];
  tips: string[];
}

interface BriefingResponse {
  suggestedName: string;
  briefing: Briefing;
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

export function formatBriefingAsText(briefing: Briefing): string {
  const sections: string[] = [];

  if (briefing.tastingOrder.length > 0) {
    sections.push("## Tasting Order");
    briefing.tastingOrder.forEach((entry, index) => {
      sections.push(`${index + 1}. ${entry.bottleName} — ${entry.reason}`);
    });
  }

  if (briefing.bottleProfiles.length > 0) {
    sections.push("\n## Bottle Profiles");
    for (const profile of briefing.bottleProfiles) {
      sections.push(`### ${profile.bottleName}`);
      if (profile.keyNotes.length > 0) {
        sections.push(`Key notes: ${profile.keyNotes.join(", ")}`);
      }
      if (profile.watchFor) {
        sections.push(`Watch for: ${profile.watchFor}`);
      }
      if (profile.background) {
        sections.push(`Background: ${profile.background}`);
      }
    }
  }

  if (briefing.tips.length > 0) {
    sections.push("\n## Tips");
    for (const tip of briefing.tips) {
      sections.push(`- ${tip}`);
    }
  }

  return sections.join("\n");
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch (error) {
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
      { "bottleName": "exact bottle name", "reason": "why this position in the order" }
    ],
    "bottleProfiles": [
      {
        "bottleName": "exact bottle name",
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

Return only the JSON object. No markdown, no explanation.`;

      const { text } = await generateText({
        model: openai(OPENAI_MODEL),
        prompt
      });

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        console.error("Failed to parse AI response as JSON:", error);
        return NextResponse.json({ error: "Could not parse AI response" }, { status: 500 });
      }

      const validated = briefingResponseSchema.safeParse(parsed);
      if (!validated.success) {
        console.error("AI response failed validation:", validated.error);
        return NextResponse.json({ error: "Invalid AI response format" }, { status: 500 });
      }

      return NextResponse.json(validated.data);
    } catch (error) {
      console.error("Failed to generate briefing:", error);
      return NextResponse.json({ error: "Failed to generate briefing" }, { status: 500 });
    }
  } catch (error) {
    console.error("Briefing endpoint error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
