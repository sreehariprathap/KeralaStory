// Rebuild derived rigs without decoding/recompressing the supplied textures.
// Original GLBs are never overwritten. Run: node scripts/rig-characters.mjs [source.glb ...]
// Passing source names rebuilds only those rigs.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Box3, Matrix3, Matrix4, Quaternion, Vector3 } from 'three';

// Sources live outside public/ so they are not shipped; only the rigged outputs are served.
const sources = new URL('../asset-sources/characters/', import.meta.url);
const assets = new URL('../public/assets/characters/', import.meta.url);
const profiles = [
  { source: 'anime-style_teenage_boy.glb', output: 'anime-style_teenage_boy_rigged.glb', shoulder: [.12,.73,0], elbow: [.155,.56,0], wrist: [.16,.40,0], hip: [.075,.44,0], knee: [.075,.235,0], ankle: [.08,.055,0], relaxed: true, center: [0,0], armRadius: .065 },
  { source: 'cartoon_kid.glb', output: 'cartoon_kid_rigged.glb', shoulder: [.10,.685,0], elbow: [.255,.685,0], wrist: [.39,.685,0], hip: [.055,.415,0], knee: [.055,.225,0], ankle: [.055,.05,0], skirt: false },
  { source: 'kid_boy.glb', output: 'kid_boy_rigged.glb', shoulder: [.105,.655,.012], elbow: [.23,.545,.012], wrist: [.325,.455,.012], hip: [.045,.385,.015], knee: [.045,.205,.015], ankle: [.045,.05,.015], skirt: false },
  // T-pose, realistic eight-head proportions; the arms sit slightly behind the torso centre.
  { source: 'lionel_messi_qatar_2022.glb', output: 'lionel_messi_qatar_2022_rigged.glb', shoulder: [.11,.793,-.03], elbow: [.265,.795,-.03], wrist: [.40,.795,-.022], hip: [.065,.46,-.01], knee: [.064,.27,-.02], ankle: [.068,.055,-.02], skirt: false },
  // Straw-hat boy: a wide T pose with the arms level at four-fifths height.
  { source: 'monkey_d_luffy.glb', output: 'monkey_d_luffy_rigged.glb', shoulder: [.10,.80,0], elbow: [.28,.80,0], wrist: [.45,.80,0], hip: [.05,.45,0], knee: [.055,.24,0], ankle: [.055,.05,0], skirt: false },
  { source: 'the_little_girl.glb', output: 'the_little_girl_rigged.glb', shoulder: [.083,.663,0], elbow: [.24,.655,0], wrist: [.38,.65,0], hip: [.043,.43,0], knee: [.043,.205,0], ankle: [.043,.05,0], skirt: true },
];
const smooth = (lo, hi, value) => { const t = Math.max(0, Math.min(1, (value-lo)/(hi-lo))); return t*t*(3-2*t); };

const only = process.argv.slice(2);
for (const profile of profiles.filter(p => !only.length || only.includes(p.source))) {
  const file = readFileSync(new URL(profile.source, sources));
  const jsonLength = file.readUInt32LE(12);
  const doc = JSON.parse(file.subarray(20,20+jsonLength).toString());
  if (doc.skins?.length || doc.animations?.length || doc.extensionsRequired?.length) throw new Error('Unexpected source format');
  const original = file.subarray(28+jsonLength);
  const chunks = [original]; let byteLength = original.length;
  const widths = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4, MAT4:16 };
  function readAccessor(index) {
    const a = doc.accessors[index], view = doc.bufferViews[a.bufferView];
    if (a.sparse || a.normalized) throw new Error('Unsupported accessor');
    const bytes = {5126:4,5125:4,5123:2,5121:1}[a.componentType], width = widths[a.type];
    const values = [];
    for (let i=0;i<a.count;i++) for(let c=0;c<width;c++) {
      const offset = (view.byteOffset??0)+(a.byteOffset??0)+i*(view.byteStride??bytes*width)+c*bytes;
      values.push(a.componentType===5126?original.readFloatLE(offset):bytes===4?original.readUInt32LE(offset):bytes===2?original.readUInt16LE(offset):original.readUInt8(offset));
    }
    return values;
  }
  function append(array, type, componentType, bounds=false) {
    const padding = (4-byteLength%4)%4;
    if(padding) { chunks.push(Buffer.alloc(padding)); byteLength+=padding; }
    const data = Buffer.from(array.buffer,array.byteOffset,array.byteLength);
    const view = doc.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:data.length})-1;
    chunks.push(data); byteLength+=data.length;
    const accessor={bufferView:view,componentType,count:array.length/widths[type],type};
    if(bounds) {
      accessor.min=[Infinity,Infinity,Infinity];accessor.max=[-Infinity,-Infinity,-Infinity];
      for(let i=0;i<array.length;i++) {const c=i%3;accessor.min[c]=Math.min(accessor.min[c],array[i]);accessor.max[c]=Math.max(accessor.max[c],array[i]);}
    }
    return doc.accessors.push(accessor)-1;
  }
  const instances = [], bounds = new Box3(), vertex = new Vector3();
  function visit(index, parent) {
    const n=doc.nodes[index];
    const local=n.matrix?new Matrix4().fromArray(n.matrix):new Matrix4().compose(new Vector3().fromArray(n.translation??[0,0,0]),new Quaternion().fromArray(n.rotation??[0,0,0,1]),new Vector3().fromArray(n.scale??[1,1,1]));
    const matrix=parent.clone().multiply(local);
    if(n.mesh!==undefined) for(const primitive of doc.meshes[n.mesh].primitives) {
      if(primitive.mode!==undefined&&primitive.mode!==4) throw new Error('Expected triangles');
      const positions=readAccessor(primitive.attributes.POSITION);
      for(let i=0;i<positions.length;i+=3) {vertex.fromArray(positions,i).applyMatrix4(matrix);bounds.expandByPoint(vertex);vertex.toArray(positions,i);}
      instances.push({primitive,positions,matrix,name:n.name});
    }
    for(const child of n.children??[]) visit(child,matrix);
  }
  for(const node of doc.scenes[doc.scene??0].nodes) visit(node,new Matrix4());
  const height=bounds.max.y-bounds.min.y, center=bounds.getCenter(new Vector3());
  if(profile.center){center.x=profile.center[0];center.z=profile.center[1];}
  const nodes=[{name:'KeralaRoot',translation:[0,0,0],children:[]}], joints=[0], points=[new Vector3()];
  const ids={};
  function bone(name, point, parent) {
    const id=nodes.length, p=new Vector3().fromArray(point).multiplyScalar(1.7);
    nodes.push({name,translation:p.clone().sub(points[parent]).toArray(),children:[]});
    nodes[parent].children.push(id);points.push(p);joints.push(id);return id;
  }
  for(const [side,sign] of [['L',1],['R',-1]]) {
    const pos=p=>[p[0]*sign,p[1],p[2]];
    ids[`Hip${side}`]=bone(`KeralaHip_${side}_01`,pos(profile.hip),0);
    ids[`Knee${side}`]=bone(`KeralaKnee_${side}_02`,pos(profile.knee),ids[`Hip${side}`]);
    ids[`Ankle${side}`]=bone(`KeralaAnkle_${side}_03`,pos(profile.ankle),ids[`Knee${side}`]);
    ids[`Shoulder${side}`]=bone(`KeralaShoulder_${side}_04`,pos(profile.shoulder),0);
    ids[`Elbow${side}`]=bone(`KeralaElbow_${side}_05`,pos(profile.elbow),ids[`Shoulder${side}`]);
    ids[`Wrist${side}`]=bone(`KeralaWrist_${side}_06`,pos(profile.wrist),ids[`Elbow${side}`]);
  }
  function weights(x,y,z) {
    const side=x>=0?'L':'R', ax=Math.abs(x);
    if(profile.relaxed && y>profile.wrist[1]-.07 && y<profile.shoulder[1]+.045){
      const t=Math.max(0,Math.min(1,(profile.shoulder[1]-y)/(profile.shoulder[1]-profile.wrist[1])));
      const armX=profile.shoulder[0]+t*(profile.wrist[0]-profile.shoulder[0]);
      const radius=profile.armRadius;
      const distance=Math.hypot(ax-armX,z-profile.shoulder[2]);
      const blend=(1-smooth(radius*.75,radius*1.5,distance))*smooth(armX-radius,armX-radius*.25,ax)*(1-smooth(profile.shoulder[1],profile.shoulder[1]+.045,y));
      if(blend>0){const elbow=1-smooth(profile.elbow[1]-.03,profile.elbow[1]+.03,y);return [[0,1-blend],[ids[`Shoulder${side}`],blend*(1-elbow)],[ids[`Elbow${side}`],blend*elbow]];}
    }
    const armY=profile.shoulder[1]+(ax-profile.shoulder[0])*(profile.wrist[1]-profile.shoulder[1])/(profile.wrist[0]-profile.shoulder[0]);
    // Long hair behind the uniform's shoulders must remain attached to the torso.
    const armDepth=profile.armDepth ? 1-smooth(profile.armDepth*.65,profile.armDepth,Math.abs(z-profile.shoulder[2])) : 1;
    const armBlend=smooth(.075,.135,ax)*(1-smooth(profile.shoulder[1]+.025,profile.shoulder[1]+(profile.armUpperFade??.075),y))*smooth(armY-.08,armY-.035,y)*armDepth;
    if(!profile.relaxed && armBlend>0) {
      // Project onto the authored upper-arm axis; blend across the elbow.
      const start=new Vector3(...profile.shoulder), axis=new Vector3(...profile.elbow).sub(start);
      const t=new Vector3(ax,y,z).sub(start).dot(axis)/axis.lengthSq();
      const elbow=smooth(.78,1.22,t);
      return [[0,1-armBlend],[ids[`Shoulder${side}`],armBlend*(1-elbow)],[ids[`Elbow${side}`],armBlend*elbow]];
    }
    if(y<profile.hip[1]+.035) {
      const left=smooth(-.025,.025,x);
      if(profile.skirt&&y>.245) {
        const cloth=.35*(1-smooth(.34,.465,y));
        return [[0,1-cloth],[ids.HipL,cloth*left],[ids.HipR,cloth*(1-left)]];
      }
      const leg=1-smooth(profile.hip[1]-.035,profile.hip[1]+.035,y);
      const knee=1-smooth(profile.knee[1]-.035,profile.knee[1]+.035,y);
      // Keep the pelvis seam smooth; below the crotch each leg is independent.
      const split=y<profile.hip[1]-.075?(x>=0?1:0):left;
      const result=[[0,1-leg],[ids.HipL,leg*split*(1-knee)],[ids.HipR,leg*(1-split)*(1-knee)],[ids.KneeL,leg*split*knee],[ids.KneeR,leg*(1-split)*knee]];
      return result;
    }
    return [[0,1]];
  }
  const meshes=[];
  for(const instance of instances) {
    const {primitive,matrix,name}=instance, positions=new Float32Array(instance.positions.length);
    const count=positions.length/3, skinIndices=new Uint16Array(count*4), skinWeights=new Float32Array(count*4);
    for(let i=0;i<count;i++) {
      const p=instance.positions, x=(p[i*3]-center.x)/height, y=(p[i*3+1]-bounds.min.y)/height, z=(p[i*3+2]-center.z)/height;
      positions.set([x*1.7,y*1.7,z*1.7],i*3);
      const influences=weights(x,y,z).filter(([,w])=>w>0).sort((a,b)=>b[1]-a[1]).slice(0,4), total=influences.reduce((sum,[,w])=>sum+w,0);
      influences.forEach(([id,w],k)=>{skinIndices[i*4+k]=id;skinWeights[i*4+k]=w/total;});
    }
    const attributes={...primitive.attributes,POSITION:append(positions,'VEC3',5126,true),JOINTS_0:append(skinIndices,'VEC4',5123),WEIGHTS_0:append(skinWeights,'VEC4',5126)};
    if(attributes.NORMAL!==undefined) {
      const normals=new Float32Array(readAccessor(attributes.NORMAL)), normalMatrix=new Matrix3().getNormalMatrix(matrix);
      for(let i=0;i<normals.length;i+=3) vertex.fromArray(normals,i).applyMatrix3(normalMatrix).normalize().toArray(normals,i);
      attributes.NORMAL=append(normals,'VEC3',5126);
    }
    if(attributes.TANGENT!==undefined) {
      const tangents=new Float32Array(readAccessor(attributes.TANGENT));
      const handedness=Math.sign(matrix.determinant());
      for(let i=0;i<tangents.length;i+=4) {
        vertex.fromArray(tangents,i).transformDirection(matrix).toArray(tangents,i);
        tangents[i+3]*=handedness;
      }
      attributes.TANGENT=append(tangents,'VEC4',5126);
    }
    const output={...primitive,attributes};
    if(matrix.determinant()<0) {
      const indices=primitive.indices===undefined?Array.from({length:count},(_,i)=>i):readAccessor(primitive.indices);
      for(let i=0;i<indices.length;i+=3) [indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
      output.indices=append(new Uint32Array(indices),'SCALAR',5125);
    }
    nodes.push({name,mesh:meshes.length,skin:0});meshes.push({primitives:[output]});
  }
  const inverse=new Float32Array(joints.length*16);
  points.forEach((p,i)=>new Matrix4().makeTranslation(-p.x,-p.y,-p.z).toArray(inverse,i*16));
  doc.skins=[{name:'Kerala fitted humanoid',joints,skeleton:0,inverseBindMatrices:append(inverse,'MAT4',5126)}];
  doc.nodes=nodes;doc.meshes=meshes;doc.scenes=[{name:'Rigged character',nodes:[0,...nodes.map((n,i)=>n.mesh===undefined?-1:i).filter(i=>i>=0)]}];doc.scene=0;
  doc.asset.extras={...doc.asset.extras,rigSource:profile.source,rigGenerator:'scripts/rig-characters.mjs',note:'Fitted procedural rig; animation supplied by the game.'};
  // Keep only referenced streams, so baked geometry does not duplicate the source.
  const accessorIds=new Set([doc.skins[0].inverseBindMatrices]);
  for(const mesh of meshes) for(const p of mesh.primitives) {
    Object.values(p.attributes).forEach(id=>accessorIds.add(id));
    if(p.indices!==undefined) accessorIds.add(p.indices);
  }
  const accessorMap=new Map([...accessorIds].map((id,index)=>[id,index]));
  doc.accessors=[...accessorIds].map(id=>doc.accessors[id]);
  for(const mesh of meshes) for(const p of mesh.primitives) {
    for(const key of Object.keys(p.attributes)) p.attributes[key]=accessorMap.get(p.attributes[key]);
    if(p.indices!==undefined) p.indices=accessorMap.get(p.indices);
  }
  doc.skins[0].inverseBindMatrices=accessorMap.get(doc.skins[0].inverseBindMatrices);
  const viewIds=new Set(doc.accessors.map(a=>a.bufferView));
  for(const image of doc.images??[]) if(image.bufferView!==undefined) viewIds.add(image.bufferView);
  const viewMap=new Map([...viewIds].map((id,index)=>[id,index]));
  const combined=Buffer.concat(chunks), packed=[];let packedLength=0;
  doc.bufferViews=[...viewIds].map(id=>{
    const view=doc.bufferViews[id], padding=(4-packedLength%4)%4;
    if(padding){packed.push(Buffer.alloc(padding));packedLength+=padding;}
    const offset=packedLength;
    packed.push(combined.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength));packedLength+=view.byteLength;
    return {...view,byteOffset:offset};
  });
  for(const a of doc.accessors) a.bufferView=viewMap.get(a.bufferView);
  for(const image of doc.images??[]) if(image.bufferView!==undefined) image.bufferView=viewMap.get(image.bufferView);
  doc.buffers=[{byteLength:packedLength}];
  const json=Buffer.from(JSON.stringify(doc)), jsonPadded=Buffer.alloc(Math.ceil(json.length/4)*4,0x20);json.copy(jsonPadded);
  const bin=Buffer.concat(packed), binPadded=Buffer.alloc(Math.ceil(bin.length/4)*4);bin.copy(binPadded);
  const header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+jsonPadded.length+binPadded.length,8);header.writeUInt32LE(jsonPadded.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binPadded.length);binHeader.writeUInt32LE(0x004e4942,4);
  const destination=new URL(profile.output,assets);
  writeFileSync(destination,Buffer.concat([header,jsonPadded,binHeader,binPadded]));
  console.log(`${fileURLToPath(destination)}: ${joints.length} bones, ${meshes.length} skinned meshes`);
}
