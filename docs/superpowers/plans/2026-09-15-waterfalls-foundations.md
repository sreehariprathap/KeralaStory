# Waterfalls and grounded architecture — scoped Q5/Q6 delivery

Parent: [overall quality plan](2026-09-15-overall-quality.md). This pass implements the user's waterfall and slope-foundation priorities; it does not mark all Q1–Q8 gates complete.

## Tasks by complexity

| Task | Complexity / owner | Scope and acceptance |
|---|---|---|
| 1. Audit building placements | Simple / GPT-5.6 Luna | Read-only inventory of house, shop, temple and lighthouse bases; identify gaps against terrain. |
| 2. Rebuild waterfall presentation | Complex / GPT-6 Astra | Rock-backed cascade, directional flow, contact foam and connected runoff; terrain contact, reduced motion and low quality; preserve existing forest edits. |
| 3. Ground architectural bases | Complex / GPT-6 Astra | Shared footprint support computation, continuous buried foundations, visible plinths and matching collision; accessible approaches. |
| 4. Foundation regression coverage | Bounded / GPT-5.6 Luna | Test the established support contract against slopes and actual placements; no production integration edits. |
| 5. Integration and visual review | Complex / Astra | Inspect production components in the running browser, review subsystem changes, run typecheck/full tests/build/diff check, record evidence and limits. |

## Ownership and dependencies

- Waterfall worker owns `KodasseryWorld.tsx`, new waterfall component/utilities and waterfall tests.
- Foundation worker owns `KeralaWorld.tsx` and new foundation utility; supplies its interface before Luna writes tests.
- Luna owns only the assigned foundation test file after the audit.
- Integrator owns this plan and validation/build-log documentation. Existing unrelated work stays intact in the current `production` workspace; no commits, merges or publication are part of this task.
- Tasks 2 and 3 have disjoint production writes. Task 4 consumes task 3's contract. Task 5 consumes both implementations.

## Verification

- Check footprint extrema against rendered terrain, not only building-center height.
- Check steps/approaches and existing route collision regressions.
- Inspect cascade, contact foam and representative sloped buildings at gameplay distance.
- Run `npm run typecheck`, `npm test`, `npm run build`, `git diff --check`.
- Record actual status in `docs/06-build-log.md` and a scoped validation report. Performance/device release gates remain separate.
