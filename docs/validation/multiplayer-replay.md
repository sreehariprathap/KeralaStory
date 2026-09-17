# Multiplayer replay validation — L02

The focused Vitest suite runs each executable scenario twice against the same
canonical world definition and requires identical serialized player checksums.
The replay tick count is also asserted, and each scenario checks its specific
final ownership/connection behavior.

| Scenario | Ticks | Expected final result | Checksum rule |
| --- | ---: | --- | --- |
| Walking apart | 120 | Two connected guests remain distinct and move in opposite X directions; each acknowledges sequence 10 | Two runs equal |
| Duplicate input | 50 | Guest remains connected, acknowledges sequence 1 only, and keeps moving in the first input direction | Two runs equal |
| Disconnect/reconnect | 80 | Same guest identity is connected after reconnect and acknowledges sequence 2 | Two runs equal |
| Safe-spawn reset | — | Not executable through the public `replayPlayers` API | Gap: no invalid-position/reset event is exposed |

The replay API accepts only `join`, `input`, `disconnect`, `reconnect`, and
`leave` events. It does not expose a way to inject a position, invalidate a
player's position, or request a safe-spawn reset. This report therefore does
not invent a replay event/schema or claim safe-reset coverage.

Focused command:

```text
npm test -- packages/simulation/tests/replayScenarios.test.ts
```
