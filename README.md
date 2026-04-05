# Whisky Advisor

Whisky Advisor is a single-user web app for tracking a personal whisky collection, keeping tasting notes, comparing bottles, and getting AI-assisted guidance.

## Features

- Catalog bottles with distillery, bottler, bottler kind, and release series
- Add bottles via photo-first flow with optional barcode helper
- Save structured tasting notes and personal ratings
- Compare paid price with current web pricing
- See collection analytics and palate profile
- Compare whiskies side by side
- Export data to CSV or JSON

## Development

```bash
npm install
npm run dev
```

If service credentials are not configured, the app runs in local mock mode backed by `data/mock-store.json`.

## Production Setup

Set these environment variables before deploying:

- `NEXT_PUBLIC_APP_URL`
- `APP_LOCK_ENABLED=true`
- `APP_ACCESS_TOKEN` (private token used by `/unlock`)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (optional, but required for AI enrichment/pricing)

Important notes:

- In production, the app performs strict env validation at startup.
- With `APP_LOCK_ENABLED=true`, all app pages and API routes are private unless unlocked.
- The current bottle artwork in the app uses local placeholder assets that are safe for production use.

Deployment checklist:

- See [GO_LIVE_CHECKLIST.md](./docs/GO_LIVE_CHECKLIST.md).
