import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { buildFinanceDesk } from '../landing/immersive/financeObjects';

const solid = (w,h,d,color) => {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,Math.min(.09,d/3)),new THREE.MeshStandardMaterial({color,roughness:.28,metalness:.12}));
  mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
};
const labelTexture = (title,rows,accent='#246BFD') => {
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=500;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#FAF8FF';ctx.fillRect(0,0,640,500);
  ctx.fillStyle=accent;ctx.fillRect(0,0,640,12);ctx.font='bold 18px sans-serif';ctx.fillText('VALUEVADE / FINANCE WORKFLOW',35,57);
  ctx.fillStyle='#02073D';ctx.font='bold 37px sans-serif';ctx.fillText(title,35,124);
  rows.forEach((row,i)=>{ctx.fillStyle=i===rows.length-1?'#E3F4ED':'#EDF0FC';ctx.fillRect(35,157+i*75,570,56);ctx.fillStyle=i===rows.length-1?'#08634C':'#575E7A';ctx.font='23px sans-serif';ctx.fillText(row,53,193+i*75);});
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
};
const panel = (title,rows,accent) => {
  const group=new THREE.Group();group.add(solid(2.7,2.16,.15,accent));
  const face=new THREE.Mesh(new THREE.PlaneGeometry(2.57,2.01),new THREE.MeshBasicMaterial({map:labelTexture(title,rows,accent),toneMapped:false}));face.position.z=.081;group.add(face);return group;
};
function addCoins(group,x,y,z) {
  for(let i=0;i<4;i++){const coin=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.1,32),new THREE.MeshStandardMaterial({color:'#C6D3FA',metalness:.65,roughness:.24}));coin.position.set(x,y+i*.105,z);coin.castShadow=true;group.add(coin);}
}
export function buildBusinessScene(scene,mode) {
  if(mode==='course') {
    const desk=buildFinanceDesk(scene);
    const book=solid(1.2,.16,.8,'#FF6AC1');book.position.set(-.5,-1.07,.8);desk.groups[0].add(book);
    const cover=solid(1.14,.04,.76,'#FAF8FF');cover.position.set(-.5,-.97,.8);desk.groups[0].add(cover);
    addCoins(desk.groups[1],1.75,-.5,.85);
    const chip=solid(.55,.55,.22,'#0F9D78');chip.position.set(-1.1,1.1,.1);chip.rotation.z=.2;desk.groups[2].add(chip);
    return {...desk,connections:[],particles:[]};
  }
  const root=new THREE.Group();scene.add(root);
  const source=panel('Source records',['Financial statements','Concall transcripts','Approved source inputs'],'#246BFD');
  const paper=solid(2.65,2.1,.08,'#C6B4F0');paper.position.set(-.12,.12,-.15);paper.rotation.z=.07;source.add(paper);addCoins(source,-.9,-1.1,.65);
  const processor=new THREE.Group();
  const base=solid(2.3,.24,1.45,'#CAC0E9');base.position.y=-.9;processor.add(base);
  const stack=solid(1.9,.18,1.25,'#E8DFF8');stack.position.y=-.61;processor.add(stack);
  const cube=solid(1.6,1.45,1.25,'#246BFD');cube.position.y=.15;processor.add(cube);
  const face=new THREE.Mesh(new THREE.PlaneGeometry(1.45,1.2),new THREE.MeshBasicMaterial({map:labelTexture('AI WORKFLOW',['Extract · compare','Draft · explain','Human review'],'#246BFD'),toneMapped:false}));face.position.set(0,.15,.632);processor.add(face);
  for(let i=0;i<5;i++){const pin=solid(.1,.1,.4,'#93B1FE');pin.position.set(-.64+i*.32,-.75,.82);processor.add(pin);}
  const review=panel('Review queue',['Source-linked findings','Exceptions highlighted','Approval required'],'#0F9D78');
  const check=solid(.64,.64,.2,'#0F9D78');check.position.set(1.18,-.92,.27);review.add(check);
  const a=solid(.18,.06,.03,'#FFFFFF');a.position.set(1.04,-.93,.385);a.rotation.z=-.7;review.add(a);
  const b=solid(.34,.06,.03,'#FFFFFF');b.position.set(1.23,-.86,.385);b.rotation.z=.75;review.add(b);
  const groups=[source,processor,review];groups.forEach(g=>root.add(g));
  const connections=[],particles=[];
  [-1,1].forEach(sign=>{
    const points=[new THREE.Vector3(sign*1.02,-.7,0),new THREE.Vector3(sign*1.68,-.55,.1),new THREE.Vector3(sign*2.42,-.1,0)];
    const curve=new THREE.CatmullRomCurve3(points);
    const pipe=new THREE.Mesh(new THREE.TubeGeometry(curve,32,.026,8,false),new THREE.MeshStandardMaterial({color:'#B0A0D6',roughness:.6}));root.add(pipe);connections.push(pipe);
    const parcel=solid(.14,.14,.14,sign<0?'#246BFD':'#0F9D78');root.add(parcel);particles.push({mesh:parcel,curve});
  });
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,15),new THREE.ShadowMaterial({color:'#68518D',opacity:.12}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.29;floor.receiveShadow=true;scene.add(floor);
  return {root,groups,connections,particles};
}