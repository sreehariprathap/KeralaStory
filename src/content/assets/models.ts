export const CHARACTER_MODELS = [
  { id: 'uniform', name: 'Maya', url: '/assets/characters/arms_out_in_uniform_rigged.glb', rig: 'uniform', rotationY: 0 },
  { id: 'nick', name: 'Niko', url: '/assets/characters/nick_unused_model.glb', rig: 'nick', rotationY: 0 },
  { id: 'little-girl', name: 'Mimi', url: '/assets/characters/the_little_girl_rigged.glb', rig: 'little-girl', rotationY: 0 },
  { id: 'young-tom', name: 'Tommy', url: '/assets/characters/young_tom_rigged.glb', rig: 'relaxed', rotationY: 0 },
  { id: 'kid-boy', name: 'Kannan', url: '/assets/characters/kid_boy_rigged.glb', rig: 'kid-boy', rotationY: 0 },
  { id: 'cartoon-kid', name: 'Kuttu', url: '/assets/characters/cartoon_kid_rigged.glb', rig: 'fitted', rotationY: 0 },
  { id: 'teenage-boy', name: 'Achu', url: '/assets/characters/anime-style_teenage_boy_rigged.glb', rig: 'relaxed', rotationY: 0 },
  { id: 'anime-boy', name: 'Appu', url: '/assets/characters/anime_boy_for_blender..glb', rig: 'appu', rotationY: Math.PI },
  { id: 'friendly-anime-boy', name: 'Kichu', url: '/assets/characters/friendly_anime_boy_rigged.glb', rig: 'relaxed', rotationY: 0 },
] as const;
export const CAR_MODELS = [
  { id: 'admin', name: 'Admin car', url: '/assets/cars/admin-car.glb', rotationY: -Math.PI / 2 },
  { id: 'muscle', name: 'Classic muscle car', url: '/assets/cars/classic_muscle_car.glb', rotationY: 0 },
  { id: 'car-carton', name: 'Cartoon car', url: '/assets/cars/car_carton.glb', rotationY: Math.PI },
  { id: 'fennec', name: 'Fennec', url: '/assets/cars/fennec_-_rocket_league_car.glb', rotationY: -Math.PI / 2 },
] as const;
/** Source assets remain visible to review tooling but cannot spawn before calibration. */
export const PENDING_CAR_MODELS = [
  { id: 'bronco', name: 'Bronco', url: '/assets/cars/bronco.glb', reason: 'Body and tyres are fused; separate wheel geometry is required.' },
  { id: 'car', name: 'Rigged car', url: '/assets/cars/car.glb', reason: 'Skinned source needs a corrected rest pose and wheel-bone calibration.' },
] as const;
export type CarModelId = typeof CAR_MODELS[number]['id'];
export const CAR_PICKER_CATALOG = [
  ...CAR_MODELS.map(model => ({ ...model, available: true as const, reason: '' })),
  ...PENDING_CAR_MODELS.map(model => ({ ...model, available: false as const })),
];
