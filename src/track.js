// 賽道：以封閉樣條曲線定義中心線，路面、路肩、牆、場景都由它生成。三張地圖（召喚峽谷／嚎哭深淵／屠夫之橋）共用同一套，外觀由 THEMES 決定。
// 物理與 AI 只需要：nearest()（最近點、橫向偏移、行進距離）與 sample()（某距離的位置與方向）。
import * as THREE from 'three';

export const TRACK_DEF={
  id:'rift', theme:'rift', name:{zh:'召喚峽谷',ja:'サモナーズリフト'},
  w:15,        // 路寬（公尺）
  off:7,       // 路外草地寬度，之外是牆
  laps:3,
  pts:[[0,0],[0,-60],[10,-110],[40,-140],[90,-150],[140,-135],[165,-100],[160,-60],[130,-40],[110,-10],[120,30],[160,50],[200,40],[230,70],[225,120],[190,150],[130,160],[70,150],[30,120],[0,70]],
  pads:[{f:.13,lat:0},{f:.53,lat:-3.5},{f:.79,lat:3.5},{f:.925,lat:-4},{f:.94,lat:-4},{f:.955,lat:-4}],   // 最後三塊是連續加速帶（走外側才吃得到）
  // 賽道機關（參考瑪利歐賽車：加速跳台、會動的障礙、捷徑的取捨）
  ramps:[{f:.392,lat:0,w:7,len:3,vy:8.5,kind:'ramp',boost:.5}],                                // 河道跳台：飛越河面與河道蟹
  cones:[{f:.25,lat:5,vy:9},{f:.64,lat:-5,vy:9}],                                              // 爆破花：踩到彈飛＋小加速
  pillars:[{f:.035,lat:3.2},{f:.565,lat:.5},{f:.68,lat:-3},{f:.855,lat:2.5},{f:.87,lat:-3.5}], // 石柱
  honey:[{f:.17,lat:-5.5},{f:.5,lat:5},{f:.75,lat:-5.2}],                                     // 蜂蜜果：大招充能
  minions:[{f0:.18,f1:.235,team:0},{f0:.695,f1:.75,team:1}],                                   // 小兵：逆向走過來
  crab:{f:.405,amp:5.5,period:6},                                                              // 河道蟹：在河上左右橫走
  river:.405, baron:.33, dragon:.47,
  turrets:[{f:.06,side:-1,team:0},{f:.19,side:1,team:0},{f:.29,side:-1,team:0},{f:.61,side:1,team:1},{f:.73,side:-1,team:1},{f:.9,side:1,team:1}],
  pits:[{f:.33,side:1,kind:'baron'},{f:.47,side:-1,kind:'dragon'}], bases:[[.015,-1,0],[.5,1,1]],
};
// 嚎哭深淵（ARAM）：雪地、一條長長的石橋、深淵上的冰橋跳台、魄羅、治療聖物、魄羅王雕像
export const ABYSS_DEF={
  id:'abyss', theme:'abyss', name:{zh:'嚎哭深淵',ja:'ハウリングアビス'},
  w:15, off:7, laps:3,
  pts:[[0,0],[0,-70],[4,-140],[20,-195],[55,-225],[98,-222],[124,-192],[122,-145],[100,-110],[92,-65],[108,-20],[118,35],[108,85],[80,112],[42,112],[14,88],[0,50]],
  pads:[{f:.1,lat:0},{f:.14,lat:-3.5},{f:.5,lat:3},{f:.93,lat:-3},{f:.945,lat:-3},{f:.96,lat:-3}],
  ramps:[{f:.614,lat:0,w:7,len:3,vy:8.5,kind:'ramp',boost:.5}],
  cones:[{f:.3,lat:5,vy:9},{f:.8,lat:-5,vy:9}],
  pillars:[{f:.05,lat:-3},{f:.17,lat:2.5},{f:.45,lat:0},{f:.7,lat:3},{f:.72,lat:-3.5},{f:.88,lat:1}],
  honey:[{f:.25,lat:-5.3},{f:.55,lat:5},{f:.85,lat:-5}],
  minions:[{f0:.1,f1:.165,team:0},{f0:.66,f1:.725,team:1}],
  poros:[{f:.38,amp:4.5,period:8,ph:0},{f:.77,amp:4.5,period:8.5,ph:2}],   // 魄羅：在路上左右蹦跳
  river:.63,
  turrets:[{f:.04,side:-1,team:0},{f:.16,side:1,team:0},{f:.26,side:-1,team:0},{f:.55,side:1,team:1},{f:.7,side:-1,team:1},{f:.84,side:1,team:1}],
  pits:[{f:.33,side:'out',kind:'poroking'},{f:.47,side:'out',kind:'shrine'},{f:.9,side:'out',kind:'shrine'}], bases:[[.015,-1,0],[.5,1,1]],
};
// 屠夫之橋（比爾吉沃特）：夕陽下的碼頭、木板路、海上的海盜船、剛普朗克的砲擊、火藥桶、柳橙
export const BILGE_DEF={
  id:'bilge', theme:'bilge', name:{zh:'屠夫之橋',ja:'ブッチャーズブリッジ'},
  w:15, off:7, laps:3,
  pts:[[0,0],[0,-50],[14,-82],[50,-94],[92,-88],[114,-62],[112,-22],[132,6],[172,12],[198,34],[198,78],[176,104],[132,108],[96,92],[72,62],[42,54],[14,42]],
  pads:[{f:.03,lat:0},{f:.2,lat:-3},{f:.72,lat:3},{f:.97,lat:0}],
  ramps:[{f:.862,lat:0,w:7,len:3,vy:8.5,kind:'ramp',boost:.5}],                            // 碼頭之間的缺口：跳過去
  cones:[{f:.56,lat:4,vy:9}],
  pillars:[{f:.15,lat:2},{f:.33,lat:-3},{f:.5,lat:3},{f:.66,lat:-2.5},{f:.68,lat:3},{f:.8,lat:0}],   // 火藥桶
  honey:[{f:.25,lat:5},{f:.6,lat:-5},{f:.9,lat:5.2}],                                        // 柳橙
  cannons:[{f:.12,lat:0,r:4.5,period:6,ph:0},{f:.38,lat:2,r:4.5,period:7,ph:2.5},{f:.47,lat:-2,r:4.5,period:5.5,ph:1},{f:.74,lat:0,r:5,period:6.5,ph:3.5}],   // 砲擊：紅圈亮起後落下
  river:.875,
  turrets:[], pits:[{f:.2,side:'out',kind:'ship'},{f:.55,side:'out',kind:'ship'},{f:.8,side:'out',kind:'ship'},{f:.4,side:'out',kind:'ship'}], bases:[],
};
export const TRACKS={rift:TRACK_DEF,abyss:ABYSS_DEF,bilge:BILGE_DEF};
// 外觀：地面、路、牆、天空、霧、燈光、樹、機關的樣子
const THEMES={
  rift:{ground:'grass',road:'stone',roadTint:0xffffff,wall:0xD8D2C8,curb:[0x3C8CE7,0xE5484D],line:0xF4EEDC,trees:'pine',decor:'meadow',water:'river',pillar:'stone',honey:'honey',
    sky:[0x4F9BE0,0xCFEBFA,0xB8DDC4],mount:[0x6F93A8,0xE8F2F8],clouds:0xffffff,fog:[0xCFEBFA,80,320],hemi:[0xEAF6FF,0x4A6B3A,2.0],sun:[0xFFF0D0,3.0,[80,140,40]],banner:['SUMMONER’S RIFT GP','#1F4F8C','#8C1F2A']},
  abyss:{ground:'snow',road:'stone',roadTint:0xC4D2E2,wall:0xBCD2EA,curb:[0x3C8CE7,0xE5484D],line:0xFFFFFF,trees:'snowpine',decor:'snow',water:'chasm',pillar:'ice',honey:'relic',snow:true,
    sky:[0x7E9CB8,0xDCE6EE,0xC8D6E2],mount:[0x8FA6BA,0xFFFFFF],clouds:0xE8EEF4,fog:[0xD6E2EC,60,270],hemi:[0xE8F2FF,0x9AAABB,2.2],sun:[0xE8F0FF,2.4,[60,120,-60]],banner:['HOWLING ABYSS GP','#2B4A6F','#6A8FB8']},
  bilge:{ground:'sea',road:'planks',roadTint:0xffffff,wall:0x8A6242,curb:[0xC9A46B,0x3A2A1E],line:0xE8D8B0,trees:'none',decor:'harbor',water:'bridge',pillar:'barrel',honey:'orange',
    sky:[0x3B4E8C,0xF2A66B,0x2E4A6A],mount:[0x2A2F45,0x4A4F68],clouds:0xFFC89A,fog:[0xE8A77A,90,360],hemi:[0xFFD8B0,0x2E4A6A,1.9],sun:[0xFFB27A,3.0,[-120,60,40]],banner:['BUTCHER’S BRIDGE GP','#6B3A1E','#1E3A5F']},
};
const TEAM=[0x3C8CE7,0xE5484D];

function rng(seed){ let s=seed>>>0; return ()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; }
// 照片材質（Poly Haven CC0，見 tex/CREDITS.txt）：只載一次，每場比賽共用
const TEX={}, TL=new THREE.TextureLoader();
function photo(name,rx,ry,srgb=true){ const k=name+rx+'x'+ry; if(!TEX[k]){ const t=TL.load('tex/'+name); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx,ry); t.anisotropy=8; if(srgb) t.colorSpace=THREE.SRGBColorSpace; TEX[k]=t; } return TEX[k]; }
// 大範圍的明暗／色偏（世界座標雜訊），讓重複的貼圖不那麼明顯
function macroTint(mat,scale,lo,hi){ mat.onBeforeCompile=sh=>{
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;\nfloat mh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat mn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mh(i),mh(i+vec2(1,0)),f.x),mix(mh(i+vec2(0,1)),mh(i+1.),f.x),f.y);}')
    .replace('#include <map_fragment>',`#include <map_fragment>\n{ float n=mn(vWP.xz/${scale.toFixed(1)})*.65+mn(vWP.xz/${(scale/3.7).toFixed(1)})*.35; diffuseColor.rgb*=mix(vec3(${lo}),vec3(${hi}),n); }`); }; return mat; }
function canvasTex(w,h,draw,rep){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; if(rep){ t.wrapS=t.wrapT=THREE.RepeatWrapping; } return t; }

export class Track{
  constructor(def=TRACK_DEF){
    this.def=def; this.look=THEMES[def.theme||'rift']; this.w=def.w; this.half=def.w/2; this.off=def.off; this.laps=def.laps;
    const curve=new THREE.CatmullRomCurve3(def.pts.map(p=>new THREE.Vector3(p[0],0,p[1])),true,'centripetal');
    const N=this.N=900, sp=curve.getSpacedPoints(N);
    this.P=sp.slice(0,N); this.L=curve.getLength(); this.ds=this.L/N;
    this.T=[]; this.Nm=[];
    for(let i=0;i<N;i++){
      const a=this.P[(i-1+N)%N], b=this.P[(i+1)%N], t=new THREE.Vector3().subVectors(b,a).setY(0).normalize();
      this.T.push(t); this.Nm.push(new THREE.Vector3(t.z,0,-t.x));   // Nm：行進方向的右手邊（從上往下看）
    }
    this.pads=def.pads.map(p=>({s:p.f*this.L,lat:p.lat,len:4,w:3.2}));
    const at=(f,lat)=>{ const m=this.sample(f*this.L); return {x:m.pos.x+m.nrm.x*lat,z:m.pos.z+m.nrm.z*lat,s:f*this.L,lat}; };
    this.ramps=(def.ramps||[]).map(r=>Object.assign({},r,{s:r.f*this.L})).concat((def.cones||[]).map(c=>({s:c.f*this.L,lat:c.lat,w:2.6,len:2.6,vy:c.vy,boost:.6,kind:'cone'})));
    this.pillars=(def.pillars||[]).map(p=>Object.assign(at(p.f,p.lat),{r:1.1}));
    this.honey=(def.honey||[]).map(h=>at(h.f,h.lat));
    // 會動的障礙；eff＝撞到時的效果
    this.hz=[]; (def.minions||[]).forEach((m,w)=>{ for(let wave=0;wave<2;wave++) for(let j=0;j<2;j++) this.hz.push({kind:'minion',team:m.team,seg:m,wave,j,r:.7,x:0,z:0,h:0,eff:{spin:.45,slow:.5}}); });
    if(def.crab) this.hz.push({kind:'crab',r:1.3,x:0,z:0,h:0,eff:{knock:6,spin:.8},seg:def.crab});
    (def.poros||[]).forEach(p=>this.hz.push({kind:'poro',r:1,x:0,z:0,h:0,eff:{spin:.5,slow:.8},seg:p}));
    (def.cannons||[]).forEach(c=>{ const q=at(c.f,c.lat); this.hz.push({kind:'cannon',r:c.r,x:q.x,z:q.z,h:0,eff:{knock:7,spin:.9},seg:c,on:false}); });
    this.hzAI=this.hz.filter(o=>o.kind!=='minion'||o.j===0);   // 電腦閃避用：一組小兵當成一個大障礙
  }
  // 會動的障礙：位置只由比賽時間決定 → 兩支手機不用傳資料也一樣
  hazards(t){
    const L=this.L, d=this.def;
    for(const o of this.hz){
      let s,lat;
      if(o.kind==='minion'){ const s0=o.seg.f0*L, len=(o.seg.f1-o.seg.f0)*L, v=5, u=((t*v+o.wave*len/2)%len+len)%len;
        const c=Math.sin(t*.35+o.wave*2+o.seg.f0*9)*3.5; s=s0+len-u+o.j*1.2; lat=c+(o.j?1:-1); o.cs=s0+len-u; o.cl=c; }
      else if(o.kind==='cannon'){ const c=o.seg, u=((t+c.ph)%c.period+c.period)%c.period; o.u=u; o.warn=u>c.period-1.3; o.on=u<.25;   // 砲擊：落下前 1.3 秒亮紅圈，落下後 0.25 秒內在圈裡的人被炸飛
        o.s=c.f*L; o.lat=c.lat; o.as=o.s; o.alat=c.lat; o.ar=o.r; continue; }
      else { const c=o.seg, w=(t+(c.ph||0))*Math.PI*2/c.period; s=c.f*L; lat=c.amp*Math.sin(w); o.dirS=Math.cos(w)>0?1:-1; }   // 河道蟹、魄羅：左右橫走
      const m=this.sample(s); o.x=m.pos.x+m.nrm.x*lat; o.z=m.pos.z+m.nrm.z*lat; o.s=((s%L)+L)%L; o.lat=lat; if(o.kind==='minion'){ o.as=((o.cs%L)+L)%L; o.alat=o.cl; o.ar=2.6; } else { o.as=o.s; o.alat=lat; o.ar=o.r; }
      o.h=o.kind==='minion'?Math.atan2(-m.tan.x,-m.tan.z):Math.atan2(m.nrm.x,m.nrm.z)*o.dirS;
    }
    return this.hz;
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
  build(root,q){
    this.q=q||'std'; const hq=this.q==='hq';
    const N=this.N, P=this.P, Nm=this.Nm, half=this.half, off=this.off, L=this.L, ds=this.ds, R=rng(20260926);
    const lam=(c,o)=>new THREE.MeshLambertMaterial(Object.assign({color:c},o||{}));
    // 地面（草地）
    const grass=canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#4E8A3E'; g.fillRect(0,0,w,h); for(let k=0;k<2600;k++){ const v=R(); g.fillStyle=v<.33?'#5C9A48':v<.66?'#447C36':'#63A34E'; g.fillRect(R()*w,R()*h,2+R()*3,2+R()*3); } },true);
    grass.repeat.set(140,140);
    const cx=P.reduce((a,p)=>a+p.x,0)/N, cz=P.reduce((a,p)=>a+p.z,0)/N; this.center=new THREE.Vector3(cx,0,cz);
    const Lk=this.look; this.spinners=[]; this.bobbers=[]; this.ships=[]; this.cannonM=[]; this.sea=null;
    let gmat;
    if(Lk.ground==='snow'){ const sn=canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#EEF3F8'; g.fillRect(0,0,w,h); for(let k=0;k<3000;k++){ const v=R(); g.fillStyle=v<.4?'#DCE5EE':v<.8?'#F9FBFF':'#C6D3E2'; g.fillRect(R()*w,R()*h,2+R()*4,2+R()*4); } },true);
      sn.repeat.set(120,120); gmat=macroTint(lam(0xffffff,{map:sn}),42,'.86,.9,.97','1.04,1.04,1.06'); }
    else if(Lk.ground==='sea'){ const sea=canvasTex(128,128,(g,w,h)=>{ g.fillStyle='#2C6A93'; g.fillRect(0,0,w,h); g.strokeStyle='rgba(200,235,255,.4)'; g.lineWidth=2; for(let k=0;k<14;k++){ const y=R()*h, x=R()*w; g.beginPath(); g.moveTo(x,y); g.bezierCurveTo(x+10,y-5,x+20,y+5,x+32,y); g.stroke(); } },true);
      sea.repeat.set(170,170); this.sea=sea; gmat=macroTint(lam(0xffffff,{map:sea}),60,'.75,.8,.9','1.1,1.05,1.0'); }
    else gmat=macroTint(lam(0x9FD86A,{map:photo('grass.jpg',230,230)}),38,'.8,.9,.72','1.12,1.14,.96');
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(1400,1400),gmat);
    ground.receiveShadow=hq; ground.rotation.x=-Math.PI/2; ground.position.set(cx,0,cz); root.add(ground);
    // 路面
    const road=canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#9A8C74'; g.fillRect(0,0,w,h);
      for(let y=0;y<h;y+=32) for(let x=((y/32)%2)*24;x<w;x+=48){ g.fillStyle=`hsl(35,${10+R()*10}%,${46+R()*10}%)`; g.fillRect(x+2,y+2,44,28); }
      g.globalAlpha=.25; for(let k=0;k<900;k++){ g.fillStyle=R()<.5?'#5E5446':'#C9BCA2'; g.fillRect(R()*w,R()*h,2,2); } g.globalAlpha=1;
      g.fillStyle='rgba(244,238,220,.85)'; g.fillRect(6,0,5,h); g.fillRect(w-11,0,5,h); },true);
    const rp=[], ru=[], ri=[];
    for(let i=0;i<=N;i++){ const k=i%N, p=P[k], n=Nm[k], v=i*ds/8;
      rp.push(p.x-n.x*half,.03,p.z-n.z*half, p.x+n.x*half,.03,p.z+n.z*half); ru.push(0,v,1,v);
      if(i<N){ const a=i*2; ri.push(a,a+2,a+1, a+1,a+2,a+3); } }
    // 木板（碼頭）：一片一片橫向的木板＋釘子
    const planks=(light)=>canvasTex(256,256,(g,w,h)=>{ for(let y=0;y<h;y+=32){ g.fillStyle=`hsl(28,${32+R()*16}%,${(light?34:22)+R()*10}%)`; g.fillRect(0,y,w,31); g.fillStyle='rgba(0,0,0,.4)'; g.fillRect(0,y+30,w,2);
      for(let k=0;k<30;k++){ g.fillStyle='rgba(0,0,0,.13)'; g.fillRect(R()*w,y+R()*30,20+R()*50,1); } const cut=R()*w; g.fillStyle='rgba(0,0,0,.45)'; g.fillRect(cut,y,2,31); g.fillStyle='#1E1A16'; g.fillRect(cut-7,y+6,3,3); g.fillRect(cut-7,y+22,3,3); g.fillRect(cut+5,y+6,3,3); g.fillRect(cut+5,y+22,3,3); } },true);
    let roadMat;
    if(Lk.road==='planks'){ const pl=planks(true); pl.repeat.set(1.5,2); roadMat=macroTint(lam(0xffffff,{map:pl}),26,'.8,.78,.74','1.1,1.06,1.0'); }
    else roadMat=macroTint(lam(Lk.roadTint,Object.assign({map:photo('road.jpg',4,2.4)},hq?{normalMap:photo('road_n.jpg',4,2.4,false),normalScale:new THREE.Vector2(1.2,1.2)}:{})),26,'.8,.78,.74','1.1,1.06,1.0');
    const roadM=this.strip(rp,ru,ri,roadMat); roadM.receiveShadow=hq; root.add(roadM);
    // 路邊白線（照片材質換掉後另外畫）
    for(const side of [-1,1]){ const lp=[], lu=[], li=[]; for(let i=0;i<=N;i++){ const k=i%N, p=P[k], n=Nm[k], a=(half-.75)*side, b=(half-.4)*side; lp.push(p.x+n.x*a,.045,p.z+n.z*a, p.x+n.x*b,.045,p.z+n.z*b); lu.push(0,0,1,0); if(i<N){ const q2=i*2; if(side>0) li.push(q2,q2+2,q2+1, q2+1,q2+2,q2+3); else li.push(q2,q2+1,q2+2, q2+1,q2+3,q2+2); } }
      root.add(this.strip(lp,lu,li,lam(Lk.line))); }
    // 路肩：前半圈藍白、後半圈紅白
    const curb=(inner,outer,y)=>{ const pos=[], col=[], c=new THREE.Color(), W=new THREE.Color(0xffffff);
      for(let i=0;i<N;i++){ const j=(i+1)%N, team=i<N/2?0:1, on=Math.floor(i*ds/3)%2===0; c.setHex(on?Lk.curb[team]:(Lk.ground==='sea'?0x5A4030:0xF4F1EA));
        for(const side of [-1,1]){ const a=P[i],b=P[j],na=Nm[i],nb=Nm[j], q=(p,n,d)=>[p.x+n.x*d*side,y,p.z+n.z*d*side];
          const v=[q(a,na,inner),q(b,nb,inner),q(a,na,outer),q(b,nb,outer)];
          const tri=side>0?[0,2,1,1,2,3]:[0,1,2,1,3,2]; tri.forEach(t=>{ pos.push(...v[t]); col.push(c.r,c.g,c.b); }); } }
      const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); g.computeVertexNormals();
      return new THREE.Mesh(g,lam(0xffffff,{vertexColors:true,side:THREE.DoubleSide})); };   // 兩側三角形的方向不同：雙面才不會有一邊看不到
    root.add(curb(half,half+1.1,.04));
    // 海：路外兩側鋪碼頭木板（跳台後的缺口不鋪，看得到海）
    if(Lk.ground==='sea'){ const dk=planks(false); dk.repeat.set(1,2); const dm=lam(0xffffff,{map:dk}), gapS=(this.def.river||0)*L;
      for(const side of [-1,1]){ const dp=[], du=[], di=[]; for(let i=0;i<=N;i++){ const k=i%N, p=P[k], n=Nm[k], a=(half+1.1)*side, b=(half+off+4.5)*side, v=i*ds/8;
          dp.push(p.x+n.x*a,.025,p.z+n.z*a, p.x+n.x*b,.025,p.z+n.z*b); du.push(0,v,1,v);
          let dd=Math.abs(i*ds-gapS); dd=Math.min(dd,L-dd); if(i<N&&dd>9){ const q2=i*2; if(side>0) di.push(q2,q2+2,q2+1, q2+1,q2+2,q2+3); else di.push(q2,q2+1,q2+2, q2+1,q2+3,q2+2); } }
        const dmesh=this.strip(dp,du,di,dm); dmesh.receiveShadow=hq; root.add(dmesh); }
      // 木樁：碼頭邊緣每 6 公尺一根
      const posts=[]; for(let i=0;i<N;i+=Math.max(1,Math.round(6/ds))){ for(const side of [-1,1]){ const d=(half+off+4.8)*side, p=P[i], n=Nm[i]; posts.push([p.x+n.x*d,p.z+n.z*d]); } }
      const pm=new THREE.InstancedMesh(new THREE.CylinderGeometry(.28,.32,2.6,7),lam(0x4A3322),posts.length), o=new THREE.Object3D(); posts.forEach((t,k)=>{ o.position.set(t[0],.3,t[1]); o.updateMatrix(); pm.setMatrixAt(k,o.matrix); }); root.add(pm); }
    // 牆（石牆）
    const wallP=[], wallI=[], wallUV=[]; let vi=0; const WH=1.1;
    for(const side of [-1,1]) for(let i=0;i<=N;i++){ const k=i%N, p=P[k], n=Nm[k], d=(half+off)*side;
      wallP.push(p.x+n.x*d,0,p.z+n.z*d, p.x+n.x*d,WH,p.z+n.z*d, p.x+n.x*(d+side*.8),WH,p.z+n.z*(d+side*.8)); const u=i*this.ds/2.2; wallUV.push(u,0, u,.5, u,.86);
      if(i<N){ const a=vi+i*3, b=a+3; if(side<0) wallI.push(a,a+1,b, b,a+1,b+1, a+1,a+2,b+1, b+1,a+2,b+2); else wallI.push(a,b,a+1, b,b+1,a+1, a+1,b+1,a+2, b+1,b+2,a+2); }
      if(i===N) vi+=(N+1)*3; }
    const wg=new THREE.BufferGeometry(); wg.setAttribute('position',new THREE.Float32BufferAttribute(wallP,3)); wg.setIndex(wallI); wg.computeVertexNormals();
    wg.setAttribute('uv',new THREE.Float32BufferAttribute(wallUV,2)); wg.computeVertexNormals();
    const wallM=new THREE.Mesh(wg,lam(Lk.wall,{side:THREE.DoubleSide,map:Lk.ground==='sea'?planks(true):photo('wall.jpg',1,1)})); wallM.castShadow=wallM.receiveShadow=hq; root.add(wallM);
    // 起跑線與拱門
    const chk=canvasTex(128,32,(g)=>{ for(let x=0;x<16;x++) for(let y=0;y<4;y++){ g.fillStyle=(x+y)%2?'#111':'#fff'; g.fillRect(x*8,y*8,8,8); } });
    const sl=new THREE.Mesh(new THREE.PlaneGeometry(this.w,2),lam(0xffffff,{map:chk})); this.place(sl,0,0,.05); sl.rotateX(-Math.PI/2); root.add(sl);
    const banner=canvasTex(512,96,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,w,0); gr.addColorStop(0,Lk.banner[1]); gr.addColorStop(1,Lk.banner[2]); g.fillStyle=gr; g.fillRect(0,0,w,h); g.fillStyle='#F2C14E'; g.font='900 52px -apple-system,sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(Lk.banner[0],w/2,h/2+2,w-20); });
    const gate=new THREE.Group(); this.place(gate,0,0,0);
    [-1,1].forEach(s=>{ const pl=new THREE.Mesh(new THREE.BoxGeometry(.8,7,.8),lam(0x6B6F7A)); pl.position.set(s*(half+1.4),3.5,0); gate.add(pl); });
    const bm=new THREE.Mesh(new THREE.BoxGeometry(this.w+3.6,1.6,.5),[lam(0x2A2F3A),lam(0x2A2F3A),lam(0x2A2F3A),lam(0x2A2F3A),new THREE.MeshBasicMaterial({map:banner}),new THREE.MeshBasicMaterial({map:banner})]); bm.position.y=6.6; gate.add(bm);
    root.add(gate);
    // 加速板
    const arrow=canvasTex(64,128,(g,w,h)=>{ g.fillStyle='#FFB020'; g.fillRect(0,0,w,h); g.strokeStyle='#FFF3B0'; g.lineWidth=10; g.lineJoin='round'; for(let k=0;k<3;k++){ const y=100-k*38; g.beginPath(); g.moveTo(8,y); g.lineTo(32,y-24); g.lineTo(56,y); g.stroke(); } },true);
    this.padMats=[];
    this.pads.forEach(pd=>{ const m=new THREE.MeshBasicMaterial({map:arrow.clone(),transparent:true,opacity:.95}); m.map.needsUpdate=true; m.map.repeat.set(1,1); this.padMats.push(m);
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(pd.w,pd.len),m); this.place(mesh,pd.s,pd.lat,.06); mesh.rotateX(-Math.PI/2); root.add(mesh); });
    // 河道（河上有橋）／深淵（冰橋）／碼頭缺口（木橋）
    if(this.def.river!=null&&Lk.water==='chasm'){ const s=this.def.river*L, smp=this.sample(s), rw=16, span=this.w+2*off+80, rot=Math.atan2(smp.tan.x,smp.tan.z);
      const ch=new THREE.Mesh(new THREE.PlaneGeometry(span,rw),new THREE.MeshBasicMaterial({color:0x0B1626})); ch.rotation.x=-Math.PI/2; ch.rotation.z=rot; ch.position.set(smp.pos.x,.015,smp.pos.z); root.add(ch);
      [-1,1].forEach(e=>{ const lip=new THREE.Mesh(new THREE.PlaneGeometry(span,1.2),new THREE.MeshBasicMaterial({color:0x7FC8FF,transparent:true,opacity:.7})); lip.rotation.x=-Math.PI/2; lip.rotation.z=rot; lip.position.set(smp.pos.x+smp.tan.x*e*rw/2,.02,smp.pos.z+smp.tan.z*e*rw/2); root.add(lip); });
      [-1,1].forEach(side=>{ const rail=new THREE.Mesh(new THREE.BoxGeometry(.35,.9,rw+2),new THREE.MeshLambertMaterial({color:0xBFE8FF,emissive:0x3F8FD8,emissiveIntensity:.5})); this.place(rail,s,side*(half+1.4),.45); root.add(rail); }); }
    else if(this.def.river!=null&&Lk.water==='bridge'){ const s=this.def.river*L;
      [-1,1].forEach(side=>{ const rail=new THREE.Mesh(new THREE.BoxGeometry(.3,.8,20),lam(0x6B4A2E)); this.place(rail,s,side*(half+1.3),.9); root.add(rail);
        for(let k=-2;k<=2;k++){ const post=new THREE.Mesh(new THREE.CylinderGeometry(.18,.2,2.2,6),lam(0x4A3322)); this.place(post,s+k*4.5,side*(half+1.3),.2); root.add(post); } }); }
    else if(this.def.river!=null){ const s=this.def.river*L, smp=this.sample(s), rw=18, span=this.w+2*off+70;
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
    // 地圖上的地標：巴龍／小龍巢穴、魄羅王雕像、冰晶神壇、海盜船（side:'out'＝放在賽道外側）
    this.pitG=[];
    for(const pt of (this.def.pits||[])){ let side=pt.side; const m=this.sample(pt.f*L);
      if(side==='out') side=((m.pos.x-this.center.x)*m.nrm.x+(m.pos.z-this.center.z)*m.nrm.z)>0?1:-1;
      let g;
      if(pt.kind==='baron') g=pit(pt.f,side,0x3B2A55,0xA66BFF);
      else if(pt.kind==='dragon') g=pit(pt.f,side,0x5A3322,0xFF8A3D);
      else g=this.landmark(pt.kind,pt.f*L,side,lam,root);
      if(g.userData.spin) this.spinners.push(g.userData.spin); this.pitG.push(g); }
    // 防禦塔與主堡
    (this.def.turrets||[]).forEach(t=>{ const g=new THREE.Group(); this.place(g,t.f*L,t.side*(half+off+4),0);
      const base=new THREE.Mesh(new THREE.CylinderGeometry(1.8,2.2,1.2,10),lam(0x6E6A64)); base.position.y=.6; g.add(base);
      const col=new THREE.Mesh(new THREE.CylinderGeometry(1,1.4,5,10),lam(0x8E8A82)); col.position.y=3.7; g.add(col);
      const top=new THREE.Mesh(new THREE.CylinderGeometry(1.8,1.1,1,10),lam(0x5B5750)); top.position.y=6.6; g.add(top);
      const cr=new THREE.Mesh(new THREE.OctahedronGeometry(.9),new THREE.MeshLambertMaterial({color:TEAM[t.team],emissive:TEAM[t.team],emissiveIntensity:.7})); cr.position.y=8; g.add(cr); g.userData.spin=cr;
      root.add(g); this.spinners.push(cr); });
    (this.def.bases||[]).forEach(([f,side,team])=>{ const g=new THREE.Group(); this.place(g,f*L,side*(half+off+12),0);
      const ped=new THREE.Mesh(new THREE.CylinderGeometry(4,5,1.5,8),lam(0x6E6A64)); ped.position.y=.75; g.add(ped);
      const cr=new THREE.Mesh(new THREE.OctahedronGeometry(3),new THREE.MeshLambertMaterial({color:TEAM[team],emissive:TEAM[team],emissiveIntensity:.8})); cr.scale.y=1.6; cr.position.y=6.5; g.add(cr);
      root.add(g); this.spinners.push(cr); });
    // 野區樹木與草叢（InstancedMesh）
    const trees=[], bushes=[]; let minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9; P.forEach(p=>{ minX=Math.min(minX,p.x); maxX=Math.max(maxX,p.x); minZ=Math.min(minZ,p.z); maxZ=Math.max(maxZ,p.z); });
    for(let k=0;k<2600&&trees.length<520;k++){ const x=minX-70+R()*(maxX-minX+140), z=minZ-70+R()*(maxZ-minZ+140), q=this.nearest({x,z});
      const pitNear=this.pitG.some(g=>Math.hypot(g.position.x-x,g.position.z-z)<(g.userData.clear||13));
      const inGap=this.def.river!=null&&Lk.water==='chasm'&&(()=>{ let d=Math.abs(q.s-this.def.river*L); d=Math.min(d,L-d); return d<11&&q.dist<60; })();   // 深淵裡不長樹
      if(q.dist>half+off+3.5&&!pitNear&&!inGap) trees.push([x,z,.8+R()*.7,R()*6]); }
    for(let i=0;i<N;i+=5){ if(R()<.45) continue; const side=R()<.5?-1:1, d=half+off+1.8+R()*1.5, p=P[i], n=Nm[i]; bushes.push([p.x+n.x*d*side,p.z+n.z*d*side,.8+R()*.6]); }
    const inst=(geo,mat,list,fn)=>{ const m=new THREE.InstancedMesh(geo,mat,list.length), o=new THREE.Object3D(); list.forEach((t,k)=>{ fn(o,t); o.updateMatrix(); m.setMatrixAt(k,o.matrix); }); root.add(m); };
    // 樹：三層不規則的樹冠＋每棵不同的綠色（一次繪圖）
    const jag=(g,amt)=>{ const p=g.attributes.position, rr=rng(g.uuid.length*7+p.count); for(let i=0;i<p.count;i++){ const y=p.getY(i); if(Math.abs(p.getX(i))+Math.abs(p.getZ(i))<1e-3) continue; const k=1+(rr()-.5)*amt; p.setX(i,p.getX(i)*k); p.setZ(i,p.getZ(i)*k); p.setY(i,y+(rr()-.5)*amt*.8); } g.computeVertexNormals(); return g; };
    if(Lk.trees==='none') trees.length=0;
    const snowy=Lk.trees==='snowpine', tint=trees.map(()=>snowy?new THREE.Color().setHSL(.4+R()*.06,.22+R()*.1,.2+R()*.08):new THREE.Color().setHSL(.27+R()*.08,.42+R()*.2,.24+R()*.1));
    const inst2=(geo,mat,list,fn,col)=>{ const m=new THREE.InstancedMesh(geo,mat,list.length), o=new THREE.Object3D(); list.forEach((t,k)=>{ fn(o,t); o.updateMatrix(); m.setMatrixAt(k,o.matrix); if(col) m.setColorAt(k,col(k)); }); m.castShadow=hq; root.add(m); return m; };
    const leaf=new THREE.MeshLambertMaterial({color:0xffffff,flatShading:true});
    inst2(new THREE.CylinderGeometry(.3,.48,2.4,7),lam(0x6B4A2E),trees,(o,t)=>{ o.position.set(t[0],1.2*t[2],t[1]); o.scale.setScalar(t[2]); o.rotation.set(0,t[3],0); });
    inst2(jag(new THREE.ConeGeometry(2.8,3.6,9,2),.28),leaf,trees,(o,t)=>{ o.position.set(t[0],3.9*t[2],t[1]); o.scale.setScalar(t[2]); o.rotation.set(0,t[3],0); },k=>tint[k]);
    inst2(jag(new THREE.ConeGeometry(2.2,3.1,9,2),.28),leaf,trees,(o,t)=>{ o.position.set(t[0],5.5*t[2],t[1]); o.scale.setScalar(t[2]); o.rotation.set(0,t[3]+1,0); },k=>tint[k].clone().offsetHSL(0,0,.04));
    inst2(jag(new THREE.ConeGeometry(1.5,2.5,8,2),.25),leaf,trees,(o,t)=>{ o.position.set(t[0],7*t[2],t[1]); o.scale.setScalar(t[2]); o.rotation.set(0,t[3]+2,0); },k=>snowy?new THREE.Color(0xF2F6FA):tint[k].clone().offsetHSL(0,0,.08));   // 雪松：最上層是積雪
    if(snowy) inst2(jag(new THREE.ConeGeometry(2.3,.9,9,1),.2),leaf,trees,(o,t)=>{ o.position.set(t[0],4.9*t[2],t[1]); o.scale.setScalar(t[2]); o.rotation.set(0,t[3]+.5,0); },()=>new THREE.Color(0xE6EEF6));
    if(hq&&Lk.ground==='grass') this.buildTufts(root);
    this.buildFeatures(root, lam, arrow);
    this.buildSky(root); this.buildDecor(root);
    if(Lk.ground==='sea') bushes.length=0;
    inst(new THREE.SphereGeometry(1.4,7,5),lam(Lk.ground==='snow'?0xE4ECF4:0x2E7A5C),bushes,(o,t)=>{ o.position.set(t[0],.5,t[1]); o.scale.set(t[2]*1.4,t[2],t[2]*1.4); o.rotation.set(0,0,0); });
  }
  // 地標：魄羅王雕像、冰晶神壇、海盜船
  landmark(kind,s,side,lam,root){
    const g=new THREE.Group(), half=this.half, off=this.off;
    if(kind==='poroking'){ this.place(g,s,side*(half+off+18),0);
      const ped=new THREE.Mesh(new THREE.CylinderGeometry(6,7,1.6,10),lam(0x9AA8B8)); ped.position.y=.8; g.add(ped);
      const body=new THREE.Mesh(new THREE.IcosahedronGeometry(4.6,2),new THREE.MeshLambertMaterial({color:0xF6F4EE,flatShading:true})); body.position.y=5.6; body.scale.set(1,.9,1); g.add(body);
      [-1,1].forEach(e=>{ const horn=new THREE.Mesh(new THREE.ConeGeometry(.7,2.6,8),lam(0x8A6A4A)); horn.position.set(e*2.4,9.4,-.4); horn.rotation.z=-e*.55; g.add(horn);
        const eye=new THREE.Mesh(new THREE.SphereGeometry(.5,10,8),lam(0x2A2F3A)); eye.position.set(e*1.4,6.8,-4); g.add(eye); });
      const tongue=new THREE.Mesh(new THREE.SphereGeometry(.9,10,8),lam(0xF27A9A)); tongue.scale.set(1,.45,1.2); tongue.position.set(0,4.6,-4.2); g.add(tongue);
      const crown=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.8,1.1,8,1,true),new THREE.MeshLambertMaterial({color:0xF2C14E,emissive:0xA07010,emissiveIntensity:.4,side:THREE.DoubleSide})); crown.position.y=10.2; g.add(crown);
      g.rotation.y+=side>0?-Math.PI/2:Math.PI/2; g.userData.clear=14; }
    else if(kind==='shrine'){ this.place(g,s,side*(half+off+12),0);
      const base=new THREE.Mesh(new THREE.CylinderGeometry(3.2,3.8,1,8),lam(0x7A8898)); base.position.y=.5; g.add(base);
      const ice=new THREE.MeshLambertMaterial({color:0xBFE8FF,emissive:0x3F8FD8,emissiveIntensity:.45,transparent:true,opacity:.9,flatShading:true});
      for(let k=0;k<5;k++){ const c=new THREE.Mesh(new THREE.OctahedronGeometry(1),ice); const a=k/5*Math.PI*2; c.scale.set(.7,2+k%3,.7); c.position.set(Math.cos(a)*1.4,2.2+k%3*.6,Math.sin(a)*1.4); c.rotation.set(Math.cos(a)*.3,a,Math.sin(a)*.3); g.add(c); }
      const core=new THREE.Mesh(new THREE.OctahedronGeometry(1.2),new THREE.MeshLambertMaterial({color:0xE8FAFF,emissive:0x7FD4FF,emissiveIntensity:.9})); core.position.y=6; g.add(core); g.userData.spin=core; g.userData.clear=8; }
    else if(kind==='ship'){ this.place(g,s,side*(half+off+26),0);
      const wood=lam(0x5A3A22), dark=lam(0x3A2616);
      const hull=new THREE.Mesh(new THREE.BoxGeometry(7,3,22),wood); hull.position.y=.6; g.add(hull);
      const bow=new THREE.Mesh(new THREE.ConeGeometry(3.5,6,4,1),wood); bow.rotation.set(Math.PI/2,0,Math.PI/4); bow.scale.set(1,1,.6); bow.position.set(0,.8,14); g.add(bow);
      const deck=new THREE.Mesh(new THREE.BoxGeometry(6.4,.3,21),lam(0x8A6242)); deck.position.y=2.2; g.add(deck);
      const aft=new THREE.Mesh(new THREE.BoxGeometry(6.6,2.6,5),dark); aft.position.set(0,3.4,-8.5); g.add(aft);
      [5,-2].forEach((z,k)=>{ const mast=new THREE.Mesh(new THREE.CylinderGeometry(.25,.32,14-k*3,6),dark); mast.position.set(0,9-k*1.5,z); g.add(mast);
        const sail=new THREE.Mesh(new THREE.PlaneGeometry(7-k,6-k),new THREE.MeshLambertMaterial({color:k?0xE8DCC0:0xB5122A,side:THREE.DoubleSide})); sail.position.set(0,10-k*1.5,z+.3); sail.rotation.y=Math.PI/2*0; g.add(sail); });
      const flag=new THREE.Mesh(new THREE.PlaneGeometry(2,1.2),new THREE.MeshBasicMaterial({color:0x111111,side:THREE.DoubleSide})); flag.position.set(0,16.4,5); g.add(flag);
      for(let k=0;k<4;k++) [-1,1].forEach(e=>{ const cn=new THREE.Mesh(new THREE.CylinderGeometry(.3,.35,1.4,8),lam(0x2A2F3A)); cn.rotation.z=Math.PI/2; cn.position.set(e*3.8,1.4,-6+k*4); g.add(cn); });
      g.rotation.y+=(k=>k)(0); g.userData.bob=Math.random()*6; g.userData.clear=18; this.ships.push(g); }
    root.add(g); return g;
  }
  // 機關的外觀：跳台、爆破花、石柱、蜂蜜果、小兵、河道蟹、魄羅、砲擊
  buildFeatures(root,lam,arrow){
    const T=this;
    this.ramps.forEach(r=>{
      if(r.kind==='ramp'){ // 楔形跳台（黃黑斜紋＋箭頭）
        const h=1.1, g=new THREE.BufferGeometry(), w=r.w/2, l=r.len/2;
        const v=[-w,0,-l, w,0,-l, -w,h,l, w,h,l, -w,0,l, w,0,l];
        g.setAttribute('position',new THREE.Float32BufferAttribute(v,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1,0,1,1,1],2));
        g.setIndex([0,2,1, 1,2,3, 2,4,3, 3,4,5, 0,4,2, 1,3,5]); g.computeVertexNormals();
        const m=new THREE.Mesh(g,new THREE.MeshLambertMaterial({map:arrow,side:THREE.DoubleSide})); this.place(m,r.s,r.lat,.02); root.add(m);
        [-1,1].forEach(sd=>{ const post=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,2.4,6),lam(0x2A2F3A)); this.place(post,r.s+l,r.lat+sd*(w+.3),1.2); root.add(post);
          const fl=new THREE.Mesh(new THREE.PlaneGeometry(.9,.5),new THREE.MeshBasicMaterial({color:0xFFB020,side:THREE.DoubleSide})); fl.position.set(sd*(w+.3),0,0); this.place(fl,r.s+l,r.lat+sd*(w+.75),2.1); root.add(fl); });
      } else { // 爆破花：橘色花苞＋綠葉
        const g=new THREE.Group(); this.place(g,r.s,r.lat,0);
        for(let k=0;k<5;k++){ const lf=new THREE.Mesh(new THREE.SphereGeometry(.7,8,6),lam(0x3F8F3A)); lf.scale.set(1,.25,.5); const a=k/5*Math.PI*2; lf.position.set(Math.cos(a)*.7,.18,Math.sin(a)*.7); lf.rotation.y=-a; g.add(lf); }
        const bud=new THREE.Mesh(new THREE.SphereGeometry(.6,12,10),new THREE.MeshLambertMaterial({color:0xFF7A2A,emissive:0xFF5A1A,emissiveIntensity:.5})); bud.position.y=.7; bud.scale.set(1,1.2,1); g.add(bud); (this.bobbers||(this.bobbers=[])).push(bud);
        const ring=new THREE.Mesh(new THREE.RingGeometry(1.1,1.35,24),new THREE.MeshBasicMaterial({color:0xFFB020,transparent:true,opacity:.7,side:THREE.DoubleSide})); ring.rotation.x=-Math.PI/2; ring.position.y=.06; g.add(ring);
        root.add(g); }
    });
    const Lk=this.look;
    // 石柱：一次繪圖（嚎哭深淵＝冰柱、屠夫之橋＝火藥桶）
    if(this.pillars.length&&Lk.pillar==='barrel'){ const o=new THREE.Object3D(), n=this.pillars.length;
      const b=new THREE.InstancedMesh(new THREE.CylinderGeometry(1.05,1.05,2.2,12),lam(0x7A4A28),n), band=new THREE.InstancedMesh(new THREE.CylinderGeometry(1.1,1.1,.22,12),lam(0x2A2F3A),n*2), top=new THREE.InstancedMesh(new THREE.CircleGeometry(.9,12),new THREE.MeshLambertMaterial({color:0xE5484D,emissive:0x801010,emissiveIntensity:.4}),n);
      this.pillars.forEach((p,k)=>{ o.position.set(p.x,1.1,p.z); o.rotation.set(0,k,0); o.scale.set(1,1,1); o.updateMatrix(); b.setMatrixAt(k,o.matrix);
        [.45,1.75].forEach((y,j)=>{ o.position.set(p.x,y,p.z); o.updateMatrix(); band.setMatrixAt(k*2+j,o.matrix); });
        o.position.set(p.x,2.21,p.z); o.rotation.set(-Math.PI/2,0,0); o.updateMatrix(); top.setMatrixAt(k,o.matrix); });
      root.add(b,band,top); }
    else if(this.pillars.length&&Lk.pillar==='ice'){ const o=new THREE.Object3D(), m=new THREE.InstancedMesh(new THREE.OctahedronGeometry(1.2),new THREE.MeshLambertMaterial({color:0xBFE8FF,emissive:0x3F8FD8,emissiveIntensity:.35,transparent:true,opacity:.88,flatShading:true}),this.pillars.length);
      this.pillars.forEach((p,k)=>{ o.position.set(p.x,1.7,p.z); o.rotation.set(0,k*1.3,0); o.scale.set(.95,1.6,.95); o.updateMatrix(); m.setMatrixAt(k,o.matrix); }); root.add(m); }
    else if(this.pillars.length){ const m=new THREE.InstancedMesh(new THREE.CylinderGeometry(1.0,1.2,3.2,7),new THREE.MeshLambertMaterial({color:0x8C8A84,flatShading:true}),this.pillars.length), o=new THREE.Object3D();
      this.pillars.forEach((p,k)=>{ o.position.set(p.x,1.6,p.z); o.rotation.set(0,k*1.3,0); o.scale.set(1,1,1); o.updateMatrix(); m.setMatrixAt(k,o.matrix); }); root.add(m);
      const cap=new THREE.InstancedMesh(new THREE.ConeGeometry(.5,.9,6),new THREE.MeshLambertMaterial({color:0x7FD4FF,emissive:0x3FA0FF,emissiveIntensity:.6}),this.pillars.length);
      this.pillars.forEach((p,k)=>{ o.position.set(p.x,3.65,p.z); o.rotation.set(0,k,0); o.updateMatrix(); cap.setMatrixAt(k,o.matrix); }); root.add(cap); }
    // 蜂蜜果
    this.honeyM=this.honey.map(h=>{ const g=new THREE.Group(); g.position.set(h.x,0,h.z);
      const st=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,.8,5),lam(0x5A8F3A)); st.position.y=.4; g.add(st);
      const hc=Lk.honey==='relic'?[0x7CFF9A,0x2FCB5A]:Lk.honey==='orange'?[0xFF9A2A,0xE0600A]:[0xFFC53A,0xFF9A1A];   // 治療聖物（綠）／柳橙／蜂蜜果
      const fr=new THREE.Mesh(new THREE.SphereGeometry(.42,12,10),new THREE.MeshLambertMaterial({color:hc[0],emissive:hc[1],emissiveIntensity:.55})); fr.position.y=1; g.add(fr);
      if(Lk.honey==='relic'){ st.visible=false; const ring=new THREE.Mesh(new THREE.TorusGeometry(.62,.05,6,20),new THREE.MeshBasicMaterial({color:0xC8FFD8})); fr.add(ring); const ped=new THREE.Mesh(new THREE.CylinderGeometry(.5,.6,.25,8),lam(0x8A96A4)); ped.position.y=.12; g.add(ped); }
      if(Lk.honey==='orange'){ const lf=new THREE.Mesh(new THREE.SphereGeometry(.16,6,4),lam(0x3F8F3A)); lf.scale.set(1.4,.4,.8); lf.position.set(.12,.42,0); fr.add(lf); }
      root.add(g); return {g,fr}; });
    // 小兵與河道蟹
    const blue=lam(0x3C8CE7), red=lam(0xE5484D), skin=lam(0xE8D2B0), dark=lam(0x2A2F3A);
    this.hzM=this.hz.map(o=>{ const g=new THREE.Group();
      if(o.kind==='minion'){ const b=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.5,4,8),o.team?red:blue); b.position.y=.62; g.add(b);
        const hd=new THREE.Mesh(new THREE.SphereGeometry(.24,8,6),skin); hd.position.y=1.2; g.add(hd);
        const hat=new THREE.Mesh(new THREE.ConeGeometry(.28,.36,6),o.team?red:blue); hat.position.y=1.45; g.add(hat);
        const sw=new THREE.Mesh(new THREE.BoxGeometry(.06,.06,.6),dark); sw.position.set(.38,.7,.25); g.add(sw); }
      else if(o.kind==='crab'){ const sh=new THREE.Mesh(new THREE.SphereGeometry(1.1,12,8,0,Math.PI*2,0,Math.PI/2),lam(0x5FB8C9)); sh.scale.set(1.2,.7,1); sh.position.y=.35; g.add(sh);
        const pt=new THREE.Mesh(new THREE.TorusGeometry(.9,.12,6,16),lam(0xF2C14E)); pt.rotation.x=Math.PI/2; pt.position.y=.4; g.add(pt);
        [-1,1].forEach(sd=>{ const cl=new THREE.Mesh(new THREE.SphereGeometry(.28,8,6),lam(0x3F8FA6)); cl.position.set(sd*1.1,.35,.6); g.add(cl);
          for(let k=0;k<3;k++){ const lg=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.6,4),dark); lg.position.set(sd*(.8+k*.1),.2,-.4+k*.4); lg.rotation.z=sd*.9; g.add(lg); } }); }
      else if(o.kind==='poro'){ const b=new THREE.Mesh(new THREE.IcosahedronGeometry(.75,1),new THREE.MeshLambertMaterial({color:0xF6F4EE,flatShading:true})); b.position.y=.75; g.add(b);
        [-1,1].forEach(e=>{ const h=new THREE.Mesh(new THREE.ConeGeometry(.16,.5,6),lam(0x8A6A4A)); h.position.set(e*.4,1.45,-.1); h.rotation.z=-e*.5; g.add(h); const ey=new THREE.Mesh(new THREE.SphereGeometry(.1,6,4),dark); ey.position.set(e*.25,.95,.66); g.add(ey); });
        const tg=new THREE.Mesh(new THREE.SphereGeometry(.18,8,6),lam(0xF27A9A)); tg.scale.set(1,.5,1.2); tg.position.set(0,.55,.72); g.add(tg); }
      else if(o.kind==='cannon'){ const ring=new THREE.Mesh(new THREE.RingGeometry(o.r-.4,o.r,36),new THREE.MeshBasicMaterial({color:0xFF3A2A,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false})); ring.rotation.x=-Math.PI/2; ring.position.y=.08; g.add(ring);
        const fill=new THREE.Mesh(new THREE.CircleGeometry(o.r-.4,36),new THREE.MeshBasicMaterial({color:0xFF6A3A,transparent:true,opacity:0,depthWrite:false})); fill.rotation.x=-Math.PI/2; fill.position.y=.07; g.add(fill);
        const ball=new THREE.Mesh(new THREE.SphereGeometry(.55,10,8),lam(0x22252C)); g.add(ball);
        const boom=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),new THREE.MeshBasicMaterial({color:0xFFA040,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false})); g.add(boom);
        g.userData={ring,fill,ball,boom}; }
      root.add(g); return g; });
  }
  // 每幀：障礙位置（比賽時間）、蜂蜜果（這支手機的玩家吃過就暫時隱藏）
  tickFeatures(raceT,me,t){
    const hz=this.hazards(raceT);
    hz.forEach((o,k)=>{ const g=this.hzM[k];
      if(o.kind==='cannon'){ const U=g.userData, c=o.seg, lead=1.3; g.position.set(o.x,0,o.z);
        const w=o.warn?1-(c.period-o.u)/lead:0;                                  // 0→1：砲彈落下前
        U.ring.material.opacity=o.warn?.5+.5*Math.sin(t*18):0; U.fill.material.opacity=o.warn?.12+.25*w:0;
        U.ball.visible=o.warn; U.ball.position.y=o.warn?28*(1-w):0;
        const bt=o.u<.6?o.u/.6:1; U.boom.material.opacity=o.u<.6?.85*(1-bt):0; U.boom.scale.setScalar(.5+o.r*1.1*Math.sqrt(bt)); U.boom.position.y=1;
        return; }
      const hop=o.kind==='poro'?Math.abs(Math.sin(raceT*7+k))*.55:o.kind==='minion'?Math.abs(Math.sin(raceT*8+k))*.12:.02;
      g.position.set(o.x,hop,o.z); g.rotation.y=o.h; });
    (this.honeyM||[]).forEach((h,k)=>{ const on=!me||!(me.honey[k]>0); h.g.visible=on; if(on){ h.fr.position.y=1+Math.sin(t*2+k)*.12; h.fr.rotation.y=t; } });
    (this.bobbers||[]).forEach((b,k)=>{ const u=1+.08*Math.sin(t*5+k); b.scale.set(u,1.2*u,u); });
  }
  // 天空（漸層圓頂，跟著鏡頭）與遠山剪影：各只有一個物體，幾乎不增加負擔
  // 高畫質：路邊一叢叢的草（兩片交叉的半透明面，一次繪圖）
  buildTufts(root){
    const R=rng(99), half=this.half, off=this.off, list=[];
    const tex=canvasTex(64,128,(g,w,h)=>{ g.clearRect(0,0,w,h); for(let k=0;k<22;k++){ const x=6+R()*52, lean=(R()-.5)*18, top=10+R()*40; const gr=g.createLinearGradient(0,h,0,top); gr.addColorStop(0,'#2F5A22'); gr.addColorStop(1,R()<.5?'#8FC45A':'#6FAE45'); g.strokeStyle=gr; g.lineWidth=2+R()*2.5; g.lineCap='round'; g.beginPath(); g.moveTo(x,h); g.quadraticCurveTo(x+lean*.3,(h+top)/2,x+lean,top); g.stroke(); } });
    for(let i=0;i<this.N;i++){ const p=this.P[i], n=this.Nm[i]; for(let k=0;k<4;k++){ if(R()<.25) continue; const side=R()<.5?-1:1, d=half+.9+R()*(off-1.6); list.push([p.x+n.x*d*side,p.z+n.z*d*side,.6+R()*.7,R()*3]); } }
    const pos=[], uv=[], idx=[]; [0,Math.PI/2].forEach((a,j)=>{ const c=Math.cos(a)*.55, s2=Math.sin(a)*.55, b=j*4; pos.push(-c,0,-s2, c,0,s2, c,.9,s2, -c,.9,-s2); uv.push(0,0,1,0,1,1,0,1); idx.push(b,b+1,b+2, b,b+2,b+3); });
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); geo.setIndex(idx); geo.computeVertexNormals();
    const m=new THREE.InstancedMesh(geo,new THREE.MeshLambertMaterial({map:tex,alphaTest:.45,side:THREE.DoubleSide}),list.length), o=new THREE.Object3D();
    list.forEach((t,k)=>{ o.position.set(t[0],0,t[1]); o.scale.set(t[2],t[2]*(.8+R()*.5),t[2]); o.rotation.set(0,t[3],0); o.updateMatrix(); m.setMatrixAt(k,o.matrix); }); root.add(m);
  }
  buildSky(root){
    const R=rng(77), sky=new THREE.SphereGeometry(640,24,12), col=[], p=sky.attributes.position, c=new THREE.Color();
    const Lk=this.look, top=new THREE.Color(Lk.sky[0]), hor=new THREE.Color(Lk.sky[1]), low=new THREE.Color(Lk.sky[2]);
    for(let i=0;i<p.count;i++){ const y=p.getY(i)/640; if(y>=0) c.copy(hor).lerp(top,Math.pow(y,.6)); else c.copy(hor).lerp(low,Math.min(1,-y*4)); col.push(c.r,c.g,c.b); }
    sky.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
    // 雲：幾片柔邊的雲朵貼圖（永遠面向鏡頭，不吃霧）
    { const cl=canvasTex(256,128,(g,w,h)=>{ for(let k=0;k<14;k++){ const x=40+R()*176, y=50+R()*40, r=18+R()*34, gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,'rgba(255,255,255,.95)'); gr.addColorStop(.6,'rgba(255,255,255,.55)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill(); } });
      const C=this.center; this.clouds=[]; for(let k=0;k<16;k++){ const a=k/16*Math.PI*2+R()*.3, d=260+R()*200, sp=new THREE.Sprite(new THREE.SpriteMaterial({map:cl,color:Lk.clouds,fog:false,depthWrite:false,transparent:true,opacity:.75+R()*.2}));
        sp.position.set(C.x+Math.cos(a)*d,110+R()*90,C.z+Math.sin(a)*d); const sc=90+R()*90; sp.scale.set(sc,sc*.45,1); sp.renderOrder=-1; root.add(sp); this.clouds.push(sp); } }
    this.sky=new THREE.Mesh(sky,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false})); this.sky.renderOrder=-1; root.add(this.sky);
    // 遠山：一圈低多邊形山峰，合併成一個網格
    const pos=[], cc=[], ring=46, C=this.center;
    for(let k=0;k<ring;k++){ const a0=k/ring*Math.PI*2, a1=(k+1)/ring*Math.PI*2, am=(a0+a1)/2, r=430+R()*60, h=40+R()*70;
      const P0=[C.x+Math.cos(a0)*r*1.05,-2,C.z+Math.sin(a0)*r*1.05], P1=[C.x+Math.cos(a1)*r*1.05,-2,C.z+Math.sin(a1)*r*1.05], Pt=[C.x+Math.cos(am)*r,h,C.z+Math.sin(am)*r];
      pos.push(...P0,...Pt,...P1); const shade=.78+R()*.12; const base=new THREE.Color(Lk.mount[0]).multiplyScalar(shade), peak=new THREE.Color(Lk.mount[1]);
      cc.push(base.r,base.g,base.b, peak.r,peak.g,peak.b, base.r,base.g,base.b); }
    const mg=new THREE.BufferGeometry(); mg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); mg.setAttribute('color',new THREE.Float32BufferAttribute(cc,3));
    root.add(new THREE.Mesh(mg,new THREE.MeshBasicMaterial({vertexColors:true,fog:false,side:THREE.DoubleSide})));
  }
  // 岩石與小花：InstancedMesh（各一次繪圖）
  buildDecor(root){
    const R=rng(4242), half=this.half, off=this.off, rocks=[], flowers=[], Lk=this.look;
    if(Lk.decor==='harbor'){ this.buildHarbor(root); return; }
    for(let i=0;i<this.N;i+=3){ const p=this.P[i], n=this.Nm[i];
      if(R()<.35){ const side=R()<.5?-1:1, d=half+1.5+R()*(off-2.5); flowers.push([p.x+n.x*d*side,p.z+n.z*d*side,R()]); }
      if(R()<.12){ const side=R()<.5?-1:1, d=half+off+2.5+R()*6; rocks.push([p.x+n.x*d*side,p.z+n.z*d*side,.6+R()*1.2,R()*6]); } }
    const o=new THREE.Object3D();
    if(Lk.decor==='snow') flowers.length=0;
    const rm=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:Lk.decor==='snow'?0xB8C4D0:0x8C8A84,flatShading:true}),rocks.length);
    rocks.forEach((t,k)=>{ o.position.set(t[0],t[2]*.35,t[1]); o.scale.set(t[2]*1.3,t[2]*.8,t[2]); o.rotation.set(t[3],t[3]*2,0); o.updateMatrix(); rm.setMatrixAt(k,o.matrix); }); root.add(rm);
    const fg=new THREE.PlaneGeometry(.5,.5); fg.rotateX(-Math.PI/2); fg.translate(0,.06,0);
    const fm=new THREE.InstancedMesh(fg,new THREE.MeshLambertMaterial({color:0xffffff}),flowers.length), cols=[0xFFE27A,0xF7A1C4,0xFFFFFF,0xC39BF2], c=new THREE.Color();
    flowers.forEach((t,k)=>{ o.position.set(t[0],0,t[1]); o.scale.setScalar(.7+t[2]*.6); o.rotation.set(0,t[2]*6,0); o.updateMatrix(); fm.setMatrixAt(k,o.matrix); fm.setColorAt(k,c.setHex(cols[Math.floor(t[2]*4)%4])); }); root.add(fm);
  }
  // 碼頭的裝飾：牆上的燈籠、木箱與木桶
  buildHarbor(root){
    const R=rng(515), half=this.half, off=this.off, lan=[], crates=[], kegs=[];
    for(let i=0;i<this.N;i+=Math.max(1,Math.round(18/this.ds))){ const p=this.P[i], n=this.Nm[i]; for(const side of [-1,1]){ const d=(half+off+.4)*side; lan.push([p.x+n.x*d,p.z+n.z*d]); } }
    for(let i=0;i<this.N;i+=4){ if(R()<.8) continue; const p=this.P[i], n=this.Nm[i], side=R()<.5?-1:1, d=(half+off+1.7+R()*2)*side; (R()<.5?crates:kegs).push([p.x+n.x*d,p.z+n.z*d,R()*6,.8+R()*.5]); }
    const o=new THREE.Object3D(), lam=c=>new THREE.MeshLambertMaterial({color:c});
    const post=new THREE.InstancedMesh(new THREE.CylinderGeometry(.1,.12,2.4,6),lam(0x2A2F3A),lan.length), lamp=new THREE.InstancedMesh(new THREE.SphereGeometry(.28,8,6),new THREE.MeshLambertMaterial({color:0xFFD27A,emissive:0xFFB040,emissiveIntensity:1.3}),lan.length);
    lan.forEach((t,k)=>{ o.position.set(t[0],2.3,t[1]); o.rotation.set(0,0,0); o.scale.set(1,1,1); o.updateMatrix(); post.setMatrixAt(k,o.matrix); o.position.y=3.6; o.updateMatrix(); lamp.setMatrixAt(k,o.matrix); }); root.add(post,lamp);
    const cm=new THREE.InstancedMesh(new THREE.BoxGeometry(1.4,1.4,1.4),lam(0x9A6A3E),crates.length); crates.forEach((t,k)=>{ o.position.set(t[0],.7*t[3]-.1,t[1]); o.rotation.set(0,t[2],0); o.scale.setScalar(t[3]); o.updateMatrix(); cm.setMatrixAt(k,o.matrix); }); root.add(cm);
    const km=new THREE.InstancedMesh(new THREE.CylinderGeometry(.6,.6,1.3,10),lam(0x6B4424),kegs.length); kegs.forEach((t,k)=>{ o.position.set(t[0],.55*t[3]-.1,t[1]); o.rotation.set(0,t[2],0); o.scale.setScalar(t[3]); o.updateMatrix(); km.setMatrixAt(k,o.matrix); }); root.add(km);
  }
  strip(pos,uv,idx,mat){ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals(); return new THREE.Mesh(g,mat); }
  // 把物件放在賽道距離 s、橫向 lat 的位置，並朝向行進方向
  place(obj,s,lat,y){ const m=this.sample(s); obj.position.set(m.pos.x+m.nrm.x*lat,y,m.pos.z+m.nrm.z*lat); obj.rotation.set(0,Math.atan2(m.tan.x,m.tan.z),0); return obj; }
  tick(t){ (this.spinners||[]).forEach((c,k)=>{ c.rotation.y=t*.8+k; });
    if(this.sea){ this.sea.offset.x=t*.02; this.sea.offset.y=Math.sin(t*.4)*.01; }
    (this.ships||[]).forEach(g=>{ const b=g.userData.bob; g.position.y=Math.sin(t*.8+b)*.35-.2; g.rotation.z=Math.sin(t*.6+b)*.04; g.rotation.x=Math.sin(t*.5+b*2)*.02; }); if(this.water){ this.water.material.map.offset.x=t*.12; this.water.material.map.offset.y=Math.sin(t*.7)*.04; } this.padMats.forEach(m=>{ m.map.offset.y=-t*1.5; }); }
}
