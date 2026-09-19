# Malakkappara Phase 3 — West Bank and Botanical Garden — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry Market Road over the Chalakkudy River on a girder bridge into a west-bank quarter of homestays and a riverside resort, with a small Botanical Garden as the tourist draw.

**Architecture:** Market Road is extended in `v2Layout.ts` and crosses on a `beam` bridge added to the shared bridge list (which already drives deck height, the dig under the span, abutments and ceiling). The west bank becomes a levelled district of the Malakkappara town site. Buildings and the garden are more `malakkapparaPlan.ts` data drawn by the existing `malakkapparaTown.ts` generator.

**Tech Stack:** TypeScript, React Three Fiber, three.js, Rapier, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-18-malakkappara-hill-town-design.md` (Phase 3)

## Global Constraints

- Measured heights along z = −668: town pad 82, a gully at 74 (x ≈ −624), the east bank 80 (x ≈ −648), water surface 80 (x −658…−680), the west bank 79–81, falling to 73–75 beyond x −700.
- Bridge deck at 83.2 m: at least 1.5 m of air under the slab over the water.
- Road control grades ≤ 10 % (`tests/v2Layout.test.ts`), so the west approach falls 83.2 → 77 over ≥ 68 m.
- West district pad y = 77, footprint x −780…−698, z −706…−632.
- The garden is a tourist attraction, not a park: about 44 × 30 m.

---

### Task 1: Market Road over the river

**Files:** `src/content/world/v2Layout.ts` (extend the road, move its cap, add the bridge, add the west district), `src/content/world/chalakkudyCityPlan.ts` (bridge entry), `src/content/world/roadMarkings.ts` (mark the west road). Test: `tests/malakkapparaBridge.test.ts`.

- Market Road: `[[-554.35, base+7, -668], [-620, base+7, -668], [-650, 83.2, -668]]` — it crosses the gully on its own embankment at pad level, then rises to the deck.
- Bridge `malakkappara-river-bridge`, style `beam`, width 9: from `[-650, 83.2, -668]` to `[-692, 83.2, -668]`.
- West road `malakkappara-west-road`: `[[-692, 83.2, -668], [-730, 79.5, -670], [-762, 77, -668]]`, ending in a turning cap (radius 9).
- District `malakkappara-west-bank` on the town site: footprint `[[-780,-706],[-698,-706],[-698,-632],[-780,-632]]`, `y: 77`.

Test: deck clears the water by ≥ 1.5 m; both bridge ends sit on dry ground within 0.4 m of their road's height; every new control segment is ≤ 10 % grade.

Commit: `feat: carry Market Road over the Chalakkudy River into the west bank`

### Task 2: West-bank quarter and Botanical Garden

**Files:** `src/content/world/malakkapparaPlan.ts` (lots + `MALAKKAPPARA_GARDEN`), `src/content/world/malakkapparaTown.ts` (garden geometry). Test: extend `tests/malakkapparaTown.test.ts`.

- North of the road: five homestay/house lots (x −710…−760, z −680…−700) and **Riverside Retreat**, a two-storey resort at (−706, −690) facing the river, with four cottages.
- South of the road: the garden, x −752…−708, z −662…−632.
- Garden contents: clipped hedge boundary, a gate arch with the board `Malakkappara Botanical Garden · സസ്യോദ്യാനം`, gravel paths in a cross, eight flower beds of bright blocks, a small glasshouse (glass box with a pitched roof), a round fountain with a jet, and benches.

Tests: garden and lots inside the west district and clear of the road; garden ≥ 40 × 28 m and ≤ 50 × 36 m; the existing lot/road/plinth invariants still hold for every new lot.

Commit: `feat: add Malakkappara's west-bank quarter and Botanical Garden`

### Task 3: Verify

- Screenshots: bridge from the east, the west quarter, the garden, and a wide town view; medium and low tiers.
- `npx vitest run --dir tests`, `npx tsc --noEmit` (ignoring the other session's in-flight bike files).
