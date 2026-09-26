// 召喚峽谷賽道：以封閉樣條曲線定義中心線，路面、路肩、牆、場景都由它生成。
// 物理與 AI 只需要：nearest()（最近點、橫向偏移、行進距離）與 sample()（某距離的位置與方向）。
import * as THREE from 'three';

export const TRACK_DEF={
  w:15,        // 路寬（公尺）
  off:7,       // 路外草地寬度，之外是牆
  laps:3,
  pts:[[0,0],[0,-60],[10,-110],[40,-140],[90,-150],[140,-135],[165,-100],[160,-60],[130,-40],[110,-10],[120,30],[160,50],[200,40],[230,70],[225,120],[190,150],[130,160],[70,150],[30,120],[0,70]],
  pads:[{f:.13,lat:0},{f:.53,lat:-3.5},{f:.79,lat:3.5}],
  river:.405, baron:.33, dragon:.47,
  turrets:[{f:.06,side:-1,team:0},{f:.19,side:1,team:0},{f:.29,side:-1,team:0},{f:.61,side:1,team:1},{f:.73,side:-1,team:1},{f:.9,side:1,team:1}],
};
const TEAM=[0x3C8CE7,0xE5484D];

function rng(seed){ let s=seed>>>0; return ()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; }
function canvasTex(w,h,draw,rep){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; if(rep){ t.wrapS=t.wrapT=THREE.RepeatWrapping; } return t; }

export class Track{
  constructor(def=TRACK_DEF){
    this.def=def; this.w=def.w; this.half=def.w/2; this.off=def.off; this.laps=def.laps;
    const curve=new THREE.CatmullRomCurve3(def.pts.map(p=>new THREE.Vector3(p[0],0,p[1])),true,'centripetal');
    const N=this.N=900, sp=curve.getSpacedPoints(N);
    this.P=sp.slice(0,N); this.L=curve.getLength(); this.ds=this.L/N;
    this.T=[]; this.Nm=[];
    for(let i=0;i<N;i++){
      const a=this.P[(i-1+N)%N], b=this.P[(i+1)%N], t=new THREE.Vector3().subVectors(b,a).setY(0).normalize();
      this.T.push(t); this.Nm.push(new THREE.Vector3(t.z,0,-t.x));   // Nm：行進方向的右手邊（從上往下看）
    }
    this.pads=def.pads.map(p=>({s:p.f*this.L,lat:p.lat,len:4,w:3.2}));
  }
  idxAt(s){ const L=this.L; s=((s%L)+L)%L; return Math.floor(s/this.ds)%this.N; }
  sample(s){ const L=this.L; s=((s%L)+L)%L; const f=s/this.ds, i=Math.floor(f)%this.N, j=(i+1)%this.N, t=f-Math.floor(f);
    return {pos:this.P[i].clone().lerp(this.P[j],t), tan:this.T[i].clone().lerp(this.T[j],t).normalize(), nrm:this.Nm[i].clone().lerp(this.Nm[j],t).normalize(), i}; }
  // 最近的中心線點。hint 是上一幀的索引，只在附近搜尋；跑太遠才整圈找。
  nearest(p,hint){
    const N=this.N, P=this.P; let best=1e18,bi=0,bt=0;
    const scan=(from,count)=>{ for(let k=0;k<count;k++){ const i=((from+k)%N+N)%N, a=P[i], b=P[(i+1)%N], abx=b.x-a.x, abz=b.z-a.z;
      let t=((p.x-a.x)*abx+(p.z-a.z)*abz)/(abx*abx+abz*abz); t=t<0?0:t>1?1:t; const x=a.x+abx*t, z=a.z+abz*t, d=(p.x-x)**2+(p.z-z)**2;
      if(d<best){ best=d; bi=i; bt=t; } } };
    if(hint!=null&&hint>=0) scan(hint-40,80);
    if(hint==null||hint<0||best>(this.half+this.off+6)**2) scan(0,N);
    const a=P[bi], b=P[(bi+1)%N], x=a.x+(b.x-a.x)*bt, z=a.z+(b.z-a.z)*bt, n=this.Nm[bi];
    return {i:bi, s:(bi+bt)*this.ds, lat:(p.x-x)*n.x+(p.z-z)*n.z, dist:Math.sqrt(best)};
  }

  /* ---------- 場景 ---------- */
  build(root){
    const N=this.N, P=this.P, Nm=this.Nm, half=this.half, off=this.off, L=this.L, ds=this.ds, R=rng(20260926);
    const lam=(c,o)=>new THREE.MeshLambertMaterial(Object.assign({color:c},o||{}));
    // 地面（草地）
    const grass=canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#4E8A3E'; g.fillRect(0,0,w,h); for(let k=0;k<2600;k++){ const v=R(); g.fillStyle=v<.33?'#5C9A48':v<.66?'#447C36':'#63A34E'; g.fillRect(R()*w,R()*h,2+R()*3,2+R()*3); } },true);
    grass.repeat.set(140,140);
    const cx=P.reduce((a,p)=>a+p.x,0)/N, cz=P.reduce((a,p)=>a+p.z,0)/N; this.center=new THREE.Vector3(cx,0,cz);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(1400,1400),lam(0xffffff,{map:grass})); ground.rotation.x=-Math.PI/2; ground.position.set(cx,0,cz); root.add(ground);
    // 路面
    const road=canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#9A8C74'; g.fillRect(0,0,w,h);
      for(let y=0;y<h;y+=32) for(let x=((y/32)%2)*24;x<w;x+=48){ g.fillStyle=`hsl(35,${10+R()*10}%,${46+R()*10}%)`; g.fillRect(x+2,y+2,44,28); }
      g.globalAlpha=.25; for(let k=0;k<900;k++){ g.fillStyle=R()<.5?'#5E5446':'#C9BCA2'; g.fillRect(R()*w,R()*h,2,2); } g.globalAlpha=1;
      g.fillStyle='rgba(244,238,220,.85)'; g.fillRect(6,0,5,h); g.fillRect(w-11,0,5,h); },true);
    const rp=[], ru=[], ri=[];
    for(let i=0;i<=N;i++){ const k=i%N, p=P[k], n=Nm[k], v=i*ds/8;
      rp.push(p.x-n.x*half,.03,p.z-n.z*half, p.x+n.x*half,.03,p.z+n.z*half); ru.push(0,v,1,v);
      if(i<N){ const a=i*2; ri.push(a,a+2,a+1, a+1,a+2,a+3); } }
    root.add(this.strip(rp,ru,ri,lam(0xffffff,{map:road})));
    // 路肩：前半圈藍白、後半圈紅白
    const curb=(inner,outer,y)=>{ const pos=[], col=[], c=new THREE.Color(), W=new THREE.Color(0xffffff);
      for(let i=0;i<N;i++){ const j=(i+1)%N, team=i<N/2?0:1, on=Math.floor(i*ds/3)%2===0; c.setHex(on?TEAM[team]:0xF4F1EA);
        for(const side of [-1,1]){ const a=P[i],b=P[j],na=Nm[i],nb=Nm[j], q=(p,n,d)=>[p.x+n.x*d*side,y,p.z+n.z*d*side];
          const v=[q(a,na,inner),q(b,nb,inner),q(a,na,outer),q(b,nb,outer)];
          const tri=side>0?[0,2,1,1,2,3]:[0,1,2,1,3,2]; tri.forEach(t=>{ pos.push(...v[t]); col.push(c.r,c.g,c.b); }); } }
      const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); g.computeVertexNormals();
      return new THREE.Mesh(g,lam(0xffffff,{vertexColors:true})); };
    root.add(curb(half,half+1.1,.04));
    // 牆（石牆）
    const wallP=[], wallI=[]; let vi=0; const WH=1.1;
    for(const side of [-1,1]) for(let i=0;i<=N;i++){ const k=i%N, p=P[k], n=Nm[k], d=(half+off)*side;
      wallP.push(p.x+n.x*d,0,p.z+n.z*d, p.x+n.x*d,WH,p.z+n.z*d, p.x+n.x*(d+side*.8),WH,p.z+n.z*(d+side*.8));
      if(i<N){ const a=vi+i*3, b=a+3; if(side<0) wallI.push(a,a+1,b, b,a+1,b+1, a+1,a+2,b+1, b+1,a+2,b+2); else wallI.push(a,b,a+1, b,b+1,a+1, a+1,b+1,a+2, b+1,b+2,a+2); }
      if(i===N) vi+=(N+1)*3; }
    const wg=new THREE.BufferGeometry(); wg.setAttribute('position',new THREE.Float32BufferAttribute(wallP,3)); wg.setIndex(wallI); wg.computeVertexNormals();
    root.add(new THREE.Mesh(wg,lam(0x8B8378,{side:THREE.DoubleSide})));
    // 起跑線與拱門
    const chk=canvasTex(128,32,(g)=>{ for(let x=0;x<16;x++) for(let y=0;y<4;y++){ g.fillStyle=(x+y)%2?'#111':'#fff'; g.fillRect(x*8,y*8,8,8); } });
    const sl=new THREE.Mesh(new THREE.PlaneGeometry(this.w,2),lam(0xffffff,{map:chk})); this.place(sl,0,0,.05); sl.rotateX(-Math.PI/2); root.add(sl);
    const banner=canvasTex(512,96,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,w,0); gr.addColorStop(0,'#1F4F8C'); gr.addColorStop(1,'#8C1F2A'); g.fillStyle=gr; g.fillRect(0,0,w,h); g.fillStyle='#F2C14E'; g.font='900 58px -apple-system,sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('SUMMONER’S RIFT GP',w/2,h/2+2); });
    const gate=new THREE.Group(); this.place(gate,0,0,0);
    [-1,1].forEach(s=>{ const pl=new THREE.Mesh(new THREE.BoxGeometry(.8,7,.8),lam(0x6B6F7A)); pl.position.set(s*(half+1.4),3.5,0); gate.add(pl); });
    const bm=new THREE.Mesh(new THREE.BoxGeometry(this.w+3.6,1.6,.5),[lam(0x2A2F3A),lam(0x2A2F3A),lam(0x2A2F3A),lam(0x2A2F3A),new THREE.MeshBasicMaterial({map:banner}),new THREE.MeshBasicMaterial({map:banner})]); bm.position.y=6.6; gate.add(bm);
    root.add(gate);
    // 加速板
    const arrow=canvasTex(64,128,(g,w,h)=>{ g.fillStyle='#FFB020'; g.fillRect(0,0,w,h); g.strokeStyle='#FFF3B0'; g.lineWidth=10; g.lineJoin='round'; for(let k=0;k<3;k++){ const y=100-k*38; g.beginPath(); g.moveTo(8,y); g.lineTo(32,y-24); g.lineTo(56,y); g.stroke(); } },true);
    this.padMats=[];
    this.pads.forEach(pd=>{ const m=new THREE.MeshBasicMaterial({map:arrow.clone(),transparent:true,opacity:.95}); m.map.needsUpdate=true; m.map.repeat.set(1,1); this.padMats.push(m);
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(pd.w,pd.len),m); this.place(mesh,pd.s,pd.lat,.06); mesh.rotateX(-Math.PI/2); root.add(mesh); });
    // 河道（河上有橋）
    { const s=this.def.river*L, smp=this.sample(s), rw=18, span=this.w+2*off+70;
      const wt=canvasTex(128,128,(g,w,h)=>{ g.fillStyle='#3FA7C9'; g.fillRect(0,0,w,h); g.strokeStyle='rgba(220,248,255,.55)'; g.lineWidth=3; for(let k=0;k<9;k++){ const y=R()*h, x=R()*w; g.beginPath(); g.moveTo(x,y); g.bezierCurveTo(x+14,y-6,x+28,y+6,x+44,y); g.stroke(); } },true); wt.repeat.set(span/14,rw/14);
      const water=new THREE.Mesh(new THREE.PlaneGeometry(span,rw),new THREE.MeshLambertMaterial({map:wt,transparent:true,opacity:.95}));
      water.rotation.x=-Math.PI/2; water.position.set(smp.pos.x,.015,smp.pos.z); water.rotation.z=Math.atan2(smp.tan.x,smp.tan.z); root.add(water); this.water=water;
      [-1,1].forEach(side=>{ const rail=new THREE.Mesh(new THREE.BoxGeometry(.35,.9,rw+2),lam(0xC9A46B)); this.place(rail,s,side*(half+1.4),.45); root.add(rail); }); }
    // 巴龍巢穴、小龍巢穴
    const pit=(f,side,col,glow)=>{ const s=f*L, g=new THREE.Group(); this.place(g,s,side*(half+off+17),0);
      const rim=new THREE.Mesh(new THREE.TorusGeometry(9,1.6,8,24),lam(0x5A5560)); rim.rotation.x=Math.PI/2; rim.position.y=.4; g.add(rim);
      const floor=new THREE.Mesh(new THREE.CircleGeometry(8.5,24),lam(col)); floor.rotation.x=-Math.PI/2; floor.position.y=.05; g.add(floor);
      const core=new THREE.Mesh(new THREE.IcosahedronGeometry(2.6,0),new THREE.MeshLambertMaterial({color:glow,emissive:glow,emissiveIntensity:.6})); core.position.y=3.2; g.add(core); g.userData.spin=core;
      root.add(g); return g; };
    this.baron=pit(this.def.baron,1,0x3B2A55,0xA66BFF); this.dragon=pit(this.def.dragon,-1,0x5A3322,0xFF8A3D);
    // 防禦塔與主堡
    this.def.turrets.forEach(t=>{ const g=new THREE.Group(); this.place(g,t.f*L,t.side*(half+off+4),0);
      const base=new THREE.Mesh(new THREE.CylinderGeometry(1.8,2.2,1.2,10),lam(0x6E6A64)); base.position.y=.6; g.add(base);
      const col=new THREE.Mesh(new THREE.CylinderGeometry(1,1.4,5,10),lam(0x8E8A82)); col.position.y=3.7; g.add(col);
      const top=new THREE.Mesh(new THREE.CylinderGeometry(1.8,1.1,1,10),lam(0x5B5750)); top.position.y=6.6; g.add(top);
      const cr=new THREE.Mesh(new THREE.OctahedronGeometry(.9),new THREE.MeshLambertMaterial({color:TEAM[t.team],emissive:TEAM[t.team],emissiveIntensity:.7})); cr.position.y=8; g.add(cr); g.userData.spin=cr;
      root.add(g); (this.spinners||(this.spinners=[])).push(cr); });
    [[.015,-1,0],[.5,1,1]].forEach(([f,side,team])=>{ const g=new THREE.Group(); this.place(g,f*L,side*(half+off+12),0);
      const ped=new THREE.Mesh(new THREE.CylinderGeometry(4,5,1.5,8),lam(0x6E6A64)); ped.position.y=.75; g.add(ped);
      const cr=new THREE.Mesh(new THREE.OctahedronGeometry(3),new THREE.MeshLambertMaterial({color:TEAM[team],emissive:TEAM[team],emissiveIntensity:.8})); cr.scale.y=1.6; cr.position.y=6.5; g.add(cr);
      root.add(g); this.spinners.push(cr); });
    this.spinners.push(this.baron.userData.spin,this.dragon.userData.spin);
    // 野區樹木與草叢（InstancedMesh）
    const trees=[], bushes=[]; let minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9; P.forEach(p=>{ minX=Math.min(minX,p.x); maxX=Math.max(maxX,p.x); minZ=Math.min(minZ,p.z); maxZ=Math.max(maxZ,p.z); });
    for(let k=0;k<2600&&trees.length<520;k++){ const x=minX-70+R()*(maxX-minX+140), z=minZ-70+R()*(maxZ-minZ+140), q=this.nearest({x,z});
      const pitNear=[this.baron,this.dragon].some(g=>Math.hypot(g.position.x-x,g.position.z-z)<13);
      if(q.dist>half+off+3.5&&!pitNear) trees.push([x,z,.8+R()*.7,R()*6]); }
    for(let i=0;i<N;i+=5){ if(R()<.45) continue; const side=R()<.5?-1:1, d=half+off+1.8+R()*1.5, p=P[i], n=Nm[i]; bushes.push([p.x+n.x*d*side,p.z+n.z*d*side,.8+R()*.6]); }
    const inst=(geo,mat,list,fn)=>{ const m=new THREE.InstancedMesh(geo,mat,list.length), o=new THREE.Object3D(); list.forEach((t,k)=>{ fn(o,t); o.updateMatrix(); m.setMatrixAt(k,o.matrix); }); root.add(m); };
    inst(new THREE.CylinderGeometry(.35,.5,2.4,6),lam(0x6B4A2E),trees,(o,t)=>{ o.position.set(t[0],1.2*t[2],t[1]); o.scale.setScalar(t[2]); o.rotation.set(0,t[3],0); });
    inst(new THREE.ConeGeometry(2.6,4.6,7),lam(0x2F6B3A),trees,(o,t)=>{ o.position.set(t[0],(2.4+2)*t[2],t[1]); o.scale.setScalar(t[2]); o.rotation.set(0,t[3],0); });
    inst(new THREE.ConeGeometry(1.9,3.4,7),lam(0x3B8046),trees,(o,t)=>{ o.position.set(t[0],(2.4+3.9)*t[2],t[1]); o.scale.setScalar(t[2]); o.rotation.set(0,t[3]+1,0); });
    this.buildSky(root); this.buildDecor(root);
    inst(new THREE.SphereGeometry(1.4,7,5),lam(0x2E7A5C),bushes,(o,t)=>{ o.position.set(t[0],.5,t[1]); o.scale.set(t[2]*1.4,t[2],t[2]*1.4); o.rotation.set(0,0,0); });
  }
  // 天空（漸層圓頂，跟著鏡頭）與遠山剪影：各只有一個物體，幾乎不增加負擔
  buildSky(root){
    const R=rng(77), sky=new THREE.SphereGeometry(640,24,12), col=[], p=sky.attributes.position, c=new THREE.Color();
    const top=new THREE.Color(0x4F9BE0), hor=new THREE.Color(0xCFEBFA), low=new THREE.Color(0xB8DDC4);
    for(let i=0;i<p.count;i++){ const y=p.getY(i)/640; if(y>=0) c.copy(hor).lerp(top,Math.pow(y,.6)); else c.copy(hor).lerp(low,Math.min(1,-y*4)); col.push(c.r,c.g,c.b); }
    sky.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
    this.sky=new THREE.Mesh(sky,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false})); this.sky.renderOrder=-1; root.add(this.sky);
    // 遠山：一圈低多邊形山峰，合併成一個網格
    const pos=[], cc=[], ring=46, C=this.center;
    for(let k=0;k<ring;k++){ const a0=k/ring*Math.PI*2, a1=(k+1)/ring*Math.PI*2, am=(a0+a1)/2, r=430+R()*60, h=40+R()*70;
      const P0=[C.x+Math.cos(a0)*r*1.05,-2,C.z+Math.sin(a0)*r*1.05], P1=[C.x+Math.cos(a1)*r*1.05,-2,C.z+Math.sin(a1)*r*1.05], Pt=[C.x+Math.cos(am)*r,h,C.z+Math.sin(am)*r];
      pos.push(...P0,...Pt,...P1); const shade=.78+R()*.12; const base=new THREE.Color(0x6F93A8).multiplyScalar(shade), peak=new THREE.Color(0xE8F2F8);
      cc.push(base.r,base.g,base.b, peak.r,peak.g,peak.b, base.r,base.g,base.b); }
    const mg=new THREE.BufferGeometry(); mg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); mg.setAttribute('color',new THREE.Float32BufferAttribute(cc,3));
    root.add(new THREE.Mesh(mg,new THREE.MeshBasicMaterial({vertexColors:true,fog:false,side:THREE.DoubleSide})));
  }
  // 岩石與小花：InstancedMesh（各一次繪圖）
  buildDecor(root){
    const R=rng(4242), half=this.half, off=this.off, rocks=[], flowers=[];
    for(let i=0;i<this.N;i+=3){ const p=this.P[i], n=this.Nm[i];
      if(R()<.35){ const side=R()<.5?-1:1, d=half+1.5+R()*(off-2.5); flowers.push([p.x+n.x*d*side,p.z+n.z*d*side,R()]); }
      if(R()<.12){ const side=R()<.5?-1:1, d=half+off+2.5+R()*6; rocks.push([p.x+n.x*d*side,p.z+n.z*d*side,.6+R()*1.2,R()*6]); } }
    const o=new THREE.Object3D();
    const rm=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:0x8C8A84,flatShading:true}),rocks.length);
    rocks.forEach((t,k)=>{ o.position.set(t[0],t[2]*.35,t[1]); o.scale.set(t[2]*1.3,t[2]*.8,t[2]); o.rotation.set(t[3],t[3]*2,0); o.updateMatrix(); rm.setMatrixAt(k,o.matrix); }); root.add(rm);
    const fg=new THREE.PlaneGeometry(.5,.5); fg.rotateX(-Math.PI/2); fg.translate(0,.06,0);
    const fm=new THREE.InstancedMesh(fg,new THREE.MeshLambertMaterial({color:0xffffff}),flowers.length), cols=[0xFFE27A,0xF7A1C4,0xFFFFFF,0xC39BF2], c=new THREE.Color();
    flowers.forEach((t,k)=>{ o.position.set(t[0],0,t[1]); o.scale.setScalar(.7+t[2]*.6); o.rotation.set(0,t[2]*6,0); o.updateMatrix(); fm.setMatrixAt(k,o.matrix); fm.setColorAt(k,c.setHex(cols[Math.floor(t[2]*4)%4])); }); root.add(fm);
  }
  strip(pos,uv,idx,mat){ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals(); return new THREE.Mesh(g,mat); }
  // 把物件放在賽道距離 s、橫向 lat 的位置，並朝向行進方向
  place(obj,s,lat,y){ const m=this.sample(s); obj.position.set(m.pos.x+m.nrm.x*lat,y,m.pos.z+m.nrm.z*lat); obj.rotation.set(0,Math.atan2(m.tan.x,m.tan.z),0); return obj; }
  tick(t){ (this.spinners||[]).forEach((c,k)=>{ c.rotation.y=t*.8+k; }); if(this.water){ this.water.material.map.offset.x=t*.12; this.water.material.map.offset.y=Math.sin(t*.7)*.04; } this.padMats.forEach(m=>{ m.map.offset.y=-t*1.5; }); }
}
