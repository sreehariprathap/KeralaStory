export const CHARACTER_MODELS = [
  { id: 'nick', name: 'Niko', url: '/assets/characters/nick_unused_model.glb', rig: 'nick', rotationY: 0 },
  { id: 'little-girl', name: 'Mimi', url: '/assets/characters/the_little_girl_rigged.glb', rig: 'little-girl', rotationY: 0 },
  { id: 'kid-boy', name: 'Kannan', url: '/assets/characters/kid_boy_rigged.glb', rig: 'kid-boy', rotationY: 0 },
  { id: 'cartoon-kid', name: 'Kuttu', url: '/assets/characters/cartoon_kid_rigged.glb', rig: 'fitted', rotationY: 0 },
  { id: 'teenage-boy', name: 'Achu', url: '/assets/characters/anime-style_teenage_boy_rigged.glb', rig: 'relaxed', rotationY: 0 },
  { id: 'messi', name: 'Messi', url: '/assets/characters/lionel_messi_qatar_2022_rigged.glb', rig: 'messi', rotationY: 0 },
  // Supplied with its own Mixamo skeleton; the limb bones drive the same walk cycle.
  { id: 'mask-player', name: 'Player 07', url: '/assets/characters/squid_game_player_rig_version.glb', rig: 'mixamo', rotationY: 0 },
  // Rigged here from a static source (scripts/rig-characters.mjs).
  { id: 'straw-hat', name: 'Luffy', url: '/assets/characters/monkey_d_luffy_rigged.glb', rig: 'fitted', rotationY: 0 },
] as const;
export const CAR_MODELS = [
  { id: 'admin', name: 'Admin car', url: '/assets/cars/admin-car.glb', rotationY: -Math.PI / 2 },
  { id: 'muscle', name: 'Classic muscle car', url: '/assets/cars/classic_muscle_car.glb', rotationY: 0 },
  { id: 'car-carton', name: 'Cartoon car', url: '/assets/cars/car_carton.glb', rotationY: Math.PI },
  { id: 'fennec', name: 'Fennec', url: '/assets/cars/fennec_-_rocket_league_car.glb', rotationY: -Math.PI / 2 },
  // Body and tyres are one fused mesh: these two drive normally but their wheels do not visually spin.
  { id: 'bronco', name: 'Bronco', url: '/assets/cars/bronco.glb', rotationY: Math.PI / 2 },
  { id: 'cyberpunk', name: 'Cyberpunk car', url: '/assets/cars/cyberpunk-car.glb', rotationY: 0 },
  { id: 'golf-gti', name: 'Golf GTI', url: '/assets/cars/1992_volkswagen_golf_gti_mk2.glb', rotationY: 0 },
  { id: 'sports-coupe', name: 'Sports coupe', url: '/assets/cars/cartoon_sports_car.glb', rotationY: 0 },
  { id: 'supercar', name: 'Supercar', url: '/assets/cars/modern_cartoon_sports_car.glb', rotationY: 0 },
  // Authored rotated 45 degrees in its file; its wheels are fused into the body, like the Bronco.
  { id: 'toy-car', name: 'Toy car', url: '/assets/cars/cartoony_car.glb', rotationY: Math.PI * 5 / 4 },
  { id: 'lambini', name: 'Lambini GT', url: '/assets/cars/bbr_2_-_lambini_gt.glb', rotationY: 0 },
  { id: 'celero', name: 'Celero GT', url: '/assets/cars/bbr_2_-_celero_gt.glb', rotationY: 0 },
  // Source node names have left/right swapped relative to world +X; the measured coordinates rule.
  { id: 'willys-buggy', name: 'Willys buggy', url: '/assets/cars/willys_mountain_buggy_2.glb', rotationY: 0 },
] as const;
/** Source assets remain visible to review tooling but cannot spawn before calibration. */
export const PENDING_CAR_MODELS = [
  { id: 'car', name: 'Rigged car', url: '/assets/cars/car.glb', reason: 'Skinned source needs bone-driven wheel animation support, not present in the renderer yet.' },
] as const;
export type CarModelId = typeof CAR_MODELS[number]['id'];
export const CAR_PICKER_CATALOG = [
  ...CAR_MODELS.map(model => ({ ...model, available: true as const, reason: '' })),
  ...PENDING_CAR_MODELS.map(model => ({ ...model, available: false as const })),
];
