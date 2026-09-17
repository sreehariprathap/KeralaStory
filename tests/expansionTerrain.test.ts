import { describe, expect, it } from 'vitest';
import { EXPANSION_GROUND, EXPANSION_LAYOUT, hasGroundAt, isTravelAllowed, isWater, ORIGINAL_WORLD_BOUNDS, originalTerrainHeight, safeGroundPosition, terrainHeight, waterLevelAt } from '../src/content/world/definition';
import { createTerrainChunk, sampleTerrainChunk } from '../src/game/world/expansionTerrain';

describe('shared expansion ground',()=>{
  it('uses finite upward triangles and exact barycentric sampling',()=>{
    for(const chunk of [...EXPANSION_GROUND.chunks,EXPANSION_GROUND.originalNorthChunk]){
      expect(chunk.vertices.every(Number.isFinite)).toBe(true);
      for(let i=0;i<chunk.indices.length;i+=3){
        const a=chunk.indices[i]*3,b=chunk.indices[i+1]*3,c=chunk.indices[i+2]*3,v=chunk.vertices;
        expect((v[b+2]-v[a+2])*(v[c]-v[a])-(v[b]-v[a])*(v[c+2]-v[a+2])).toBeGreaterThan(0);
      }
    }
    const chunk=createTerrainChunk('plane',{xMin:0,xMax:4,zMin:0,zMax:4},2,(x,z)=>x+z*2);
    expect(sampleTerrainChunk(chunk,1.3,2.7)).toBeCloseTo(6.7);
    expect(sampleTerrainChunk(chunk,4,4)).toBe(12);
    expect(sampleTerrainChunk(chunk,5,4)).toBeNull();
  });
  it('matches both sides of every original and expansion shared edge',()=>{
    const [west,north]=EXPANSION_GROUND.chunks;
    for(let z=-740;z<=-499;z+=.7)expect(sampleTerrainChunk(west,-78,z)).toBeCloseTo(sampleTerrainChunk(north,-78,z)!,7);
    for(let z=-499;z<=-334;z+=.7)expect(sampleTerrainChunk(west,-78,z)).toBeCloseTo(sampleTerrainChunk(EXPANSION_GROUND.originalNorthChunk,-78,z)!,7);
    for(let x=-78;x<=88;x+=.7)expect(sampleTerrainChunk(north,x,-499)).toBeCloseTo(sampleTerrainChunk(EXPANSION_GROUND.originalNorthChunk,x,-499)!,7);
  });
  it('preserves original path/building heights, grounds the new town, and refuses unbuilt holes',()=>{
    for(const [x,z] of [[0,-460],[18,-415],[31,-386],[-21,-288],[25,-238],[65,54]])expect(terrainHeight(x,z)).toBe(originalTerrainHeight(x,z));
    expect(ORIGINAL_WORLD_BOUNDS.xMin).toBe(-78);
    const [townX,townZ]=[-430,-120];
    expect(hasGroundAt(townX,townZ)).toBe(true);
    expect(isWater(townX,townZ)).toBe(false);
    expect(isTravelAllowed('foot',townX,townZ)).toBe(true);
    expect(safeGroundPosition([townX,0,townZ])[0]).toBe(townX);
    expect(hasGroundAt(100,0)).toBe(false);
    expect(isTravelAllowed('foot',100,0)).toBe(false);
    expect(safeGroundPosition([100,0,0])[0]).not.toBe(100);
  });
  it('grounds all anchors and separates highland water levels from the original river',()=>{
    for(const a of EXPANSION_LAYOUT.anchors){expect(a.position[1]).toBe(terrainHeight(a.position[0],a.position[2]));expect(isWater(a.position[0],a.position[2])).toBe(false);}
    expect(waterLevelAt(-630,-470)).toBeGreaterThan(60);
    expect(waterLevelAt(-630,-380)).toBeLessThan(50);
    expect(waterLevelAt(0,-100)).toBe(8);
    expect(waterLevelAt(-500,-100)).toBeNull();
  });
});
