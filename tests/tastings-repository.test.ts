import { afterEach, describe, expect, it, vi } from "vitest";

const mockStore = vi.hoisted(() => ({
  readStore: vi.fn(),
  writeStore: vi.fn()
}));

const mockCreateId = vi.hoisted(() => vi.fn((prefix: string) => `${prefix}_test`));

vi.mock("@/lib/mock-store", () => mockStore);
vi.mock("@/lib/id", () => ({
  createId: mockCreateId
}));

import { readStore, writeStore } from "@/lib/mock-store";
import {
  createQuickBottleShare,
  deleteTastingPerson,
  getBottleSocialSummary
} from "@/lib/repository";
import type {
  CollectionItem,
  Expression,
  TastingGroup,
  TastingPerson,
  TastingPlace,
  TastingSession,
  TastingSessionAttendee,
  TastingSessionBottle,
  WhiskyStore
} from "@/lib/types";

const mockedReadStore = vi.mocked(readStore);
const mockedWriteStore = vi.mocked(writeStore);

function buildExpression(overrides: Partial<Expression> = {}): Expression {
  return {
    id: "expr_1",
    name: "Lagavulin 16",
    tags: [],
    tastingNotes: [],
    ...overrides
  };
}

function buildCollectionItem(overrides: Partial<CollectionItem> = {}): CollectionItem {
  return {
    id: "item_1",
    expressionId: "expr_1",
    status: "owned",
    fillState: "open",
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: "2026-04-01T10:00:00.000Z",
    purchaseCurrency: "ZAR",
    ...overrides
  };
}

function buildStore(overrides: Partial<WhiskyStore> = {}): WhiskyStore {
  return {
    expressions: [buildExpression()],
    expressionFlavorProfiles: [],
    collectionItems: [buildCollectionItem()],
    itemImages: [],
    drafts: [],
    tastingPeople: [],
    tastingGroups: [],
    tastingPlaces: [],
    tastingSessions: [],
    tastingSessionAttendees: [],
    tastingSessionBottles: [],
    ...overrides
  };
}

function buildPerson(overrides: Partial<TastingPerson> = {}): TastingPerson {
  return {
    id: "person_1",
    name: "Alex",
    relationshipType: "friend",
    preferenceTags: ["peated"],
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: "2026-04-01T10:00:00.000Z",
    ...overrides
  };
}

function buildGroup(overrides: Partial<TastingGroup> = {}): TastingGroup {
  return {
    id: "group_1",
    name: "Friday Crew",
    memberPersonIds: ["person_1"],
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: "2026-04-01T10:00:00.000Z",
    ...overrides
  };
}

function buildPlace(overrides: Partial<TastingPlace> = {}): TastingPlace {
  return {
    id: "place_1",
    name: "Home Bar",
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: "2026-04-01T10:00:00.000Z",
    ...overrides
  };
}

function buildSession(overrides: Partial<TastingSession> = {}): TastingSession {
  return {
    id: "session_1",
    occasionType: "visit",
    sessionDate: "2026-04-10T18:00:00.000Z",
    createdAt: "2026-04-10T18:00:00.000Z",
    updatedAt: "2026-04-10T18:00:00.000Z",
    ...overrides
  };
}

function buildAttendee(overrides: Partial<TastingSessionAttendee> = {}): TastingSessionAttendee {
  return {
    id: "attendee_1",
    sessionId: "session_1",
    personId: "person_1",
    ...overrides
  };
}

function buildBottleLink(overrides: Partial<TastingSessionBottle> = {}): TastingSessionBottle {
  return {
    id: "bottle_1",
    sessionId: "session_1",
    collectionItemId: "item_1",
    ...overrides
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("tastings repository", () => {
  it("refuses to delete a person who already appears in tasting history", async () => {
    mockedReadStore.mockResolvedValue(
      buildStore({
        tastingPeople: [buildPerson()],
        tastingSessionAttendees: [buildAttendee()]
      })
    );

    await expect(deleteTastingPerson("person_1")).rejects.toThrow(
      "Cannot delete a person who already appears in tasting history."
    );

    expect(mockedWriteStore).not.toHaveBeenCalled();
  });

  it("removes a person and strips them from groups when history is clean", async () => {
    mockedReadStore.mockResolvedValue(
      buildStore({
        tastingPeople: [buildPerson(), buildPerson({ id: "person_2", name: "Beth" })],
        tastingGroups: [
          buildGroup({
            memberPersonIds: ["person_1", "person_2"]
          })
        ]
      })
    );

    await expect(deleteTastingPerson("person_1")).resolves.toBe(true);

    expect(mockedWriteStore).toHaveBeenCalledTimes(1);
    const writtenStore = mockedWriteStore.mock.calls[0]?.[0] as WhiskyStore;

    expect(writtenStore.tastingPeople?.map((entry) => entry.id)).toEqual(["person_2"]);
    expect(writtenStore.tastingGroups?.[0]?.memberPersonIds).toEqual(["person_2"]);
  });

  it("rejects quick shares for bottles that are not shareable", async () => {
    mockedReadStore.mockResolvedValue(
      buildStore({
        tastingPeople: [buildPerson()],
        collectionItems: [
          buildCollectionItem({
            id: "item_1",
            status: "wishlist",
            fillState: "sealed"
          })
        ]
      })
    );

    await expect(
      createQuickBottleShare({
        occasionType: "visit",
        sessionDate: "2026-04-14T18:00:00.000Z",
        attendeePersonIds: ["person_1"],
        collectionItemId: "item_1"
      })
    ).rejects.toThrow("Only owned bottles that are not finished can be shared.");

    expect(mockedWriteStore).not.toHaveBeenCalled();
  });

  it("builds a social summary from the latest session and dedupes repeated attendees", async () => {
  const olderSession = buildSession({
      id: "session_old",
      sessionDate: "2026-04-01T18:00:00.000Z",
      groupId: "group_old",
      placeId: "place_old"
    });
    const newerSession = buildSession({
      id: "session_new",
      sessionDate: "2026-04-10T18:00:00.000Z",
      groupId: "group_new",
      placeId: "place_new"
    });

    mockedReadStore.mockResolvedValue(
      buildStore({
        tastingPeople: [
          buildPerson({
            id: "person_1",
            name: "Alex",
            preferenceTags: ["peated", "sherry"]
          }),
          buildPerson({
            id: "person_2",
            name: "Beth",
            preferenceTags: ["fruit"]
          })
        ],
        tastingGroups: [
          buildGroup({
            id: "group_old",
            name: "Old Crew"
          }),
          buildGroup({
            id: "group_new",
            name: "New Crew"
          })
        ],
        tastingPlaces: [
          buildPlace({
            id: "place_old",
            name: "Cabinet"
          }),
          buildPlace({
            id: "place_new",
            name: "Lounge"
          })
        ],
        tastingSessions: [olderSession, newerSession],
        tastingSessionAttendees: [
          buildAttendee({
            id: "attendee_old_1",
            sessionId: "session_old",
            personId: "person_1"
          }),
          buildAttendee({
            id: "attendee_old_2",
            sessionId: "session_old",
            personId: "person_2"
          }),
          buildAttendee({
            id: "attendee_new_1",
            sessionId: "session_new",
            personId: "person_1"
          })
        ],
        tastingSessionBottles: [
          buildBottleLink({
            id: "bottle_old",
            sessionId: "session_old",
            collectionItemId: "item_1"
          }),
          buildBottleLink({
            id: "bottle_new",
            sessionId: "session_new",
            collectionItemId: "item_1"
          })
        ]
      })
    );

    const summary = await getBottleSocialSummary("item_1");

    expect(summary.lastSharedAt).toBe("2026-04-10T18:00:00.000Z");
    expect(summary.people).toEqual([
      {
        personId: "person_1",
        name: "Alex",
        relationshipType: "friend",
        preferenceTags: ["peated", "sherry"],
        lastTastedAt: "2026-04-10T18:00:00.000Z"
      },
      {
        personId: "person_2",
        name: "Beth",
        relationshipType: "friend",
        preferenceTags: ["fruit"],
        lastTastedAt: "2026-04-01T18:00:00.000Z"
      }
    ]);
    expect(summary.groups).toEqual([
      {
        groupId: "group_new",
        name: "New Crew",
        lastSessionAt: "2026-04-10T18:00:00.000Z"
      },
      {
        groupId: "group_old",
        name: "Old Crew",
        lastSessionAt: "2026-04-01T18:00:00.000Z"
      }
    ]);
    expect(summary.places).toEqual([
      {
        placeId: "place_new",
        name: "Lounge",
        lastSessionAt: "2026-04-10T18:00:00.000Z"
      },
      {
        placeId: "place_old",
        name: "Cabinet",
        lastSessionAt: "2026-04-01T18:00:00.000Z"
      }
    ]);
  });
});
