# Avatar and forest review — 15 September 2026

## Fixed

The earlier generic animator selected no bones for Kichu because his source mesh has no skin. Achu, Tommy and Kuttu also lacked skeletons and used whole-object bobbing. Appu has a VRoid-style skeleton with UpperArm/LowerArm/UpperLeg/LowerLeg names; broad substring matching also selected unintended joints.

- Generated separate 13-bone, weighted GLBs for Achu, Kichu, Tommy and Kuttu using the existing reproducible rig pipeline. Original source assets are unchanged. Relaxed-arm models have their own fitting and arm-weight envelopes; they do not receive the T-pose shoulder drop.
- Appu retains his original skeleton and weights; the animation adapter maps exactly eight limb joints. Existing Maya, Niko, Mimi and Kannan rigs stay connected.
- The model catalog now explicitly supplies each animation rig and facing orientation. Removed silent generic/static animation fallbacks. Tommy and Appu face the camera consistently with the other travelers.
- Tests load every selectable GLB, validate skin influences and measure vertex deformation separately in both arms and both legs for walk, run, airborne and cycle states.
- Nine imported avatars have procedural skeletal locomotion. This is not a claim of artist-authored animation clips, finger articulation or terrain-aware foot planting.

## Trees

A deterministic subset of Kodassery forest placements uses `anime_tree_2.glb`, `jabami_anime_tree_v4.glb` and `jabami_anime_tree_v5.glb`. Approximately 904, 945 and 909 triangles per source model respectively. Their loaded scenes are already Y-up. Geometry is base-centered and normalized before instancing at the original forest's approximate canopy height. Preserve original random draws, route positions, trunk collision proxies and low-quality procedural fallbacks. No new tree assets were downloaded.

## Visual evidence

Inspected the actual running Chrome app's Kichu profile preview and Kodassery entry scene. A temporary browser review page rendered all nine production ImportedAvatar components together and exposed walk/run/airborne/cycle motion snapshots. Inspected walking and airborne silhouettes at an oblique angle and cycling from the front. All three tree assets were also rendered together using the production importer to confirm upright orientation, materials and size normalization. Temporary review files were removed. Source and posed meshes were additionally inspected in Blender. No screenshot files are claimed as committed artifacts.

## Recommended next visual passes

1. **Feet and transitions:** Add terrain-aware ankle targets (foot placement), distinct land/fall states, and artist-authored idle/walk/run clips. Measure stride against world speed to reduce sliding. Keep the current limb adapter as the fallback during asset replacement.
2. **Ground and buildings:** Replace flat path colors and repeating terrain vertex bands with a small shared painted atlas for laterite, dirt, moss, timber and roof tile. Match world-space texture scale across regions. Check color maps in sRGB and roughness/normal data as linear; preserve the GLTFLoader's existing material handling. [Three.js color management](https://threejs.org/manual/en/color-management.html).
3. **Foliage motion:** Bend leaf tips using one shared wind clock with per-instance variation, anchored trunks, matching shadow deformation, and reduced-motion/low-quality opt-outs. Avoid moving entire plants up and down.
4. **Texture and mesh budgets:** Build lower-detail versions of the large character assets, audit texture dimensions and mipmaps, and test GPU texture compression with a supported loader before increasing foliage density. [Three.js textures](https://threejs.org/manual/en/textures.html).
5. **Acceptance:** Capture the same daylight character/region views and a warmed 60-second frame-time route before and after each pass. This turn does not establish mobile, memory, cold-load or frame-rate acceptance.

## Final checks

Typecheck PASS. Full test suite PASS: 166 tests in 29 files. Production build PASS with the existing large scene-chunk warning. Diff whitespace check PASS. No new package dependencies.
