// 進入點：標題畫面（選英雄與造型）→ 讀取 → 比賽 → 結果。
import {T,lang,applyLang,setLang,onLang} from './i18n.js';
import {ROSTER,byId,modelUrl,circleUrl,DD} from './roster.js';
import {Track,TRACK_DEF} from './track.js';
import {Race,DT} from './race.js';
import {View} from './view.js';
import {initInput,pollInput} from './input.js';
import {sfx,engine,stopEngine,unlockAudio} from './audio.js';
import {initAI,driveAI} from './ai.js';

const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const ls={get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} }};
const show=id=>document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('on',s.id===id));

/* ---------- 標題：選英雄與造型 ---------- */
let ver=null, pick={champ:ls.get('lk-champ')||'Teemo', skin:ls.get('lk-skin')||null};
const skinCache={};
async function ddVer(){ if(!ver){ try{ ver=(await (await fetch(DD+'/api/versions.json')).json())[0]; }catch(e){ ver='16.19.1'; } } return ver; }
async function skinsOf(cid){
  if(skinCache[cid]) return skinCache[cid];
  const v=await ddVer(), get=l=>fetch(`${DD}/cdn/${v}/data/${l}/champion/${cid}.json`).then(r=>r.json()).then(j=>j.data[cid]);
  const [zh,ja]=await Promise.all([get('zh_TW'),get('ja_JP')]); const jn={}; ja.skins.forEach(s=>jn[s.num]=s.name);
  return skinCache[cid]=zh.skins.filter(s=>s.parentSkin==null).map(s=>({id:s.id,num:s.num,n:{zh:s.name==='default'?`${'經典'} ${zh.name}`:s.name,ja:jn[s.num]&&jn[s.num]!=='default'?jn[s.num]:`クラシック ${ja.name}`}}));
}
async function renderRoster(){
  const v=await ddVer();
  $('roster').innerHTML=ROSTER.map(c=>`<button class="ch ${c.id===pick.champ?'sel':''}" data-c="${c.id}"><img src="${DD}/cdn/${v}/img/champion/${c.id}.png" alt=""><span>${esc(c.name[lang])}</span></button>`).join('');
  $('roster').querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{ if(pick.champ!==b.dataset.c){ pick.champ=b.dataset.c; pick.skin=null; ls.set('lk-champ',pick.champ); ls.set('lk-skin',''); } renderRoster(); });
  renderKit(); renderSkins();
}
async function renderSkins(){
  const cid=pick.champ, box=$('skins'); box.innerHTML=`<span style="font-size:12px;opacity:.6">${T('loading')}</span>`;
  let list; try{ list=await skinsOf(cid); }catch(e){ box.innerHTML=''; return; }
  if(cid!==pick.champ) return;
  if(!pick.skin||!list.some(s=>s.id===pick.skin)) pick.skin=list[0].id;
  box.innerHTML=list.map(s=>`<button class="sk ${s.id===pick.skin?'sel':''}" data-s="${s.id}"><img src="${DD}/cdn/img/champion/tiles/${cid}_${s.num}.jpg" alt="" loading="lazy"><span>${esc(s.n[lang])}</span></button>`).join('');
  box.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{ pick.skin=b.dataset.s; ls.set('lk-skin',pick.skin); box.querySelectorAll('.sk').forEach(x=>x.classList.toggle('sel',x===b)); });
}
function renderKit(){ const c=byId(pick.champ), k=c.kit;
  $('kit').innerHTML=`<div><b>${T('passive')}</b>　${esc(k.p[lang])}</div><div><b>${T('skill')}</b>　${esc(k.q[lang])}</div><div><b>${T('ult')}</b>　${esc(k.r[lang])}</div><div style="opacity:.55;font-size:11px;margin-top:4px">${T('soon')}</div>`; }

/* ---------- 比賽 ---------- */
let view=null, track=null, race=null, me=0, acc=0, lastT=0, raf=0, bannerT=0;
function entrantsSolo(){
  const name=($('name').value.trim()||T('namePh').replace(/^.*：/,''));
  ls.set('lk-name',$('name').value.trim());
  // 電腦只用兩種模型（每個約 5 MB），避免一次下載太多
  const others=ROSTER.filter(c=>c.id!==pick.champ).sort(()=>Math.random()-.5).slice(0,2);
  const list=[{name,champ:pick.champ,skin:pick.skin||String(byId(pick.champ).key*1000),human:true}];
  for(let i=0;i<5;i++){ const c=others[i%2]; list.push({name:`${c.name[lang]} ${'ABC'[Math.floor(i/2)]}`,champ:c.id,skin:String(c.key*1000),cpu:true}); }
  list.forEach(e=>e.url=modelUrl(e.champ,e.skin));
  return list;
}
async function startSolo(){
  unlockAudio(); tryLandscape();
  const list=entrantsSolo();
  if(!view) view=new View($('game'));
  if(!track) track=new Track(TRACK_DEF);
  show('s-load'); $('load-t').textContent=T('loadModels'); $('load-s').textContent=T('loadHint'); $('load-bar').style.width='0%';
  const urls=[...new Set(list.map(e=>e.url))];
  const res=await view.loadModels(urls,p=>$('load-bar').style.width=Math.round(p*100)+'%');
  if(res.some(r=>r.status==='rejected')){ $('load-s').textContent=T('loadFail'); await new Promise(r=>setTimeout(r,900)); }
  race=new Race(track,list); me=0;
  view.setup(track,race,me); drawMiniBase();
  show(''); $('hud').classList.add('on'); $('pad').classList.add('on'); document.body.classList.add('racing');
  acc=0; lastT=performance.now(); cancelAnimationFrame(raf); raf=requestAnimationFrame(loop);
}
function loop(now){
  raf=requestAnimationFrame(loop);
  const dt=Math.min(.1,(now-lastT)/1000); lastT=now; acc+=dt;
  let I=pollInput();
  if(window.__lk.auto){ const k=race.karts[me]; if(!k.ai) initAI(k,Math.random); driveAI(k,track,race.karts,race.t); I={steer:k.input.steer,drift:k.input.drift}; }   // 除錯：自動駕駛
  const inputs={[me]:I};
  let n=0; while(acc>=DT&&n<8){ race.step(inputs); acc-=DT; n++; }
  if(n===8) acc=0;
  for(const ev of race.events){
    if(ev.k>=0) view.onEvent(ev.k,ev.e);
    const mine=ev.k===me;
    if(ev.e==='count'){ center(ev.n); sfx.beep(); }
    else if(ev.e==='go'){ center(T('go')); sfx.go(); setTimeout(()=>center(''),700); }
    else if(mine&&ev.e==='final'){ banner(T('finalLap')); sfx.final(); }
    else if(mine&&ev.e==='lap'&&race.karts[me].lap>1) sfx.lap();
    else if(mine&&ev.e.startsWith('turbo')) sfx.turbo(+ev.e.slice(5));
    else if(mine&&ev.e==='hit') sfx.hit();
    else if(mine&&ev.e==='wall') sfx.wall();
    else if(mine&&ev.e==='finish'){ center(T('finish')); sfx.finish(); }
    else if(ev.e==='done') setTimeout(showResults,1600);
  }
  race.events.length=0;
  view.render(dt,now/1000);
  hud(dt);
  const k=race.karts[me]; engine(k.speed,!!k.drift,race.phase!=='done');
}
function center(t){ const e=$('h-center'); e.textContent=t; e.classList.remove('pop'); void e.offsetWidth; if(t!=='') e.classList.add('pop'); }
function banner(t){ $('h-banner').textContent=t; bannerT=2.2; }
const fmt=s=>{ if(s==null) return '--'; const m=Math.floor(s/60), r=s-m*60; return `${m}:${r.toFixed(2).padStart(5,'0')}`; };
function hud(dt){
  const k=race.karts[me], suf=lang==='ja'?['位','位','位','位','位','位']:['st','nd','rd','th','th','th'];
  $('h-pos').innerHTML=`${k.rank}<small>${lang==='ja'?'位':suf[k.rank-1]} / ${race.karts.length}</small>`;
  $('h-lap').textContent=T('lap',{l:Math.max(1,Math.min(race.laps,k.lap)),n:race.laps});
  $('h-time').textContent=fmt(k.finished?k.finishTime:race.time);
  $('h-spd').textContent=Math.round(k.speed*3.6)+' km/h';
  if(bannerT>0){ bannerT-=dt; if(bannerT<=0) $('h-banner').textContent=''; }
  drawMini();
}
/* ---------- 小地圖 ---------- */
let mini=null;
function drawMiniBase(){
  const c=$('mini'), P=track.P; let a=1e9,b=-1e9,cc=1e9,d=-1e9; P.forEach(p=>{ a=Math.min(a,p.x); b=Math.max(b,p.x); cc=Math.min(cc,p.z); d=Math.max(d,p.z); });
  const sc=(c.width-36)/Math.max(b-a,d-cc); mini={sc,ox:(c.width-(b-a)*sc)/2-a*sc,oy:(c.height-(d-cc)*sc)/2-cc*sc};
}
function drawMini(){
  const c=$('mini'), g=c.getContext('2d'), P=track.P, M=mini; g.clearRect(0,0,c.width,c.height);
  g.lineCap=g.lineJoin='round'; g.beginPath(); P.forEach((p,i)=>{ const x=p.x*M.sc+M.ox, y=p.z*M.sc+M.oy; i?g.lineTo(x,y):g.moveTo(x,y); }); g.closePath();
  g.strokeStyle='rgba(255,255,255,.28)'; g.lineWidth=12; g.stroke(); g.strokeStyle='#C9B48A'; g.lineWidth=6; g.stroke();
  [...race.karts].sort((x,y)=>(x.idx===me)-(y.idx===me)).forEach(k=>{ const x=k.pos.x*M.sc+M.ox, y=k.pos.z*M.sc+M.oy, col=byId(k.champ).color;
    g.beginPath(); g.arc(x,y,k.idx===me?8:6,0,Math.PI*2); g.fillStyle='#'+col.toString(16).padStart(6,'0'); g.fill(); g.lineWidth=k.idx===me?3:2; g.strokeStyle=k.idx===me?'#fff':'#1B1A22'; g.stroke(); });
}
/* ---------- 結果 ---------- */
function showResults(){
  stopEngine();
  const rows=race.results().map(r=>`<tr class="${r.idx===me?'me':''}"><td class="n">${r.rank}</td><td><img src="${circleUrl(r.skin)}" alt="">${esc(r.name)}</td><td class="t">${r.time!=null?fmt(r.time):`<span style="opacity:.5">${T('dnf')}</span>`}</td></tr>`).join('');
  $('res').innerHTML=`<h2>${T('result')}</h2><table>${rows}</table><button class="big go" id="r-again">${T('again')}</button><button class="big ghost" id="r-home">${T('home')}</button>`;
  show('s-result');
  $('r-again').onclick=()=>{ show(''); startSolo(); };
  $('r-home').onclick=goTitle;
}
function goTitle(){ cancelAnimationFrame(raf); stopEngine(); $('hud').classList.remove('on'); $('pad').classList.remove('on'); document.body.classList.remove('racing'); show('s-title'); }
function tryLandscape(){ try{ if(matchMedia('(pointer:coarse)').matches){ document.documentElement.requestFullscreen?.().then(()=>screen.orientation?.lock?.('landscape')).catch(()=>{}); } }catch(e){} }
const orient=()=>document.body.classList.toggle('portrait',innerHeight>innerWidth);
addEventListener('resize',orient); orient();

/* ---------- 啟動 ---------- */
$('name').value=ls.get('lk-name')||'';
document.querySelectorAll('#seg-lang button').forEach(b=>b.onclick=()=>setLang(b.dataset.v));
onLang(()=>{ $('name').placeholder=T('namePh'); if(document.getElementById('s-title').classList.contains('on')) renderRoster(); });
$('b-solo').onclick=startSolo;
$('b-online').onclick=()=>{ $('t-err').textContent=T('onlineSoon'); };
initInput(); applyLang();
// 除錯用
window.__lk={get race(){ return race; }, get view(){ return view; }, start:startSolo, Race, Track, TRACK_DEF, initAI, driveAI, auto:false};
