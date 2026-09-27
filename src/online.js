// 兩支手機對戰：大廳、開賽同步、狀態同步（每秒 20 次）、技能重播、斷線處理。
// 分工：每支手機負責自己的車；房主另外負責電腦。
// 對方的車：用「最後收到的狀態＋速度×(經過時間＋單程延遲)」推算它現在在哪，再平滑靠過去（不再顯示過去的位置）。
import {Net} from './net.js?v=20260927110403';
import {T,lang} from './i18n.js?v=20260927110403';
import {ROSTER,byId,modelUrl,circleUrl} from './roster.js?v=20260927110403';
import {cast,remoteHit} from './skills.js?v=20260927110403';
import {initAI} from './ai.js?v=20260927110403';

const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const SEND_EVERY=2;                     // 每幾個模擬步送一次（60/2 = 30Hz）
const F=['x','z','y','vy','heading','speed','vx','vz','drift','level','driftT','lap','s','half','fin','ft','boostT','spinT','stunT','slowT','shieldT','invisT','ballT','hopT','steer','offroad','trailT','lightSlowT','bumpT','immuneT','chargeT','yiT'];

let net=null, G=null, me=-1, cpuN=2, opp=null, state='idle', readySelf=false, readyOpp=false, pendingStart=null, lastCfg=null;
const rem={};                            // idx → {L:最新狀態, tr:收到時間, st:對方送出時間, angV:轉向速度}
let lastN=0, sendN=0;

/* ---------- 狀態打包／套用 ---------- */
const r3=v=>Math.round(v*1000)/1000;
function pack(k){ return [k.idx,r3(k.pos.x),r3(k.pos.z),r3(k.y),r3(k.vy),r3(k.heading),r3(k.speed),r3(k.vel.x),r3(k.vel.z),k.drift,k.level,r3(k.driftT),k.lap,r3(k.s),k.half?1:0,k.finished?1:0,r3(k.finishTime||0),
  r3(k.boostT),r3(k.spinT),r3(k.stunT),r3(k.slowT),r3(k.shieldT),r3(k.invisT),r3(k.ballT),r3(k.hopT),r3(k.input.steer),k.offroad?1:0,r3(k.trailT),r3(k.lightSlowT),r3(k.bumpT),r3(k.immuneT),r3(k.chargeT),r3(k.yiT)]; }
function unpack(a){ const o={}; F.forEach((f,i)=>o[f]=a[i+1]); return o; }
const lerpA=(a,b,u)=>{ let d=b-a; d=Math.atan2(Math.sin(d),Math.cos(d)); return a+d*u; };
export function applyRemote(race,k){
  const R=rem[k.idx]; if(!R||!R.L) return; const L=R.L;
  const owd=(net?net.rtt:60)/2, age=Math.min(.35,Math.max(0,(performance.now()-R.tr+owd)/1000));
  const tx=L.x+L.vx*age, tz=L.z+L.vz*age, th=L.heading+(R.angV||0)*Math.min(age,.15);
  // 只平滑「修正量」：車照預測的軌跡走，新封包造成的落差 off 再慢慢歸零（不會因為平滑而一直落後）
  if(!R.init||Math.hypot(tx-k.pos.x,tz-k.pos.z)>8){ R.ox=R.oz=R.oh=0; R.init=true; }                     // 差太多（被拉回、傳送）就直接跳過去
  else if(R.fresh){ R.ox=k.pos.x-tx; R.oz=k.pos.z-tz; let dh=k.heading-th; R.oh=Math.atan2(Math.sin(dh),Math.cos(dh)); }
  R.fresh=false; const d=Math.exp(-(1/60)*10); R.ox*=d; R.oz*=d; R.oh*=d;
  k.pos.set(tx+R.ox,0,tz+R.oz); k.heading=th+R.oh;
  k.y=(L.y>0||L.vy>0)?Math.max(0,L.y+L.vy*age-12*age*age):0;
  k.vel.set(L.vx,0,L.vz); k.speed=L.speed; k.vy=L.vy;
  ['drift','level','driftT','boostT','spinT','stunT','slowT','shieldT','invisT','ballT','hopT','trailT','lightSlowT','bumpT','immuneT','chargeT','yiT'].forEach(f=>k[f]=L[f]||0);
  k.offroad=!!L.offroad; k.input.steer=L.steer; k.lap=L.lap; k.s=L.s; k.half=!!L.half;
  const q=race.track.nearest(k.pos,k.lastI); k.lastI=q.i; k.calcProgress(race.track);
  if(L.fin&&!k.finished) race.markFinished(k,L.ft);
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
  $('o-cpu-row').style.display=host?'':'none'; $('o-laps-row').style.display=host?'':'none';
  document.querySelectorAll('#seg-olaps button').forEach(b=>b.classList.toggle('sel',+b.dataset.v===G.getLaps()));
  $('o-start').style.display=host?'':'none'; $('o-start').disabled=!opp;
  $('o-status').textContent=(host?(opp?T('guestJoined',{n:opp.name}):T('tellCode')):T('waitingHost'))+(host?'':`（${T('laps')}：${T('lapsIs',{n:G.getLaps()})}）`);
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
  return {entrants:list,seed:Math.floor(Math.random()*1e9),laps:G.getLaps()};
}
function beginFromConfig(cfg){
  lastCfg=cfg; readySelf=false; readyOpp=false; Object.keys(rem).forEach(k=>delete rem[k]); lastN=0;
  const mine=net.isHost?'host':'guest';
  const list=cfg.entrants.map(e=>Object.assign({},e,{local:e.side===mine}));
  me=list.findIndex(e=>e.human&&e.side===mine);
  state='loading';
  if(cfg.laps) G.setLaps(cfg.laps);
  G.startRace(list,{me,seed:cfg.seed,online:true,laps:cfg.laps||3,
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
     .on('_join',()=>{ net.send({t:'hello',...G.myEntry()}); net.send({t:'laps',n:G.getLaps()}); })
     .on('cpu',m=>{ cpuN=m.n; lobbyUI(); })
     .on('laps',m=>{ if([3,5,7].includes(m.n)) G.setLaps(m.n); lobbyUI(); })
     .on('config',m=>{ if(!net.isHost) beginFromConfig(m.cfg); })
     .on('ready',()=>{ readyOpp=true; tryGo(); })
     .on('go',()=>{ if(!net.isHost){ if(readySelf) go(); else pendingStart=true; } })
     .on('snap',m=>{ if(m.n!=null){ if(m.n<=lastN) return; lastN=m.n; }            // 晚到的舊封包丟掉
        const t=performance.now();
        for(const a of m.k){ const d=unpack(a), R=rem[a[0]]||(rem[a[0]]={});
          if(R.L&&m.st&&R.st){ const dt=(m.st-R.st)/1000; if(dt>.005){ let dh=d.heading-R.L.heading; dh=Math.atan2(Math.sin(dh),Math.cos(dh)); R.angV=Math.max(-14,Math.min(14,dh/dt)); } }
          R.L=d; R.tr=t; R.st=m.st; R.fresh=true; } })
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
  document.querySelectorAll('#seg-olaps button').forEach(b=>b.onclick=()=>{ G.setLaps(+b.dataset.v); if(net) net.send({t:'laps',n:+b.dataset.v}); lobbyUI(); });
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
export function tick(race){ if(!net||!net.open) return; if(++stepN%SEND_EVERY) return; net.sendFast({t:'snap',n:++sendN,st:Math.round(performance.now()),k:race.karts.filter(k=>k.local).map(pack)}); }
export function leave(silent){ if(net){ net.close(); } net=null; opp=null; state='idle'; if(!silent) showChoose(); }
export function stateOf(){ return state; }
