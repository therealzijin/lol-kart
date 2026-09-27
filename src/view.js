// 畫面：賽道、懸浮滑板＋英雄模型、粒子、追尾鏡頭。只讀取 Race 的狀態，不改變它。
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {byId,ROSTER} from './roster.js?v=20260927100449';
import {K} from './kart.js?v=20260927100449';

const BASIS='https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/basis/';
const HOVER=.42, RIDER_H=1.45;
const SPARK=[0xFFFFFF,0x4DA3FF,0xFF9A2E,0xD06BFF];
const CLIP={idle:[/^idle1(_base)?(\.|$)/i,/^idle1/i,/^idle/i], hit:[/^knockup/i,/^taunt/i], dance:[/^dance1?(\.|$)/i,/^dance/i,/^laugh/i],
  laugh:[/^laugh(\.|$)/i,/^laugh/i,/^joke/i], stun:[/^stun/i,/^idle1/i]};
const findClip=(clips,key)=>{ for(const r of CLIP[key]){ const c=clips.find(c=>r.test(c.name)); if(c) return c; } return null; };
// 施放技能時播遊戲裡真正的施法動作（Spell1～4）
const spellClip=(clips,n)=>clips.find(c=>new RegExp('^spell'+n+'(\\.|$|_?a?$)','i').test(c.name))||clips.find(c=>new RegExp('^spell'+n,'i').test(c.name)&&!/toidle|torun|_in/i.test(c.name));
const FX_COL={dart:0x8BE04E,zap:0x5CE1FF,hook:0xF2C14E,mystic:0xFFD86B,trueshot:0xFFD86B,arrow:0xCFEFFF,crystal:0x8FD3FF,rocket:0xFF8A2A,shroom:0xE5484D,poison:0x6BD13F,tremor:0xC99A5B,ball:0xC99A5B,static:0x7FD4FF,boom:0xFF8A2A,beartrap:0xC9A46B,icewall:0xBFE8FF,storm:0x9FD8FF,alpha:0xC8FF6B,charge:0xFF7A3A,slam:0x6FD86B,minion:0xFFE27A,crab:0x5FB8C9};

// 有些造型把「回城／表情動作的道具」（狗屋、椰子樹、海浪、拉霸機…）一起放在模型裡，待機動作也看得到，
// 還會把外框撐得很大 → 角色被縮得很小。這裡把這類網格藏起來，並回傳「只算身體」的外框。
const PROP_RX=/recall|emote|dance|joke|taunt|laugh|homeguard/i, KEEP_RX=/mount|weapon|bow|gun|blade|arrow|wing|tail|coat|cape|hair|shield|launcher|dragon|pet|companion|sword|staff|axe|hammer/i;
export function hideProps(model){
  let pelvis=null, head=null; model.traverse(o=>{ if(o.isBone){ if(!pelvis&&/^(c_)?(pelvis|hip)$/i.test(o.name)) pelvis=o; if(!head&&/^(c_)?head$/i.test(o.name)) head=o; } });
  const body=new Set(); [pelvis,head].forEach(b=>b&&b.traverse(o=>{ if(o.isBone) body.add(o); }));
  const info=[]; model.updateMatrixWorld(true);
  model.traverse(o=>{ if(!o.isMesh) return; let bb, frac=0, names='';
    if(o.isSkinnedMesh){ o.computeBoundingBox(); bb=o.boundingBox.clone().applyMatrix4(o.matrixWorld);
      const SI=o.geometry.attributes.skinIndex, SW=o.geometry.attributes.skinWeight, bones=o.skeleton.bones, cnt=new Map(); let inB=0;
      for(let i=0;i<SI.count;i++){ let bi=0,bw=-1; for(let k=0;k<4;k++){ const w=SW.getComponent(i,k); if(w>bw){ bw=w; bi=SI.getComponent(i,k); } } const b=bones[bi]; if(body.has(b)) inB++; else if(b) cnt.set(b,(cnt.get(b)||0)+1); }
      frac=inB/Math.max(1,SI.count);
      [...cnt.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).forEach(([b])=>{ for(let p=b,d=0;p&&p.isBone&&d<4;p=p.parent,d++) names+=' '+p.name; });
    } else { if(!o.geometry.boundingBox) o.geometry.computeBoundingBox(); bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); }
    info.push({o,bb,frac,names}); });
  const core=info.filter(m=>m.frac>=.3); if(!core.length) return null;
  const box=new THREE.Box3(); core.forEach(m=>box.union(m.bb)); const H=Math.max(1e-6,box.max.y-box.min.y), c=box.getCenter(new THREE.Vector3());
  info.forEach(m=>{ if(m.frac>=.05) return; const sz=m.bb.getSize(new THREE.Vector3()), mc=m.bb.getCenter(new THREE.Vector3()), off=Math.hypot(mc.x-c.x,mc.z-c.z)/H, big=Math.max(sz.x,sz.y,sz.z)/H;
    if(PROP_RX.test(m.names)||(!KEEP_RX.test(m.names)&&(off>.8||big>1.6))) m.o.visible=false; });
  return box;
}
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
    this.pd=1; r.setPixelRatio(Math.min(devicePixelRatio||1,1.5)); el.appendChild(r.domElement);
    const s=this.scene=new THREE.Scene(); s.background=new THREE.Color(0xCFEBFA); s.fog=new THREE.Fog(0xCFEBFA,80,320);
    s.add(new THREE.HemisphereLight(0xEAF6FF,0x3E6B34,2.2));
    const sun=new THREE.DirectionalLight(0xFFF1D6,2.6); sun.position.set(80,140,40); s.add(sun);
    this.cam=new THREE.PerspectiveCamera(62,1,.1,700);
    this.root=new THREE.Group(); s.add(this.root);
    this.dot=dotTex(); this.shTex=shadowTex();
    this.sparks=new Particles(s,700,.32,this.dot); this.puffs=new Particles(s,400,1.1,this.dot);
    this.gltf={}; this.riders=[]; this.fxm=new Map(); this.flashes=[];
    const ktx=new KTX2Loader().setTranscoderPath(BASIS).detectSupport(r);
    this.loader=new GLTFLoader().setKTX2Loader(ktx).setMeshoptDecoder(MeshoptDecoder);
    const fit=()=>{ const w=el.clientWidth||innerWidth, h=el.clientHeight||innerHeight; this._w=w; this._h=h; r.setSize(w,h,false); this.cam.aspect=w/h; this.cam.updateProjectionMatrix(); };
    // 從主畫面（全螢幕 App 模式）打開時，轉成橫向不一定會發 resize → 畫面被拉扁。多聽幾種事件，render() 每幀也再檢查一次
    addEventListener('resize',fit); addEventListener('orientationchange',()=>setTimeout(fit,300)); window.visualViewport?.addEventListener('resize',fit);
    fit(); this.fit=fit; this.el=el;
  }
  // 畫質：std＝1.5 倍解析度；eco（省電）＝1 倍解析度、粒子減半
  setQuality(q){ this.q=q; this.pd=q==='eco'?.5:1; this.r.setPixelRatio(q==='eco'?1:Math.min(devicePixelRatio||1,1.5)); this.fit(); }
  // 下載英雄模型（onProgress 回報 0～1）。失敗的會用替身。
  loadModels(urls,onProgress){
    const prog={}; const report=()=>{ const v=Object.values(prog); onProgress&&onProgress(v.length?v.reduce((a,b)=>a+b,0)/urls.length:1); };
    return Promise.allSettled(urls.map(u=>{ prog[u]=0; if(this.gltf[u]){ prog[u]=1; report(); return Promise.resolve(this.gltf[u]); }
      return this.loader.loadAsync(u,e=>{ if(e.total){ prog[u]=e.loaded/e.total; report(); } }).then(g=>{ this.gltf[u]=g; prog[u]=1; report(); return g; }); }));
  }
  setup(track,race,me){
    this.root.clear(); this.sparks.clear(); this.puffs.clear(); this.fxm.clear(); this.flashes=[]; this.track=track; this.race=race; this.me=me;
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
    const shield=new THREE.Mesh(new THREE.SphereGeometry(1.25,20,14),new THREE.MeshBasicMaterial({color:k.champ==='Sivir'?0xFFD86B:0x7FC8FF,transparent:true,opacity:.25,blending:THREE.AdditiveBlending,depthWrite:false})); shield.position.y=.9; shield.visible=false; tilt.add(shield);
    let ball=null; if(k.champ==='Rammus'){ ball=new THREE.Group(); const sh=new THREE.Mesh(new THREE.IcosahedronGeometry(.85,1),new THREE.MeshStandardMaterial({color:0xB8864E,roughness:.6,flatShading:true})); ball.add(sh);
      const sg=new THREE.ConeGeometry(.12,.35,5), sm=new THREE.MeshStandardMaterial({color:0xE8D2A0}); new THREE.IcosahedronGeometry(.85,0).attributes.position.array.forEach((_,i,a)=>{ if(i%9) return; const v=new THREE.Vector3(a[i],a[i+1],a[i+2]).normalize(); const c=new THREE.Mesh(sg,sm); c.position.copy(v).multiplyScalar(.9); c.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v); ball.add(c); });
      ball.position.y=.9; ball.visible=false; tilt.add(ball); }
    const warn=nameSprite('!!',0xE5484D); warn.scale.set(1.2,.3,1); warn.position.y=2.7; warn.visible=false; g.add(warn);
    const R={k,g,tilt,body,stand,shadow,tag,glow,thr,col,shield,ball,warn,champ:null,roll:0,yawOff:0,t:Math.random()*9,opa:1};
    const gl=this.gltf[k.url]; if(gl) this.attach(R,gl);
    return R;
  }
  attach(R,gltf){
    const model=SkeletonUtils.clone(gltf.scene), mixer=new THREE.AnimationMixer(model), clips={};
    Object.keys(CLIP).forEach(k=>{ const c=findClip(gltf.animations,k); if(c) clips[k]=c; });
    if(clips.idle){ mixer.clipAction(clips.idle).play(); mixer.update(0); }
    model.updateMatrixWorld(true);
    model.traverse(o=>{ if(o.isMesh) o.frustumCulled=false; });
    const box=hideProps(model)||new THREE.Box3().setFromObject(model);   // 只用身體算大小（道具、同伴不算）
    const h=Math.max(1e-6,box.max.y-box.min.y), sc=RIDER_H/h, inner=new THREE.Group(); inner.add(model);
    inner.scale.setScalar(sc); inner.position.set(-(box.min.x+box.max.x)/2*sc,-box.min.y*sc,-(box.min.z+box.max.z)/2*sc);
    const mats=[]; model.traverse(o=>{ if(o.isMesh){ o.material=o.material.clone(); mats.push(o.material); } });
    const ch=byId(R.k.champ), all=gltf.animations; clips.q=spellClip(all,ch.qi+1); clips.r=spellClip(all,ch.ri+1);
    R.body.remove(R.stand); R.body.add(inner); R.model=inner; R.mats=mats; R.champ={mixer,clips,cur:null,act:null};
  }
  play(R,key){
    const C=R.champ; if(!C||C.cur===key) return; const clip=C.clips[key]||C.clips.idle; C.cur=key; if(!clip) return;
    const a=C.mixer.clipAction(clip), once=key==='hit'||key==='laugh'||key==='q'||key==='r';
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
    if(e==='trick'){ R.flipT=.45; for(let n=0;n<12;n++) this.sparks.emit(new THREE.Vector3(p.x,p.y+.8,p.z),new THREE.Vector3((Math.random()-.5)*4,Math.random()*3,(Math.random()-.5)*4),0xFFF3B0,.4,4); }
    if(e==='honey'||e==='egg'){ const c=e==='honey'?0xFFC53A:0x9FDCFF; for(let n=0;n<14;n++) this.sparks.emit(new THREE.Vector3(p.x,p.y+1,p.z),new THREE.Vector3((Math.random()-.5)*3,1+Math.random()*2,(Math.random()-.5)*3),c,.5,2); }
    if(e==='jump'){ for(let n=0;n<8;n++) this.puffs.emit(new THREE.Vector3(p.x,.2,p.z),new THREE.Vector3((Math.random()-.5)*3,.5,(Math.random()-.5)*3),0x8C7A5A,.45,0); }
  }
  // 角色身上的狀態：護盾泡泡、滾球、隱形、暈眩星星、減速、被飛彈鎖定
  status(R,dt){
    const k=R.k, p=R.g.position;
    // 被打後的無敵時間：一閃一閃
    R.tilt.visible=!(k.immuneT>0&&k.spinT<=0&&k.stunT<=0&&k.y<=.01&&Math.floor(R.t*14)%2===1);
    R.shield.visible=k.shieldT>0; if(R.shield.visible){ R.shield.material.opacity=.18+.1*Math.sin(R.t*8); R.shield.scale.setScalar(1+.04*Math.sin(R.t*5)); }
    if(R.ball){ const on=k.ballT>0; R.ball.visible=on; R.body.visible=!on; if(on) R.ball.rotation.x+=dt*k.speed*.9; }
    const want=k.invisT>0?(k.idx===this.me?.4:.12):1;
    if(Math.abs(R.opa-want)>.01){ R.opa+=(want-R.opa)*Math.min(1,dt*8); const tr=R.opa<.99;
      (R.mats||[]).forEach(m=>{ if(m.transparent!==tr){ m.transparent=tr; m.needsUpdate=true; } m.opacity=R.opa; m.depthWrite=!tr; });
      R.tilt.children.forEach(c=>{ if(c.material&&c!==R.shield&&c!==R.glow){ c.material.transparent=true; c.material.opacity=R.opa; } }); }
    if(R.tag) R.tag.visible=R.tag.visible&&k.invisT<=0;
    R.warn.visible=k.warnT>0&&k.idx!==this.me&&Math.sin(R.t*14)>0;
    if(k.stunT>0&&Math.random()<.5){ const a=R.t*9; this.sparks.emit(new THREE.Vector3(p.x+Math.cos(a)*.6,p.y+1.9,p.z+Math.sin(a)*.6),new THREE.Vector3(0,.3,0),0xFFE27A,.35,0); }
    if(k.slowT>0&&Math.random()<.4) this.sparks.emit(new THREE.Vector3(p.x+(Math.random()-.5)*1.2,p.y+.2,p.z+(Math.random()-.5)*1.2),new THREE.Vector3(0,1.2,0),0x9FB8FF,.5,0);
    if(k.chargeT>0&&Math.random()<.8) this.sparks.emit(new THREE.Vector3(p.x+(Math.random()-.5)*1.4,p.y+.3+Math.random()*1.4,p.z+(Math.random()-.5)*1.4),new THREE.Vector3(0,.8,0),Math.random()<.5?0xFF7A3A:0xFFD24A,.35,0);
    if(k.yiT>0&&Math.random()<.5) this.sparks.emit(new THREE.Vector3(p.x+(Math.random()-.5)*1,p.y+.4+Math.random()*1.4,p.z+(Math.random()-.5)*1),new THREE.Vector3(0,1.4,0),0xC8FF6B,.45,0);
    if(R.flipT>0){ R.flipT=Math.max(0,R.flipT-dt); R.tilt.rotation.x=-(1-R.flipT/.45)*Math.PI*2; }
    if(k.lightSlowT>0&&Math.random()<.3) this.sparks.emit(new THREE.Vector3(p.x,p.y+1.2,p.z),new THREE.Vector3((Math.random()-.5),.5,(Math.random()-.5)),0x6BD13F,.5,2);
  }
  makeFx(o){
    const g=new THREE.Group(), c=FX_COL[o.kind]||0xffffff, em=(col,o2)=>new THREE.MeshStandardMaterial(Object.assign({color:col,emissive:col,emissiveIntensity:1.2,roughness:.4},o2||{}));
    const glow=(sz,col)=>{ const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:this.dot,color:col,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false})); sp.scale.set(sz,sz,1); g.add(sp); return sp; };
    const along=(geo,mat,len,z)=>{ const m=new THREE.Mesh(geo,mat); m.rotation.x=Math.PI/2; m.position.z=z||0; g.add(m); return m; };
    const M={g,kind:o.kind};
    if(o.kind==='dart'){ along(new THREE.CylinderGeometry(.05,.05,.9,6),em(0x6B4A2E)); along(new THREE.ConeGeometry(.1,.3,6),em(c),0,.55); glow(.9,c); }
    else if(o.kind==='zap'){ g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.38,1),em(c))); glow(2.2,c); }
    else if(o.kind==='hook'){ g.add(new THREE.Mesh(new THREE.BoxGeometry(.55,.4,.6),new THREE.MeshStandardMaterial({color:c,metalness:.7,roughness:.3})));
      M.chain=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,1,5),new THREE.MeshStandardMaterial({color:0x9AA0A8,metalness:.8,roughness:.3})); this.root.add(M.chain); }
    else if(o.kind==='mystic'){ g.add(new THREE.Mesh(new THREE.SphereGeometry(.36,12,10),em(c))); glow(2.4,c); }
    else if(o.kind==='trueshot'){ along(new THREE.CylinderGeometry(.9,.9,12,16,1,true),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.45,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide})); along(new THREE.CylinderGeometry(.35,.35,12,10),new THREE.MeshBasicMaterial({color:0xFFFFFF})); glow(5,c); }
    else if(o.kind==='arrow'){ along(new THREE.CylinderGeometry(.035,.035,1,5),em(0xE8F6FF)); along(new THREE.ConeGeometry(.09,.3,5),em(c),0,.6); glow(.8,c); }
    else if(o.kind==='crystal'){ const m=new THREE.Mesh(new THREE.OctahedronGeometry(.7),em(c,{transparent:true,opacity:.9})); m.scale.set(.6,.6,2.4); g.add(m); glow(4,c); M.spin=m; }
    else if(o.kind==='rocket'){ along(new THREE.CylinderGeometry(.26,.26,1.5,12),new THREE.MeshStandardMaterial({color:0xE5484D,roughness:.4})); along(new THREE.ConeGeometry(.26,.5,12),new THREE.MeshStandardMaterial({color:0x2E3440}),0,1);
      [0,1,2,3].forEach(i=>{ const f=new THREE.Mesh(new THREE.BoxGeometry(.04,.45,.45),new THREE.MeshStandardMaterial({color:0x7A2FD1})); f.position.z=-.65; f.rotation.z=i*Math.PI/2; f.translateY(.3); g.add(f); }); glow(1.6,c); }
    else if(o.kind==='shroom'){ const cap=new THREE.Mesh(new THREE.SphereGeometry(.45,14,10,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0xE5484D,roughness:.5}));
      cap.position.y=.32; g.add(cap); const st=new THREE.Mesh(new THREE.CylinderGeometry(.13,.17,.34,8),new THREE.MeshStandardMaterial({color:0xF4EEDC})); st.position.y=.17; g.add(st);
      for(let i=0;i<6;i++){ const a=i/6*Math.PI*2, d=new THREE.Mesh(new THREE.SphereGeometry(.07,6,4),new THREE.MeshBasicMaterial({color:0xffffff})); d.position.set(Math.cos(a)*.3,.58,Math.sin(a)*.3); g.add(d); } M.spin=cap; }
    else if(o.kind==='poison'){ const d=new THREE.Mesh(new THREE.CircleGeometry(o.r,20),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.35,blending:THREE.AdditiveBlending,depthWrite:false})); d.rotation.x=-Math.PI/2; d.position.y=.08; g.add(d); M.disc=d; }
    else if(o.kind==='beartrap'){ const m=new THREE.MeshStandardMaterial({color:0x8A8F98,metalness:.7,roughness:.3});
      [-1,1].forEach(sd=>{ const j=new THREE.Mesh(new THREE.TorusGeometry(.35,.06,4,10,Math.PI),m); j.rotation.set(0,Math.PI/2,sd*.5); g.add(j); }); glow(1,c);
      M.chain=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,1,4),new THREE.MeshStandardMaterial({color:0x6B4A2E})); this.root.add(M.chain); }
    else if(o.kind==='icewall'){ const m=em(c,{transparent:true,opacity:.85,emissiveIntensity:.5});
      for(let i=0;i<3;i++){ const cr=new THREE.Mesh(new THREE.OctahedronGeometry(.7),m); cr.scale.set(.8,1.6+i*.3,.8); cr.position.set((i-1)*.7,.9+i*.1,0); cr.rotation.y=i; g.add(cr); } M.grow=true; }
    else if(o.kind==='storm'){ const d=new THREE.Mesh(new THREE.RingGeometry(o.r-1,o.r,32),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide})); d.rotation.x=-Math.PI/2; d.position.y=.12; g.add(d); M.disc=d; }
    else if(o.kind==='alpha'){ glow(3,c); }
    else if(o.kind==='tremor'){ const d=new THREE.Mesh(new THREE.RingGeometry(o.r-.8,o.r,32),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.6,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide})); d.rotation.x=-Math.PI/2; d.position.y=.1; g.add(d); M.disc=d; }
    return M;
  }
  syncFx(race,dt,t){
    const alive=new Set();
    for(const o of race.fx){
      alive.add(o.id); let M=this.fxm.get(o.id); if(!M){ M=this.makeFx(o); this.fxm.set(o.id,M); this.root.add(M.g); }
      M.g.position.set(o.x,o.kind==='shroom'||o.kind==='poison'||o.kind==='tremor'||o.kind==='storm'||o.kind==='icewall'?.05:(o.y||1),o.z);
      if(o.dx!=null&&o.mode!=='static') M.g.rotation.y=Math.atan2(o.dx,o.dz);
      const c=FX_COL[o.kind], p=M.g.position;
      if(M.spin&&o.kind==='crystal') M.spin.rotation.z+=dt*8;
      if(o.kind==='shroom'){ const armed=!o.arm||o.age>=o.arm; M.g.scale.setScalar(armed?1+.05*Math.sin(t*4+o.id):Math.min(1,o.age/o.arm)); }
      if(o.kind==='poison'){ M.disc.material.opacity=.32*Math.min(1,(o.life-o.age)/1.2); if(Math.random()<.25) this.sparks.emit(new THREE.Vector3(p.x+(Math.random()-.5)*o.r,p.y+.2,p.z+(Math.random()-.5)*o.r),new THREE.Vector3(0,1,0),c,.9,0); }
      if(M.grow){ M.g.scale.set(1,Math.min(1,o.age/.25)*Math.min(1,(o.life-o.age)/.4),1); }
      if(o.kind==='storm'){ M.disc.rotation.z+=dt*2; if(Math.random()<.8){ const a=Math.random()*6.28, d=Math.random()*o.r; this.sparks.emit(new THREE.Vector3(p.x+Math.cos(a)*d,.5+Math.random()*3,p.z+Math.sin(a)*d),new THREE.Vector3(Math.sin(a)*3,-1.5,-Math.cos(a)*3),Math.random()<.5?0xFFFFFF:c,.7,0); } }
      if(o.kind==='tremor'){ M.disc.scale.setScalar(.85+.15*Math.sin(t*10)); if(Math.random()<.5){ const a=Math.random()*6.28; this.puffs.emit(new THREE.Vector3(p.x+Math.cos(a)*o.r*.9,.3,p.z+Math.sin(a)*o.r*.9),new THREE.Vector3(0,1.5,0),0x7A5A36,.5,0); } }
      if(o.mode!=='static'&&o.mode!=='follow'&&o.mode!=='followT'&&c){ const n=o.kind==='trueshot'||o.kind==='rocket'||o.kind==='crystal'?3:1; for(let i=0;i<n;i++) this.sparks.emit(p.clone().add(new THREE.Vector3((Math.random()-.5)*.3,(Math.random()-.5)*.3,(Math.random()-.5)*.3)),new THREE.Vector3(-o.dx*3,.4,-o.dz*3),o.kind==='rocket'&&Math.random()<.5?0xFFD24A:c,.35,0); }
      if(M.chain){ const b=this.riders[o.owner].g.position, a=new THREE.Vector3(b.x,b.y+.9,b.z), d=p.clone().sub(a), L=d.length(); M.chain.position.copy(a).addScaledVector(d,.5); M.chain.scale.set(1,L,1); M.chain.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); }
    }
    for(const [id,M] of this.fxm) if(!alive.has(id)){ this.root.remove(M.g); if(M.chain) this.root.remove(M.chain); this.fxm.delete(id); }
  }
  flash(x,z,r,col,y){ const m=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.6,blending:THREE.AdditiveBlending,depthWrite:false})); m.position.set(x,y||1,z); this.root.add(m); this.flashes.push({m,t:0,dur:.45,r}); }
  ring(x,z,r,col){ const m=new THREE.Mesh(new THREE.RingGeometry(.8,1,40),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide})); m.rotation.x=-Math.PI/2; m.position.set(x,.4,z); this.root.add(m); this.flashes.push({m,t:0,dur:.5,r}); }
  stepFlashes(dt){ this.flashes=this.flashes.filter(F=>{ F.t+=dt; const u=F.t/F.dur; if(u>=1){ this.root.remove(F.m); return false; } F.m.scale.setScalar(F.r*(.3+.7*Math.sqrt(u))); F.m.material.opacity=.7*(1-u); return true; }); }
  // 技能相關事件
  onFx(ev){
    if(ev.e==='boom'){ const col=FX_COL[ev.kind]||0xFF8A2A;
      if(ev.kind==='static'||ev.kind==='slam'){ this.ring(ev.x,ev.z,ev.r,col); this.ring(ev.x,ev.z,ev.r*.6,0xFFFFFF); for(let n=0;n<40;n++){ const a=Math.random()*6.28, d=Math.random()*ev.r; this.sparks.emit(new THREE.Vector3(ev.x+Math.cos(a)*d,.3+Math.random()*2,ev.z+Math.sin(a)*d),new THREE.Vector3(0,3,0),col,.4,0); } }
      else { this.flash(ev.x,ev.z,ev.r*.8,col,1); for(let n=0;n<40;n++){ const v=new THREE.Vector3(Math.random()-.5,Math.random()*.8,Math.random()-.5).normalize().multiplyScalar(4+Math.random()*6); this.sparks.emit(new THREE.Vector3(ev.x,1,ev.z),v,Math.random()<.5?col:0xFFFFFF,.6,6); } }
    }
    else if(ev.e==='fxhit'){ const col=ev.blocked?0xFFD86B:(FX_COL[ev.kind]||0xffffff); this.flash(ev.x,ev.z,ev.blocked?2:1.4,col,1); for(let n=0;n<18;n++){ const v=new THREE.Vector3(Math.random()-.5,Math.random(),Math.random()-.5).normalize().multiplyScalar(5); this.sparks.emit(new THREE.Vector3(ev.x,1,ev.z),v,col,.45,5); } }
    else if(ev.e==='fizzle'){ for(let n=0;n<6;n++) this.puffs.emit(new THREE.Vector3(ev.x,1,ev.z),new THREE.Vector3((Math.random()-.5)*2,1,(Math.random()-.5)*2),0x55504A,.4,0); }
    else if(ev.e==='cast'){ const R=this.riders[ev.k]; if(R){ R.castT=.8; R.castSlot=ev.slot; } }
  }
  render(dt,t){
    if(this.el.clientWidth!==this._w||this.el.clientHeight!==this._h) this.fit();   // 畫布實際大小變了（轉向、全螢幕）就重新設定比例
    const race=this.race, me=race.karts[this.me], TR=this.track;
    this.riders.forEach(R=>{
      const k=R.k, g=R.g;
      R.t+=dt; const bob=Math.sin(R.t*3.1)*.05;
      g.position.set(k.pos.x,HOVER+bob+k.y+(k.hopT>0?Math.sin((1-k.hopT/.18)*Math.PI)*.35:0),k.pos.z);
      // 甩尾時滑板斜一個角度、身體往內側傾
      R.yawOff+=((k.drift?k.drift*-.42:0)-R.yawOff)*Math.min(1,dt*10);
      g.rotation.y=k.heading+R.yawOff;
      const lean=k.drift?-k.drift*.42:-k.input.steer*.2*Math.min(1,k.speed/12);
      R.roll+=(lean-R.roll)*Math.min(1,dt*8); R.tilt.rotation.z=R.roll; if(!(R.flipT>0)) R.tilt.rotation.x=k.boostT>0?-.08:0;
      R.shadow.position.set(k.pos.x,.05,k.pos.z); R.shadow.rotation.z=-g.rotation.y; R.shadow.material.opacity=Math.max(.25,1-k.y*.3);
      R.glow.material.opacity=.7+.25*Math.sin(R.t*9)+(k.boostT>0?.3:0);
      // 動作
      if(R.champ){
        let want='idle';
        if(k.finished) want=k.rank<=3?'dance':'idle';
        else if(k.stunT>0) want='stun';
        else if(R.hitT>0) want='hit';
        else if(R.castT>0) want=R.castSlot;
        this.play(R,want); R.champ.mixer.update(dt);
      } else R.stand.rotation.y+=dt*(k.spinT>0?20:0);
      if(R.hitT>0) R.hitT-=dt; if(R.castT>0) R.castT-=dt;
      this.status(R,dt);
      // 粒子
      const f=new THREE.Vector3(Math.sin(g.rotation.y),0,Math.cos(g.rotation.y)), rt=new THREE.Vector3(f.z,0,-f.x), back=g.position.clone().addScaledVector(f,-.9);
      const far=g.position.distanceToSquared(this.cam.position)>70*70, pd=far?0:this.pd;   // 遠處的人不產生粒子
      if(k.drift&&k.driftT>.12){ const c=SPARK[k.level]; for(const s of [-1,1]) if(Math.random()<.7*pd){ const p=back.clone().addScaledVector(rt,s*.32); p.y=.12; this.sparks.emit(p,new THREE.Vector3(rt.x*s*1.5+(Math.random()-.5),1.2+Math.random()*1.5,rt.z*s*1.5+(Math.random()-.5)).addScaledVector(f,-2),c,.3,7); } }
      if(k.boostT>0){ if(Math.random()<pd) for(const s of [-.22,.22]){ const p=back.clone().addScaledVector(rt,s); p.y=g.position.y; this.sparks.emit(p,f.clone().multiplyScalar(-4+Math.random()).add(new THREE.Vector3((Math.random()-.5)*.6,(Math.random()-.5)*.6,(Math.random()-.5)*.6)),Math.random()<.5?0xFFB53A:0xFF6A2A,.28,0); } }
      else if(Math.random()<.35*pd) for(const s of [-.22,.22]){ const p=back.clone().addScaledVector(rt,s); p.y=g.position.y; this.sparks.emit(p,f.clone().multiplyScalar(-2),R.col.getHex(),.18,0); }
      if(k.offroad&&k.speed>6&&Math.random()<.6*pd){ const p=back.clone(); p.y=.2; this.puffs.emit(p,new THREE.Vector3((Math.random()-.5)*2,1+Math.random(),(Math.random()-.5)*2),0x5A6B35,.6,0); }
      if(R.tag) R.tag.visible=g.position.distanceTo(this.cam.position)<60&&k.invisT<=0;
    });
    this.syncFx(race,dt,t); this.stepFlashes(dt);
    if(TR.sky) TR.sky.position.copy(this.cam.position);
    this.sparks.update(dt); this.puffs.update(dt); TR.tick(t); TR.tickFeatures(race.t,me,t);
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
