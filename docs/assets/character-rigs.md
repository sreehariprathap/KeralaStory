# Fitted character rigs

The game uses `kid_boy_rigged.glb`, `the_little_girl_rigged.glb`, `lungi_raja_rigged.glb` and `monkey_d_luffy_rigged.glb`. The supplied originals remain unchanged in `asset-sources/characters/`.

Rebuild the derived assets with `node scripts/rig-characters.mjs` (pass source file names to rebuild only those). `lionel_messi_qatar_2022_rigged.glb` (Messi, T-pose, realistic proportions) uses the same generator and kicks left-footed in the football poses. The generator preserves texture bytes, UVs and materials, bakes the original node transforms into a centered 1.7 m mesh with feet at Y=0, and adds 13 bones with normalized skin weights. Normals and tangents are transformed with the mesh, including tangent handedness for reflected transforms. Unused source geometry streams are removed from the derived binary.

Each side has hip, knee, ankle, shoulder, elbow and wrist bones, beneath one stationary root. Joints are fitted separately to each source model. Kid boy's initial arm slope needs a smaller resting shoulder rotation than Little girl's T pose. Little girl's skirt uses a broad, low-weight blend between the hips and the root rather than dividing the garment rigidly between the legs.

Lungi Raja's arms run down and out from the shoulder, so its joints sit on that diagonal; the lungi reuses the skirt blend so the legs swing inside the cloth. The straw-hat boy is a wide T pose with the arms level at four-fifths of its height, spread across 23 source meshes that all share the one skeleton.

Characters supplied with their own skeleton skip this generator: `ultimate_spider_man.glb` and `squid_game_player_rig_version.glb` carry Mixamo skeletons, and the `mixamo` rig maps `mixamorig:LeftUpLeg`/`Leg`/`Arm`/`ForeArm` (the loader drops the colon) onto the same hip, knee, shoulder and elbow joints. Their exported Mixamo clip is never played; the game poses the bones itself.

Animation is generated in the game from measured movement speed, grounded state and bicycle riding state, using the same locomotion adapter as Nick. The derived GLBs contain skinning and skeletons; they do not contain baked animation clips. Character selection and saved model IDs remain unchanged, so existing profiles pick up the rigged versions automatically.

These are fitted procedural rigs, not artist-approved final animation assets. There is no cloth simulation, foot IK, or facial animation. Kid boy remains a dense source mesh and its skin attributes increase the runtime asset size. Visual refinement of joint deformation and skirt overlap is subject to the user's playtest. Browser/gameplay inspection is intentionally left to the user at their request.
