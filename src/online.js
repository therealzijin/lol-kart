// 多支手機對戰（最多 6 人）：大廳、開賽同步、狀態同步（每秒 30 次）、技能重播、斷線處理。
// 星狀連線：來賓只連房主，房主把每位來賓的位置／技能／命中轉給其他人。
// 分工：每支手機負責自己的車；房主另外負責電腦（還有中途斷線的人）。
// 別人的車：用「最後收到的狀態＋速度×(經過時間＋單程延遲)」推算它現在在哪，再平滑靠過去（不再顯示過去的位置）。
import {Net,MAX_PLAYERS} from './net.js?v=20260927163241';
import {T,lang} from './i18n.js?v=20260927163241';
import {ROSTER,byId,modelUrl,circleUrl} from './roster.js?v=20260927163241';
import {cast,remoteHit} from './skills.js?v=20260927163241';
import {initAI} from './ai.js?v=20260927163241';

const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const SEND_EVERY=2;                     // 每幾個模擬步送一次（60/2 = 30Hz）
const F=['x','z','y','vy','heading','speed','vx','vz','drift','level','driftT','lap','s','half','fin','ft','boostT','spinT','stunT','slowT','shieldT','invisT','ballT','hopT','steer','offroad','trailT','lightSlowT','bumpT','immuneT','chargeT','yiT','madT'];

let net=null, G=null, me=-1, cpuN=2, state='idle', readySelf=false, pendingStart=null, lastCfg=null;
const rem={};                            // idx → {L:最新狀態, tr:收到時間, st:對方送出時間, angV:轉向速度}
const peers=new Map();                   // 房主：來賓 id → {name,champ,skin}
let roster=[];                           // 大廳名單 [{id,name,champ,skin}]（第一位是房主），房主廣播給大家
const readyIds=new Set(), lastN={}; let sendN=0;

/* ---------- 狀態打包／套用 ---------- */
const r3=v=>Math.round(v*1000)/1000;
function pack(k){ return [k.idx,r3(k.pos.x),r3(k.pos.z),r3(k.y),r3(k.vy),r3(k.heading),r3(k.speed),r3(k.vel.x),r3(k.vel.z),k.drift,k.level,r3(k.driftT),k.lap,r3(k.s),k.half?1:0,k.finished?1:0,r3(k.finishTime||0),
  r3(k.boostT),r3(k.spinT),r3(k.stunT),r3(k.slowT),r3(k.shieldT),r3(k.invisT),r3(k.ballT),r3(k.hopT),r3(k.input.steer),k.offroad?1:0,r3(k.trailT),r3(k.lightSlowT),r3(k.bumpT),r3(k.immuneT),r3(k.chargeT),r3(k.yiT),r3(k.madT)]; }
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
  ['drift','level','driftT','boostT','spinT','stunT','slowT','shieldT','invisT','ballT','hopT','trailT','lightSlowT','bumpT','immuneT','chargeT','yiT','madT'].forEach(f=>k[f]=L[f]||0);
  k.offroad=!!L.offroad; k.input.steer=L.steer; k.lap=L.lap; k.s=L.s; k.half=!!L.half;
  const q=race.track.nearest(k.pos,k.lastI); k.lastI=q.i; k.calcProgress(race.track);
  if(L.fin&&!k.finished) race.markFinished(k,L.ft);
}

/* ---------- 大廳畫面 ---------- */
function lobbyUI(){
  const host=net&&net.isHost, myId=net?net.id:'';
  const list=roster.length?roster:[Object.assign({id:myId},G.myEntry())];
  $('o-players').innerHTML=list.map((p,i)=>`<div class="op" style="${p.id===myId?'border-color:var(--gold)':''}"><img src="${circleUrl(p.skin)}" alt=""><b>${esc(p.name)}</b><small>${esc(byId(p.champ).name[lang])}</small><i>${i===0?T('host'):T('guest')}</i></div>`).join('')
    +(list.length<MAX_PLAYERS?`<div class="op empty">${T('waitingMore',{k:list.length,m:MAX_PLAYERS})}</div>`:'');
  $('o-codebig').textContent=net?net.code:'';
  $('o-cpu-row').style.display=host?'':'none'; $('o-laps-row').style.display=host?'':'none';
  document.querySelectorAll('#seg-olaps button').forEach(b=>b.classList.toggle('sel',+b.dataset.v===G.getLaps()));
  $('o-start').style.display=host?'':'none'; $('o-start').disabled=list.length<2;
  const room=MAX_PLAYERS-list.length; if(host&&cpuN>room) cpuN=room;   // 真人＋電腦最多 6 台
  document.querySelectorAll('#seg-cpu button').forEach(b=>{ b.classList.toggle('sel',+b.dataset.v===cpuN); b.disabled=+b.dataset.v>room; });
  $('o-status').textContent=host?(list.length>1?T('guestsJoined',{k:list.length,m:MAX_PLAYERS}):T('tellCode')):`${T('waitingHost')}（${T('laps')}：${T('lapsIs',{n:G.getLaps()})}）`;
}
function showChoose(){ $('o-choose').style.display=''; $('o-lobby').style.display='none'; $('o-err').textContent=''; }
function showLobby(){ $('o-choose').style.display='none'; $('o-lobby').style.display=''; lobbyUI(); }
// 房主：名單有變就廣播（含電腦人數、圈數）
function broadcastRoster(){ if(!net||!net.isHost) return;
  roster=[Object.assign({id:'host'},G.myEntry())].concat([...peers].map(([id,p])=>Object.assign({id},p)));
  net.send({t:'roster',list:roster,cpu:cpuN,laps:G.getLaps()}); lobbyUI(); }

/* ---------- 開賽 ---------- */
function makeConfig(){
  const humans=[Object.assign({side:'host'},G.myEntry())].concat([...peers].map(([id,p])=>Object.assign({side:id},p))).slice(0,MAX_PLAYERS);
  const used=new Set(humans.map(h=>h.champ)); let pool=ROSTER.filter(c=>!used.has(c.id)).sort(()=>Math.random()-.5).slice(0,2);   // 電腦最多兩種模型
  if(!pool.length) pool=[ROSTER[0]];
  const list=humans.map(h=>({name:h.name,champ:h.champ,skin:h.skin,human:true,side:h.side}));
  const n=Math.max(0,Math.min(cpuN,MAX_PLAYERS-list.length));
  for(let i=0;i<n;i++){ const c=pool[i%pool.length]; list.push({name:`${c.name[lang]} ${'ABC'[Math.floor(i/pool.length)]}`,champ:c.id,skin:String(c.key*1000),cpu:true,side:'host'}); }
  list.forEach(e=>e.url=modelUrl(e.champ,e.skin));
  return {entrants:list,seed:Math.floor(Math.random()*1e9),laps:G.getLaps()};
}
function beginFromConfig(cfg){
  lastCfg=cfg; readySelf=false; readyIds.clear(); Object.keys(rem).forEach(k=>delete rem[k]); Object.keys(lastN).forEach(k=>delete lastN[k]);
  const mine=net.isHost?'host':net.id;
  const list=cfg.entrants.map(e=>Object.assign({},e,{local:e.side===mine}));
  me=list.findIndex(e=>e.human&&e.side===mine);
  if(me<0){ state='idle'; G.titleError(T('disconnected')); return; }       // 名單裡沒有自己（中途才加入）
  if(cfg.laps) G.setLaps(cfg.laps);
  state='loading';
  G.startRace(list,{me,seed:cfg.seed,online:true,laps:cfg.laps||3,
    applyRemote:(race,k)=>applyRemote(race,k),
    onCast:c=>{ if(net) net.send(Object.assign({t:'cast'},c)); },
    onHit:h=>{ if(net) net.send(Object.assign({t:'hit'},h)); },
    onLoaded:()=>{ if(!net) return; readySelf=true; net.send({t:'ready'}); if(net.isHost) tryGo(); else if(pendingStart){ pendingStart=null; go(); } },
  });
}
// 房主：所有（還連著的）來賓都讀完才開跑
function tryGo(){ if(!net||!net.isHost||!readySelf||!lastCfg||state!=='loading') return;
  const need=lastCfg.entrants.filter(e=>e.human&&e.side!=='host'&&peers.has(e.side)).map(e=>e.side);
  if(need.every(id=>readyIds.has(id))){ net.send({t:'go'}); go(); } }
function go(){ state='racing'; G.go(); }
export function setResults(){ if(state==='racing') state='results'; }
// 房主：某位來賓的車改由這支手機的電腦接手
function takeOver(id){ const race=G.race(); if(!race||!lastCfg) return;
  lastCfg.entrants.forEach((e,i)=>{ if(e.side!==id) return; const k=race.karts[i]; if(!k||k.local) return; k.local=true; if(k.human){ k.human=false; k.cpu=true; } if(!k.ai) initAI(k,Math.random); }); }

/* ---------- 連線事件 ---------- */
function wire(){
  net.on('hello',(m,from)=>{ if(!net.isHost) return; peers.set(from,{name:m.name,champ:m.champ,skin:m.skin}); broadcastRoster(); })
     .on('roster',m=>{ if(net.isHost) return; roster=m.list||[]; cpuN=m.cpu; if([3,5,7].includes(m.laps)) G.setLaps(m.laps); lobbyUI(); })
     .on('full',()=>{ const n=net; net=null; n&&n.close(); showChoose(); $('o-err').textContent=T('roomFull'); })
     .on('config',m=>{ if(!net.isHost) beginFromConfig(m.cfg); })
     .on('ready',(m,from)=>{ if(net.isHost){ readyIds.add(from); tryGo(); } })
     .on('go',()=>{ if(!net.isHost){ if(readySelf) go(); else pendingStart=true; } })
     .on('snap',(m,from)=>{ const src=m.from||from;
        if(net.isHost&&from!=='host') net.relay(Object.assign({},m,{from:src}),from,true);     // 房主轉給其他來賓
        if(m.n!=null){ if(m.n<=(lastN[src]||0)) return; lastN[src]=m.n; }                      // 晚到的舊封包丟掉（每位送出者各自編號）
        const race=G.race(), t=performance.now();
        for(const a of m.k){ if(race&&race.karts[a[0]]&&race.karts[a[0]].local) continue;
          const d=unpack(a), R=rem[a[0]]||(rem[a[0]]={});
          if(R.L&&m.st&&R.st&&R.src===src){ const dt=(m.st-R.st)/1000; if(dt>.005){ let dh=d.heading-R.L.heading; dh=Math.atan2(Math.sin(dh),Math.cos(dh)); R.angV=Math.max(-14,Math.min(14,dh/dt)); } }
          R.L=d; R.tr=t; R.st=m.st; R.src=src; R.fresh=true; } })
     .on('cast',(m,from)=>{ if(net.isHost&&from!=='host') net.relay(m,from,false); const race=G.race(); if(!race) return; const k=race.karts[m.k]; if(k&&!k.local) cast(race,k,m.slot,m); })
     .on('hit',(m,from)=>{ if(net.isHost&&from!=='host') net.relay(m,from,false); const race=G.race(); if(race) remoteHit(race,m); })
     .on('bye',(m,from)=>gone(from))
     .on('_close',(m,from)=>gone(from));
}
function gone(id){ if(!net) return; if(net.isHost) guestLost(id); else lost(); }
// 房主：來賓離開。大廳就從名單移除；讀取中當作讀完；比賽中改由電腦接手，其他人繼續跑
function guestLost(id){
  const p=peers.get(id); if(!p) return; peers.delete(id);
  if(state==='loading'){ takeOver(id); tryGo(); }
  else if(state==='racing'){ takeOver(id); G.notice(T('oppLeftN',{n:p.name})); }
  broadcastRoster();
}
// 來賓：和房主斷線 → 比賽中就由這支手機接手所有別人的車（改成電腦），自己跑完
function lost(){
  if(!net) return; const was=state; net.closed=true;
  if(was==='loading'){ net=null; state='idle'; roster=[]; G.toTitle(); G.titleError(T('disconnected')); return; }
  if(was==='racing'){
    const race=G.race();
    if(race){ race.karts.forEach(k=>{ if(!k.local){ k.local=true; if(k.human){ k.human=false; k.cpu=true; } if(!k.ai) initAI(k,Math.random); } }); }
    G.notice(T('oppLeft')); net=null; state='solo';
  } else if(was==='results'){ net=null; roster=[]; state='idle'; G.resultsLeft(T('oppLeft2')); }
  else { net=null; roster=[]; state='idle'; G.toTitle(); G.titleError(T('disconnected')); }
}

/* ---------- 對外介面 ---------- */
export function initOnline(api){
  G=api;
  document.querySelectorAll('#seg-cpu button').forEach(b=>b.onclick=()=>{ if(b.disabled) return; cpuN=+b.dataset.v; broadcastRoster(); lobbyUI(); });
  document.querySelectorAll('#seg-olaps button').forEach(b=>b.onclick=()=>{ G.setLaps(+b.dataset.v); broadcastRoster(); lobbyUI(); });
  $('o-host').onclick=async()=>{
    $('o-err').textContent=T('connecting'); leave(true);
    net=new Net(); wire();
    try{ await net.host(); $('o-err').textContent=''; roster=[Object.assign({id:'host'},G.myEntry())]; showLobby(); }catch(e){ $('o-err').textContent=T('hostFail'); net=null; }
  };
  $('o-join').onclick=async()=>{
    const code=$('o-code').value.trim(); if(!/^\d{4}$/.test(code)){ $('o-err').textContent=T('badCode'); return; }
    $('o-err').textContent=T('connecting'); leave(true);
    net=new Net(); wire();
    try{ await net.join(code); if(!net) return; $('o-err').textContent=''; net.send({t:'hello',...G.myEntry()}); showLobby(); }catch(e){ $('o-err').textContent=T(e&&e.message==='full'?'roomFull':'notFound'); net=null; }
  };
  $('o-start').onclick=()=>{ if(!net||!peers.size) return; const cfg=makeConfig(); net.send({t:'config',cfg}); beginFromConfig(cfg); };
  $('o-back').onclick=()=>{ leave(); G.toTitle(); };
}
export function openOnline(){ showChoose(); if(net){ showLobby(); } }
export function isOnline(){ return !!(net&&net.open); }
export function isHost(){ return !!(net&&net.isHost); }
export function rematch(){ if(!net||!net.isHost||!peers.size) return false; const cfg=makeConfig(); net.send({t:'config',cfg}); beginFromConfig(cfg); return true; }
// 每個模擬步呼叫；每 2 步送一次自己負責的車（房主：給所有來賓；來賓：給房主，房主再轉）
let stepN=0;
export function tick(race){ if(!net||!net.open) return; if(++stepN%SEND_EVERY) return; net.sendFast({t:'snap',n:++sendN,st:Math.round(performance.now()),k:race.karts.filter(k=>k.local).map(pack)}); }
export function leave(silent){ if(net){ net.close(); } net=null; peers.clear(); roster=[]; state='idle'; if(!silent) showChoose(); }
export function stateOf(){ return state; }
