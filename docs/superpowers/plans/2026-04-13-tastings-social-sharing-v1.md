# Tastings & Social Sharing V1

**Date:** 2026-04-13
**Status:** Ready to implement
**Scope:** New owner-only tastings area, social history model, advisor context upgrade, mock-store + Supabase schema changes

---

## Overview

The app currently knows bottles, ratings, and optional tasting entries, but it does not understand the social way the collection is actually used: taking bottles to friends, family, colleagues, and recurring whisky Fridays.

This plan adds a dedicated `Tastings` area where the owner can:

- Log a full tasting session with multiple bottles and attendees
- Log a quick "I took this bottle to these people" entry without opening a big form
- Track who has tasted which bottles
- See when a bottle was last shared
- Ask the Advisor what bottle or bottle flight to take for a visit or whisky Friday

The feature should feel native to the current app: Collection remains bottle-first, Advisor remains conversation-first, and the new `Tastings` area becomes the social memory of the collection.

---

## Product Direction

- Add a new top-level owner nav item: `Tastings`
- Keep this as a separate domain, not as an extension of collection filters or bottle notes
- Support both workflows in v1:
  - Full session logging
  - Quick bottle share logging
- Store both workflows using one underlying session model so history and advisor logic stay consistent
- Make `Tastings` owner-only; guests should not see the nav item or access the route

### V1 defaults already chosen

- Saved people include a simple relationship type: `friend | family | colleague | other`
- Saved people can also have lightweight preference tags describing what they tend to enjoy
- Saved reusable entities exist for:
  - people
  - groups
  - places
- Person preference tags stay intentionally simple in v1:
  - one positive `preferenceTags: string[]` list
  - tags can cover whisky styles, flavor families, or specific bottles/distilleries
  - no separate dislike scoring or structured flavor profile model yet
- Attendance implies tasting in v1:
  - if a person attended a session, they are treated as having tasted every bottle logged for that session
- Advisor planning supports both:
  - a single best bottle
  - a 2-4 bottle flight
- Advisor default planning goal: balanced variety, while avoiding bottles the same people had very recently
- Person preference tags act as a soft signal for advisor planning, but actual tasting history remains the stronger signal

---

## Architecture

Use a new normalized social/tastings layer rather than trying to stretch the old `TastingEntry` shape.

### Core principle

`TastingSession` becomes the source of truth for shared-drinking history. A quick bottle log is stored as a small single-bottle session under the hood.

### Why this model

- It supports both ad hoc visits and recurring whisky Fridays
- It captures bottles + people + date + place in one record
- It gives the Advisor better context than standalone bottle notes
- It keeps future expansion possible without rewriting the model again

### Existing concepts to preserve

- `CollectionItem` remains the bottle ownership record
- Ratings and favorites stay on the bottle
- `personalNotes` stays personal and bottle-specific
- Collection pages and bottle detail pages remain the main browsing/editing surfaces

---

## Data Model

Add the following new types in `lib/types.ts`.

### Directory entities

```ts
export type RelationshipType = "friend" | "family" | "colleague" | "other";
export type OccasionType = "visit" | "whisky_friday" | "other";

export interface TastingPerson {
  id: string;
  name: string;
  relationshipType: RelationshipType;
  preferenceTags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TastingGroup {
  id: string;
  name: string;
  notes?: string;
  memberPersonIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TastingPlace {
  id: string;
  name: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Session entities

```ts
export interface TastingSession {
  id: string;
  title?: string;
  occasionType: OccasionType;
  sessionDate: string; // ISO datetime
  placeId?: string;
  groupId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TastingSessionAttendee {
  id: string;
  sessionId: string;
  personId: string;
}

export interface TastingSessionBottle {
  id: string;
  sessionId: string;
  collectionItemId: string;
}
```

### Derived read models

These should be computed in the repository layer for UI and Advisor use.

```ts
export interface TastingSessionView {
  session: TastingSession;
  place?: TastingPlace;
  group?: TastingGroup;
  attendees: TastingPerson[];
  bottles: CollectionViewItem[];
}

export interface BottleSocialSummary {
  collectionItemId: string;
  lastSharedAt?: string;
  people: Array<{ personId: string; name: string; relationshipType: RelationshipType; lastTastedAt: string }>;
  groups: Array<{ groupId: string; name: string; lastSessionAt: string }>;
  places: Array<{ placeId: string; name: string; lastSessionAt: string }>;
}
```

### Store shape changes

Extend `WhiskyStore` with:

```ts
tastingPeople?: TastingPerson[];
tastingGroups?: TastingGroup[];
tastingPlaces?: TastingPlace[];
tastingSessions?: TastingSession[];
tastingSessionAttendees?: TastingSessionAttendee[];
tastingSessionBottles?: TastingSessionBottle[];
```

### Persistence rules

- Quick bottle-share flow must create:
  - one `TastingSession`
  - one or more `TastingSessionAttendee` records
  - one `TastingSessionBottle`
- Full session flow must create:
  - one `TastingSession`
  - zero or one linked `TastingGroup`
  - optional linked `TastingPlace`
  - many attendee rows
  - many bottle rows
- Only `owned` bottles with `fillState !== "finished"` may be added to a session
- Logging a session does not auto-change rating, favorite, or fill state in v1

---

## Database & Store Changes

### Supabase

Add a new migration creating:

- `tasting_people`
- `tasting_groups`
- `tasting_group_members`
- `tasting_places`
- `tasting_sessions`
- `tasting_session_attendees`
- `tasting_session_bottles`

Suggested columns:

- `tasting_people`
  - `id`
  - `name`
  - `relationship_type`
  - `preference_tags`
  - `notes`
  - `created_at`
  - `updated_at`
- `tasting_groups`
  - `id`
  - `name`
  - `notes`
  - `created_at`
  - `updated_at`
- `tasting_group_members`
  - `id`
  - `group_id`
  - `person_id`
- `tasting_places`
  - `id`
  - `name`
  - `notes`
  - `created_at`
  - `updated_at`
- `tasting_sessions`
  - `id`
  - `title`
  - `occasion_type`
  - `session_date`
  - `place_id`
  - `group_id`
  - `notes`
  - `created_at`
  - `updated_at`
- `tasting_session_attendees`
  - `id`
  - `session_id`
  - `person_id`
- `tasting_session_bottles`
  - `id`
  - `session_id`
  - `collection_item_id`

### Mock store

- Extend `data/mock-store.json` seed shape with empty arrays for the new tastings entities
- Update `lib/seed-data.ts` accordingly
- Update `lib/mock-store.ts` legacy migration logic so missing tastings arrays are safely defaulted rather than treated as schema errors

### Supabase adapter

Update `lib/supabase-store.ts` to read and write the new tables alongside the current store tables.

Important constraint:

- The current Supabase store writer is not transactional
- Keep the tastings writes grouped carefully and document that partial failures can leave incomplete session data, matching current store behavior

---

## Repository & API Changes

Add repository functions for the new tastings domain.

### Directory reads/writes

- `getTastingPeople()`
- `createTastingPerson(...)`
- `updateTastingPerson(...)`
- `deleteTastingPerson(...)`
- `getTastingGroups()`
- `createTastingGroup(...)`
- `updateTastingGroup(...)`
- `deleteTastingGroup(...)`
- `getTastingPlaces()`
- `createTastingPlace(...)`
- `updateTastingPlace(...)`
- `deleteTastingPlace(...)`

### Session reads/writes

- `getTastingSessions()`
- `getRecentTastingSessions(limit?: number)`
- `getTastingSessionById(sessionId: string)`
- `createTastingSession(...)`
- `updateTastingSession(...)`
- `deleteTastingSession(...)`
- `createQuickBottleShare(...)`

### Derived reads

- `getBottleSocialSummary(itemId: string)`
- `getTargetTastingHistory({ personId?, groupId?, placeId? })`
- `getAdvisorSocialContext()`

### API routes

Add:

- `GET/POST /api/tastings/sessions`
- `PATCH/DELETE /api/tastings/sessions/[sessionId]`
- `GET/POST /api/tastings/people`
- `PATCH/DELETE /api/tastings/people/[personId]`
- `GET/POST /api/tastings/groups`
- `PATCH/DELETE /api/tastings/groups/[groupId]`
- `GET/POST /api/tastings/places`
- `PATCH/DELETE /api/tastings/places/[placeId]`

### Validation

Add Zod schemas in `lib/schemas.ts` for:

- person payload
- group payload
- place payload
- session payload
- quick bottle share payload

Validation rules:

- person name required
- person preference tags optional and stored as a normalized string array
- person preference tags should be lightweight owner-managed hints such as `peated`, `sherry`, `smoky`, `citrus`, `Springbank`
- group name required
- place name required
- session must have at least one bottle
- session date required
- attendee list may be empty for solo/self sessions, but quick bottle share should require at least one named person or group
- bottle ids must reference owned, non-finished collection items before save

---

## UX Placement

### Top-level navigation

Add `Tastings` to the owner nav in `app/layout.tsx`.

Guest nav remains unchanged.

### New page: `/tastings`

Create a new page as the main social-drinking hub.

Recommended page sections:

1. Hero
   - explain the social use case
   - mention visits, friends, family, colleagues, and whisky Fridays
2. Quick actions
   - `Log session`
   - `Quick share`
   - `Ask advisor what to take`
3. Recent sessions
   - recent cards with date, attendees, bottles, and place/group context
4. Directory panels
   - People
   - Groups
   - Places

People cards or editor affordances should show optional preference tags so the owner can quickly remember what that person tends to enjoy.

### Bottle detail integration

On `app/collection/[itemId]/page.tsx`, add a new owner-only panel below rating and above or near chat:

- title: `Sharing history`
- show:
  - last shared date
  - recent people who tasted it
  - recent places/groups where it appeared
- include:
  - `Log taking this bottle` action

This quick action opens a lightweight flow that can capture:

- date
- people and/or group
- optional place
- optional note

Under the hood it creates a single-bottle session.

### Collection page

Do not add a full tastings UI to the Collection page in v1.

Optional small future enhancement only:

- show a subtle badge or tooltip later for "shared recently"

### Advisor page

Keep the current Advisor page, but update the hero copy and chips so social planning feels native.

Add new default prompt chips such as:

- `What should I take to whisky Friday?`
- `Which bottles should I bring to visit my family?`
- `What have my colleagues not tasted in a while?`
- `Plan me a 3-bottle flight for friends`

---

## Advisor Changes

The current advisor understands drink-now, wishlist, analytics, ratings, and deals. It needs a new social-planning branch.

### Trigger detection

Extend `detectContextTriggers()` in `lib/advisor-context.ts` to detect phrases like:

- `take`
- `bring`
- `visit`
- `going to`
- `Friday`
- `whisky Friday`
- `whisky club`
- `with my friends`
- `with my family`
- `with colleagues`

Add a new trigger such as:

```ts
socialPlanning: boolean;
```

### New context blocks

Add builder functions for:

- recent tasting sessions
- bottle share recency
- history for named people/groups/places when the query mentions them
- neglected shared bottles

Examples of context the model should receive:

- which bottles were shared with these people recently
- which owned bottles they have never had
- which bottles have not been shared in a long time
- current available owned bottles
- saved preference tags for the named people when available

### Recommendation behavior

For social-planning questions, the Advisor should:

- prefer owned bottles that are not finished
- avoid recommending the exact same bottles the target people had very recently
- optimize for balanced variety by default
- use person preference tags as a tie-breaker or nudge, not as a hard filter
- support both:
  - one bottle
  - a 2-4 bottle flight
- explain the recommendation in social terms, not only palate terms

Example reasoning shape:

- one familiar crowd-pleaser
- one more characterful bottle
- one wildcard or contrast bottle

### Repository support for advisor

Add derived helper functions that return:

- recent bottles by person
- recent bottles by group
- recent bottles by place
- bottles never tasted by a target person/group
- longest-neglected shareable bottles
- preference tags for named people referenced in the query

---

## Files Affected

### New

- `app/tastings/page.tsx`
- `app/api/tastings/sessions/route.ts`
- `app/api/tastings/sessions/[sessionId]/route.ts`
- `app/api/tastings/people/route.ts`
- `app/api/tastings/people/[personId]/route.ts`
- `app/api/tastings/groups/route.ts`
- `app/api/tastings/groups/[groupId]/route.ts`
- `app/api/tastings/places/route.ts`
- `app/api/tastings/places/[placeId]/route.ts`
- one or more tastings UI components under `components/`
- one Supabase migration for the new tastings tables

### Modify

- `app/layout.tsx`
- `app/collection/[itemId]/page.tsx`
- `components/advisor-chat.tsx`
- `lib/types.ts`
- `lib/repository.ts`
- `lib/schemas.ts`
- `lib/advisor-context.ts`
- `lib/mock-store.ts`
- `lib/supabase-store.ts`
- `lib/seed-data.ts`
- `data/mock-store.json`
- `middleware.ts` only if route visibility rules need explicit tastings handling

---

## Implementation Notes

### Session creation flow

1. User opens `Log session` or `Quick share`
2. User selects or creates people/group/place
3. User selects one or more owned bottles
4. App validates the selection
5. Repository writes session + link rows
6. Tastings page and bottle social summaries refresh

### Group behavior

- Selecting a group should prefill attendees from its member list
- The session still stores attendee rows directly
- Later group membership changes must not rewrite historical session attendees

### Bottle summary derivation

`getBottleSocialSummary(itemId)` should compute:

- most recent session date for the bottle
- recent people linked through attendee rows
- recent groups linked through session group ids
- recent places linked through session place ids

### Backward compatibility

- Existing collection flows should keep working unchanged
- Old `tastingEntries` can remain in types for now, but new social history must not depend on them
- Do not remove `tastingEntries` in this v1 task unless a separate cleanup plan is created

---

## Test Plan

### Repository and validation

- creating a person succeeds with valid name and relationship type
- creating or updating a person persists preference tags correctly
- creating a group persists member ids correctly
- creating a place succeeds with valid name
- session creation fails when bottle list is empty
- session creation fails when bottle is wishlist or finished
- quick bottle share creates one session and one bottle link row
- bottle social summary returns latest shared date correctly

### Advisor logic

- trigger detection catches social-planning phrases
- named person or group in the query adds relevant social context block
- named person in the query includes their saved preference tags in the social context block
- recommendations exclude finished bottles
- recommendations penalize bottles recently shared with the same target
- recommendations can use saved person preference tags as a soft signal without overriding recent-history avoidance
- flight mode returns varied recommendations, not near-duplicates

### UI

- owner sees `Tastings` in top nav
- guest does not see `Tastings`
- `/tastings` is inaccessible to guests
- bottle detail page shows sharing history for owner
- quick share flow creates a visible recent session entry
- group selection prefills attendees

### Data store

- mock store reads/writes new tastings entities
- Supabase adapter reads/writes new tastings tables without dropping existing collection data

---

## Out of Scope

- Per-person reaction notes or scores
- Separate like/dislike taxonomies or weighted person preference scoring
- Pour size tracking
- Automatic fill-state depletion from session logging
- Public guest tastings pages
- Writing advisor/social filters back into URLs
- Analytics dashboards for tastings trends

---

## Assumptions

- The owner wants this to be a personal private memory aid, not a multi-user collaborative product
- One person attending a session implies they tasted all bottles in that session
- Reusable people, groups, and places are worth the added structure in v1
- Lightweight person preference tags are valuable enough to store, but should remain editable freeform hints rather than a rigid tasting ontology
- Quick share convenience matters enough to warrant a dedicated bottle-first flow
- The advisor should optimize for variety first, then recency avoidance, then bottle neglect
