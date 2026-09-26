// 技能系統：少數幾種「零件」組合出 8 位英雄的 Q / R。
// 場上物件（彈、陷阱、區域）都是純資料 {id, kind, mode, x, z, …}，方便之後透過網路同步。
// mode：straight 直線｜homing 追蹤｜rail 沿賽道｜rocket 沿賽道追第一名｜static 固定｜follow 跟著施放者
import {K} from './kart.js';

const R_RATE=2.2, R_ON_HIT=15;           // 大招每秒自然充能、打中別人加多少
let nextId=1;

/* ---------- 工具 ---------- */
const fwdOf=k=>({x:Math.sin(k.heading),z:Math.cos(k.heading)});
const dist2=(a,b)=>(a.x-b.x)**2+(a.z-b.z)**2;
function targetable(k){ return !k.finished&&k.invisT<=0; }
// 前方可以瞄準的人：行進距離在 gap 內、角度在 cone 內
function ahead(race,k,maxGap,cone){
  const f=fwdOf(k); let best=null, bestG=1e9;
  for(const o of race.karts){ if(o===k||!targetable(o)) continue;
    const g=o.progress-k.progress; if(g<1||g>maxGap) continue;
    const dx=o.pos.x-k.pos.x, dz=o.pos.z-k.pos.z, d=Math.hypot(dx,dz)||1, cos=(dx*f.x+dz*f.z)/d;
    if(cone!=null&&cos<Math.cos(cone)) continue;
    if(g<bestG){ bestG=g; best=o; } }
  return best;
}
const behind=(race,k,maxGap)=>race.karts.filter(o=>o!==k&&!o.finished&&k.progress-o.progress>1&&k.progress-o.progress<maxGap);
const near=(race,k,r)=>race.karts.filter(o=>o!==k&&!o.finished&&dist2(o.pos,k.pos)<r*r);

function spawn(race,o){ o.id=nextId++; o.age=0; o.hit=[]; race.fx.push(o); return o; }
function shot(race,k,kind,opt){
  const f=fwdOf(k), a=opt.ang||0, dx=f.x*Math.cos(a)-f.z*Math.sin(a)*-1, dz=f.z*Math.cos(a)+f.x*Math.sin(a)*-1;
  const n=Math.hypot(dx,dz);
  return spawn(race,Object.assign({kind,owner:k.idx,mode:'straight',x:k.pos.x+f.x*1.6,z:k.pos.z+f.z*1.6,y:1,dx:dx/n,dz:dz/n,v:60,r:1,life:1,eff:{}},opt));
}
function railShot(race,k,kind,opt){
  const q=race.track.nearest(k.pos,k.lastI);
  return spawn(race,Object.assign({kind,owner:k.idx,mode:'rail',s:q.s+2,lat:q.lat,x:k.pos.x,z:k.pos.z,y:1.2,v:80,r:2,life:3,eff:{}},opt));
}
function boom(race,x,z,r,eff,owner,kind){ let first=true;
  race.events.push({k:-1,e:'boom',x,z,r,kind:kind||'boom'});
  for(const o of race.karts){ if(o.idx===owner||o.finished) continue; if((o.pos.x-x)**2+(o.pos.z-z)**2<r*r){ const res=o.hit(eff); credit(race,owner,res,first?1:.3); if(res===true) first=false; } }
}
function credit(race,owner,res,mul){ if(res===true&&owner>=0){ const k=race.karts[owner]; k.rCharge=Math.min(100,k.rCharge+R_ON_HIT*(mul==null?1:mul)); k.events.push('landed'); } }

/* ---------- 8 位英雄 ---------- */
export const KITS={
  Teemo:{
    q:{cd:7, cast(race,k){ const t=ahead(race,k,70,.8); shot(race,k,'dart',{mode:t?'homing':'straight',target:t?t.idx:-1,v:62,r:1,life:1.6,eff:{blind:2.2,slow:.7}}); }},
    r:{cast(race,k){ const f=fwdOf(k), nx=f.z, nz=-f.x; const mine=race.fx.filter(o=>o.kind==='shroom'&&o.owner===k.idx); while(mine.length>=6){ const old=mine.shift(); old.life=0; }
      [-3,0,3].forEach(l=>spawn(race,{kind:'shroom',owner:k.idx,mode:'static',x:k.pos.x-f.x*3.5+nx*l,z:k.pos.z-f.z*3.5+nz*l,y:0,r:1.3,life:40,arm:.6,eff:{spin:1.1,slow:1.4}})); }},
    ai(race,k){ return {q:!!ahead(race,k,55,.9), r:behind(race,k,35).length>0}; },
  },
  Jinx:{
    q:{cd:6, cast(race,k){ shot(race,k,'zap',{v:78,r:1.3,life:.9,eff:{stun:.4,slow:2}}); }},
    r:{cast(race,k){ const order=[...race.karts].filter(o=>o!==k&&!o.finished).sort((a,b)=>a.rank-b.rank); const t=order[0]; if(!t) return false;
      const q=race.track.nearest(k.pos,k.lastI); spawn(race,{kind:'rocket',owner:k.idx,mode:'rocket',target:t.idx,s:q.s+2,lat:q.lat,x:k.pos.x,z:k.pos.z,y:1.6,v:62,r:2.2,life:14,eff:{knock:9,spin:1.3},boomR:5}); }},
    ai(race,k){ return {q:!!ahead(race,k,55,.14), r:k.rank>1}; },
  },
  Blitzcrank:{
    q:{cd:9, cast(race,k){ shot(race,k,'hook',{v:66,r:1.4,life:.85,eff:{spin:.5},pull:true}); }},
    r:{cast(race,k){ boom(race,k.pos.x,k.pos.z,10,{knock:8,spin:1},k.idx,'static'); }},
    ai(race,k){ return {q:!!ahead(race,k,45,.12), r:near(race,k,9).length>0}; },
  },
  Ezreal:{
    q:{cd:4.5, cast(race,k){ shot(race,k,'mystic',{v:95,r:1,life:.7,eff:{spin:.9},refund:true}); }},
    r:{cast(race,k){ railShot(race,k,'trueshot',{v:88,r:3,life:3,pierce:true,eff:{spin:1.2,slow:1}}); }},
    ai(race,k){ return {q:!!ahead(race,k,55,.1), r:!!ahead(race,k,160,null)}; },
  },
  Twitch:{
    q:{cd:12, cast(race,k){ k.invisT=5; k.boost(1.4); }},
    r:{cast(race,k){ k.trailT=4; }},
    ai(race,k){ return {q:behind(race,k,25).length>0||!!race.fx.find(o=>o.target===k.idx), r:behind(race,k,30).length>0}; },
  },
  Sivir:{
    q:{cd:10, cast(race,k){ k.shieldT=4; }},
    r:{cast(race,k){ k.boost(3.3); k.huntT=3.3; }},
    ai(race,k){ const danger=race.fx.some(o=>o.owner!==k.idx&&(o.target===k.idx||(o.mode!=='static'&&dist2(o,k.pos)<400))); return {q:danger, r:true}; },
  },
  Rammus:{
    q:{cd:11, cast(race,k){ k.ballT=3; k.boost(.6); }},
    r:{cast(race,k){ spawn(race,{kind:'tremor',owner:k.idx,mode:'follow',x:k.pos.x,z:k.pos.z,y:0,r:7,life:4,zone:{slow:.35}}); }},
    ai(race,k){ return {q:!!ahead(race,k,22,.35), r:near(race,k,9).length>0}; },
  },
  Ashe:{
    q:{cd:6, cast(race,k){ [-.3,-.15,0,.15,.3].forEach(a=>shot(race,k,'arrow',{ang:a,v:64,r:.9,life:.75,eff:{slow:1.8,spin:.35},credit:.3})); }},
    r:{cast(race,k){ railShot(race,k,'crystal',{v:70,r:2.2,life:4,eff:{stun:1.6,slow:2},boomR:5,boomEff:{slow:2}}); }},
    ai(race,k){ return {q:!!ahead(race,k,40,.3), r:!!ahead(race,k,150,null)}; },
  },
};

/* ---------- 施放 ---------- */
export function cast(race,k,slot){
  if(race.phase!=='race'&&race.phase!=='finish') return false;
  if(k.finished||k.spinT>0||k.stunT>0) return false;
  const kit=KITS[k.champ]; if(!kit) return false;
  if(slot==='q'){ if(k.qCD>0) return false; if(kit.q.cast(race,k)===false) return false; k.qCD=kit.q.cd; }
  else { if(k.rCharge<100) return false; if(kit.r.cast(race,k)===false) return false; k.rCharge=0; }
  race.events.push({k:k.idx,e:'cast',slot,champ:k.champ}); return true;
}
// 電腦：技能好了就依情況決定要不要放（有一點反應延遲）
export function aiCast(race,k){
  const A=k.ai; if(!A) return; A.castWait=(A.castWait||0)-1/60; if(A.castWait>0) return;
  const want=KITS[k.champ].ai(race,k);
  if(want.q&&k.qCD<=0&&Math.random()<.25){ cast(race,k,'q'); A.castWait=.6; }
  else if(want.r&&k.rCharge>=100&&Math.random()<.12){ cast(race,k,'r'); A.castWait=1; }
}

/* ---------- 每步更新 ---------- */
export function stepSkills(race,dt){
  const T=race.track, edge=T.half+T.off;
  for(const k of race.karts){
    if(race.phase==='race'&&!k.finished) k.rCharge=Math.min(100,k.rCharge+R_RATE*dt);
    // 吉茵珂絲被動：名次變好就加速
    if(k.champ==='Jinx'){ if(k.prevRank&&k.rank<k.prevRank&&race.phase==='race'&&(k.pasT||0)<=0){ k.boost(.7); k.pasT=2.5; k.events.push('excited'); } k.prevRank=k.rank; }
    // 圖奇被動：緊跟在後的人中毒
    if(k.champ==='Twitch') for(const o of behind(race,k,9)) o.lightSlowT=Math.max(o.lightSlowT,.2);
    // 圖奇大招：身後留下毒霧
    if(k.trailT>0){ k.trailAcc=(k.trailAcc||0)+dt; if(k.trailAcc>=.22){ k.trailAcc=0; const f=fwdOf(k); spawn(race,{kind:'poison',owner:k.idx,mode:'static',x:k.pos.x-f.x*2.2,z:k.pos.z-f.z*2.2,y:0,r:2.8,life:6,zone:{slow:.35}}); } }
  }
  for(const o of race.fx){
    o.age+=dt; if(o.age>=o.life){ o.life=0; continue; }
    // 移動
    if(o.mode==='straight'){ o.x+=o.dx*o.v*dt; o.z+=o.dz*o.v*dt; const q=T.nearest(o,o.hint); o.hint=q.i; if(Math.abs(q.lat)>edge){ o.life=0; race.events.push({k:-1,e:'fizzle',x:o.x,z:o.z}); continue; } }
    else if(o.mode==='homing'){ const t=race.karts[o.target]; if(t&&targetable(t)){ const dx=t.pos.x-o.x, dz=t.pos.z-o.z, d=Math.hypot(dx,dz)||1, k=Math.min(1,7*dt); o.dx+=(dx/d-o.dx)*k; o.dz+=(dz/d-o.dz)*k; const n=Math.hypot(o.dx,o.dz); o.dx/=n; o.dz/=n; } o.x+=o.dx*o.v*dt; o.z+=o.dz*o.v*dt; }
    else if(o.mode==='rail'||o.mode==='rocket'){
      const t=o.mode==='rocket'?race.karts[o.target]:null;
      if(t&&!t.finished){ t.warnT=.2; let gap=t.s-o.s; if(gap<-T.L/2) gap+=T.L; if(gap>T.L/2) gap-=T.L;
        if(gap<9&&gap>-4){ o.mode='homing'; o.v=46; const dx=t.pos.x-o.x, dz=t.pos.z-o.z, d=Math.hypot(dx,dz)||1; o.dx=dx/d; o.dz=dz/d; continue; }
        o.lat+=((() => { const q=T.nearest(t.pos,t.lastI); return q.lat; })()-o.lat)*Math.min(1,dt*1.5); }
      else o.lat*=Math.max(0,1-dt*.6);
      o.s+=o.v*dt; const m=T.sample(o.s); o.x=m.pos.x+m.nrm.x*o.lat; o.z=m.pos.z+m.nrm.z*o.lat; o.dx=m.tan.x; o.dz=m.tan.z;
    }
    else if(o.mode==='follow'){ const k=race.karts[o.owner]; o.x=k.pos.x; o.z=k.pos.z; }
    // 命中
    if(o.arm&&o.age<o.arm) continue;
    for(const k of race.karts){
      if(k.finished||(k.idx===o.owner&&o.mode!=='static')||o.hit.includes(k.idx)) continue;
      if(o.kind==='shroom'&&k.idx===o.owner) continue;
      const rr=o.r+K.R; if((k.pos.x-o.x)**2+(k.pos.z-o.z)**2>rr*rr||Math.abs((k.y||0)-(o.mode==='static'||o.mode==='follow'?0:.3))>2.2) continue;
      if(o.zone){ k.slowT=Math.max(k.slowT,o.zone.slow); continue; }                       // 區域：在裡面就減速
      o.hit.push(k.idx);
      const res=k.hit(o.eff); credit(race,o.owner,res,o.credit);
      if(res===true&&o.pull){ const b=race.karts[o.owner], f=fwdOf(b); k.pos.set(b.pos.x-f.x*3.8,0,b.pos.z-f.z*3.8); k.heading=b.heading; k.vel.set(f.x*b.speed*.4,0,f.z*b.speed*.4); k.speed=b.speed*.4; k.lastI=-1; race.events.push({k:o.owner,e:'pull',t:k.idx}); }
      if(res===true&&o.refund){ const b=race.karts[o.owner]; b.qCD*=.35; }
      if(o.boomR) boom(race,o.x,o.z,o.boomR,o.boomEff||o.eff,o.owner,o.kind);
      race.events.push({k:k.idx,e:'fxhit',kind:o.kind,x:o.x,z:o.z,blocked:res==='block'});
      if(!o.pierce){ o.life=0; break; }
    }
  }
  race.fx=race.fx.filter(o=>o.life>0);
}
// 拉姆斯滾球撞到人
export function onCollide(race,a,b){
  for(const [x,y] of [[a,b],[b,a]]) if(x.ballT>0){ x.ballT=0; const res=y.hit({knock:8,spin:1}); credit(race,x.idx,res); race.events.push({k:y.idx,e:'fxhit',kind:'ball',x:y.pos.x,z:y.pos.z,blocked:res==='block'}); }
}
