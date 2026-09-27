// 技能系統：少數幾種「零件」組合出 8 位英雄的 Q / R。
// 場上物件（彈、陷阱、區域）都是純資料 {id, kind, mode, x, z, …}。
// mode：straight 直線｜homing 追蹤｜rail 沿賽道｜rocket 沿賽道追第一名｜static 固定｜follow 跟著施放者
//
// 連線對戰的原則：
// - 施放：施放者那支手機決定目標，把 {seq, 位置, 方向, 目標} 傳給對方，對方用同樣的程式「重播」，產生同樣 id 的物件。
// - 命中：只判定「這支手機負責的車」（k.local）。命中後 report()：通知對方移除彈道、幫施放者加充能、播特效。
import {K} from './kart.js?v=20260927101822';

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
// 選目標：重播時用對方傳來的目標；自己施放時記下選了誰
function pick(race,fn){ const c=race.ctx; if(c&&c.replay) return c.target>=0?race.karts[c.target]:null; const t=fn(); if(c) c.target=t?t.idx:-1; return t; }

function spawn(race,o){ const c=race.ctx; o.id=c?`${c.k}.${c.seq}.${c.n++}`:'z'+(nextId++); o.age=0; o.hit=[]; race.fx.push(o); return o; }
function shot(race,k,kind,opt){
  const f=fwdOf(k), a=opt.ang||0, dx=f.x*Math.cos(a)+f.z*Math.sin(a), dz=f.z*Math.cos(a)-f.x*Math.sin(a), n=Math.hypot(dx,dz);
  return spawn(race,Object.assign({kind,owner:k.idx,mode:'straight',x:k.pos.x+f.x*1.6,z:k.pos.z+f.z*1.6,y:1,dx:dx/n,dz:dz/n,v:60,r:1,life:1,eff:{}},opt));
}
// 賽道座標 → 世界座標（s 距離、lat 橫向）
function trackXZ(race,s,lat){ const m=race.track.sample(s); return {x:m.pos.x+m.nrm.x*lat,z:m.pos.z+m.nrm.z*lat,tan:m.tan}; }
function railShot(race,k,kind,opt){
  const q=race.track.nearest(k.pos,k.lastI);
  return spawn(race,Object.assign({kind,owner:k.idx,mode:'rail',s:q.s+2,lat:q.lat,x:k.pos.x,z:k.pos.z,y:1.2,v:80,r:2,life:3,eff:{}},opt));
}
// 範圍效果：只作用在這支手機負責的車
function boom(race,x,z,r,eff,owner,kind,skip){ let first=true;
  race.events.push({k:-1,e:'boom',x,z,r,kind:kind||'boom'});
  for(const o of race.karts){ if(!o.local||o.idx===owner||o.idx===skip||o.finished||o.immuneT>0) continue;
    if((o.pos.x-x)**2+(o.pos.z-z)**2<r*r){ const res=o.hit(eff); report(race,{owner,victim:o.idx,res,kind:kind||'boom',x:o.pos.x,z:o.pos.z,mul:first?1:.3}); if(res===true) first=false; } }
}
function applyCredit(race,h){ if(h.res!==true||h.owner<0) return; const k=race.karts[h.owner]; if(!k||!k.local) return;
  k.rCharge=Math.min(100,k.rCharge+R_ON_HIT*(h.mul==null?1:h.mul)); k.events.push('landed'); if(h.refund) k.qCD*=.6; if(h.reel) k.boost(1); }
// 這支手機判定到命中 → 自己處理 + 通知對方
function report(race,h){
  applyCredit(race,h);
  race.events.push({k:h.victim,e:'fxhit',kind:h.kind,x:h.x,z:h.z,blocked:h.res==='block'});
  if(race.onHit) race.onHit(h);
}
// 對方判定到的命中
export function remoteHit(race,h){
  if(h.id!=null){ const o=race.fx.find(f=>f.id===h.id); if(o){ if(h.pierce) o.hit.push(h.victim); else o.life=0; } }
  if(race.karts[h.owner]&&race.karts[h.owner].ballT>0&&h.kind==='ball') race.karts[h.owner].ballT=0;
  applyCredit(race,h);
  race.events.push({k:h.victim,e:'fxhit',kind:h.kind,x:h.x,z:h.z,blocked:h.res==='block'});
  if(h.boom) boom(race,h.boom.x,h.boom.z,h.boom.r,h.boom.eff,h.owner,h.boom.kind,h.victim);   // 對方那邊炸開 → 這邊的車也要吃到
}

/* ---------- 12 位英雄 ---------- */
export const KITS={
  Teemo:{
    q:{cd:7, cast(race,k){ const t=pick(race,()=>ahead(race,k,70,.8)); shot(race,k,'dart',{mode:t?'homing':'straight',target:t?t.idx:-1,v:62,r:1,life:1.6,eff:{blind:2.2,slow:.7}}); }},
    r:{cast(race,k){ const f=fwdOf(k), nx=f.z, nz=-f.x; const mine=race.fx.filter(o=>o.kind==='shroom'&&o.owner===k.idx); while(mine.length>=6){ const old=mine.shift(); old.life=0; }
      [-3,0,3].forEach(l=>spawn(race,{kind:'shroom',owner:k.idx,mode:'static',x:k.pos.x-f.x*3.5+nx*l,z:k.pos.z-f.z*3.5+nz*l,y:0,r:1.3,life:40,arm:.6,eff:{spin:1.1,slow:1.4}})); }},
    ai(race,k){ return {q:!!ahead(race,k,55,.9), r:behind(race,k,35).length>0}; },
  },
  Jinx:{
    q:{cd:6, cast(race,k){ shot(race,k,'zap',{v:78,r:1.3,life:.9,eff:{stun:.4,slow:2}}); }},
    r:{cast(race,k){ const t=pick(race,()=>[...race.karts].filter(o=>o!==k&&!o.finished).sort((a,b)=>a.rank-b.rank)[0]); if(!t) return false;
      const q=race.track.nearest(k.pos,k.lastI); spawn(race,{kind:'rocket',owner:k.idx,mode:'rocket',target:t.idx,s:q.s+2,lat:q.lat,x:k.pos.x,z:k.pos.z,y:1.6,v:62,r:2.2,life:14,eff:{knock:9,spin:1.3},boomR:5}); }},
    ai(race,k){ return {q:!!ahead(race,k,55,.14), r:k.rank>1}; },
  },
  Blitzcrank:{
    q:{cd:9, cast(race,k){ shot(race,k,'hook',{v:66,r:1.4,life:.85,eff:{spin:.5},pull:true}); }},
    r:{cast(race,k){ boom(race,k.pos.x,k.pos.z,10,{knock:8,spin:1},k.idx,'static'); }},
    ai(race,k){ return {q:!!ahead(race,k,45,.12), r:near(race,k,9).length>0}; },
  },
  Ezreal:{
    q:{cd:6, cast(race,k){ shot(race,k,'mystic',{v:95,r:1,life:.7,eff:{spin:.9},refund:true}); }},
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
    q:{cd:6, cast(race,k){ [-.18,0,.18].forEach(a=>shot(race,k,'arrow',{ang:a,v:64,r:.9,life:.75,eff:{slow:1.8,spin:.35},credit:.4})); }},
    r:{cast(race,k){ railShot(race,k,'crystal',{v:70,r:2.2,life:4,eff:{stun:1.2,slow:2},boomR:5,boomEff:{slow:2}}); }},
    ai(race,k){ return {q:!!ahead(race,k,40,.3), r:!!ahead(race,k,150,null)}; },
  },
  Kled:{
    q:{cd:8, cast(race,k){ shot(race,k,'beartrap',{v:62,r:1.2,life:.9,eff:{slow:1.6,spin:.25},reel:true}); }},
    r:{cast(race,k){ k.chargeT=3.5; k.boost(2.8); }},
    ai(race,k){ return {q:!!ahead(race,k,45,.15), r:k.rank>1||near(race,k,10).length>0}; },
  },
  Anivia:{
    q:{cd:10, cast(race,k){ const q=race.track.nearest(k.pos,k.lastI), lat=Math.max(-race.track.half+2,Math.min(race.track.half-2,q.lat));
      [-2.6,0,2.6].forEach(d=>{ const p=trackXZ(race,q.s-5,lat+d); spawn(race,{kind:'icewall',owner:k.idx,mode:'static',noOwner:true,x:p.x,z:p.z,y:0,r:1.35,life:5,arm:.25,pierce:true,eff:{spin:.5,slow:1.2}}); }); }},
    r:{cast(race,k){ const t=pick(race,()=>ahead(race,k,100,null)); if(!t) return false;
      spawn(race,{kind:'storm',owner:k.idx,mode:'followT',target:t.idx,x:t.pos.x,z:t.pos.z,y:0,r:5.5,life:4,zone:{slow:.35}}); }},
    ai(race,k){ return {q:behind(race,k,25).length>0, r:!!ahead(race,k,90,null)}; },
  },
  MasterYi:{
    q:{cd:10, cast(race,k){ const t=pick(race,()=>ahead(race,k,40,null));
      let s, lat; if(t){ const tq=race.track.nearest(t.pos,t.lastI); s=tq.s+3; lat=tq.lat;
        spawn(race,{kind:'alpha',owner:k.idx,mode:'homing',target:t.idx,x:t.pos.x,z:t.pos.z,y:1,dx:0,dz:1,v:30,r:2.2,life:.3,eff:{spin:.7},refund:true}); }
      else { const q=race.track.nearest(k.pos,k.lastI); s=q.s+8; lat=q.lat; }
      race.events.push({k:-1,e:'boom',x:k.pos.x,z:k.pos.z,r:2,kind:'alpha'});
      if(k.local&&!race.ctx.replay){ const p=trackXZ(race,s,lat); k.pos.set(p.x,0,p.z); k.heading=Math.atan2(p.tan.x,p.tan.z); k.vel.set(p.tan.x*k.speed,0,p.tan.z*k.speed); k.lastI=-1; }
      race.events.push({k:-1,e:'boom',x:trackXZ(race,s,lat).x,z:trackXZ(race,s,lat).z,r:2,kind:'alpha'}); }},
    r:{cast(race,k){ k.yiT=6; k.slowT=0; k.blindT=0; k.boost(.6); }},
    ai(race,k){ return {q:!!ahead(race,k,38,null), r:true}; },
  },
  Zac:{
    q:{cd:9, cast(race,k){ if(k.local){ k.vy=Math.max(k.vy,10); k.y=Math.max(k.y,.31); k.air='zac'; } k.boost(.6); k.slamUntil=race.t+2; k.slamAir=false; }},
    r:{cast(race,k){ k.bounceT=4; k.slamUntil=race.t+4.5; k.slamAir=false; }},
    ai(race,k){ return {q:near(race,k,9).length>0||!!ahead(race,k,18,.4), r:near(race,k,11).length>0}; },
  },
};

/* ---------- 施放 ---------- */
// rep：對方傳來的施放紀錄 {seq, x, z, h, target}；有 rep 時不檢查冷卻（對方已經檢查過）
export function cast(race,k,slot,rep){
  const kit=KITS[k.champ]; if(!kit) return false;
  if(!rep){
    if(!k.local||(race.phase!=='race'&&race.phase!=='finish')) return false;
    if(k.finished||k.spinT>0||k.stunT>0) return false;
    if(slot==='q'?k.qCD>0:k.rCharge<100) return false;
  }
  race.ctx={k:k.idx,seq:rep?rep.seq:++k.castSeq,n:0,target:rep?rep.target:null,replay:!!rep};
  const saved=rep?{x:k.pos.x,z:k.pos.z,h:k.heading}:null;
  if(rep){ k.pos.x=rep.x; k.pos.z=rep.z; k.heading=rep.h; }       // 用施放當下的真實位置，比內插位置準
  let ok;
  try{ ok=(slot==='q'?kit.q:kit.r).cast(race,k)!==false; }
  finally{ const c=race.ctx; race.ctx=null; if(saved){ k.pos.x=saved.x; k.pos.z=saved.z; k.heading=saved.h; }
    if(ok&&!rep){ if(slot==='q') k.qCD=kit.q.cd; else k.rCharge=0; if(race.onCast) race.onCast({k:k.idx,slot,seq:c.seq,x:k.pos.x,z:k.pos.z,h:k.heading,target:c.target}); } }
  if(!ok) return false;
  race.events.push({k:k.idx,e:'cast',slot,champ:k.champ}); return true;
}
// 電腦：技能好了就依情況決定要不要放（有一點反應延遲）
export function aiCast(race,k){
  const A=k.ai; if(!A) return; A.castWait=(A.castWait||0)-1/60; if(A.castWait>0) return;
  const want=KITS[k.champ].ai(race,k);
  // 場上已經有很多技能在飛時先不放，避免整群人一直被打
  const flying=race.fx.filter(o=>o.mode!=='static'&&o.mode!=='follow'&&o.owner!==k.idx).length;
  if(want.q&&k.qCD<=0&&flying<3&&Math.random()<.12){ if(cast(race,k,'q')) k.qCD*=1.4; A.castWait=1.5; }
  else if(want.r&&k.rCharge>=100&&flying<4&&Math.random()<.08){ cast(race,k,'r'); A.castWait=2.5; }
}

/* ---------- 每步更新 ---------- */
export function stepSkills(race,dt){
  const T=race.track, edge=T.half+T.off;
  for(const k of race.karts){
    if(k.local&&race.phase==='race'&&!k.finished) k.rCharge=Math.min(100,k.rCharge+R_RATE*dt);
    // 吉茵珂絲被動：名次變好就加速
    if(k.champ==='Jinx'&&k.local){ if(k.prevRank&&k.rank<k.prevRank&&race.phase==='race'&&(k.pasT||0)<=0){ k.boost(.7); k.pasT=2.5; k.events.push('excited'); } k.prevRank=k.rank; }
    // 圖奇被動：緊跟在後的人中毒
    if(k.champ==='Twitch') for(const o of behind(race,k,9)) if(o.local) o.lightSlowT=Math.max(o.lightSlowT,.2);
    // 札克大招：連續彈跳（跳躍由負責的手機做；落地震波兩邊各自判定）
    if(k.bounceT>0){ k.bounceT=Math.max(0,k.bounceT-dt); if(k.local&&k.y<=.01&&k.vy<=0&&k.spinT<=0&&k.stunT<=0&&!k.finished){ k.vy=6.5; } }
    if(k.slamUntil&&race.t<k.slamUntil){ if(k.y>.5) k.slamAir=true; else if(k.slamAir&&k.y<=.05){ k.slamAir=false; boom(race,k.pos.x,k.pos.z,6,{knock:6,spin:.7},k.idx,'slam'); } }
    // 圖奇大招：身後留下毒霧（兩邊各自產生，只影響自己負責的車）
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
        const tq=T.nearest(t.pos,t.lastI); o.lat+=(tq.lat-o.lat)*Math.min(1,dt*1.5); }
      else o.lat*=Math.max(0,1-dt*.6);
      o.s+=o.v*dt; const m=T.sample(o.s); o.x=m.pos.x+m.nrm.x*o.lat; o.z=m.pos.z+m.nrm.z*o.lat; o.dx=m.tan.x; o.dz=m.tan.z;
    }
    else if(o.mode==='follow'){ const k=race.karts[o.owner]; o.x=k.pos.x; o.z=k.pos.z; }
    else if(o.mode==='followT'){ const t=race.karts[o.target]; if(t){ const u=Math.min(1,dt*6); o.x+=(t.pos.x-o.x)*u; o.z+=(t.pos.z-o.z)*u; } }
    // 命中（只判定這支手機負責的車）
    if(o.arm&&o.age<o.arm) continue;
    for(const k of race.karts){
      if(!k.local||k.finished||(k.idx===o.owner&&(o.mode!=='static'||o.noOwner))||o.hit.includes(k.idx)) continue;
      if(k.immuneT>0&&!o.zone) continue;
      if(o.kind==='shroom'&&k.idx===o.owner) continue;
      const rr=o.r+K.R, grounded=o.mode==='static'||o.mode==='follow'||o.mode==='followT'; if((k.pos.x-o.x)**2+(k.pos.z-o.z)**2>rr*rr||Math.abs((k.y||0)-(grounded?0:.3))>(o.kind==='icewall'?1.6:2.2)) continue;
      if(o.zone){ k.slowT=Math.max(k.slowT,o.zone.slow); continue; }                       // 區域：在裡面就減速
      o.hit.push(k.idx);
      const res=k.hit(o.eff);
      if(res===true&&o.pull){ const b=race.karts[o.owner], f=fwdOf(b); k.pos.set(b.pos.x-f.x*3.8,0,b.pos.z-f.z*3.8); k.heading=b.heading; k.vel.set(f.x*b.speed*.4,0,f.z*b.speed*.4); k.speed=b.speed*.4; k.lastI=-1; race.events.push({k:o.owner,e:'pull',t:k.idx}); }
      const bm=o.boomR?{x:o.x,z:o.z,r:o.boomR,eff:o.boomEff||o.eff,kind:o.kind}:null;
      report(race,{id:o.id,owner:o.owner,victim:k.idx,res,kind:o.kind,x:o.x,z:o.z,mul:o.credit,refund:!!o.refund,reel:!!o.reel,pierce:!!o.pierce,boom:bm});
      if(bm) boom(race,bm.x,bm.z,bm.r,bm.eff,o.owner,bm.kind,k.idx);
      if(!o.pierce){ o.life=0; break; }
    }
  }
  race.fx=race.fx.filter(o=>o.life>0);
}
// 拉姆斯滾球撞到人：被撞的那台所屬的手機判定
export function onCollide(race,a,b){
  for(const [x,y] of [[a,b],[b,a]]) if(x.chargeT>0&&y.local&&y.immuneT<=0){ const res=y.hit({knock:7,spin:.9}); report(race,{owner:x.idx,victim:y.idx,res,kind:'charge',x:y.pos.x,z:y.pos.z,mul:.5}); }
  for(const [x,y] of [[a,b],[b,a]]) if(x.ballT>0){
    if(x.local) x.ballT=0;
    if(y.local&&y.immuneT<=0){ const res=y.hit({knock:8,spin:1}); report(race,{owner:x.idx,victim:y.idx,res,kind:'ball',x:y.pos.x,z:y.pos.z}); }
  }
}
