import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/**
 * Production builds ship Draco-compressed models (scripts/optimize-assets.mjs). Every GLTFLoader in the app is
 * created by `useLoader`, so the decoder is attached once here rather than at each call site.
 * The decoder (bundled with a content hash by three's DRACOLoader) is only fetched when a compressed model is parsed.
 */
const draco = new DRACOLoader();
const parse = GLTFLoader.prototype.parse;
GLTFLoader.prototype.parse = function (this: GLTFLoader, ...args: Parameters<GLTFLoader['parse']>) {
  if (!(this as unknown as { dracoLoader: DRACOLoader | null }).dracoLoader) this.setDRACOLoader(draco);
  return parse.apply(this, args);
};
