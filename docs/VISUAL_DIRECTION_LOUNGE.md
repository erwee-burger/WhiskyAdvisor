# Whisky Advisor Visual Direction (Lounge / Cellar)

## Design Intent
Build a private collector interface that feels like a premium whisky lounge: dark, intimate, calm, and tactile. The UI should feel curated and trustworthy, not flashy.

## Color System
- App background: deep blue-black to charcoal (`#090c12` -> `#0f141d`)
- Primary surfaces: desaturated slate/navy (`#121722`, `#1a202b`)
- Wood accents: dark cherry (`#2b0f14`, `#3a141c`, `#5a1d26`)
- Highlight metal/light: warm amber/brass (`#d49d45`, `#e7bf74`)
- Typography:
  - Primary text `#f3e9d8`
  - Secondary `#d5c6ad`
  - Muted `#a59174`

## Typography
- Headings and key labels: `Cormorant Garamond`-style serif mood
- Body and compact metadata: same family for mockup consistency
- Weight approach: medium/regular with generous spacing

## Surface Rules
- Rounded panels with thin amber lines
- Two-layer surface gradients for depth
- Light reflections are subtle, never glossy-heavy
- Avoid bright white; all highlights are warm and soft

## Interaction Rules
- Hover states should lift key objects (bottles/cards)
- Active elements receive amber halo and deeper shadow
- Popups/tooltips always render above cabinet and scene layers

## Screen-Specific Direction
- Collection: cabinet-driven visual hero with dynamic shelves
- Dashboard: intelligence-first cards with tasteful warmth
- Bottle Detail: hero bottle, pricing triad, tasting timeline, and source trace
- Advisor: recommendation cards with rationale chips
- Compare: side-by-side emphasis with clear differential badges

## Component Language
- Top bar with pill nav and active amber state
- Metric card with large numeric focus
- Chip tags for tasting profile and metadata
- Timeline blocks for tastings and pricing history

## Motion
- Keep motion brief and intentional: 150-220ms
- No continuous decorative animation
- Use motion only to support hierarchy and focus

## Implementation Notes
- Theme tokens are defined in [bar-theme.css](/c:/Users/erweeb/OneDrive - VATit Processing (Pty) Ltd/Erwee/Whisky/mockups/styles/bar-theme.css)
- New mockups using this system:
  - [dashboard-lounge.html](/c:/Users/erweeb/OneDrive - VATit Processing (Pty) Ltd/Erwee/Whisky/mockups/dashboard-lounge.html)
  - [bottle-detail-lounge.html](/c:/Users/erweeb/OneDrive - VATit Processing (Pty) Ltd/Erwee/Whisky/mockups/bottle-detail-lounge.html)
  - [collection-cabinet.html](/c:/Users/erweeb/OneDrive - VATit Processing (Pty) Ltd/Erwee/Whisky/mockups/collection-cabinet.html)

## Next Build Sequence
1. Port theme tokens into app-level CSS variables.
2. Implement app shell (top nav, section spacing, card primitives).
3. Implement Dashboard and Bottle Detail first.
4. Bring Collection mockup logic into real components using live data.
5. Finish with Advisor, Compare, and Analytics pages.
