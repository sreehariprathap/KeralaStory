# Kerala Story implementation guardrails

Read docs/02-design-bible.md and docs/03-architecture.md before feature work. Treat docs/04-task-backlog.md as task definitions; docs/06-build-log.md records actual status.

The user requests GPT-6 Astra for core work and Luna for bounded tasks. Use Astra for physics, camera, input lifecycle, terrain and integration; delegate small UI, pure utilities, tests and data tasks to Luna when interfaces are ready. Give each agent explicit writable paths. Do not overlap writes to shared contracts, app composition or package files.

The user has expanded scope to a connected four-region prototype in Kerala circa 2000. Follow docs/07-kerala-2000s-direction.md for this expansion. Procedural preview characters and scenery are prototypes, not completion of the approved rigged anime asset milestones. Do not claim four regions are playable while only one is available.

No quests, backend, accounts, or multiplayer in this iteration. Preserve user work. Run npm run typecheck, npm test and npm run build before handoff, and inspect the actual running UI. Record checks not yet performed honestly. Avoid per-frame React state updates; physics owns movement and UI receives snapshots. Style UI with shared tokens. Keep all map coordinates tied to world data.
