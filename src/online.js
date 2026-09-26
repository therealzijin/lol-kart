// 兩支手機對戰：大廳、開賽同步、狀態同步（每秒 20 次）、技能重播、斷線處理。
// 分工：每支手機負責自己的車；房主另外負責電腦。對方的車用收到的狀態做 110ms 延遲內插。
import {Net} from './net.js';
import {T,lang} from './i18n.js';
import {ROSTER,byId,modelUrl,circleUrl} from './roster.js';
import {cast,remoteHit} from './skills.js';
import {initAI} from './ai.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const DELAY=110, SEND_EVERY=3;          // 內插延遲（ms）、每幾個模擬步送一次（60/3 = 20Hz）
const F=['x','z','y','vy','heading','speed','vx','vz','drift','level','driftT','lap','s','half','fin','ft','boostT','spinT','stunT','slowT','shieldT','invisT','ballT','hopT','steer','offroad','trailT','lightSlowT','bumpT'];

let net=null, G=null, me=-1, cpuN=2, opp=null, state='idle', readySelf=false, readyOpp=false, pendingStart=null, lastCfg=null;
const buf={};                            // idx → [{t, d}]

/* ---------- 狀態打包／套用 ---------- */
const r3=v=>Math.round(v*1000)/1000;
function pack(k){ return [k.idx,r3(k.pos.x),r3(k.pos.z),r3(k.y),r3(k.vy),r3(k.heading),r3(k.speed),r3(k.vel.x),r3(k.vel.z),k.drift,k.level,r3(k.driftT),k.lap,r3(k.s),k.half?1:0,k.finished?1:0,r3(k.finishTime||0),
  r3(k.boostT),r3(k.spinT),r3(k.stunT),r3(k.slowT),r3(k.shieldT),r3(k.invisT),r3(k.ballT),r3(k.hopT),r3(k.input.steer),k.offroad?1:0,r3(k.trailT),r3(k.lightSlowT),r3(k.bumpT)]; }
function unpack(a){ const o={}; F.forEach((f,i)=>o[f]=a[i+1]); return o; }
const lerpA=(a,b,u)=>{ let d=b-a; d=Math.atan2(Math.sin(d),Math.cos(d)); return a+d*u; };
export function applyRemote(race,k){
  const B=buf[k.idx]; if(!B||!B.length) return;
  const now=performance.now()-DELAY; let a=null,b=null;
  for(const e of B){ if(e.t<=now) a=e; else { b=e; break; } }
  const L=B[B.length-1].d; let x,z,h,y;
  if(a&&b){ const u=(now-a.t)/Math.max(1,b.t-a.t); x=a.d.x+(b.d.x-a.d.x)*u; z=a.d.z+(b.d.z-a.d.z)*u; y=a.d.y+(b.d.y-a.d.y)*u; h=lerpA(a.d.heading,b.d.heading,u); }
  else { const e=a||B[0], dt=Math.min(.25,Math.max(0,(now-e.t)/1000)); x=e.d.x+e.d.vx*dt; z=e.d.z+e.d.vz*dt; y=e.d.y; h=e.d.heading; }   // 封包晚到：用速度往前推一點
  k.pos.set(x,0,z); k.y=y; k.heading=h; k.vel.set(L.vx,0,L.vz); k.speed=L.speed; k.vy=L.vy;
  ['drift','level','driftT','boostT','spinT','stunT','slowT','shieldT','invisT','ballT','hopT','trailT','lightSlowT','bumpT'].forEach(f=>k[f]=L[f]);
  k.offroad=!!L.offroad; k.input.steer=L.steer; k.lap=L.lap; k.s=L.s; k.half=!!L.half;
  const q=race.track.nearest(k.pos,k.lastI); k.lastI=q.i; k.calcProgress(race.track);
  if(L.fin&&!k.finished) race.markFinished(k,L.ft);
  while(B.length>2&&B[1].t<now-400) B.shift();
}

/* ---------- 大廳畫面 ---------- */
function lobbyUI(){
  const host=net&&net.isHost, pl=[];
  const meE=G.myEntry();
  pl.push(`<div class="op"><img src="${circleUrl(meE.skin)}" alt=""><b>${esc(meE.name)}</b><small>${esc(byId(meE.champ).name[lang])}</small><i>${host?T('host'):T('guest')}</i></div>`);
  if(opp) pl.push(`<div class="op"><img src="${circleUrl(opp.skin)}" alt=""><b>${esc(opp.name)}</b><small>${esc(byId(opp.champ).name[lang])}</small><i>${host?T('guest'):T('host')}</i></div>`);
  else pl.push(`<div class="op empty">${T('waitingGuest')}</div>`);
  $('o-players').innerHTML=pl.join('');
  $('o-codebig').textContent=net?net.code:'';
  $('o-cpu-row').style.display=host?'':'none';
  $('o-start').style.display=host?'':'none'; $('o-start').disabled=!opp;
  $('o-status').textContent=host?(opp?T('guestJoined',{n:opp.name}):T('tellCode')):T('waitingHost');
  document.querySelectorAll('#seg-cpu button').forEach(b=>b.classList.toggle('sel',+b.dataset.v===cpuN));
}
function showChoose(){ $('o-choose').style.display=''; $('o-lobby').style.display='none'; $('o-err').textContent=''; }
function showLobby(){ $('o-choose').style.display='none'; $('o-lobby').style.display=''; lobbyUI(); }

/* ---------- 開賽 ---------- */
function makeConfig(){
  const H=G.myEntry(), used=new Set([H.champ,opp.champ]);
  const pool=ROSTER.filter(c=>!used.has(c.id)).sort(()=>Math.random()-.5).slice(0,2);   // 電腦最多兩種模型
  const list=[{name:H.name,champ:H.champ,skin:H.skin,human:true,side:'host'},{name:opp.name,champ:opp.champ,skin:opp.skin,human:true,side:'guest'}];
  for(let i=0;i<cpuN;i++){ const c=pool[i%pool.length]; list.push({name:`${c.name[lang]} ${'ABC'[Math.floor(i/2)]}`,champ:c.id,skin:String(c.key*1000),cpu:true,side:'host'}); }
  list.forEach(e=>e.url=modelUrl(e.champ,e.skin));
  return {entrants:list,seed:Math.floor(Math.random()*1e9)};
}
function beginFromConfig(cfg){
  lastCfg=cfg; readySelf=false; readyOpp=false; Object.keys(buf).forEach(k=>delete buf[k]);
  const mine=net.isHost?'host':'guest';
  const list=cfg.entrants.map(e=>Object.assign({},e,{local:e.side===mine}));
  me=list.findIndex(e=>e.human&&e.side===mine);
  state='loading';
  G.startRace(list,{me,seed:cfg.seed,online:true,
    applyRemote:(race,k)=>applyRemote(race,k),
    onCast:c=>{ if(net) net.send(Object.assign({t:'cast'},c)); },
    onHit:h=>{ if(net) net.send(Object.assign({t:'hit'},h)); },
    onLoaded:()=>{ if(!net) return; readySelf=true; net.send({t:'ready'}); if(net.isHost) tryGo(); else if(pendingStart){ pendingStart=null; go(); } },
  });
}
function tryGo(){ if(!net.isHost||!readySelf||!readyOpp) return; net.send({t:'go'}); go(); }
function go(){ state='racing'; G.go(); }
export function setResults(){ if(state==='racing') state='results'; }

/* ---------- 連線事件 ---------- */
function wire(){
  net.on('hello',m=>{ opp={name:m.name,champ:m.champ,skin:m.skin}; if(net.isHost){ net.send({t:'hello',...G.myEntry()}); } lobbyUI(); })
     .on('_join',()=>{ net.send({t:'hello',...G.myEntry()}); })
     .on('cpu',m=>{ cpuN=m.n; lobbyUI(); })
     .on('config',m=>{ if(!net.isHost) beginFromConfig(m.cfg); })
     .on('ready',()=>{ readyOpp=true; tryGo(); })
     .on('go',()=>{ if(!net.isHost){ if(readySelf) go(); else pendingStart=true; } })
     .on('snap',m=>{ const t=performance.now(); for(const a of m.k){ const B=buf[a[0]]||(buf[a[0]]=[]); B.push({t,d:unpack(a)}); if(B.length>40) B.shift(); } })
     .on('cast',m=>{ const race=G.race(); if(!race) return; const k=race.karts[m.k]; if(k&&!k.local) cast(race,k,m.slot,m); })
     .on('hit',m=>{ const race=G.race(); if(race) remoteHit(race,m); })
     .on('bye',()=>lost())
     .on('_close',()=>lost());
}
// 對方離開：比賽中由這支手機接手（對方的車改成電腦開）
function lost(){
  if(!net) return; const was=state; net.closed=true;
  if(was==='loading'){ net=null; opp=null; state='idle'; G.toTitle(); G.titleError(T('disconnected')); return; }
  if(was==='racing'){
    const race=G.race();
    if(race){ race.karts.forEach(k=>{ if(!k.local){ k.local=true; if(k.human){ k.human=false; k.cpu=true; } if(!k.ai) initAI(k,Math.random); } }); }
    G.notice(T('oppLeft')); net=null; state='solo';
  } else if(was==='results'){ net=null; opp=null; state='idle'; G.resultsLeft(T('oppLeft2')); }
  else { net=null; opp=null; state='idle'; G.toTitle(); G.titleError(T('disconnected')); }
}

/* ---------- 對外介面 ---------- */
export function initOnline(api){
  G=api;
  document.querySelectorAll('#seg-cpu button').forEach(b=>b.onclick=()=>{ cpuN=+b.dataset.v; if(net) net.send({t:'cpu',n:cpuN}); lobbyUI(); });
  $('o-host').onclick=async()=>{
    $('o-err').textContent=T('connecting'); leave(true);
    net=new Net(); wire();
    try{ await net.host(); $('o-err').textContent=''; showLobby(); }catch(e){ $('o-err').textContent=T('hostFail'); net=null; }
  };
  $('o-join').onclick=async()=>{
    const code=$('o-code').value.trim(); if(!/^\d{4}$/.test(code)){ $('o-err').textContent=T('badCode'); return; }
    $('o-err').textContent=T('connecting'); leave(true);
    net=new Net(); wire();
    try{ await net.join(code); $('o-err').textContent=''; net.send({t:'hello',...G.myEntry()}); showLobby(); }catch(e){ $('o-err').textContent=T('notFound'); net=null; }
  };
  $('o-start').onclick=()=>{ if(!net||!opp) return; const cfg=makeConfig(); net.send({t:'config',cfg}); beginFromConfig(cfg); };
  $('o-back').onclick=()=>{ leave(); G.toTitle(); };
}
export function openOnline(){ showChoose(); if(net){ showLobby(); } }
export function isOnline(){ return !!(net&&net.open); }
export function isHost(){ return !!(net&&net.isHost); }
export function rematch(){ if(!net||!net.isHost||!opp) return false; const cfg=makeConfig(); net.send({t:'config',cfg}); beginFromConfig(cfg); return true; }
// 每個模擬步呼叫；每 3 步送一次自己負責的車
let stepN=0;
export function tick(race){ if(!net||!net.open) return; if(++stepN%SEND_EVERY) return; net.send({t:'snap',k:race.karts.filter(k=>k.local).map(pack)}); }
export function leave(silent){ if(net){ net.close(); } net=null; opp=null; state='idle'; if(!silent) showChoose(); }
export function stateOf(){ return state; }
