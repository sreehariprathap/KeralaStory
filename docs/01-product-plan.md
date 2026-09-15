# Product and delivery plan

> Current delivery scope: see [08-complete-app-plan.md](08-complete-app-plan.md) and [09-model-handoffs.md](09-model-handoffs.md). Mobile play, English/Malayalam labels and cycling are now included; 07/08 specify the compressed world envelope. This document retains the original experience requirements.

## Experience

The player enters a lived-in, fictional Kerala-inspired world and can immediately walk, run, look around, and choose detours. The primary reward is seeing what lies beyond the next bend: canopy homes, luminous paddy fields, the river crossing, then the harbor opening toward the sea.

The vertical layout in the reference becomes both a north-to-south journey and a gradual descent in elevation. It is a connected 3D environment with optional side paths, not four menu destinations. The far landscape can be scenery; the playable route must be honest about where the player can go.

## First-release player journey

1. Title screen: reference-inspired map art, game title, Create explorer or Continue, settings.
2. Create explorer: display name, one of three curated anime appearance presets on a shared rig, skin/hair/clothing color options, rotating 3D preview. No asset uploads or sliders for skeletal proportions.
3. Enter world: load the origin and essential avatar assets, then place the player on a safe Kodassery overlook. Show movement help once.
4. Explore: camera-relative walking/running, jump, gentle camera orbit, discover named landmarks. No mandatory interactions or narrative gates.
5. Navigate: minimap shows position, heading, nearby paths, and one optional waypoint. Full map shows all four regions and visited landmarks.
6. Reach the harbor and continue exploring or walk back. A small location discovery message is sufficient; there is no forced ending.
7. Return later: Continue restores the local appearance, settings, discoveries, and last valid position.

Defaults are proposals chosen to make the first build achievable. Online login, other visible players, or mobile-first controls would change architecture and should be decided before those features are implemented.

## Traversal rules

- WASD or arrow keys move; Shift runs; Space jumps; mouse controls the camera; M opens map; Escape pauses/releases the pointer. Allow drag-to-orbit when pointer lock is unavailable.
- Start tuning at walk 3 m/s, run 5.5 m/s, jump apex about 0.7 m. These are playtest parameters, not fixed promises.
- No stamina, fall damage, swimming, climbing, boats, or vehicles in release one.
- Slopes and steps use collision-based traversal. Rope bridges have rigid collision even if decorative ropes move.
- Water/deep falls return the player to the last grounded safe point with a short fade. Shoreline shallows must be visibly distinct from unsafe water.
- The Kurumali bridge is the only route across the main river: prevent jumping or wading around it. It remains open both ways. Reserve space for a future guardian or toll event without implementing one.
- Use vegetation, rock faces, terrain, and readable shoreline boundaries to contain the world; avoid unexplained invisible walls on inviting paths.

## World layout

Initial playable envelope: approximately 420 m east-west by 1,050 m north-south, with scenery beyond. Tune a winding main route to roughly 1.4 km: about 8 minutes walking or 4–5 minutes running without stops. Target 15–25 minutes for a first exploratory visit with detours. Measure during blockout and shorten empty stretches before adding detail.

| Region | Approximate z band / elevation | Required identity | First playable content |
|---|---|---|---|
| Kodassery Peaks | -520 to -230 / 65–110 m | Misty Ghats-inspired ridges, canopy treehouses, rope bridges, waterfall | Origin overlook, two canopy homes, one traversable canopy bridge, waterfall overlook, winding descent |
| Kadambode | -230 to 80 / 20–65 m | Terraced paddy, plantain/banana, pepper vines, cardamom, tiled homes | Farm loop, four house exteriors, Kerala-inspired temple courtyard, stream edge, spice garden |
| Kurumali Puzha | 80 to 200 / 5–20 m | Wide blue-green river, wooden crossing, fishing banks | Bridge and approaches, two fishing spots with ambient figures, boats and nets as scenery |
| Kodaly | 200 to 530 / 2–15 m | Old Kochi-inspired harbor, colonial and modern architecture, paved streets | One compact city loop, six modular facade variants, working-harbor ambience, jetty, lighthouse exterior |

Bands describe ownership, not rectangular visual borders. Blend ground, planting, light, and audio at edges. The stream descends from the falls into the main river; the river bends toward the western estuary and sea beside Kodaly. The main crossing cuts north-bank farms off from south-bank city approaches. Draw and validate this topology before placing detailed assets.

Landmarks: origin, canopy bridge, waterfall overlook, paddy terrace, temple courtyard, spice garden, river bridge, fishing bank, market street, lighthouse, harbor jetty. All are accessible or clearly marked as scenic exteriors. Most buildings remain exteriors; never imply every door opens.

## Delivery stages and exit gates

| Stage | Deliverable | Exit gate |
|---|---|---|
| 0. Foundation | Tooling, schemas, input states, debug scene, design tokens | Clean build; placeholder avatar moves on test ground; contracts reviewed |
| 1. Movement and art slice | Kodassery sample with one approved avatar, bridge, treehouse, foliage, water, HUD | Five-minute playtest without clipping/falling through; avatar and environment match the art bible; measured frame budget |
| 2. Connected blockout | All four zones, safe descent and bridge, coordinate-based map | Walk origin → harbor → origin without teleportation or a reload; map tracks correctly |
| 3. Exploration alpha | Profile flow, three avatar presets, region dressing, discoveries, local save, ambience | First-time and return-user flows work; all identity landmarks present |
| 4. Release candidate | Loading recovery, quality tiers, accessibility, performance and browser QA | Release checklist in validation document passes; remaining issues explicit |
| Later | Quests, dialogue, accounts, cloud saves, multiplayer, touch play | Separate feature brief and contract review for each |

Do not equate a graybox with completion of the anime visual requirement. The avatar, lighting, foliage, architecture, and animation need an explicit art review. A capsule is useful in Stage 0 and unacceptable as the finished avatar.

## Scope and production reality

This is a small 3D game, not a weekend landing page. Core movement and world engineering require iterative playtesting; a consistent rigged avatar and regional asset kit are the largest visual dependencies. Small code tasks can be delegated cheaply, but they do not replace modeling, animation, or integration work.

Use original or appropriately licensed reusable assets. Keep placeholders clearly named. Asset creation/acquisition tasks must identify the actual delivery method and license before being considered ready. Generated images can support concept art, texture work, or the atlas, but are not rigged, collision-ready 3D models. No purchases or external publication are part of this plan.
