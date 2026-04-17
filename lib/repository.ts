import Papa from "papaparse";

import { buildBuyNextSuggestions, buildDrinkNowSuggestions } from "@/lib/advisor";
import { buildCollectionAnalytics } from "@/lib/analytics";
import { buildComparison } from "@/lib/comparison";
import { createId } from "@/lib/id";
import { readStore, writeStore } from "@/lib/mock-store";
import { analyzeBottleImage, buildDraftFromExpression } from "@/lib/openai";
import { buildPalateProfile } from "@/lib/profile";
import type {
  BottleSocialSummary,
  CollectionItem,
  CollectionStatus,
  CollectionViewItem,
  Expression,
  FillState,
  IntakeDraft,
  ItemImage,
  OccasionType,
  RelationshipType,
  TastingGroup,
  TastingPerson,
  TastingPlace,
  TastingSession,
  TastingSessionView,
  WhiskyStore
} from "@/lib/types";

type BottleRecordPayload = {
  name: string;
  distilleryName?: string;
  bottlerName?: string;
  brand?: string;
  country?: string;
  abv?: number;
  ageStatement?: number;
  barcode?: string;
  description?: string;
  tags: string[];
  status: CollectionStatus;
  fillState: FillState;
  purchaseCurrency: string;
  purchasePrice?: number;
  purchaseDate?: string;
  purchaseSource?: string;
  personalNotes?: string;
  frontImageUrl?: string;
  frontImageLabel?: string;
};

type TastingPersonPayload = {
  name: string;
  relationshipType: RelationshipType;
  preferenceTags: string[];
  notes?: string;
};

type TastingGroupPayload = {
  name: string;
  notes?: string;
  memberPersonIds: string[];
};

type TastingPlacePayload = {
  name: string;
  notes?: string;
};

type TastingSessionPayload = {
  title?: string;
  occasionType: OccasionType;
  sessionDate: string;
  placeId?: string;
  groupId?: string;
  notes?: string;
  attendeePersonIds: string[];
  bottleItemIds: string[];
};

type QuickBottleSharePayload = {
  title?: string;
  occasionType: OccasionType;
  sessionDate: string;
  placeId?: string;
  groupId?: string;
  notes?: string;
  attendeePersonIds: string[];
  collectionItemId: string;
};

type TastingTargetHistory = {
  people: TastingPerson[];
  groups: TastingGroup[];
  places: TastingPlace[];
  preferenceTags: string[];
  recentSessions: TastingSessionView[];
  recentBottles: CollectionViewItem[];
  neverTastedBottles: CollectionViewItem[];
};

type AdvisorSocialContext = {
  recentSessions: TastingSessionView[];
  longestNeglectedBottles: CollectionViewItem[];
  namedTargets: TastingTargetHistory[];
  people: TastingPerson[];
  groups: TastingGroup[];
  places: TastingPlace[];
};


function buildFallbackExpression(name: string, barcode?: string): Expression {
  return {
    id: createId("expr"),
    name,
    barcode,
    tags: []
  };
}



function buildDraftView(store: WhiskyStore, draft: IntakeDraft | null) {
  if (!draft) return null;
  return {
    draftId: draft.id,
    source: draft.source,
    barcode: draft.barcode,
    rawAiResponse: draft.rawAiResponse,
    expression: draft.expression,
    collection: {
      status: (draft.collection.status ?? "owned") as CollectionStatus,
      fillState: (draft.collection.fillState ?? "sealed") as FillState,
      purchaseCurrency: draft.collection.purchaseCurrency ?? "ZAR"
    }
  };
}

function upsertItemImage(store: WhiskyStore, image: ItemImage) {
  const existingIndex = store.itemImages.findIndex(
    (entry) => entry.collectionItemId === image.collectionItemId && entry.kind === image.kind
  );

  if (existingIndex >= 0) {
    store.itemImages[existingIndex] = {
      ...image,
      id: store.itemImages[existingIndex].id
    };
    return;
  }

  store.itemImages.unshift(image);
}

function buildExpressionRecord(
  expressionId: string,
  payload: BottleRecordPayload,
  baseExpression?: Expression
): Expression {
  return {
    id: expressionId,
    name: payload.name,
    distilleryName: payload.distilleryName ?? baseExpression?.distilleryName,
    bottlerName: payload.bottlerName ?? baseExpression?.bottlerName,
    brand: payload.brand ?? baseExpression?.brand,
    country: payload.country ?? baseExpression?.country,
    abv: payload.abv ?? baseExpression?.abv,
    ageStatement: payload.ageStatement ?? baseExpression?.ageStatement,
    barcode: payload.barcode ?? baseExpression?.barcode,
    description: payload.description ?? baseExpression?.description,
    imageUrl: baseExpression?.imageUrl,
    tags: payload.tags.length > 0 ? payload.tags : (baseExpression?.tags ?? [])
  };
}

function buildCollectionItemRecord(
  itemId: string,
  expressionId: string,
  payload: BottleRecordPayload,
  existingItem?: CollectionItem | null
): CollectionItem {
  const now = new Date().toISOString();

  return {
    id: itemId,
    expressionId,
    status: payload.status,
    fillState: payload.fillState,
    purchaseCurrency: payload.purchaseCurrency,
    purchasePrice: payload.purchasePrice,
    purchaseDate: payload.purchaseDate,
    purchaseSource: payload.purchaseSource,
    personalNotes: payload.personalNotes,
    rating: existingItem?.rating,
    isFavorite: existingItem?.isFavorite ?? false,
    createdAt: existingItem?.createdAt ?? now,
    updatedAt: now
  };
}

function removeExpressionIfOrphaned(store: WhiskyStore, expressionId: string) {
  const stillReferenced = store.collectionItems.some((entry) => entry.expressionId === expressionId);

  if (stillReferenced) {
    return;
  }

  store.expressions = store.expressions.filter((entry) => entry.id !== expressionId);
}

function compareIsoDatesDesc(left?: string, right?: string) {
  return (right ?? "").localeCompare(left ?? "");
}

function isShareableBottle(entry: CollectionViewItem) {
  return entry.item.status === "owned" && entry.item.fillState !== "finished";
}

function buildCollectionViewFromStore(store: WhiskyStore): CollectionViewItem[] {
  return store.collectionItems.map((item) => {
    const expression = store.expressions.find((entry) => entry.id === item.expressionId) ?? {
      id: item.expressionId,
      name: "Unknown",
      tags: []
    };
    const images = store.itemImages.filter((img) => img.collectionItemId === item.id);

    return {
      item,
      expression,
      images,
      distillery: expression.distilleryName ? { name: expression.distilleryName } : undefined,
      bottler: expression.bottlerName ? { name: expression.bottlerName } : undefined,
      priceSnapshot: item.purchasePrice
        ? {
            retail: {
              low: item.purchasePrice,
              high: item.purchasePrice,
              currency: item.purchaseCurrency ?? "ZAR"
            }
          }
        : undefined
    };
  });
}

function resolveAttendeePersonIds(
  store: WhiskyStore,
  attendeePersonIds: string[],
  groupId?: string
) {
  const personIds = [...new Set(attendeePersonIds)];

  for (const personId of personIds) {
    const exists = (store.tastingPeople ?? []).some((entry) => entry.id === personId);
    if (!exists) {
      throw new Error("One or more people could not be found.");
    }
  }

  if (!groupId) {
    return personIds;
  }

  const groupExists = (store.tastingGroups ?? []).some((entry) => entry.id === groupId);
  if (!groupExists) {
    throw new Error("Selected group could not be found.");
  }

  return personIds;
}

function ensurePlaceExists(store: WhiskyStore, placeId?: string) {
  if (!placeId) {
    return;
  }

  const exists = (store.tastingPlaces ?? []).some((entry) => entry.id === placeId);
  if (!exists) {
    throw new Error("Selected place could not be found.");
  }
}

function ensureShareableBottleIds(collection: CollectionViewItem[], bottleItemIds: string[]) {
  const shareable = new Map(
    collection.filter(isShareableBottle).map((entry) => [entry.item.id, entry] as const)
  );

  return bottleItemIds.map((bottleItemId) => {
    const bottle = shareable.get(bottleItemId);
    if (!bottle) {
      throw new Error("Only owned bottles that are not finished can be shared.");
    }

    return bottle;
  });
}

function buildTastingSessionViewsFromStore(
  store: WhiskyStore,
  collection = buildCollectionViewFromStore(store)
): TastingSessionView[] {
  const peopleById = new Map((store.tastingPeople ?? []).map((entry) => [entry.id, entry] as const));
  const groupsById = new Map((store.tastingGroups ?? []).map((entry) => [entry.id, entry] as const));
  const placesById = new Map((store.tastingPlaces ?? []).map((entry) => [entry.id, entry] as const));
  const bottlesBySessionId = new Map<string, string[]>();
  const attendeesBySessionId = new Map<string, string[]>();
  const collectionByItemId = new Map(collection.map((entry) => [entry.item.id, entry] as const));

  for (const entry of store.tastingSessionBottles ?? []) {
    const current = bottlesBySessionId.get(entry.sessionId) ?? [];
    current.push(entry.collectionItemId);
    bottlesBySessionId.set(entry.sessionId, current);
  }

  for (const entry of store.tastingSessionAttendees ?? []) {
    const current = attendeesBySessionId.get(entry.sessionId) ?? [];
    current.push(entry.personId);
    attendeesBySessionId.set(entry.sessionId, current);
  }

  return [...(store.tastingSessions ?? [])]
    .sort((left, right) => compareIsoDatesDesc(left.sessionDate, right.sessionDate))
    .map((session) => ({
      session,
      place: session.placeId ? placesById.get(session.placeId) : undefined,
      group: session.groupId ? groupsById.get(session.groupId) : undefined,
      attendees: [...new Set(attendeesBySessionId.get(session.id) ?? [])]
        .map((personId) => peopleById.get(personId))
        .filter((entry): entry is TastingPerson => Boolean(entry)),
      bottles: [...new Set(bottlesBySessionId.get(session.id) ?? [])]
        .map((itemId) => collectionByItemId.get(itemId))
        .filter((entry): entry is CollectionViewItem => Boolean(entry))
    }));
}

function buildBottleSocialSummaryFromViews(
  itemId: string,
  sessionViews: TastingSessionView[]
): BottleSocialSummary {
  const people = new Map<
    string,
    {
      personId: string;
      name: string;
      relationshipType: RelationshipType;
      preferenceTags: string[];
      lastTastedAt: string;
    }
  >();
  const groups = new Map<string, { groupId: string; name: string; lastSessionAt: string }>();
  const places = new Map<string, { placeId: string; name: string; lastSessionAt: string }>();

  const relevantSessions = sessionViews.filter((view) =>
    view.bottles.some((bottle) => bottle.item.id === itemId)
  );

  for (const view of relevantSessions) {
    for (const attendee of view.attendees) {
      const previous = people.get(attendee.id);
      if (!previous || previous.lastTastedAt < view.session.sessionDate) {
        people.set(attendee.id, {
          personId: attendee.id,
          name: attendee.name,
          relationshipType: attendee.relationshipType,
          preferenceTags: attendee.preferenceTags,
          lastTastedAt: view.session.sessionDate
        });
      }
    }

    if (view.group) {
      const previous = groups.get(view.group.id);
      if (!previous || previous.lastSessionAt < view.session.sessionDate) {
        groups.set(view.group.id, {
          groupId: view.group.id,
          name: view.group.name,
          lastSessionAt: view.session.sessionDate
        });
      }
    }

    if (view.place) {
      const previous = places.get(view.place.id);
      if (!previous || previous.lastSessionAt < view.session.sessionDate) {
        places.set(view.place.id, {
          placeId: view.place.id,
          name: view.place.name,
          lastSessionAt: view.session.sessionDate
        });
      }
    }
  }

  return {
    collectionItemId: itemId,
    lastSharedAt: relevantSessions[0]?.session.sessionDate,
    people: [...people.values()].sort((left, right) =>
      compareIsoDatesDesc(left.lastTastedAt, right.lastTastedAt)
    ),
    groups: [...groups.values()].sort((left, right) =>
      compareIsoDatesDesc(left.lastSessionAt, right.lastSessionAt)
    ),
    places: [...places.values()].sort((left, right) =>
      compareIsoDatesDesc(left.lastSessionAt, right.lastSessionAt)
    )
  };
}

function buildLongestNeglectedBottles(
  collection: CollectionViewItem[],
  sessionViews: TastingSessionView[]
) {
  const lastSharedByBottleId = new Map<string, string>();

  for (const view of sessionViews) {
    for (const bottle of view.bottles) {
      const previous = lastSharedByBottleId.get(bottle.item.id);
      if (!previous || previous < view.session.sessionDate) {
        lastSharedByBottleId.set(bottle.item.id, view.session.sessionDate);
      }
    }
  }

  return collection
    .filter(isShareableBottle)
    .sort((left, right) => {
      const leftDate = lastSharedByBottleId.get(left.item.id);
      const rightDate = lastSharedByBottleId.get(right.item.id);

      if (!leftDate && !rightDate) {
        return left.expression.name.localeCompare(right.expression.name);
      }

      if (!leftDate) {
        return -1;
      }

      if (!rightDate) {
        return 1;
      }

      return leftDate.localeCompare(rightDate);
    });
}

function matchNamedEntries<T extends { id: string; name: string }>(query: string, entries: T[]) {
  const normalizedQuery = query.toLowerCase();
  return entries.filter((entry) => normalizedQuery.includes(entry.name.toLowerCase()));
}

function buildTargetHistory(
  collection: CollectionViewItem[],
  sessionViews: TastingSessionView[],
  people: TastingPerson[],
  groups: TastingGroup[],
  places: TastingPlace[]
): TastingTargetHistory {
  const matchedSessions = sessionViews.filter((view) => {
    const matchesPeople = people.some((person) =>
      view.attendees.some((attendee) => attendee.id === person.id)
    );
    const matchesGroups = groups.some((group) => view.group?.id === group.id);
    const matchesPlaces = places.some((place) => view.place?.id === place.id);

    return matchesPeople || matchesGroups || matchesPlaces;
  });

  const recentBottles = new Map<string, CollectionViewItem>();
  for (const view of matchedSessions) {
    for (const bottle of view.bottles) {
      if (!recentBottles.has(bottle.item.id)) {
        recentBottles.set(bottle.item.id, bottle);
      }
    }
  }

  const tastedBottleIds = new Set(recentBottles.keys());
  const neverTastedBottles = collection
    .filter(isShareableBottle)
    .filter((entry) => !tastedBottleIds.has(entry.item.id));

  const preferenceTags = [...new Set(people.flatMap((person) => person.preferenceTags))];

  return {
    people,
    groups,
    places,
    preferenceTags,
    recentSessions: matchedSessions,
    recentBottles: [...recentBottles.values()],
    neverTastedBottles
  };
}

function replaceSessionLinks(
  store: WhiskyStore,
  sessionId: string,
  attendeePersonIds: string[],
  bottleItemIds: string[]
) {
  store.tastingSessionAttendees = (store.tastingSessionAttendees ?? []).filter(
    (entry) => entry.sessionId !== sessionId
  );
  store.tastingSessionBottles = (store.tastingSessionBottles ?? []).filter(
    (entry) => entry.sessionId !== sessionId
  );

  for (const personId of attendeePersonIds) {
    store.tastingSessionAttendees.unshift({
      id: createId("taste_attendee"),
      sessionId,
      personId
    });
  }

  for (const bottleItemId of bottleItemIds) {
    store.tastingSessionBottles.unshift({
      id: createId("taste_bottle"),
      sessionId,
      collectionItemId: bottleItemId
    });
  }
}

function pruneEmptyTastingSessions(store: WhiskyStore) {
  const sessionIdsWithBottles = new Set(
    (store.tastingSessionBottles ?? []).map((entry) => entry.sessionId)
  );

  const removedSessionIds = new Set(
    (store.tastingSessions ?? [])
      .filter((entry) => !sessionIdsWithBottles.has(entry.id))
      .map((entry) => entry.id)
  );

  if (removedSessionIds.size === 0) {
    return;
  }

  store.tastingSessions = (store.tastingSessions ?? []).filter(
    (entry) => !removedSessionIds.has(entry.id)
  );
  store.tastingSessionAttendees = (store.tastingSessionAttendees ?? []).filter(
    (entry) => !removedSessionIds.has(entry.sessionId)
  );
}

export async function getCollectionView(): Promise<CollectionViewItem[]> {
  const store = await readStore();
  return buildCollectionViewFromStore(store);
}

export async function getDashboardData() {
  const collection = await getCollectionView();
  const profile = buildPalateProfile(collection.filter((entry) => entry.item.status === "owned"));

  return {
    collection,
    analytics: buildCollectionAnalytics(collection),
    profile,
    drinkNow: buildDrinkNowSuggestions(collection, profile),
    buyNext: buildBuyNextSuggestions(collection, profile)
  };
}

export async function getItemById(itemId: string) {
  const collection = await getCollectionView();
  return collection.find(({ item }) => item.id === itemId) ?? null;
}

export async function getBottleSocialSummary(itemId: string) {
  const store = await readStore();
  const collection = buildCollectionViewFromStore(store);
  const sessionViews = buildTastingSessionViewsFromStore(store, collection);
  return buildBottleSocialSummaryFromViews(itemId, sessionViews);
}

export async function getTastingPeople() {
  const store = await readStore();
  return [...(store.tastingPeople ?? [])].sort((left, right) => left.name.localeCompare(right.name));
}

export async function createTastingPerson(payload: TastingPersonPayload) {
  const store = await readStore();
  const now = new Date().toISOString();

  const person: TastingPerson = {
    id: createId("taste_person"),
    name: payload.name,
    relationshipType: payload.relationshipType,
    preferenceTags: payload.preferenceTags,
    notes: payload.notes,
    createdAt: now,
    updatedAt: now
  };

  store.tastingPeople = [person, ...(store.tastingPeople ?? [])];
  await writeStore(store);
  return person;
}

export async function updateTastingPerson(personId: string, payload: TastingPersonPayload) {
  const store = await readStore();
  const personIndex = (store.tastingPeople ?? []).findIndex((entry) => entry.id === personId);

  if (personIndex < 0 || !store.tastingPeople) {
    return null;
  }

  store.tastingPeople[personIndex] = {
    ...store.tastingPeople[personIndex],
    name: payload.name,
    relationshipType: payload.relationshipType,
    preferenceTags: payload.preferenceTags,
    notes: payload.notes,
    updatedAt: new Date().toISOString()
  };

  await writeStore(store);
  return store.tastingPeople[personIndex];
}

export async function deleteTastingPerson(personId: string) {
  const store = await readStore();
  const beforeCount = (store.tastingPeople ?? []).length;
  const isReferencedInHistory = (store.tastingSessionAttendees ?? []).some(
    (entry) => entry.personId === personId
  );

  if (isReferencedInHistory) {
    throw new Error("Cannot delete a person who already appears in tasting history.");
  }

  store.tastingPeople = (store.tastingPeople ?? []).filter((entry) => entry.id !== personId);
  if ((store.tastingPeople ?? []).length === beforeCount) {
    return false;
  }

  store.tastingGroups = (store.tastingGroups ?? []).map((group) => ({
    ...group,
    memberPersonIds: group.memberPersonIds.filter((entry) => entry !== personId),
    updatedAt: new Date().toISOString()
  }));

  await writeStore(store);
  return true;
}

export async function getTastingGroups() {
  const store = await readStore();
  return [...(store.tastingGroups ?? [])].sort((left, right) => left.name.localeCompare(right.name));
}

export async function createTastingGroup(payload: TastingGroupPayload) {
  const store = await readStore();
  resolveAttendeePersonIds(store, payload.memberPersonIds);
  const now = new Date().toISOString();

  const group: TastingGroup = {
    id: createId("taste_group"),
    name: payload.name,
    notes: payload.notes,
    memberPersonIds: [...new Set(payload.memberPersonIds)],
    createdAt: now,
    updatedAt: now
  };

  store.tastingGroups = [group, ...(store.tastingGroups ?? [])];
  await writeStore(store);
  return group;
}

export async function updateTastingGroup(groupId: string, payload: TastingGroupPayload) {
  const store = await readStore();
  const groupIndex = (store.tastingGroups ?? []).findIndex((entry) => entry.id === groupId);

  if (groupIndex < 0 || !store.tastingGroups) {
    return null;
  }

  resolveAttendeePersonIds(store, payload.memberPersonIds);
  store.tastingGroups[groupIndex] = {
    ...store.tastingGroups[groupIndex],
    name: payload.name,
    notes: payload.notes,
    memberPersonIds: [...new Set(payload.memberPersonIds)],
    updatedAt: new Date().toISOString()
  };

  await writeStore(store);
  return store.tastingGroups[groupIndex];
}

export async function deleteTastingGroup(groupId: string) {
  const store = await readStore();
  const beforeCount = (store.tastingGroups ?? []).length;

  store.tastingGroups = (store.tastingGroups ?? []).filter((entry) => entry.id !== groupId);
  if ((store.tastingGroups ?? []).length === beforeCount) {
    return false;
  }

  store.tastingSessions = (store.tastingSessions ?? []).map((session) =>
    session.groupId === groupId
      ? { ...session, groupId: undefined, updatedAt: new Date().toISOString() }
      : session
  );

  await writeStore(store);
  return true;
}

export async function getTastingPlaces() {
  const store = await readStore();
  return [...(store.tastingPlaces ?? [])].sort((left, right) => left.name.localeCompare(right.name));
}

export async function createTastingPlace(payload: TastingPlacePayload) {
  const store = await readStore();
  const now = new Date().toISOString();

  const place: TastingPlace = {
    id: createId("taste_place"),
    name: payload.name,
    notes: payload.notes,
    createdAt: now,
    updatedAt: now
  };

  store.tastingPlaces = [place, ...(store.tastingPlaces ?? [])];
  await writeStore(store);
  return place;
}

export async function updateTastingPlace(placeId: string, payload: TastingPlacePayload) {
  const store = await readStore();
  const placeIndex = (store.tastingPlaces ?? []).findIndex((entry) => entry.id === placeId);

  if (placeIndex < 0 || !store.tastingPlaces) {
    return null;
  }

  store.tastingPlaces[placeIndex] = {
    ...store.tastingPlaces[placeIndex],
    name: payload.name,
    notes: payload.notes,
    updatedAt: new Date().toISOString()
  };

  await writeStore(store);
  return store.tastingPlaces[placeIndex];
}

export async function deleteTastingPlace(placeId: string) {
  const store = await readStore();
  const beforeCount = (store.tastingPlaces ?? []).length;

  store.tastingPlaces = (store.tastingPlaces ?? []).filter((entry) => entry.id !== placeId);
  if ((store.tastingPlaces ?? []).length === beforeCount) {
    return false;
  }

  store.tastingSessions = (store.tastingSessions ?? []).map((session) =>
    session.placeId === placeId
      ? { ...session, placeId: undefined, updatedAt: new Date().toISOString() }
      : session
  );

  await writeStore(store);
  return true;
}

export async function getTastingSessions() {
  const store = await readStore();
  const collection = buildCollectionViewFromStore(store);
  return buildTastingSessionViewsFromStore(store, collection);
}

export async function getRecentTastingSessions(limit = 6) {
  const sessions = await getTastingSessions();
  return sessions.slice(0, limit);
}

export async function getTastingsPageData() {
  const store = await readStore();
  const collection = buildCollectionViewFromStore(store);
  const sessionViews = buildTastingSessionViewsFromStore(store, collection);

  return {
    recentSessions: sessionViews.slice(0, 12),
    people: [...(store.tastingPeople ?? [])].sort((left, right) => left.name.localeCompare(right.name)),
    groups: [...(store.tastingGroups ?? [])].sort((left, right) => left.name.localeCompare(right.name)),
    places: [...(store.tastingPlaces ?? [])].sort((left, right) => left.name.localeCompare(right.name)),
    availableBottles: collection.filter(isShareableBottle)
  };
}

export async function getTastingSessionById(sessionId: string) {
  const sessions = await getTastingSessions();
  return sessions.find((entry) => entry.session.id === sessionId) ?? null;
}

export async function createTastingSession(payload: TastingSessionPayload) {
  const store = await readStore();
  const collection = buildCollectionViewFromStore(store);
  ensurePlaceExists(store, payload.placeId);
  const attendeePersonIds = resolveAttendeePersonIds(
    store,
    payload.attendeePersonIds,
    payload.groupId
  );
  ensureShareableBottleIds(collection, payload.bottleItemIds);

  const now = new Date().toISOString();
  const session: TastingSession = {
    id: createId("taste_session"),
    title: payload.title,
    occasionType: payload.occasionType,
    sessionDate: payload.sessionDate,
    placeId: payload.placeId,
    groupId: payload.groupId,
    notes: payload.notes,
    createdAt: now,
    updatedAt: now
  };

  store.tastingSessions = [session, ...(store.tastingSessions ?? [])];
  replaceSessionLinks(store, session.id, attendeePersonIds, payload.bottleItemIds);
  await writeStore(store);

  const sessionViews = buildTastingSessionViewsFromStore(store, collection);
  return sessionViews.find((entry) => entry.session.id === session.id) ?? null;
}

export async function updateTastingSession(sessionId: string, payload: TastingSessionPayload) {
  const store = await readStore();
  const sessionIndex = (store.tastingSessions ?? []).findIndex((entry) => entry.id === sessionId);

  if (sessionIndex < 0 || !store.tastingSessions) {
    return null;
  }

  const collection = buildCollectionViewFromStore(store);
  ensurePlaceExists(store, payload.placeId);
  const attendeePersonIds = resolveAttendeePersonIds(
    store,
    payload.attendeePersonIds,
    payload.groupId
  );
  ensureShareableBottleIds(collection, payload.bottleItemIds);

  store.tastingSessions[sessionIndex] = {
    ...store.tastingSessions[sessionIndex],
    title: payload.title,
    occasionType: payload.occasionType,
    sessionDate: payload.sessionDate,
    placeId: payload.placeId,
    groupId: payload.groupId,
    notes: payload.notes,
    updatedAt: new Date().toISOString()
  };

  replaceSessionLinks(store, sessionId, attendeePersonIds, payload.bottleItemIds);
  await writeStore(store);

  const sessionViews = buildTastingSessionViewsFromStore(store, collection);
  return sessionViews.find((entry) => entry.session.id === sessionId) ?? null;
}

export async function deleteTastingSession(sessionId: string) {
  const store = await readStore();
  const beforeCount = (store.tastingSessions ?? []).length;

  store.tastingSessions = (store.tastingSessions ?? []).filter((entry) => entry.id !== sessionId);
  if ((store.tastingSessions ?? []).length === beforeCount) {
    return false;
  }

  store.tastingSessionAttendees = (store.tastingSessionAttendees ?? []).filter(
    (entry) => entry.sessionId !== sessionId
  );
  store.tastingSessionBottles = (store.tastingSessionBottles ?? []).filter(
    (entry) => entry.sessionId !== sessionId
  );

  await writeStore(store);
  return true;
}

export async function createQuickBottleShare(payload: QuickBottleSharePayload) {
  const store = await readStore();
  const collection = buildCollectionViewFromStore(store);
  ensurePlaceExists(store, payload.placeId);
  const attendeePersonIds = resolveAttendeePersonIds(
    store,
    payload.attendeePersonIds,
    payload.groupId
  );

  if (attendeePersonIds.length === 0) {
    throw new Error("Quick share needs at least one real attendee.");
  }

  ensureShareableBottleIds(collection, [payload.collectionItemId]);
  const now = new Date().toISOString();
  const session: TastingSession = {
    id: createId("taste_session"),
    title: payload.title,
    occasionType: payload.occasionType,
    sessionDate: payload.sessionDate,
    placeId: payload.placeId,
    groupId: payload.groupId,
    notes: payload.notes,
    createdAt: now,
    updatedAt: now
  };

  store.tastingSessions = [session, ...(store.tastingSessions ?? [])];
  replaceSessionLinks(store, session.id, attendeePersonIds, [payload.collectionItemId]);
  await writeStore(store);

  const sessionViews = buildTastingSessionViewsFromStore(store, collection);
  return sessionViews.find((entry) => entry.session.id === session.id) ?? null;
}

export async function getTargetTastingHistory({
  personId,
  groupId,
  placeId
}: {
  personId?: string;
  groupId?: string;
  placeId?: string;
}) {
  const store = await readStore();
  const collection = buildCollectionViewFromStore(store);
  const sessionViews = buildTastingSessionViewsFromStore(store, collection);

  const people = (store.tastingPeople ?? []).filter((entry) => entry.id === personId);
  const groups = (store.tastingGroups ?? []).filter((entry) => entry.id === groupId);
  const places = (store.tastingPlaces ?? []).filter((entry) => entry.id === placeId);

  return buildTargetHistory(collection, sessionViews, people, groups, places);
}

export async function getAdvisorSocialContext(query = ""): Promise<AdvisorSocialContext> {
  const store = await readStore();
  const collection = buildCollectionViewFromStore(store);
  const sessionViews = buildTastingSessionViewsFromStore(store, collection);
  const people = store.tastingPeople ?? [];
  const groups = store.tastingGroups ?? [];
  const places = store.tastingPlaces ?? [];
  const matchedPeople = query ? matchNamedEntries(query, people) : [];
  const matchedGroups = query ? matchNamedEntries(query, groups) : [];
  const matchedPlaces = query ? matchNamedEntries(query, places) : [];

  return {
    recentSessions: sessionViews.slice(0, 6),
    longestNeglectedBottles: buildLongestNeglectedBottles(collection, sessionViews).slice(0, 8),
    namedTargets:
      matchedPeople.length > 0 || matchedGroups.length > 0 || matchedPlaces.length > 0
        ? [buildTargetHistory(collection, sessionViews, matchedPeople, matchedGroups, matchedPlaces)]
        : [],
    people,
    groups,
    places
  };
}

export async function getDraftViewById(draftId: string) {
  const store = await readStore();
  const draft = store.drafts.find((entry) => entry.id === draftId);
  return buildDraftView(store, draft ?? null);
}

export async function getExpressionChoiceList() {
  const store = await readStore();

  return store.expressions.map((expression) => {
    const existingItem = store.collectionItems.find((entry) => entry.expressionId === expression.id);

    return {
      itemId: existingItem?.id ?? expression.id,
      expressionId: expression.id,
      label: `${expression.name}${expression.distilleryName ? ` - ${expression.distilleryName}` : ""}`,
      subtitle: expression.bottlerName ?? "Unknown bottler"
    };
  });
}

export async function createDraftFromBarcode(barcode: string) {
  const store = await readStore();
  const matched =
    store.expressions.find((entry) => entry.barcode === barcode) ??
    store.expressions.find((entry) => barcode && entry.name.toLowerCase().includes(barcode.toLowerCase()));

  const expression = matched ?? buildFallbackExpression(`Unknown whisky (${barcode})`, barcode);
  const draft = buildDraftFromExpression(expression, "barcode", barcode);
  store.drafts.unshift(draft);
  await writeStore(store);
  return draft;
}

export async function createDraftFromPhoto(
  fileName: string,
  imageBase64?: string,
  mimeType = "image/jpeg"
): Promise<IntakeDraft> {
  const store = await readStore();
  const aiResult = await analyzeBottleImage(fileName, imageBase64, mimeType);

  const draft: IntakeDraft = {
    id: createId("draft"),
    collectionItemId: createId("item"),
    source: aiResult ? (imageBase64 ? "hybrid" : "search") : "photo",
    rawAiResponse: aiResult?.rawAiResponse,
    expression: aiResult?.expression ?? { name: fileName.replace(/\.[^.]+$/, ""), tags: [] },
    collection: {
      purchaseCurrency: "ZAR",
      status: "owned",
      fillState: "sealed"
    }
  };

  store.drafts.unshift(draft);
  await writeStore(store);
  return draft;
}


export async function saveDraftAsItem(draftId: string, payload: BottleRecordPayload) {
  const store = await readStore();
  const draftIndex = store.drafts.findIndex((entry) => entry.id === draftId);

  if (draftIndex < 0) return null;

  const draft = store.drafts[draftIndex];
  const baseExpression = draft.expression.id
    ? store.expressions.find((entry) => entry.id === draft.expression.id)
    : undefined;
  const expressionId = baseExpression?.id ?? createId("expr");
  const expressionRecord = buildExpressionRecord(expressionId, payload, baseExpression);

  const expressionIndex = store.expressions.findIndex((entry) => entry.id === expressionId);
  if (expressionIndex >= 0) {
    store.expressions[expressionIndex] = expressionRecord;
  } else {
    store.expressions.unshift(expressionRecord);
  }

  const now = new Date().toISOString();
  const collectionItem: CollectionItem = {
    id: draft.collectionItemId,
    expressionId,
    status: payload.status as CollectionStatus,
    fillState: payload.fillState as FillState,
    purchasePrice: payload.purchasePrice,
    purchaseCurrency: payload.purchaseCurrency,
    purchaseDate: payload.purchaseDate,
    purchaseSource: payload.purchaseSource,
    personalNotes: payload.personalNotes,
    createdAt: now,
    updatedAt: now
  };

  store.collectionItems.unshift(collectionItem);

  if (payload.frontImageUrl) {
    store.itemImages.unshift({
      id: createId("img"),
      collectionItemId: collectionItem.id,
      kind: "front",
      url: payload.frontImageUrl,
      label: payload.frontImageLabel
    });
  }

  // Save the bottle (draft still present so it won't be deleted by the cleanup logic)
  await writeStore(store);

  // Best-effort: remove the draft. If this fails, the bottle is already saved.
  store.drafts.splice(draftIndex, 1);
  try {
    await writeStore(store);
  } catch {
    // Draft cleanup failed — not critical, bottle is already in the collection.
  }

  return collectionItem;
}

export async function updateItem(itemId: string, payload: BottleRecordPayload) {
  const store = await readStore();
  const itemIndex = store.collectionItems.findIndex((entry) => entry.id === itemId);

  if (itemIndex < 0) {
    return null;
  }

  const existingItem = store.collectionItems[itemIndex];
  const expressionIndex = store.expressions.findIndex(
    (entry) => entry.id === existingItem.expressionId
  );

  if (expressionIndex < 0) {
    return null;
  }

  const previousExpression = store.expressions[expressionIndex];
  const updatedExpression = buildExpressionRecord(
    previousExpression.id,
    payload,
    previousExpression
  );

  store.expressions[expressionIndex] = updatedExpression;
  store.collectionItems[itemIndex] = buildCollectionItemRecord(
    existingItem.id,
    existingItem.expressionId,
    payload,
    existingItem
  );

  if (payload.frontImageUrl) {
    upsertItemImage(store, {
      id: createId("img"),
      collectionItemId: existingItem.id,
      kind: "front",
      url: payload.frontImageUrl,
      label: payload.frontImageLabel ?? "Uploaded front label"
    });
  }

  await writeStore(store);
  return store.collectionItems[itemIndex];
}

export async function deleteItem(itemId: string) {
  const store = await readStore();
  const item = store.collectionItems.find((entry) => entry.id === itemId);

  if (!item) {
    return false;
  }

  store.itemImages = store.itemImages.filter((entry) => entry.collectionItemId !== itemId);
  store.tastingSessionBottles = (store.tastingSessionBottles ?? []).filter(
    (entry) => entry.collectionItemId !== itemId
  );
  store.collectionItems = store.collectionItems.filter((entry) => entry.id !== itemId);
  pruneEmptyTastingSessions(store);
  removeExpressionIfOrphaned(store, item.expressionId);

  await writeStore(store);
  return true;
}

export async function setBottleRating(
  itemId: string,
  rating: 1 | 2 | 3 | null,
  isFavorite: boolean
) {
  const store = await readStore();
  const item = store.collectionItems.find((entry) => entry.id === itemId);

  if (!item) {
    return null;
  }

  item.rating = rating ?? undefined;
  item.isFavorite = rating === 3 ? isFavorite : false;
  item.updatedAt = new Date().toISOString();
  await writeStore(store);
  return item;
}

export async function getPricing(itemId: string) {
  const item = await getItemById(itemId);
  if (!item) return null;

  const price = item.item.purchasePrice ?? 0;
  const currency = item.item.purchaseCurrency ?? "ZAR";

  return {
    itemId,
    cachedAt: new Date().toISOString(),
    retail: price
      ? { low: price, high: price, currency }
      : null,
    auction: price
      ? { low: price, high: price, currency }
      : null
  };
}

export async function refreshPricing(itemId: string) {
  return getPricing(itemId);
}

export async function getAnalytics() {
  const collection = await getCollectionView();
  return buildCollectionAnalytics(collection);
}

export async function getPalateProfile() {
  const collection = await getCollectionView();
  return buildPalateProfile(collection.filter((entry) => entry.item.status === "owned"));
}

export async function getCollectionDashboard() {
  const collection = await getCollectionView();
  const profile = buildPalateProfile(collection.filter((entry) => entry.item.status === "owned"));
  return {
    collection,
    analytics: buildCollectionAnalytics(collection),
    profile,
    drinkNow: buildDrinkNowSuggestions(collection, profile),
    buyNext: buildBuyNextSuggestions(collection, profile)
  };
}

export async function getAdvisor(kind: "drink-now" | "buy-next") {
  const collection = await getCollectionView();
  const profile = buildPalateProfile(collection.filter((entry) => entry.item.status === "owned"));

  return kind === "drink-now"
    ? buildDrinkNowSuggestions(collection, profile)
    : buildBuyNextSuggestions(collection, profile);
}

export async function compareWhiskies(leftId: string, rightId: string) {
  const collection = await getCollectionView();
  const left = collection.find(({ item, expression }) => item.id === leftId || expression.id === leftId);
  const right = collection.find(({ item, expression }) => item.id === rightId || expression.id === rightId);

  if (!left || !right) {
    return null;
  }

  return buildComparison(left, right);
}

export async function exportCollection(format: "csv" | "json") {
  const collection = await getCollectionView();

  if (format === "json") {
    return JSON.stringify(collection, null, 2);
  }

  const rows = collection.map(
    ({ item, expression }) => ({
      expression: expression.name,
      brand: expression.brand ?? "",
      distillery: expression.distilleryName ?? "",
      bottler: expression.bottlerName ?? "",
      abv: expression.abv ?? "",
      ageStatement: expression.ageStatement ?? "",
      barcode: expression.barcode ?? "",
      description: expression.description ?? "",
      status: item.status,
      fillState: item.fillState,
      purchasePrice: item.purchasePrice ?? "",
      purchaseCurrency: item.purchaseCurrency ?? "",
      purchaseSource: item.purchaseSource ?? "",
      rating: item.rating ?? "",
      isFavorite: item.isFavorite ? "yes" : "",
      personalNotes: item.personalNotes ?? ""
    })
  );

  return Papa.unparse(rows);
}

export async function getDrafts() {
  const store = await readStore();
  return store.drafts;
}

export async function getDraftById(draftId: string) {
  const store = await readStore();
  return store.drafts.find((entry) => entry.id === draftId) ?? null;
}
