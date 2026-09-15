export const CHARACTER_MODELS = [
  { id: 'uniform', name: 'Maya', url: '/assets/characters/arms_out_in_uniform_rigged.glb' },
  { id: 'nick', name: 'Niko', url: '/assets/characters/nick_unused_model.glb' },
  { id: 'little-girl', name: 'Mimi', url: '/assets/characters/the_little_girl_rigged.glb' },
  { id: 'young-tom', name: 'Tommy', url: '/assets/characters/young_tom_-_childhood_memory.glb' },
  { id: 'kid-boy', name: 'Kannan', url: '/assets/characters/kid_boy_rigged.glb' },
  { id: 'cartoon-kid', name: 'Kuttu', url: '/assets/characters/cartoon_kid.glb' },
  { id: 'teenage-boy', name: 'Achu', url: '/assets/characters/anime-style_teenage_boy.glb' },
  { id: 'anime-boy', name: 'Appu', url: '/assets/characters/anime_boy_for_blender..glb' },
  { id: 'friendly-anime-boy', name: 'Kichu', url: '/assets/characters/friendly_anime_boy.glb' },
] as const;
export const CAR_MODELS = [
  { id: 'admin', name: 'Admin car', url: '/assets/cars/admin-car.glb', rotationY: -Math.PI / 2 },
  { id: 'muscle', name: 'Classic muscle car', url: '/assets/cars/classic_muscle_car.glb', rotationY: 0 },
] as const;
export type CarModelId = typeof CAR_MODELS[number]['id'];
