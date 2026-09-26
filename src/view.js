// 畫面：賽道、懸浮滑板＋英雄模型、粒子、追尾鏡頭。只讀取 Race 的狀態，不改變它。
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {byId} from './roster.js';
import {K} from './kart.js';

const BASIS='https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/basis/';
const HOVER=.42, RIDER_H=1.45;
const SPARK=[0xFFFFFF,0x4DA3FF,0xFF9A2E,0xD06BFF];
const CLIP={idle:[/^idle1(_base)?(\.|$)/i,/^idle1/i,/^idle/i], hit:[/^knockup/i,/^taunt/i], dance:[/^dance1?(\.|$)/i,/^dance/i,/^laugh/i],
  laugh:[/^laugh(\.|$)/i,/^laugh/i,/^joke/i], stun:[/^stun/i,/^idle1/i]};
const findClip=(clips,key)=>{ for(const r of CLIP[key]){ const c=clips.find(c=>r.test(c.name)); if(c) return c; } return null; };

function roundedBox(w,h,d,r,s){
  const g=new THREE.BoxGeometry(w,h,d,s,s,s), p=g.attributes.position, n=g.attributes.normal, v=new THREE.Vector3(), c=new THREE.Vector3(), dir=new THREE.Vector3(), cl=(x,a)=>Math.max(-a,Math.min(a,x));
  for(let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i); c.set(cl(v.x,w/2-r),cl(v.y,h/2-r),cl(v.z,d/2-r)); dir.subVectors(v,c); if(dir.lengthSq()<1e-12) dir.fromBufferAttribute(n,i); dir.normalize(); p.setXYZ(i,c.x+dir.x*r,c.y+dir.y*r,c.z+dir.z*r); n.setXYZ(i,dir.x,dir.y,dir.z); }
  p.needsUpdate=n.needsUpdate=true; return g;
}
function dotTex(){ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'), r=g.createRadialGradient(32,32,0,32,32,32); r.addColorStop(0,'rgba(255,255,255,1)'); r.addColorStop(.35,'rgba(255,255,255,.7)'); r.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=r; g.fillRect(0,0,64,64); return new THREE.CanvasTexture(c); }
function shadowTex(){ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'), r=g.createRadialGradient(32,32,2,32,32,32); r.addColorStop(0,'rgba(0,0,0,.5)'); r.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=r; g.fillRect(0,0,64,64); return new THREE.CanvasTexture(c); }
function nameSprite(text,color){
  const c=document.createElement('canvas'); c.width=256; c.height=64; const g=c.getContext('2d');
  g.font='800 30px -apple-system,"PingFang TC","Hiragino Sans",sans-serif'; g.textAlign='center'; g.textBaseline='middle';
  const w=Math.min(250,g.measureText(text).width+28); g.fillStyle='rgba(12,18,28,.72)'; g.beginPath(); g.roundRect((256-w)/2,10,w,44,22); g.fill();
  g.fillStyle='#'+color.toString(16).padStart(6,'0'); g.fillRect((256-w)/2+10,26,8,12); g.fillStyle='#fff'; g.fillText(text,136,33);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthWrite:false})); s.scale.set(1.9,.48,1); return s;
}

class Particles{
  constructor(scene,max,size,tex){
    this.max=max; this.n=0; this.pos=new Float32Array(max*3).fill(-9999); this.col=new Float32Array(max*3); this.vel=new Float32Array(max*3); this.life=new Float32Array(max); this.age=new Float32Array(max); this.base=new Float32Array(max*3); this.grav=new Float32Array(max);
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(this.pos,3)); g.setAttribute('color',new THREE.BufferAttribute(this.col,3));
    this.pts=new THREE.Points(g,new THREE.PointsMaterial({size,map:tex,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true}));
    this.pts.frustumCulled=false; scene.add(this.pts); this.geo=g;
  }
  emit(p,v,color,life,grav){ const i=this.n; this.n=(this.n+1)%this.max; const c=new THREE.Color(color);
    this.pos.set([p.x,p.y,p.z],i*3); this.vel.set([v.x,v.y,v.z],i*3); this.base.set([c.r,c.g,c.b],i*3); this.col.set([c.r,c.g,c.b],i*3); this.life[i]=life; this.age[i]=0; this.grav[i]=grav||0; }
  update(dt){ for(let i=0;i<this.max;i++){ if(this.life[i]<=0) continue; this.age[i]+=dt; const u=this.age[i]/this.life[i];
      if(u>=1){ this.life[i]=0; this.pos[i*3+1]=-9999; continue; }
      this.vel[i*3+1]-=this.grav[i]*dt; for(let a=0;a<3;a++){ this.pos[i*3+a]+=this.vel[i*3+a]*dt; this.col[i*3+a]=this.base[i*3+a]*(1-u); } }
    this.geo.attributes.position.needsUpdate=this.geo.attributes.color.needsUpdate=true; }
  clear(){ this.life.fill(0); for(let i=0;i<this.max;i++) this.pos[i*3+1]=-9999; }
}

export class View{
  constructor(el){
    const r=this.r=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    r.setPixelRatio(Math.min(devicePixelRatio||1,1.75)); el.appendChild(r.domElement);
    const s=this.scene=new THREE.Scene(); s.background=new THREE.Color(0x9ED3F0); s.fog=new THREE.Fog(0x9ED3F0,70,300);
    s.add(new THREE.HemisphereLight(0xEAF6FF,0x3E6B34,2.2));
    const sun=new THREE.DirectionalLight(0xFFF1D6,2.6); sun.position.set(80,140,40); s.add(sun);
    this.cam=new THREE.PerspectiveCamera(62,1,.1,700);
    this.root=new THREE.Group(); s.add(this.root);
    this.dot=dotTex(); this.shTex=shadowTex();
    this.sparks=new Particles(s,700,.32,this.dot); this.puffs=new Particles(s,400,1.1,this.dot);
    this.gltf={}; this.riders=[];
    const ktx=new KTX2Loader().setTranscoderPath(BASIS).detectSupport(r);
    this.loader=new GLTFLoader().setKTX2Loader(ktx).setMeshoptDecoder(MeshoptDecoder);
    const fit=()=>{ const w=el.clientWidth||innerWidth, h=el.clientHeight||innerHeight; r.setSize(w,h,false); this.cam.aspect=w/h; this.cam.updateProjectionMatrix(); };
    addEventListener('resize',fit); fit(); this.fit=fit;
  }
  // 下載英雄模型（onProgress 回報 0～1）。失敗的會用替身。
  loadModels(urls,onProgress){
    const prog={}; const report=()=>{ const v=Object.values(prog); onProgress&&onProgress(v.length?v.reduce((a,b)=>a+b,0)/urls.length:1); };
    return Promise.allSettled(urls.map(u=>{ prog[u]=0; if(this.gltf[u]){ prog[u]=1; report(); return Promise.resolve(this.gltf[u]); }
      return this.loader.loadAsync(u,e=>{ if(e.total){ prog[u]=e.loaded/e.total; report(); } }).then(g=>{ this.gltf[u]=g; prog[u]=1; report(); return g; }); }));
  }
  setup(track,race,me){
    this.root.clear(); this.sparks.clear(); this.puffs.clear(); this.track=track; this.race=race; this.me=me;
    track.build(this.root);
    this.riders=race.karts.map(k=>this.makeRider(k));
    const k=race.karts[me]; this.cam.position.copy(k.pos).add(new THREE.Vector3(0,3,-8)); this.camT=0;
  }
  makeRider(k){
    const ch=byId(k.champ), g=new THREE.Group(), tilt=new THREE.Group(); g.add(tilt); this.root.add(g);
    const col=new THREE.Color(ch.color);
    const board=new THREE.Mesh(roundedBox(.72,.13,1.6,.06,3),new THREE.MeshStandardMaterial({color:0xF4F1EA,roughness:.35,metalness:.2})); tilt.add(board);
    const stripe=new THREE.Mesh(roundedBox(.2,.02,1.3,.01,1),new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:.6})); stripe.position.y=.075; tilt.add(stripe);
    const glow=new THREE.Mesh(new THREE.PlaneGeometry(.9,1.8),new THREE.MeshBasicMaterial({map:this.dot,color:col,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false})); glow.rotation.x=Math.PI/2; glow.position.y=-.1; tilt.add(glow);
    const thr=[-.22,.22].map(x=>{ const t=new THREE.Mesh(new THREE.CylinderGeometry(.07,.1,.22,10),new THREE.MeshStandardMaterial({color:0x444a55,metalness:.6,roughness:.4})); t.rotation.x=Math.PI/2; t.position.set(x,0,-.82); tilt.add(t); return t; });
    const body=new THREE.Group(); body.position.y=.07; tilt.add(body);
    // 模型還沒好之前的替身（彩色膠囊）
    const stand=new THREE.Mesh(new THREE.CapsuleGeometry(.28,.7,6,12),new THREE.MeshStandardMaterial({color:col,roughness:.5})); stand.position.y=.65; body.add(stand);
    const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1.8,2.4),new THREE.MeshBasicMaterial({map:this.shTex,transparent:true,depthWrite:false})); shadow.rotation.x=-Math.PI/2; this.root.add(shadow);
    let tag=null; if(k.idx!==this.me){ tag=nameSprite(k.name,ch.color); tag.position.y=2.25; g.add(tag); }
    const R={k,g,tilt,body,stand,shadow,tag,glow,thr,col,champ:null,roll:0,yawOff:0,t:Math.random()*9};
    const gl=this.gltf[k.url]; if(gl) this.attach(R,gl);
    return R;
  }
  attach(R,gltf){
    const model=SkeletonUtils.clone(gltf.scene), mixer=new THREE.AnimationMixer(model), clips={};
    Object.keys(CLIP).forEach(k=>{ const c=findClip(gltf.animations,k); if(c) clips[k]=c; });
    if(clips.idle){ mixer.clipAction(clips.idle).play(); mixer.update(0); }
    model.updateMatrixWorld(true);
    const box=new THREE.Box3();
    model.traverse(o=>{ if(!o.isMesh) return; o.frustumCulled=false; let bb; if(o.isSkinnedMesh){ o.computeBoundingBox(); bb=o.boundingBox.clone(); } else { o.geometry.computeBoundingBox(); bb=o.geometry.boundingBox.clone(); } box.union(bb.applyMatrix4(o.matrixWorld)); });
    const h=Math.max(1e-6,box.max.y-box.min.y), sc=RIDER_H/h, inner=new THREE.Group(); inner.add(model);
    inner.scale.setScalar(sc); inner.position.set(-(box.min.x+box.max.x)/2*sc,-box.min.y*sc,-(box.min.z+box.max.z)/2*sc);
    R.body.remove(R.stand); R.body.add(inner); R.champ={mixer,clips,cur:null,act:null};
  }
  play(R,key){
    const C=R.champ; if(!C||C.cur===key) return; const clip=C.clips[key]||C.clips.idle; C.cur=key; if(!clip) return;
    const a=C.mixer.clipAction(clip), once=key==='hit'||key==='laugh';
    if(C.act===a&&!once) return;
    a.reset(); a.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,Infinity); a.clampWhenFinished=once; a.enabled=true; a.setEffectiveWeight(1);
    if(C.act&&C.act!==a) a.crossFadeFrom(C.act,.2,false); a.play(); C.act=a;
  }
  // 事件（撞牆、加速、被打中…）→ 特效
  onEvent(i,e){
    const R=this.riders[i]; if(!R) return; const p=R.g.position;
    if(e==='hit'){ this.play(R,'hit'); R.hitT=1.1; for(let n=0;n<16;n++){ const a=n/16*Math.PI*2; this.sparks.emit(new THREE.Vector3(p.x,p.y+1.6,p.z),new THREE.Vector3(Math.cos(a)*3,1.5,Math.sin(a)*3),0xFFE27A,.6,3); } }
    if(e.startsWith('turbo')){ const lv=+e.slice(5); for(let n=0;n<14;n++) this.sparks.emit(new THREE.Vector3(p.x,p.y+.2,p.z),new THREE.Vector3((Math.random()-.5)*5,Math.random()*3,(Math.random()-.5)*5),SPARK[lv],.45,6); }
    if(e==='wall'){ for(let n=0;n<8;n++) this.puffs.emit(new THREE.Vector3(p.x,p.y,p.z),new THREE.Vector3((Math.random()-.5)*3,Math.random()*2,(Math.random()-.5)*3),0x6B6252,.5,0); }
    if(e==='finish'){ R.finishT=1; }
  }
  render(dt,t){
    const race=this.race, me=race.karts[this.me], TR=this.track;
    this.riders.forEach(R=>{
      const k=R.k, g=R.g;
      R.t+=dt; const bob=Math.sin(R.t*3.1)*.05;
      g.position.set(k.pos.x,HOVER+bob+k.y+(k.hopT>0?Math.sin((1-k.hopT/.18)*Math.PI)*.35:0),k.pos.z);
      // 甩尾時滑板斜一個角度、身體往內側傾
      R.yawOff+=((k.drift?k.drift*-.42:0)-R.yawOff)*Math.min(1,dt*10);
      g.rotation.y=k.heading+R.yawOff;
      const lean=k.drift?-k.drift*.42:-k.input.steer*.2*Math.min(1,k.speed/12);
      R.roll+=(lean-R.roll)*Math.min(1,dt*8); R.tilt.rotation.z=R.roll; R.tilt.rotation.x=k.boostT>0?-.08:0;
      R.shadow.position.set(k.pos.x,.05,k.pos.z); R.shadow.rotation.z=-g.rotation.y; R.shadow.material.opacity=Math.max(.25,1-k.y*.3);
      R.glow.material.opacity=.7+.25*Math.sin(R.t*9)+(k.boostT>0?.3:0);
      // 動作
      if(R.champ){
        let want='idle';
        if(k.finished) want=k.rank<=3?'dance':'idle';
        else if(k.stunT>0) want='stun';
        else if(R.hitT>0) want='hit';
        this.play(R,want); R.champ.mixer.update(dt);
      } else R.stand.rotation.y+=dt*(k.spinT>0?20:0);
      if(R.hitT>0) R.hitT-=dt;
      // 粒子
      const f=new THREE.Vector3(Math.sin(g.rotation.y),0,Math.cos(g.rotation.y)), rt=new THREE.Vector3(f.z,0,-f.x), back=g.position.clone().addScaledVector(f,-.9);
      if(k.drift&&k.driftT>.12){ const c=SPARK[k.level]; for(const s of [-1,1]) if(Math.random()<.7){ const p=back.clone().addScaledVector(rt,s*.32); p.y=.12; this.sparks.emit(p,new THREE.Vector3(rt.x*s*1.5+(Math.random()-.5),1.2+Math.random()*1.5,rt.z*s*1.5+(Math.random()-.5)).addScaledVector(f,-2),c,.3,7); } }
      if(k.boostT>0) for(const s of [-.22,.22]){ const p=back.clone().addScaledVector(rt,s); p.y=g.position.y; this.sparks.emit(p,f.clone().multiplyScalar(-4+Math.random()).add(new THREE.Vector3((Math.random()-.5)*.6,(Math.random()-.5)*.6,(Math.random()-.5)*.6)),Math.random()<.5?0xFFB53A:0xFF6A2A,.28,0); }
      else if(Math.random()<.35) for(const s of [-.22,.22]){ const p=back.clone().addScaledVector(rt,s); p.y=g.position.y; this.sparks.emit(p,f.clone().multiplyScalar(-2),R.col.getHex(),.18,0); }
      if(k.offroad&&k.speed>6&&Math.random()<.6){ const p=back.clone(); p.y=.2; this.puffs.emit(p,new THREE.Vector3((Math.random()-.5)*2,1+Math.random(),(Math.random()-.5)*2),0x5A6B35,.6,0); }
      if(R.tag) R.tag.visible=g.position.distanceTo(this.cam.position)<60;
    });
    this.sparks.update(dt); this.puffs.update(dt); TR.tick(t);
    // 鏡頭
    const R=this.riders[this.me], p=R.g.position, f=new THREE.Vector3(Math.sin(me.heading),0,Math.cos(me.heading));
    let want, look;
    if(race.phase==='countdown'){ // 倒數時從正面繞到背後
      const u=Math.min(1,1-race.cd/3.2), a=Math.PI*(1-u*u*(3-2*u)), dist=5.8+2*(1-u);
      const off=new THREE.Vector3(Math.sin(me.heading+a)*-dist,2.2+1.2*(1-u),Math.cos(me.heading+a)*-dist);
      want=p.clone().add(off); look=p.clone().add(new THREE.Vector3(0,1.2,0)); this.cam.position.lerp(want,1-Math.exp(-8*dt));
    } else {
      want=p.clone().addScaledVector(f,-6.2).add(new THREE.Vector3(0,2.6,0)); look=p.clone().addScaledVector(f,5).add(new THREE.Vector3(0,1.1,0));
      this.cam.position.lerp(want,1-Math.exp(-(me.spinT>0?3:7)*dt));
      if(me.bumpT>0){ this.cam.position.x+=(Math.random()-.5)*.25; this.cam.position.y+=(Math.random()-.5)*.25; }
    }
    this.cam.lookAt(look);
    const fov=62+(me.boostT>0?11:0)+Math.max(0,me.speed-15)*.25; this.cam.fov+=(fov-this.cam.fov)*Math.min(1,dt*5); this.cam.updateProjectionMatrix();
    this.r.render(this.scene,this.cam);
  }
}
