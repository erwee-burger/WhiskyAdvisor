# Remaining Tasks Checklist — Quick Reference

## Task 7: Update UI Components ⏳

**Files to modify:**
- [ ] `components/collection-card.tsx`
- [ ] `components/collection-browser.tsx`
- [ ] `app/collection/[itemId]/page.tsx`
- [ ] `components/add-bottle-form.tsx`

**Key changes:**
- [ ] Replace `item.expression.distillery.name` → `item.expression.distilleryName ?? "Unknown"`
- [ ] Replace `item.expression.bottler.name` → `item.expression.bottlerName ?? "Unknown"`
- [ ] Replace enum field access → import and use tag helpers
- [ ] Update component prop types to match new Expression interface
- [ ] Remove form inputs for removed enum fields (if any)
- [ ] Test UI renders without errors

**Completion criteria:**
- [ ] No TypeScript errors in UI components
- [ ] All spec compliance checks pass
- [ ] All code quality checks pass
- [ ] Commit with message: "refactor: update UI components to use flat expression + tags"

---

## Task 8: Final Type Check & Mock Store ⏳

**Files to modify:**
- [ ] `lib/mock-store.ts`

**Key changes:**
- [ ] Update seed data to use new flat Expression structure
- [ ] Remove distilleries/bottlers/citations/price_snapshots seed data
- [ ] Add tags to expression seeds
- [ ] Seed collection_items with direct expressionId FK
- [ ] Run full TypeScript check: `npx tsc --noEmit`

**Completion criteria:**
- [ ] Mock store uses new schema (no FK to deleted tables)
- [ ] Zero TypeScript errors across entire project
- [ ] All specs pass
- [ ] All code quality checks pass
- [ ] Commit with message: "refactor: update mock store to new schema, fix remaining types"

---

## Task 9: Supabase Migration ⏳

**Files to create:**
- [ ] `supabase/migrations/20260406_flatten_database.sql`

**Key steps in migration:**
- [ ] CREATE new columns on `expressions`:
  - [ ] `distillery_name text`
  - [ ] `bottler_name text`
  - [ ] `tags text[] DEFAULT '{}'`
- [ ] MIGRATE data:
  - [ ] Populate `distillery_name` from old `distilleries` table
  - [ ] Populate `bottler_name` from old `bottlers` table
  - [ ] Populate `tags` from enum/boolean columns
- [ ] DROP old tables:
  - [ ] `distilleries`
  - [ ] `bottlers`
  - [ ] `citations`
  - [ ] `price_snapshots`
- [ ] DROP old columns from `expressions`:
  - [ ] `distillery_id` (FK)
  - [ ] `bottler_id` (FK)
  - [ ] All enum/boolean columns (now in tags)

**Completion criteria:**
- [ ] Migration file created and valid SQL
- [ ] Can be applied via `supabase migration up`
- [ ] Spec compliance checks pass
- [ ] Code quality checks pass
- [ ] Commit with message: "feat: supabase migration — flatten database schema"

---

## Task 10: API Route Cleanup & Final Verification ⏳

**Files to modify:**
- [ ] `app/api/items/intake-photo/route.ts`
- [ ] `app/api/items/[itemId]/route.ts`
- [ ] `app/api/tasking/` endpoints (if any)
- [ ] `app/api/analytics/` endpoints (if any)

**Key changes:**
- [ ] Verify routes use updated repository functions
- [ ] Update response types to match new interfaces
- [ ] Remove references to deleted fields from request/response
- [ ] Test intake flow: photo → analyze → save → collection
- [ ] Test query/comparison endpoints work

**Completion criteria:**
- [ ] All API routes work with flat schema
- [ ] Intake-to-collection flow works end-to-end
- [ ] No TypeScript errors
- [ ] Spec compliance checks pass
- [ ] Code quality checks pass
- [ ] Commit with message: "refactor: API route cleanup and final verification"

---

## Final Verification Checklist

After all 4 tasks complete:

- [ ] Full `npx tsc --noEmit` shows zero errors
- [ ] All git commits follow naming convention
- [ ] Can create bottle via photo intake
- [ ] Can save bottle to collection
- [ ] Can query collection
- [ ] Can compare two whiskies
- [ ] All 10 tasks have spec compliance approval
- [ ] All 10 tasks have code quality approval
- [ ] Database migration is ready to apply

---

## Execution Notes

**Use Subagent-Driven Development approach:**
1. **Implement** — Write code to spec
2. **Spec Review** — Verify spec compliance
3. **Code Quality Review** — Check code quality
4. **Fix Issues** — Address reviewer findings
5. **Approve** — Mark task complete

**Files to reference:**
- Plan details: `docs/superpowers/plans/2026-04-06-database-redesign.md`
- Current status: `docs/superpowers/HANDOFF.md` (this file)
- Tag helpers: `lib/tags.ts` (already created)
- Type definitions: `lib/types.ts` (already updated)

---

## Quick Git Commands

```bash
# View recent commits
git log --oneline -10

# Check type errors
npx tsc --noEmit 2>&1 | head -50

# Add changes
git add <file>

# Commit
git commit -m "message"

# See what changed
git diff HEAD~1
```

---

**Total remaining work: ~4-6 hours** (Tasks 7-10)  
**Good luck! The hardest part is done. 🎯**
