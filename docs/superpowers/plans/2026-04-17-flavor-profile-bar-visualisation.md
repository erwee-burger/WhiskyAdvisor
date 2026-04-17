# Flavor Profile Bar Visualisation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the pillar pill-row in the Flavor Profile section with a two-column horizontal bar grid showing each pillar's 0–10 score as a labeled progress bar.

**Architecture:** A new `FlavorBarGrid` presentational component receives `Record<FlavorPillar, number>` and renders a CSS grid of bar rows. Styles are added to `globals.css`. `bottle-record-editor.tsx` swaps the pill-row for `<FlavorBarGrid>`.

**Tech Stack:** React (Next.js), TypeScript, plain CSS (globals.css), Vitest (existing tests — no new tests needed; component has no extractable logic)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `app/globals.css` | Modify | Add `.flavor-bar-grid`, `.flavor-bar-row`, `.flavor-bar-track`, `.flavor-bar-fill` styles |
| `components/flavor-bar-grid.tsx` | Create | Presentational component — renders pillar bars |
| `components/bottle-record-editor.tsx` | Modify | Swap pill-row for `<FlavorBarGrid pillars={profileState.pillars} />` |

---

## Task 1: Add CSS for the bar grid

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add styles at the end of globals.css**

Append the following block to the bottom of `app/globals.css`:

```css
.flavor-bar-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 24px;
}

.flavor-bar-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.flavor-bar-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.82rem;
}

.flavor-bar-label {
  color: var(--text-dark);
  text-transform: capitalize;
}

.flavor-bar-value {
  color: var(--muted);
  font-size: 0.78rem;
}

.flavor-bar-track {
  height: 5px;
  background: rgba(255, 255, 255, 0.07);
  border-radius: 3px;
  overflow: hidden;
}

.flavor-bar-fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, rgba(212, 157, 69, 0.5), #d49d45);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "style: add flavor bar grid CSS"
```

---

## Task 2: Create FlavorBarGrid component

**Files:**
- Create: `components/flavor-bar-grid.tsx`

- [ ] **Step 1: Create the component**

Create `components/flavor-bar-grid.tsx` with this exact content:

```tsx
import type { FlavorPillar } from "@/lib/types";

const PILLAR_ORDER: FlavorPillar[] = [
  "smoky", "sweet", "spicy", "fruity", "oaky", "floral", "malty", "coastal"
];

export function FlavorBarGrid({ pillars }: { pillars: Record<FlavorPillar, number> }) {
  return (
    <div className="flavor-bar-grid">
      {PILLAR_ORDER.map((pillar) => {
        const value = pillars[pillar] ?? 0;
        return (
          <div className="flavor-bar-row" key={pillar}>
            <div className="flavor-bar-header">
              <span className="flavor-bar-label">{pillar}</span>
              <span className="flavor-bar-value">{value}/10</span>
            </div>
            <div className="flavor-bar-track">
              <div className="flavor-bar-fill" style={{ width: `${value * 10}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Run existing tests to confirm nothing broken**

```bash
npm test
```

Expected: all tests pass (component has no logic layer — no new test needed).

- [ ] **Step 3: Commit**

```bash
git add components/flavor-bar-grid.tsx
git commit -m "feat: add FlavorBarGrid component"
```

---

## Task 3: Wire FlavorBarGrid into bottle-record-editor

**Files:**
- Modify: `components/bottle-record-editor.tsx`

- [ ] **Step 1: Add import**

At the top of `components/bottle-record-editor.tsx`, add this import alongside the other component imports (around line 1–30):

```tsx
import { FlavorBarGrid } from "@/components/flavor-bar-grid";
```

- [ ] **Step 2: Replace the pillar pill-row**

Find this block (around line 1122–1128):

```tsx
<div className="pill-row">
  {Object.entries(profileState.pillars).map(([pillar, value]) => (
    <span className="pill" key={pillar}>
      {pillar}: {value}/10
    </span>
  ))}
</div>
```

Replace it with:

```tsx
<FlavorBarGrid pillars={profileState.pillars} />
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Start dev server and verify visually**

```bash
npm run dev
```

Open the bottle detail page for any bottle that has a flavor profile. Verify:
- The Flavor Profile section shows 8 bar rows in a 2-column grid
- Each row has the pillar name (left), `value/10` (right), and a filled amber bar
- The "Profile top signals" pills, confidence/evidence row, and Reclassify button are all still present
- Empty state ("No flavor profile saved yet.") still shows for bottles without a profile

- [ ] **Step 5: Commit**

```bash
git add components/bottle-record-editor.tsx
git commit -m "feat: replace flavor pillar pills with FlavorBarGrid"
```
