export const CHARACTER_MODELS = [
  { id: 'uniform', name: 'School uniform', url: '/assets/characters/arms_out_in_uniform.glb' },
  { id: 'nick', name: 'Nick', url: '/assets/characters/nick_unused_model.glb' },
  { id: 'little-girl', name: 'Little girl', url: '/assets/characters/the_little_girl_rigged.glb' },
  { id: 'young-tom', name: 'Young Tom', url: '/assets/characters/young_tom_-_childhood_memory.glb' },
  { id: 'kid-boy', name: 'Kid boy', url: '/assets/characters/kid_boy_rigged.glb' },
  { id: 'cartoon-kid', name: 'Cartoon kid', url: '/assets/characters/cartoon_kid.glb' },
] as const;
export const CAR_MODELS = [
  { id: 'admin', name: 'Admin car', url: '/assets/cars/admin-car.glb', rotationY: -Math.PI / 2 },
  { id: 'muscle', name: 'Classic muscle car', url: '/assets/cars/classic_muscle_car.glb', rotationY: 0 },
] as const;
export type CarModelId = typeof CAR_MODELS[number]['id'];
