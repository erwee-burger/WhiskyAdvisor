# Tasting AI Assistant — Design Spec

**Date:** 2026-04-18

---

## Overview

Two complementary AI features on the tastings page:

- **Feature A — Tasting Suggestion Chat:** A floating chat button that lets the user ask for bottle suggestions from their collection, and apply those suggestions to the session form.
- **Feature B — Session Briefing + Name:** A button inside the session form that generates a structured pre-tasting briefing and a suggested session name, based on the selected bottles, place, and group.

---

## Feature A — Tasting Suggestion Chat

### Goal

Allow the user to ask "what should we taste tonight?" in natural language and apply the AI's answer directly to the new session form — without navigating to the advisor tab.

### UI

- A floating action button (bottom-right of the tastings page), styled consistently with the `BottleChat` button on the bottle detail page.
- Clicking opens a chat panel (side drawer or overlay) anchored to the button.
- The chat panel contains:
  - A message thread (streamed responses, same rendering as `ChatMessageContent`)
  - A text input with a send button
  - Prompt chips on first open: e.g., "Suggest bottles for a casual dinner", "What pairs well for a whisky newcomer?", "Plan a peaty session"
- When the AI returns a suggestion containing bottles, the response includes an **"Apply to tasting"** button.
- Clicking "Apply to tasting" closes the chat panel and populates the session form's `bottleItemIds` with the suggested bottles. No save occurs.

### API — `POST /api/tastings/advisor`

**Request:**
```json
{
  "messages": [UIMessage]
}
```

**Behaviour:**
- Loads the user's owned, non-finished bottles as collection context.
- Uses a tasting-specific system prompt (see below).
- Streams a response using `streamText` + `createUIMessageStreamResponse` (same pattern as `/api/advisor/chat`).
- When the AI suggests specific bottles, it embeds a structured JSON block in the response:
  ```
  {"bottleSuggestions": [{"id": "...", "name": "..."}]}
  ```
  The frontend parses this block (same pattern as the `suggestions` chips extraction in `BottleChat`) and renders the "Apply to tasting" button with the extracted IDs.

**System prompt focus:**
- Specialized for tasting occasions: occasion type, group preferences, palate diversity, tasting order considerations.
- Context includes: owned non-finished bottles (name, distillery, ABV, cask, peat level, tasting notes), palate profile, recent sessions (to avoid repeats).
- Rules: only suggest owned, non-finished bottles; give a reason for each; format suggestions in scannable markdown sections; always include the `bottleSuggestions` JSON block when recommending bottles; end with 2–3 follow-up chips.
- SA market context applied (same as main advisor).

### Component — `TastingChat`

New component in `components/tasting-chat.tsx`, modelled on `BottleChat`:
- `useChat` hook pointed at `/api/tastings/advisor`
- `extractBottleSuggestions(content)` — parses the JSON block from the AI response
- Renders an "Apply to tasting" button when suggestions are present
- Accepts an `onApply(bottleItemIds: string[])` callback prop
- The tastings page passes this callback to set the session form's `bottleItemIds`

---

## Feature B — Session Briefing + Name

### Goal

When the user has selected bottles for a session (and optionally a place/group), let them generate a structured tasting briefing and a suggested session name with one click.

### UI

**Name suggestion:**
- A small sparkle/AI icon button next to the session title input in the session form.
- Only active when at least one bottle is selected.
- Clicking populates the title field with the AI-suggested name (editable).

**Briefing generation:**
- A "Generate briefing" button in the notes section of the session form.
- Only active when at least one bottle is selected.
- Clicking replaces/populates the notes textarea with the structured briefing output (fully editable before saving).
- A loading state is shown while generating.

### API — `POST /api/tastings/briefing`

**Request:**
```json
{
  "bottleItemIds": ["..."],
  "placeId": "..." | null,
  "groupId": "..." | null,
  "attendeePersonIds": ["..."],
  "occasionType": "..." | null
}
```

**Response (JSON, not streamed):**
```json
{
  "suggestedName": "The Peated Coastal Evening",
  "briefing": {
    "tastingOrder": [
      { "bottleName": "...", "reason": "Start here because..." }
    ],
    "bottleProfiles": [
      {
        "bottleName": "...",
        "keyNotes": ["smoke", "citrus", "vanilla"],
        "watchFor": "Look for the tequila cask influence on the finish.",
        "background": "Distilled on Islay, finished in Mexican tequila casks..."
      }
    ],
    "groupContext": "...",
    "tips": ["...", "..."]
  }
}
```

**Behaviour:**
- Loads full bottle details for the selected IDs.
- Loads place and group/person details if provided.
- Sends a single non-streamed completion request.
- Returns structured JSON parsed from the model response.

**Formatted output in notes:**
The frontend formats the JSON briefing into readable text before inserting it into the notes textarea:

```
## Tasting Order
1. Smokehead Tequila Cask — Start here because it opens clean before the heavier malts.
2. ...

## Bottle Profiles
### Smokehead Tequila Cask
Key notes: smoke, citrus, vanilla
Watch for: The tequila cask influence on the finish.
Background: Distilled on Islay, finished in Mexican tequila casks...

## Tips
- Serve at room temperature
- Take your time between drams
```

This text lands in the notes textarea, fully editable, before any save.

---

## Data Flow

```
Tastings Page
├── TastingChat (floating)
│   └── POST /api/tastings/advisor  (streaming)
│       └── onApply(ids) → SessionForm.bottleItemIds
│
└── SessionForm
    ├── [AI name button] → POST /api/tastings/briefing → title field
    └── [Generate briefing] → POST /api/tastings/briefing → notes textarea
```

---

## What Is Not In Scope

- Saving the AI conversation history.
- Web search for the tasting chat (collection-only context).
- Regenerating the briefing with different parameters (user edits manually).
- Multiple name suggestions (single best suggestion only).
