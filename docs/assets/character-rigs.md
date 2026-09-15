# Kid boy and Little girl rigs

The game uses `kid_boy_rigged.glb` and `the_little_girl_rigged.glb`. The supplied `kid_boy.glb` and `the_little_girl.glb` remain unchanged.

Rebuild both derived assets with `node scripts/rig-characters.mjs`. The generator preserves texture bytes, UVs and materials, bakes the original node transforms into a centered 1.7 m mesh with feet at Y=0, and adds 13 bones with normalized skin weights. Unused source geometry streams are removed from the derived binary.

Each side has hip, knee, ankle, shoulder, elbow and wrist bones, beneath one stationary root. Joints are fitted separately to each source model. Kid boy's initial arm slope needs a smaller resting shoulder rotation than Little girl's T pose. Little girl's skirt uses a broad, low-weight blend between the hips and the root rather than dividing the garment rigidly between the legs.

Animation is generated in the game from measured movement speed, grounded state and bicycle riding state, using the same locomotion adapter as Nick. The derived GLBs contain skinning and skeletons; they do not contain baked animation clips. Character selection and saved model IDs remain unchanged, so existing profiles pick up the rigged versions automatically.

These are fitted procedural rigs, not artist-approved final animation assets. There is no cloth simulation, foot IK, or facial animation. Kid boy remains a dense source mesh and its skin attributes increase the runtime asset size. Visual refinement of joint deformation and skirt overlap is subject to the user's playtest. Browser/gameplay inspection is intentionally left to the user at their request.
