# Go-Live Checklist

## 1. Vercel Project

- Create a Vercel project connected to this repository.
- Configure production branch deploys from `main`.
- Add your custom domain and verify HTTPS.

## 2. Environment Variables

Set these in Vercel (Production):

- `NEXT_PUBLIC_APP_URL` (for example `https://yourdomain.com`)
- `APP_LOCK_ENABLED=true`
- `APP_ACCESS_TOKEN=<strong-random-secret>`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (if using AI extraction/pricing)
- `OPENAI_MODEL` (optional override)
- `USD_TO_ZAR`, `GBP_TO_ZAR`, `EUR_TO_ZAR` (optional overrides)

## 3. Database and Storage

- Run [schema.sql](/c:/Users/erweeb/OneDrive - VATit Processing (Pty) Ltd/Erwee/Whisky/supabase/schema.sql) against production Supabase.
- Enable RLS policies for private single-user access.
- Create storage buckets for bottle images.
- Test insert/read/update paths from the deployed app.

## 4. Access Lock

- Confirm `/unlock` appears for unauthenticated visitors.
- Confirm valid token sets access cookie and grants access.
- Confirm API routes return `401` without access cookie.

## 5. App Validation

- Run locally before deploy:
  - `npm run lint`
  - `npm run build`
  - `npm test`
- Validate these flows in production:
  - Add bottle (photo + optional barcode)
  - Save tasting note
  - View collection analytics
  - Compare whiskies
  - Export CSV/JSON

## 6. Monitoring and Recovery

- Enable Vercel monitoring/log drains.
- Add Supabase backups and retention.
- Add error tracking (for example Sentry).
- Document rollback path to previous deploy.

## 7. Security and Compliance

- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Do not expose private env values to client code.
- Rotate `APP_ACCESS_TOKEN` and API keys periodically.
- Confirm all public assets are production-safe/licensed.

## 8. Final Launch Steps

- Deploy to production.
- Verify:
  - Homepage loads
  - Unlock flow works
  - API calls succeed
  - No `500` errors in logs
- Announce internal go-live and capture first-day issues.
