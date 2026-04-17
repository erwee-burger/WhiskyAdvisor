# Flavor Profile Bar Visualisation

**Date:** 2026-04-17
**Status:** Approved

## Summary

Replace the current pill-row display in the Flavor Profile section of `bottle-record-editor.tsx` with a two-column horizontal bar grid. Each pillar gets a labeled row with a filled progress bar, making relative strengths immediately scannable without requiring the user to parse raw numbers.

## Scope

Single-component change. No new data, no new API, no schema changes. The `ExpressionFlavorProfile.pillars` object already contains the 0–10 values needed.

## Design

### Layout

A two-column CSS grid where each cell is one pillar row containing:
- Pillar name (capitalized, left-aligned)
- `value/10` label (right-aligned, muted)
- A thin track bar with a filled amber-gradient segment proportional to `value / 10`

Eight pillars → four rows × two columns.

### Visual style

Matches existing design tokens:
- Track background: `rgba(255,255,255,0.07)`
- Fill: `linear-gradient(90deg, rgba(212,157,69,0.5), #d49d45)`
- Label color: `var(--text-dark)` / `var(--muted)`
- Track height: 5px, border-radius: 3px

### What stays

- Section title ("Flavor profile") and subtitle
- Reclassify button (owner-only)
- Confidence / Evidence / Explanation meta row
- "Profile top signals" pill row (top notes)
- Empty state ("No flavor profile saved yet.")

### What changes

- The `pill-row` containing `{pillar}: {value}/10` spans is replaced with the `FlavorBarGrid` component.

## Component

A new `FlavorBarGrid` component in `components/flavor-bar-grid.tsx`:

```ts
type Props = { pillars: Record<FlavorPillar, number> }
```

Renders a `div.flavor-bar-grid` (CSS grid, 2 cols) with one `.flavor-bar-row` per pillar. Styles added to `globals.css`.

## Files

| File | Change |
|------|--------|
| `components/flavor-bar-grid.tsx` | Create — new component |
| `components/bottle-record-editor.tsx` | Replace pill-row with `<FlavorBarGrid pillars={profileState.pillars} />` |
| `app/globals.css` | Add `.flavor-bar-grid`, `.flavor-bar-row`, `.flavor-bar-track`, `.flavor-bar-fill` styles |

## Out of scope

- Radar/spider chart (considered and rejected in favour of bars)
- Animation or hover interactions
- Any changes to how the profile is computed or stored
