# Whisky Advisor Implementation Spec

## 1. Product Definition

### 1.1 Goal

Whisky Advisor is a private single-user web application for managing a personal whisky collection. It combines cataloging, tasting notes, bottle enrichment from images and barcodes, market pricing, comparison tools, collection analytics, palate profiling, and recommendation features.

The app is intended to be practical first. It should help capture bottles quickly, preserve enthusiast-level detail, and provide enough intelligence to act as a useful personal whisky advisor rather than a static bottle list.

### 1.2 Primary User

- One authenticated user only
- Uses both desktop and mobile
- Wants a trustworthy personal system for owned bottles and wishlist bottles
- Cares about distillery identity, bottler identity, special releases, and pricing context

### 1.3 V1 Success Criteria

- Add a bottle from a photo-driven flow in a few minutes
- Review and correct AI-suggested whisky data before saving
- Capture and revisit personal tasting notes
- View paid price versus current web price for a bottle
- Compare two whiskies side by side
- See useful analytics and a visible palate profile
- Receive recommendations for what to drink now and what to buy next

## 2. Technical Stack

### 2.1 Application Stack

- Framework: `Next.js` with App Router
- Language: `TypeScript`
- Styling: custom CSS plus CSS variables
- Backend: Next.js route handlers
- Hosting: `Vercel`
- Database: `Supabase Postgres`
- File storage: `Supabase Storage`
- AI provider: `OpenAI`
- Export: CSV and JSON download
- PWA: installable responsive web app for phone and desktop

### 2.2 Development Mode

The codebase should support two modes:

- Production mode using Supabase
- Local mock mode using seed data and an in-repo JSON store when Supabase credentials are absent

This allows the app to remain usable during development before full service configuration is complete.

## 3. Domain Model

### 3.1 Core Entities

- `Distillery`
- `Bottler`
- `Expression`
- `CollectionItem`
- `TastingEntry`
- `ItemImage`
- `Citation`
- `PriceSnapshot`

### 3.2 Distillery

Represents the producer of the spirit.

Fields:

- `id`
- `name`
- `country`
- `region`
- `founded_year` optional
- `notes` optional

### 3.3 Bottler

Represents the company or label that released the bottle.

Fields:

- `id`
- `name`
- `bottler_kind` as `official | independent`
- `country` optional
- `notes` optional

### 3.4 Expression

Represents the actual whisky release independent of whether you own it.

Fields:

- `id`
- `name`
- `distillery_id`
- `bottler_id`
- `bottler_kind`
- `release_series` optional
- `whisky_type`
- `country`
- `region`
- `abv`
- `age_statement` optional
- `vintage_year` optional
- `distilled_year` optional
- `bottled_year` optional
- `cask_type` optional
- `cask_number` optional
- `bottle_number` optional
- `outturn` optional
- `barcode` optional
- `peat_level`
- `cask_influence`
- `flavor_tags`
- `description` optional

### 3.5 CollectionItem

Represents your owned or wishlist record for a whisky expression.

Fields:

- `id`
- `expression_id`
- `status` as `owned | wishlist`
- `fill_state` as `sealed | open | finished`
- `purchase_price` optional
- `purchase_currency`
- `purchase_date` optional
- `purchase_source` optional
- `opened_date` optional
- `finished_date` optional
- `personal_notes` optional
- `created_at`
- `updated_at`

### 3.6 TastingEntry

Represents a dated tasting note tied to a collection item.

Fields:

- `id`
- `collection_item_id`
- `tasted_at`
- `nose`
- `palate`
- `finish`
- `overall_note`
- `rating` as integer `1` to `5`

### 3.7 ItemImage

Represents bottle photos and detail shots.

Fields:

- `id`
- `collection_item_id`
- `kind` as `front | back | detail`
- `url`
- `label` optional

### 3.8 Citation

Represents a sourced fact or external reference supporting enriched data or market pricing.

Fields:

- `id`
- `entity_type`
- `entity_id`
- `field`
- `label`
- `url`
- `source_kind` as `official | retail | auction | editorial | ai`
- `confidence`
- `snippet` optional
- `created_at`

### 3.9 PriceSnapshot

Represents a cached current internet price summary for a whisky expression.

Fields:

- `id`
- `expression_id`
- `refreshed_at`
- `retail_range` optional
- `auction_range` optional

Each range includes:

- `currency`
- `low`
- `high`
- `low_zar`
- `high_zar`
- `confidence`
- `sources`

## 4. Core Product Behavior

### 4.1 Bottle Intake Flow

Primary flow is photo-first.

Steps:

1. User uploads a required front-label image.
2. User may add optional extra images and an optional barcode.
3. AI reads the label and extracts likely bottle data.
4. App attempts to match an existing expression or builds a new draft expression.
5. App enriches missing fields and attaches citations with confidence.
6. User reviews, edits, and confirms the draft before save.

Rules:

- Photo remains the primary source for identification.
- Barcode is a helper only.
- Nothing AI-generated is saved as authoritative data without user confirmation.
- Independent bottlers and special releases must be editable first-class fields, not just free text.

### 4.2 Barcode Behavior

Barcode support is optional and must behave conservatively.

- If barcode matches a known product, prefill likely fields.
- If barcode is ambiguous or generic, surface a candidate instead of auto-saving.
- If barcode fails, the app falls back to the photo/OCR flow.
- Barcode must never overwrite clear label-based or manually corrected data.
- Barcode should be useful for standard retail bottlings but not assumed reliable for cask-specific indie releases.

### 4.3 Pricing Behavior

The app tracks two separate concepts:

- `purchase price`: what you paid
- `current web price`: what the bottle appears to cost online now

Rules:

- Purchase price is optional.
- Internet pricing must be split into `retail` and `auction/secondary`.
- Display price ranges, source links, confidence, original currency, and ZAR-normalized values.
- If purchase price is missing, current web price still displays.
- If purchase price exists, show a simple paid-vs-current comparison.
- Pricing is cached and can be refreshed on demand.

### 4.4 Tasting Notes

Tasting notes are hybrid and structured.

Each tasting entry must capture:

- `nose`
- `palate`
- `finish`
- `overall_note`
- `rating`

Rules:

- Multiple tasting entries per bottle are supported
- Ratings use whole numbers from `1` to `5`
- Tasting history influences palate profiling and recommendations

### 4.5 Advisor

The app provides two main recommendation outputs:

- `drink now`
- `buy next`

Advisor scoring should consider:

- your tasting ratings
- your preferred flavor tags
- favored regions
- cask preferences
- peat comfort zone
- current bottle state
- wishlist status

Every recommendation must include a concise explanation.

### 4.6 Palate Profiling

Palate profiling is visible in the UI and not hidden behind the recommendation engine.

The system should derive:

- favored peat level
- favored cask styles
- dominant flavor tags
- favored regions
- recurring bottler and distillery patterns

This profile updates as tasting history grows and directly informs advisor ranking.

### 4.7 Comparison Mode

Comparison mode supports:

- saved vs saved
- saved vs searched
- searched vs searched

The output must be structured side by side and include:

- bottle identity
- distillery
- bottler
- release series
- ABV
- cask details
- peat level
- flavor tags
- latest price snapshot
- latest personal rating if available
- AI-generated plain-language comparison summary

### 4.8 Collection Analytics

V1 analytics must include:

- owned vs wishlist counts
- sealed vs open vs finished counts
- ratings distribution
- region split
- peat profile
- top distilleries
- top bottlers
- paid total vs current market range

## 5. Screens And UX

### 5.1 Dashboard

Purpose:

- provide a fast overview of the collection
- surface drink-now suggestions
- show value and collection highlights

Content:

- summary stats
- recommendation cards
- market value snapshot
- top analytics highlights

### 5.2 Collection Screen

Purpose:

- browse and filter saved bottles

Features:

- search
- filter by status
- filter by region
- filter by peat level
- filter by bottler kind

### 5.3 Bottle Detail Screen

Purpose:

- show the complete record for one bottle

Sections:

- bottle overview
- distillery and bottler identity
- release details
- tasting history
- pricing
- citations

### 5.4 Add Bottle Screen

Purpose:

- handle intake from image and barcode

Sections:

- image upload
- barcode input
- AI suggestion review
- editable structured form
- save action

### 5.5 Analytics Screen

Purpose:

- visualize collection composition and value

### 5.6 Compare Screen

Purpose:

- compare two whiskies with a structured side-by-side layout

### 5.7 Advisor Screen

Purpose:

- show palate profile plus drink-now and buy-next recommendations

### 5.8 Export Screen

Purpose:

- allow CSV and JSON export of the full collection dataset

## 6. API Contract

- `POST /api/items/intake-photo`
- `POST /api/items/intake-barcode`
- `POST /api/items/:id/enrich`
- `PATCH /api/items/:id`
- `POST /api/items/:id/tastings`
- `GET /api/items/:id/pricing`
- `POST /api/items/:id/pricing/refresh`
- `GET /api/analytics/collection`
- `GET /api/profile/palate`
- `POST /api/compare`
- `GET /api/advisor/drink-now`
- `GET /api/advisor/buy-next`
- `GET /api/export?format=csv|json`

Each route should be implemented with:

- strict input validation
- typed responses
- mock-mode fallback where external services are unavailable

## 7. Quality And Reliability

### 7.1 Functional Requirements

- editable AI data before save
- graceful behavior when AI is unavailable
- graceful behavior when price refresh fails
- no blocked save due to missing purchase price
- support for independent bottlers and release series

### 7.2 Non-Functional Requirements

- mobile-friendly capture flow
- clear loading and error states
- fast dashboard response with cached analytics
- no silent overwrites of user-edited fields
- visual design should feel intentional and premium, not template-like

## 8. Acceptance Criteria

- user can create a bottle record with distillery, bottler, bottler kind, and release series
- user can save tasting notes and ratings
- user can see current web price even without purchase price
- user can compare two whiskies in a side-by-side view
- user can view analytics and palate profile
- user can receive drink-now and buy-next suggestions
- user can export collection data as CSV and JSON

## 9. Build Strategy

Recommended implementation order:

1. App scaffold, theme, layout, and navigation
2. Domain types and mock data layer
3. Collection list and bottle detail pages
4. Add-bottle flow with manual and mock AI enrichment
5. Tasting notes and palate profile
6. Analytics dashboard
7. Comparison mode
8. Advisor endpoints and UI
9. Pricing endpoints and paid-vs-market display
10. Export and final polish
