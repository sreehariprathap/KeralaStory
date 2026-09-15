# Fitted character rigs

The game uses `kid_boy_rigged.glb`, `the_little_girl_rigged.glb` and `arms_out_in_uniform_rigged.glb`. The supplied originals remain unchanged.

Rebuild the derived assets with `node scripts/rig-characters.mjs`. The generator preserves texture bytes, UVs and materials, bakes the original node transforms into a centered 1.7 m mesh with feet at Y=0, and adds 13 bones with normalized skin weights. Normals and tangents are transformed with the mesh, including tangent handedness for reflected transforms. Unused source geometry streams are removed from the derived binary.

Each side has hip, knee, ankle, shoulder, elbow and wrist bones, beneath one stationary root. Joints are fitted separately to each source model. Kid boy's initial arm slope needs a smaller resting shoulder rotation than Little girl's T pose. Little girl's skirt uses a broad, low-weight blend between the hips and the root rather than dividing the garment rigidly between the legs.

School uniform uses its own fitted joint positions and the same skirt blend. An arm-depth mask keeps the rear hair attached to the stationary root, and a tighter upper-arm weighting boundary protects the face. Its dense source geometry and textures make the rigged asset approximately 45 MiB; optimization remains a separate asset-production task.

The initial uniform depth mask was incorrectly centered at normalized Z=0.10 while the arm surface lies near Z=0.043. That left much of each arm partially attached to the root and produced fan-shaped stretching when lowering the shoulders. The corrected shoulder/elbow/wrist positions center the mask on the measured arm surface. Regression coverage now checks full distal-arm attachment and triangle edge stretch in idle/walk poses, beyond the original bind-pose and normalized-weight checks.

Animation is generated in the game from measured movement speed, grounded state and bicycle riding state, using the same locomotion adapter as Nick. The derived GLBs contain skinning and skeletons; they do not contain baked animation clips. Character selection and saved model IDs remain unchanged, so existing profiles pick up the rigged versions automatically.

These are fitted procedural rigs, not artist-approved final animation assets. There is no cloth simulation, foot IK, or facial animation. Kid boy remains a dense source mesh and its skin attributes increase the runtime asset size. Visual refinement of joint deformation and skirt overlap is subject to the user's playtest. Browser/gameplay inspection is intentionally left to the user at their request.
