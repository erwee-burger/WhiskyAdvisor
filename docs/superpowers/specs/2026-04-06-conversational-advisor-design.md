# Conversational Whisky Advisor — Design Spec

**Date:** 2026-04-06
**Status:** Approved

---

## Overview

Transform the existing static advisor page (drink-now / buy-next cards) into a conversational AI interface that can answer any question about the user's collection, give flexible insights, and make personalised recommendations. The AI has access to the full collection context and responds in a warm, adaptive tone.

---

## Goals

- Replace the rigid scored-card advisor with a free-form conversational interface
- Support all question types: collection analysis, recommendations, learning, and shopping
- Feel like a knowledgeable friend who knows your shelf — adaptive tone, warm undertone, opinionated
- Keep the existing palate profile and scored suggestions as supporting context, not the hero
- Short-term conversation persistence (last 20 messages via localStorage)

---

## Architecture

### Files

| File | Role |
|---|---|
| `app/advisor/page.tsx` | Restructured — chat-first layout, fetches initial context server-side |
| `components/advisor-chat.tsx` | Chat UI: message list, streaming display, input, suggestion chips |
| `components/advisor-insights.tsx` | Collapsible section: palate profile cards + drink-now/buy-next cards |
| `app/api/advisor/chat/route.ts` | New streaming API endpoint |
| `lib/advisor-context.ts` | Smart context assembler — always-on + conditional fetching |
| `lib/advisor.ts` | Existing scoring logic — unchanged, feeds context |

### Data Flow

1. User opens advisor page → server fetches palate profile + collection summary
2. Page renders with a proactive AI opening message (generated once per session)
3. User types a question → client POSTs `{ messages, query }` to `/api/advisor/chat`
4. Server runs keyword analysis on `query` to determine conditional context needed
5. Server assembles system prompt with context and calls OpenAI GPT-4o with streaming
6. Client renders streamed response word-by-word via Vercel AI SDK `useChat` hook
7. Messages synced to `localStorage` after each turn, capped at 20

---

## Smart Context Assembly

### Always Included (every message, ~800 tokens)

- Palate profile (favored regions, cask styles, peat tag, flavor tags)
- Collection summary (owned/wishlist/open/finished counts, top distilleries, top regions)
- Current drink-now top 4 and buy-next top 4 (from existing scoring)
- Last 20 messages of conversation history

### Conditionally Included (triggered by query analysis, ~600 tokens max)

| Trigger pattern | Extra context fetched |
|---|---|
| Specific bottle/distillery name | Full expression details + tasting notes for that bottle |
| "open tonight", "drink now", "what should I have" | All owned+open bottles with ratings |
| "buy", "wishlist", "next purchase" | Full wishlist with prices + palate match scores |
| "analytics", "collection", "how many", "stats" | Full analytics payload |
| "tasting", "notes", "rating" | Recent tasting entries (last 10) |

Trigger detection uses lightweight keyword/regex matching on the query string — no extra AI call.

---

## Chat UI

### Page Layout

```
┌─────────────────────────────────────┐
│  Advisor                            │
│  "Your collection, talking back."   │
├─────────────────────────────────────┤
│                                     │
│  [AI opening message]               │
│  [User message]                     │
│  [AI response - streams in]         │
│  ...                                │
│                                     │
├─────────────────────────────────────┤
│  [Suggestion chips]                 │
│  ┌─────────────────────────────┐    │
│  │ Ask anything...          ▶  │    │
│  └─────────────────────────────┘    │
├─────────────────────────────────────┤
│  ▼ Your profile & picks            │  ← collapsible
└─────────────────────────────────────┘
```

### Suggestion Chips

3-4 rotating prompts shown above the input to seed conversation. Initial set:

- "What should I open tonight?"
- "What's missing from my shelf?"
- "Which bottle have I neglected the longest?"
- "Surprise me with an insight."

Chips update after each AI response with contextually relevant follow-ups (generated as part of the AI response payload).

### Streaming

Uses Vercel AI SDK `useChat` hook. Handles streaming, message state, loading indicators, and error recovery. No hand-rolled stream parsing.

### Persistence

`useChat` message state synced to `localStorage` on every update. Rehydrated on page load. Capped at 20 messages — oldest drop when limit hit.

### Opening Message

Generated once per session on first load via the chat endpoint with a system-injected prompt:

> "Greet the user warmly and surface one genuinely interesting insight from their collection. Keep it to 2-3 sentences."

Cached in `sessionStorage` to avoid re-firing on every render or navigation.

---

## API Route: `/api/advisor/chat`

### Request

```ts
{
  messages: Message[],  // full conversation history
  query: string         // latest user message (used for context trigger detection)
}
```

### Response

Streaming text response (Vercel AI SDK compatible).

### System Prompt Structure

```
You are a personal whisky advisor for this collection.

PERSONALITY: You are warm, opinionated, and genuinely enthusiastic about
whisky. You adapt your tone to match how the user speaks — casual when they
are casual, technical when they go deep. Underneath everything, you have
strong opinions and aren't afraid to share them.

COLLECTION CONTEXT:
{palate profile}
{collection summary}
{drink-now / buy-next suggestions}
{conditional: specific bottle / wishlist / analytics / tasting notes}

RULES:
- Only advise based on what's in the collection context above
- If asked about something not in the context, say so honestly
- Never invent tasting notes or ratings the user hasn't written
- Keep responses conversational — no bullet-point walls unless the user asks
- When recommending a bottle, always give a reason tied to their actual palate
- At the end of each response, suggest 2-3 natural follow-up questions as a
  JSON block: {"suggestions": ["...", "...", "..."]}
```

### Model

GPT-4o. Reasoning quality is critical — cheaper models produce generic advice that undermines the feature.

---

## What Stays Unchanged

- `lib/advisor.ts` — scoring logic untouched, output feeds into context assembly
- `AdvisorCard` component — reused inside the collapsible insights section
- `ProfileCard` component — reused inside the collapsible insights section
- `/api/advisor/drink-now` and `/api/advisor/buy-next` routes — kept for context assembly

---

## Out of Scope (V1)

- Saving/searching conversation history beyond last 20 messages
- Multi-session memory ("last week you asked about...")
- Voice input
- Image-based questions ("what's this bottle?")
