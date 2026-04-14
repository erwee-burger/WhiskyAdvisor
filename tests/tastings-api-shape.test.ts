import { afterEach, describe, expect, it, vi } from "vitest";

const mockRepository = vi.hoisted(() => ({
  createQuickBottleShare: vi.fn(),
  createTastingSession: vi.fn(),
  getTastingSessions: vi.fn(),
  deleteTastingPerson: vi.fn(),
  updateTastingPerson: vi.fn()
}));

vi.mock("@/lib/repository", () => mockRepository);

import { DELETE as deleteTastingPersonRoute } from "@/app/api/tastings/people/[personId]/route";
import { POST as postTastingSessions } from "@/app/api/tastings/sessions/route";
import { createQuickBottleShare, createTastingSession, deleteTastingPerson } from "@/lib/repository";

const mockedCreateQuickBottleShare = vi.mocked(createQuickBottleShare);
const mockedCreateTastingSession = vi.mocked(createTastingSession);
const mockedDeleteTastingPerson = vi.mocked(deleteTastingPerson);

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
