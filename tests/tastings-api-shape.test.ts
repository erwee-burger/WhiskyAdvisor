import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRepository = vi.hoisted(() => ({
  createQuickBottleShare: vi.fn(),
  createTastingSession: vi.fn(),
  getTastingSessions: vi.fn(),
  deleteTastingPerson: vi.fn(),
  updateTastingPerson: vi.fn(),
  getCollectionView: vi.fn(),
  getTastingGroups: vi.fn(),
  getTastingPlaces: vi.fn(),
  getTastingPeople: vi.fn()
}));

vi.mock("@/lib/repository", () => mockRepository);

import { DELETE as deleteTastingPersonRoute } from "@/app/api/tastings/people/[personId]/route";
import { POST as postBriefing } from "@/app/api/tastings/briefing/route";
import { POST as postTastingSessions } from "@/app/api/tastings/sessions/route";
import { formatBriefingAsMarkdown } from "@/lib/briefing-formatter";
import { createQuickBottleShare, createTastingSession, deleteTastingPerson } from "@/lib/repository";

const mockedCreateQuickBottleShare = vi.mocked(createQuickBottleShare);
const mockedCreateTastingSession = vi.mocked(createTastingSession);
const mockedDeleteTastingPerson = vi.mocked(deleteTastingPerson);
const mockedGetCollectionView = vi.mocked(mockRepository.getCollectionView);
const mockedGetTastingGroups = vi.mocked(mockRepository.getTastingGroups);
const mockedGetTastingPlaces = vi.mocked(mockRepository.getTastingPlaces);
const mockedGetTastingPeople = vi.mocked(mockRepository.getTastingPeople);

afterEach(() => {
  vi.clearAllMocks();
});

describe("tastings API shape", () => {
  it("routes a valid quick share payload through the quick-share path", async () => {
    mockedCreateQuickBottleShare.mockResolvedValue({
      session: {
        id: "session_1",
        title: "Friday pour",
        occasionType: "visit",
        sessionDate: "2026-04-14T18:00:00.000Z",
        createdAt: "2026-04-14T18:00:00.000Z",
        updatedAt: "2026-04-14T18:00:00.000Z"
      },
      attendees: [],
      bottles: []
    } as never);

    const response = await postTastingSessions(
      new Request("http://localhost/api/tastings/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          occasionType: "visit",
          sessionDate: "2026-04-14T18:00:00.000Z",
          collectionItemId: "item_1",
          attendeePersonIds: ["person_1"]
        })
      })
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      session: {
        id: "session_1",
        title: "Friday pour",
        occasionType: "visit",
        sessionDate: "2026-04-14T18:00:00.000Z",
        createdAt: "2026-04-14T18:00:00.000Z",
        updatedAt: "2026-04-14T18:00:00.000Z"
      },
      attendees: [],
      bottles: []
    });
    expect(mockedCreateQuickBottleShare).toHaveBeenCalledTimes(1);
    expect(mockedCreateTastingSession).not.toHaveBeenCalled();
  });

  it("returns a validation error for malformed session payloads", async () => {
    const response = await postTastingSessions(
      new Request("http://localhost/api/tastings/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.fieldErrors.sessionDate).toBeDefined();
    expect(mockedCreateQuickBottleShare).not.toHaveBeenCalled();
    expect(mockedCreateTastingSession).not.toHaveBeenCalled();
  });

  it("returns 409 when person deletion is blocked by tasting history", async () => {
    mockedDeleteTastingPerson.mockRejectedValue(
      new Error("Cannot delete a person who already appears in tasting history.")
    );

    const response = await deleteTastingPersonRoute(
      new Request("http://localhost/api/tastings/people/person_1", {
        method: "DELETE"
      }),
      { params: Promise.resolve({ personId: "person_1" }) }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Cannot delete a person who already appears in tasting history."
    });
  });

  it("returns 400 when quick share has no real attendees after repository validation", async () => {
    mockedCreateQuickBottleShare.mockRejectedValue(
      new Error("Quick share needs at least one real attendee.")
    );

    const response = await postTastingSessions(
      new Request("http://localhost/api/tastings/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          occasionType: "visit",
          sessionDate: "2026-04-14T18:00:00.000Z",
          collectionItemId: "item_1",
          groupId: "group_empty"
        })
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Quick share needs at least one real attendee."
    });
  });

  it("returns 400 when quick share uses a bottle that cannot be shared", async () => {
    mockedCreateQuickBottleShare.mockRejectedValue(
      new Error("Only owned bottles that are not finished can be shared.")
    );

    const response = await postTastingSessions(
      new Request("http://localhost/api/tastings/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          occasionType: "visit",
          sessionDate: "2026-04-14T18:00:00.000Z",
          collectionItemId: "item_1",
          attendeePersonIds: ["person_1"]
        })
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Only owned bottles that are not finished can be shared."
    });
  });
});

describe("formatBriefingAsMarkdown", () => {
  it("formats tasting order section", async () => {
    const briefing = {
      tastingOrder: [
        { bottleName: "Glenlivet 12", reason: "Lightest — good opener" },
        { bottleName: "Ardbeg 10", reason: "Heavy peat — best last" }
      ],
      bottleProfiles: [],
      tips: []
    };
    const result = formatBriefingAsMarkdown(briefing);
    expect(result).toContain("## Tasting Order");
    expect(result).toContain("1. **Glenlivet 12**");
    expect(result).toContain("**Why here:** Lightest — good opener");
  });

  it("formats bottle profiles section", async () => {
    const briefing = {
      tastingOrder: [],
      bottleProfiles: [
        {
          bottleName: "Ardbeg 10",
          keyNotes: ["smoke", "citrus"],
          watchFor: "The medicinal finish.",
          background: "Islay distillery."
        }
      ],
      tips: ["Serve neat"]
    };
    const result = formatBriefingAsMarkdown(briefing);
    expect(result).toContain("### Ardbeg 10");
    expect(result).toContain("- **Key notes:** smoke, citrus");
    expect(result).toContain("- **Watch for:** The medicinal finish.");
    expect(result).toContain("## Tips");
    expect(result).toContain("- Serve neat");
  });

  it("adds readable spacing between sections and bottle profiles", async () => {
    const briefing = {
      tastingOrder: [{ bottleName: "Bottle One", reason: "Open with the gentler dram" }],
      bottleProfiles: [
        {
          bottleName: "Bottle One",
          keyNotes: ["pear", "vanilla"],
          watchFor: "The lift on the finish.",
          background: "Ex-bourbon maturation."
        },
        {
          bottleName: "Bottle Two",
          keyNotes: ["smoke"],
          watchFor: "The coastal edge.",
          background: "Island style."
        }
      ],
      tips: ["Pour small measures"]
    };
    const result = formatBriefingAsMarkdown(briefing);
    expect(result).toContain("## Bottle Profiles");
    expect(result).toContain("### Bottle One");
    expect(result).toContain("- **Background:** Ex-bourbon maturation.\n\n### Bottle Two");
    expect(result).toContain("## Tips");
    expect(result).toContain("- Pour small measures");
  });

  it("shows packed bottle metadata only once under bottle profiles", async () => {
    const briefing = {
      tastingOrder: [
        {
          bottleName:
            "Boplaas 1880 Aged 10 Years Single Cask Whisky Rum Cask | Boplaas | 46% | 10yo | tags: bourbon-cask, rum-cask, single-grain",
          reason: "Start with the younger bottling for brighter cane sugar notes."
        }
      ],
      bottleProfiles: [
        {
          bottleName:
            "Boplaas 1880 Aged 10 Years Single Cask Whisky Rum Cask | Boplaas | 46% | 10yo | tags: bourbon-cask, rum-cask, single-grain",
          keyNotes: ["banana", "molasses"],
          watchFor: "The tropical lift on the nose.",
          background: "A single-cask grain whisky finished in rum wood."
        }
      ],
      tips: []
    };
    const result = formatBriefingAsMarkdown(briefing);
    expect(result).toContain("1. **Boplaas 1880 Aged 10 Years Single Cask Whisky Rum Cask**");
    expect(result).toContain("**Why here:** Start with the younger bottling for brighter cane sugar notes.");
    expect(result).toContain("- **Producer:** Boplaas");
    expect(result).toContain("- **Specs:** 46% · 10yo");
    expect(result).toContain("- **Tags:** bourbon-cask, rum-cask, single-grain");
    expect(result).not.toContain("1. **Boplaas 1880 Aged 10 Years Single Cask Whisky Rum Cask**\n   - **Producer:**");
  });
});

describe("POST /api/tastings/briefing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid JSON", async () => {
    const response = await postBriefing(
      new Request("http://localhost/api/tastings/briefing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "invalid json"
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for empty bottleItemIds", async () => {
    const response = await postBriefing(
      new Request("http://localhost/api/tastings/briefing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bottleItemIds: [] })
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for non-array bottleItemIds", async () => {
    const response = await postBriefing(
      new Request("http://localhost/api/tastings/briefing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bottleItemIds: "not-an-array" })
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid attendeePersonIds (not array)", async () => {
    const response = await postBriefing(
      new Request("http://localhost/api/tastings/briefing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bottleItemIds: ["item-1"],
          attendeePersonIds: "not-an-array"
        })
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns 404 for non-existent bottles", async () => {
    mockedGetCollectionView.mockResolvedValueOnce([]);
    mockedGetTastingGroups.mockResolvedValueOnce([]);
    mockedGetTastingPlaces.mockResolvedValueOnce([]);
    mockedGetTastingPeople.mockResolvedValueOnce([]);

    const response = await postBriefing(
      new Request("http://localhost/api/tastings/briefing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bottleItemIds: ["nonexistent-id"] })
      })
    );
    expect(response.status).toBe(404);
  });
});
