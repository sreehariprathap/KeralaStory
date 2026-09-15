# Art and interface bible

## Design read

A warm, hand-painted Kerala adventure with expressive 3D anime travelers, grounded regional architecture, and an illustrated explorer's atlas. The world dominates the screen. Menus feel like carefully drawn travel materials rather than an enterprise dashboard.

The reference establishes winding composition, dense greenery, water, wood, terracotta, and the mountain-to-harbor journey. Adapt architecture to the written Kerala brief: the illustrated tall temple tower is not a requirement to repeat that silhouette. Use reference-backed Kerala-inspired timber, sloped tile roofs, courtyards, and stone bases. Treat people and places as lived-in communities; avoid caricatures of the hill-clan.

## Fixed visual rules

- Characters: expressive eyes, grouped hair shapes, approximately 6–6.5 heads tall, readable anime silhouette, moderate stylization. Comfortable locally inspired travel clothing, restrained accessories, shared animation rig.
- Surfaces: two or three broad tonal bands, soft painted variation, muted roughness, little metallic sheen. Avoid photorealistic texture packs mixed with flat primitives.
- Geometry: purposeful silhouettes and slightly softened edges. Broad leaf clusters with selected banana leaves and coconut fronds; foliage should read at walking-camera distance.
- Light: one shared warm sun and cool ambient fill. Mist increases uphill, coastal haze increases seaward. One fixed daytime setup in release one; no day/night system.
- Outlines: prioritize character readability with subtle silhouette treatment; no heavy black outline on every leaf. Disable optional outline pass on low quality while preserving the base look.
- Water: blue-green body, painted foam shapes and gentle directional movement. No expensive refraction requirement or realistic wave simulation.
- Motion: small foliage sway, slow water, restrained idle gestures. No camera shake, head bob, forced cinematic spins, or mandatory motion blur.
- Common assets, materials, sun direction, character proportions, and UI tokens remain shared across all regions.

## Palette and interface tokens

These are authored starting values. Test contrast on actual rendered controls; a palette alone does not guarantee accessibility.

| Token | Value | Use |
|---|---|---|
| `ink` | #24382E | Main text, linework |
| `paper` | #F4E8CC | Map and menu backgrounds |
| `paper-raised` | #FFF7E5 | Selected menu surfaces |
| `forest` | #285943 | Primary controls, canopy darks |
| `leaf` | #82A952 | Environment midtones, decorative planting |
| `river` | #4BA6B2 | Water and cartographic river fill |
| `terracotta` | #B96545 | Roofs and regional details |
| `gold` | #D5AA54 | Player waypoint ornament, small emphasis |
| `danger` | #9C3D32 | Actionable errors with text/icon |

Use ink on paper; light text on forest controls. Gold and river are not default small-text colors. HUD labels get opaque or near-opaque backplates so scene brightness cannot erase them.

- Typography: self-host Noto Sans for controls/body and Noto Serif for atlas headings; Noto Sans Malayalam when Malayalam labels are introduced. The serif treatment follows the supplied illustrated atlas, not a general website default. Verify font licenses and language coverage during asset intake.
- Body 16 px; small labels minimum 14 px; location titles 22–28 px; responsive menu title 32–48 px. Avoid tiny tracked all-caps instructions.
- Spacing: 4, 8, 12, 16, 24, 32 px. Corners: 6 px controls, 10 px panels. Thin ink/brown borders; no generic glass cards or neon gradients.
- One interface icon family: Phosphor regular. Centralized icon wrapper fixes weight and size. Unique map landmark illustrations are approved art assets, not arbitrary new UI glyphs.
- Panel transitions 120–180 ms fades; location label up to 240 ms. Reduced-motion mode removes transforms and decorative motion where feasible.

## Screen contracts

| Screen | Layout and behavior |
|---|---|
| Entry | Reference-inspired world artwork, concise title, Create explorer/Continue, settings. No fake progress or quest counters |
| Avatar setup | Large live preview, labeled name field and preset/color choices. Keyboard accessible controls; rotating preview pauses for reduced motion |
| Playing | Top left: name/avatar and region. Top right: north-up minimap, compass north, map button. Bottom left: collapsible control hints. Bottom center: contextual discovery text. Center remains clear |
| Full map | Large portrait atlas viewport with pan/zoom, player marker, paths, labels, one optional waypoint, legend, close button and accessible landmark list |
| Pause/settings | Labeled modal with Resume, controls, audio, quality, motion, reset to safe position, exit to title. Reset profile is a separate explicit action |
| Loading/error | Real loaded/total counts where known; otherwise an honest activity indicator. Retry and return to title on failure |

No health bar, stamina bar, experience, currency, quest panel, or hotbar until a mechanic actually uses it. Do not reserve visible empty panels for future systems.

HUD uses 24 px safe margins on roomy screens and 12 px on compact screens. Minimap starts around 184 px square, reducing toward 144 px when necessary. At narrow widths replace it with a compact map button and region label. At unsupported touch-only sizes explain the desktop gameplay requirement while keeping setup/settings usable. Controls should have at least 44×44 px interaction areas; test 200% browser zoom.

## Map rules

North is screen-up. The avatar arrow rotates with heading; the map does not spin. Full map always reveals the four region names and main route. Landmark markers switch from outline to filled when visited; the world itself remains open.

The functional base map is generated from authored world polygons, route lines, and landmark coordinates. An artist may add paper texture, hatching, typography, and ornaments on that same projection. Do not place a moving player marker directly on the perspective reference image: its distortions would mislead the player.

Waypoints are map-only guidance, not pathfinding. Show a bearing and straight-line distance, labeled as such; never imply a direct walkable route through cliffs. One waypoint at a time, removable through mouse or keyboard landmark list. Avoid floating icons over every object in the 3D scene.

## Asset contract and visual gate

- Canonical runtime format: GLB, meters, Y-up; environment pivots at base center, character pivot at feet, canonical character forward +Z. Normalize exports in the import pipeline.
- Avatar library: shared skeleton/bone names, consistent bind pose, root motion removed. Clips `idle`, `walk`, `run`, `jump`, `fall`, `land`; locomotion blending must avoid foot sliding.
- Starting budgets: avatar ≤35k triangles and ≤4 materials; hero building ≤25k triangles; foliage LODs roughly 2k/600/100 triangles. These are review ceilings, not reasons to fill unused budget.
- Usually 1k textures, 2k only for justified hero assets. Share atlases/materials; use KTX2 after the loader path is verified. Preserve editable source files outside the runtime bundle.
- Collision proxies are simple separate meshes/shapes. Leaves, ropes, fishing nets, and decorative clutter do not each get colliders.
- Manifest records asset ID, source/license, author, variant, dimensions, triangles, materials, textures, LODs, collision, and animation clips. Files use semantic IDs such as `ks_treehouse_a_v01.glb`.
- Review assets in one standard daylight test scene beside the approved avatar and a 1 m scale marker. Check silhouette, palette, texel density, outline width, animation, and cost before merging.

Before regional production, capture approved reference views: avatar front/side/back, canopy overlook, paddy path, bridge approach, harbor street, HUD over bright/dark terrain, and full map. These become the project's visual baseline. They do not exist yet; producing and reviewing them is a milestone task.

Future features may reuse or extend named tokens. They may not silently introduce new fonts, saturation levels, outline techniques, icon families, or character proportions. Record deliberate art-direction changes with before/after screenshots.
