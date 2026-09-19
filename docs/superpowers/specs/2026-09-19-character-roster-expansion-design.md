# Character Roster Expansion — Design

Date: 2026-09-19
Branch: `feature/map-expansion`
Status: approved for implementation

## Scope

Add 13 new playable characters, supplied as untracked `.glb` files in
`public/assets/characters/kerala/` (4) and
`public/assets/characters/Anime and HQ/` (9), taking the roster from 8 to 21.

Every new character must walk, ride, swim, jump and play football with the
same limb motion as the existing eight. The current runtime cannot absorb
them as-is: it resolves limb bones by a hardcoded chain of name regexes,
assumes a T-pose when drooping the arms, derives left/right from world-origin
sign, and sizes models from a bounding box that is wrong for two of the new
skinned assets.

This spec covers the runtime changes that make the new rigs work, the
measuring tooling for the static models, the registry rows, and the
verification pass. It does not touch the store, the character picker, the
NPC system or multiplayer — all of those already derive from
`CHARACTER_MODELS`.

## Asset inventory

Measured from the supplied files. "Bbox H" is the glTF scene bounding-box
height; "bones" is whether the file ships a skin.

| File | Bones | Limb naming | Pose | Notes |
| --- | --- | --- | --- | --- |
| `kerala/anushka_shetty_3d_model.glb` | yes (74) | `LeftUpLeg_063` | T-pose | Clean. |
| `kerala/indian_man_with_suit.glb` | yes (53) | `LeftUpLeg_3` | T-pose | Ships an unused idle animation. |
| `kerala/indian_man_in_dhoti.glb` | yes (68) | `LeftUpLeg_057` | arms down | **Rotated 90°** — L/R separated along Z. Bbox ≈1.7× the figure. |
| `kerala/police2_indian_bikes_driving_3d_model.glb` | no | — | T-pose | Narrow lower body, arms out at y≈0.75. |
| `Anime and HQ/free_fire_full_scorpio_evo_bundle_3d_model.glb` | yes (66) | `mixamorig:LeftUpLeg_056` | A-pose | **Bbox 0.009 vs bones ≈79 units.** |
| `Anime and HQ/rin_itoshi_free_fire_skin.glb` | yes (80) | `bone_LeftLegUpper_03` | A-pose | **Bbox 0.171 vs bones ≈2.8. Skeleton offset in −x: both legs read as one side.** |
| `Anime and HQ/free_fire_male_6.glb` | no | — | A-pose ~45° | Shared base body. |
| `Anime and HQ/free_fire_new_gojo_3d_model.glb` | no | — | A-pose ~45° | Shared base body. |
| `Anime and HQ/freefire_new_gojo_coal_model.glb` | no | — | A-pose ~45° | Shared base body. |
| `Anime and HQ/freefire_new_sukuna_3d_model.glb` | no | — | A-pose ~45° | Shared base body. |
| `Anime and HQ/free_fire_ramandhan_2025_character_3d.glb` | no | — | A-pose ~45° | Shared base body. |
| `Anime and HQ/freefire_new_male_3d_model_by_djajang_studio.glb` | no | — | A-pose ~45° | Shared base body. |
| `Anime and HQ/freefire_new_male_3d_model_by_djajang_studio (1).glb` | no | — | A-pose ~45° | Shared base body. |

The seven shared-base-body Free Fire models have silhouettes agreeing to
within 0.01 of normalised height, so one measured profile serves all seven
with only per-model nudges.

## Decisions

| Question | Decision |
| --- | --- |
| Scope | All 13 ship, including the three defective assets. |
| Bone resolution | Extract a `resolveSkeleton` module with a scheme table. Not a longer regex chain inside `createNickAnimation`, and not build-time bone renaming. |
| Arm droop | Derived from each model's rest pose, for all 21 characters. The per-rig-name constants (`1.35` / `.62` / `0`) are deleted. |
| Droop regression risk | Guarded by a test pinning derived values against today's constants for the existing 8. A model that cannot be derived correctly gets an explicit `armDrop` override in the registry. |
| Left/right | Sign relative to the skeleton's own hip midline, not world-origin x. |
| Skinned bounds | CPU-skin a vertex subsample through the bind matrices. Absurd resulting scale throws at load. |
| Static models | Rigged by `scripts/rig-characters.mjs` from landmarks emitted by a new `scripts/measure-character.mjs`. |
| Source layout | Sources move to `asset-sources/characters/` (unshipped); only `*_rigged.glb` outputs are served, per existing convention. |
| `rig` field in `models.ts` | Becomes an optional override. Resolution is by detection, not declaration. |
| Verification | Unit tests plus headless walk-cycle screenshots of all 21 characters, reviewed individually. |

## Architecture

### `src/game/player/resolveSkeleton.ts` (new)

Owns everything that reads a skeleton's rest pose. Exports
`resolveSkeleton(root: Object3D): ResolvedSkeleton`.

Scheme table, tried in order; the first scheme yielding exactly 8 joints
(2 sides × 4 parts) wins:

| Scheme | Pattern | Covers |
| --- | --- | --- |
| `kerala` | `^Kerala(Hip\|Knee\|Shoulder\|Elbow)_([LR])_0\d+$` | every procedurally rigged model |
| `nick` | `^Nick:?(Hip\|Knee\|Shoulder\|Elbow)_([LR])_0\d+$` | Niko |
| `vrm` | `^J_Bip_([LR])_(UpperLeg\|LowerLeg\|UpperArm\|LowerArm)_\d+$` | appu |
| `biped` | `^(?:bone_)?(?:mixamorig:?)?(Left\|Right)(UpLeg\|LegUpper\|Leg\|Arm\|ForeArm)_\d+$` | squid-game, scorpio, anushka, suit, dhoti, rin_itoshi |

`biped` maps `UpLeg`/`LegUpper`→Hip, `Leg`→Knee, `Arm`→Shoulder,
`ForeArm`→Elbow. The alternation is ordered longest-first and the regex is
fully anchored, so `LeftUpLeg_01` cannot match as `Leg` and
`LeftForeArm1_015` (an intermediate twist bone) matches nothing.

`ResolvedSkeleton` carries:

- `joints` — bone, part, side, rest quaternion, sorted parents-before-children.
- `scheme` — which table row matched, for diagnostics and tests.
- `midline` — mean x of the two Hip bones in root space.
- `hipHeight` — as today, moved here from `createNickAnimation`.
- `armDrop` — per side, derived (below).

On failure it throws naming every scheme tried and the partial matches found
per scheme, replacing today's `"${rig} is missing the expected limb bones."`

### Rest-pose derivation

**Side.** `Math.sign(jointX − midline) || 1`, where `midline` is the mean x of
the two Hip bones in root space. Today's `Math.sign(point.x)` assumes the
skeleton straddles the origin; `rin_itoshi`'s hips sit at x ≈ −2.55 and −3.14,
so both limbs currently resolve to the same side and the legs would move in
lockstep.

**Droop.** `armDrop = authored − REST_SPLAY`, where `authored` is the angle of
the shoulder→elbow vector off the downward vertical in root space, and
`REST_SPLAY = 0.22` rad (≈12.5°) is the slight outward splay the arms keep in
the final standing pose.

This formula was reverse-engineered from the three existing constants and
reproduces all of them, which is the evidence the derivation is sound rather
than a plausible guess:

| Rig | shoulder→elbow | `authored` | `authored − 0.22` | current constant |
| --- | --- | --- | --- | --- |
| `cartoon_kid` (T-pose) | (.155, 0) | 1.571 | 1.351 | 1.35 |
| `kid_boy` | (.125, −.110) | 0.849 | 0.629 | 0.62 |
| `anime-style_teenage_boy` (`relaxed`) | (.035, −.170) | 0.203 | −0.017 | 0 |

All three land within 0.03 rad. The Free Fire A-pose measures `authored` ≈
0.785, deriving `armDrop` ≈ 0.565 — roughly half the T-pose droop, which is
what its 45° arms need. Derived per side so asymmetric rigs do not skew.

`models.ts` may carry an optional `armDrop` override; when present it wins.
This is the escape hatch for any model the derivation gets wrong, and for any
of the existing 8 that the regression test flags.

### `src/game/player/nickAnimation.ts`

Loses bone discovery, side detection, hip-height measurement and the droop
constant chain. It calls `resolveSkeleton` and keeps only locomotion, riding,
swimming, airborne and football posing. The `CharacterRig` union stops being
required input; it survives only as an optional hint for behaviour that is
genuinely per-character rather than per-skeleton — currently just `kickSide`
for Messi.

### `src/game/render/ModelAsset.tsx`

`Box3.setFromObject(root, true)` walks node transforms, which for a
`SkinnedMesh` is bind-pose-independent and therefore wrong whenever a file's
node scales and inverse-bind matrices disagree. `scorpio` reports 0.009 units
against ≈79-unit bones; `rin_itoshi` 0.171 against ≈2.8. Both would scale by
`height / size.y` into the hundreds.

Fix: when the subtree contains a `SkinnedMesh`, compute bounds by CPU-skinning
a deterministic vertex subsample (stride chosen to cap work at a few thousand
vertices per mesh) through `skeleton.boneMatrices` and the geometry's bind
matrix, expanding a `Box3` from the results. Unskinned models keep the current
path.

Guard: if the resulting scale falls outside roughly 0.02×–50×, throw naming
the model, following the existing `Invalid model bounds: ${url}` precedent, so
a malformed asset fails loudly at load instead of spawning a 300-metre
character.

### `scripts/measure-character.mjs` (new)

Reads a static `.glb` and emits a candidate profile object ready to paste into
`rig-characters.mjs`. It derives, in normalised (height = 1) space:

- `hip`, `knee`, `ankle` from the leg column's x-extent and the vertical bands
  where the silhouette narrows.
- `shoulder`, `elbow`, `wrist` by tracing the outer silhouette from the widest
  band up to the neck, fitting the arm axis.
- `skirt` from whether the leg split is occluded by cloth above knee height.
- `relaxed` / `armRadius` when the arms lie close to the torso.

Output is a starting point, not gospel — each profile is confirmed or
corrected against the rendered walk cycle before it lands.

### `scripts/rig-characters.mjs`

Eight new profile entries appended to the existing `profiles` array. No
changes to the rigging algorithm itself: its `weights()` already interpolates
the arm axis between `shoulder` and `wrist`, so a 45° A-pose is handled by
data alone.

### `src/content/assets/models.ts`

13 new `CHARACTER_MODELS` rows. Static models point at their `*_rigged.glb`
output; skinned models point at the supplied file. `rig` is omitted except
where an override is needed. `rotationY` corrects the dhoti.

Proposed names — placeholders the user may overwrite without affecting
implementation:

| Source | Name | Source | Name |
| --- | --- | --- | --- |
| `anushka_shetty` | Anjali | `free_fire_male_6` | Arjun |
| `indian_man_in_dhoti` | Achappan | `free_fire_new_gojo` | Gojo |
| `indian_man_with_suit` | George | `freefire_new_gojo_coal` | Gojo Noir |
| `police2_indian_bikes_driving` | Shaji SI | `freefire_new_sukuna` | Sukuna |
| `free_fire_full_scorpio_evo_bundle` | Scorpio | `free_fire_ramandhan_2025` | Ramzan |
| `rin_itoshi_free_fire_skin` | Rin | `..._djajang_studio` | Vishnu |
| | | `..._djajang_studio (1)` | Manu |

### Asset layout

Sources for the 8 static models move from `public/assets/characters/**` to
`asset-sources/characters/`, matching the existing convention that unrigged
sources are not shipped. The 5 skinned models stay under
`public/assets/characters/` since they are served directly. The two supplied
subdirectories (`kerala/`, `Anime and HQ/`) are flattened; the space in
`Anime and HQ` is a URL hazard and the grouping carries no runtime meaning.

## Defective assets

**`indian_man_in_dhoti`** — left and right bones separate along Z rather than
X, so the model is authored 90° off. Corrected with `rotationY` in the
registry. Its bounding box is ≈1.7× the figure's height, which would shrink
the character to ≈60% scale; the stray geometry is stripped using the
`hiddenNodes` prop `ModelAsset` already supports. If the stray geometry proves
to be welded into the character mesh rather than a separate node, the model is
re-exported into `asset-sources/` instead.

**`free_fire_full_scorpio_evo_bundle`** and **`rin_itoshi_free_fire_skin`** —
resolved by the bind-pose bounds fix above; no per-asset handling.

**`rin_itoshi`** additionally depends on midline-relative side detection.

## Testing

**Unit — `resolveSkeleton`**
- Each scheme resolves 8 joints from a synthetic bone tree built to that
  naming convention, and reports the expected `scheme`.
- Scheme precedence: a tree matching two schemes resolves to the earlier one.
- Near-miss bones (`LeftForeArm1_015`, `LeftHandThumb1_018`, `LeftShoulder_08`)
  are excluded; a `biped` tree containing them still resolves exactly 8.
- An offset skeleton (both hips at negative x) splits into one joint per side.
- Droop derivation returns ≈1.35 for a synthetic T-pose, ≈0.56 for a 45°
  A-pose, ≈0 for arms-down.
- A tree missing one limb throws, and the message names the schemes tried.

**Regression — the existing 8**
- Derived `armDrop` for each currently shipping character matches its present
  constant (1.35 / .62 / 0) within tolerance. This is the guard against the
  derivation silently changing characters that already look right. Any model
  that fails gets an `armDrop` override and an explaining comment rather than
  a loosened tolerance.
- `hipHeight` for the existing 8 is unchanged by the move into
  `resolveSkeleton`.

**Unit — bounds**
- A synthetic skinned mesh whose node scale and inverse-bind matrices disagree
  produces bind-pose bounds, not node-transform bounds.
- An unskinned mesh takes the existing path and is unchanged.
- A model whose scale lands outside the sane band throws with its URL.

**Visual — all 21 characters**
Headless CDP walk-cycle capture per the established screenshot workflow,
reviewed frame by frame for: arms not intersecting legs or torso, knees
bending forward, left and right limbs in antiphase, no skin stretching at the
shoulder or hip seam, and plausible standing height against a known reference.
Any failure is corrected in the profile or via an `armDrop` override and
re-shot. All 21 are shot, not just the 13 new ones, because the droop change
touches every character.

## Out of scope

- The store, character picker, NPC and multiplayer code — all derive from
  `CHARACTER_MODELS` and need no change.
- Per-character abilities, voice lines or animations beyond the shared
  locomotion set.
- Texture or mesh optimisation of the supplied assets.
- Replacing the procedural NPC primitives with rigged models.
