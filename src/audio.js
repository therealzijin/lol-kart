// Web Audio 合成音效（不需要音檔）：引擎聲隨速度變化、甩尾、加速、倒數、過圈、終點。
let ac=null, eng=null, engGain=null, engFilter=null, noiseBuf=null, screech=null, muted=false;
function ctx(){ if(!ac){ try{ ac=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; } } if(ac.state==='suspended') ac.resume(); return ac; }
export function unlockAudio(){ ctx(); }
// 省電：不在比賽時讓音訊晶片休眠；比賽中任何觸控都會喚醒（iPhone 需要觸控才能恢復）
export function suspendAudio(){ if(ac&&ac.state==='running'){ try{ ac.suspend(); }catch(e){} } }
document.addEventListener('touchstart',()=>{ if(ac&&ac.state==='suspended'&&document.body.classList.contains('racing')) ac.resume(); },{passive:true});
document.addEventListener('visibilitychange',()=>{ if(document.hidden) suspendAudio(); });
function tone(f,t0,dur,type='sine',vol=.15,f2){ const a=ctx(); if(!a||muted) return; const o=a.createOscillator(), g=a.createGain(), t=a.currentTime+t0;
  o.type=type; o.frequency.setValueAtTime(f,t); if(f2) o.frequency.exponentialRampToValueAtTime(f2,t+dur);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.01); g.gain.exponentialRampToValueAtTime(.0001,t+dur); o.connect(g).connect(a.destination); o.start(t); o.stop(t+dur+.05); }
function noise(){ const a=ctx(); if(!noiseBuf){ noiseBuf=a.createBuffer(1,a.sampleRate,a.sampleRate); const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; } const s=a.createBufferSource(); s.buffer=noiseBuf; s.loop=true; return s; }
export const sfx={
  beep:()=>tone(660,0,.18,'square',.08), go:()=>tone(990,0,.5,'square',.1),
  lap:()=>{ tone(880,0,.12,'triangle',.12); tone(1320,.1,.2,'triangle',.12); },
  final:()=>[660,880,1100,1320].forEach((f,i)=>tone(f,i*.08,.18,'triangle',.12)),
  turbo:(lv)=>{ tone(300+lv*120,0,.35,'sawtooth',.07,900+lv*300); },
  boost:()=>tone(220,0,.5,'sawtooth',.06,660),
  hit:()=>{ tone(180,0,.3,'square',.1,70); }, wall:()=>tone(90,0,.12,'square',.08,60),
  cast:(sl)=>{ if(sl==='r'){ tone(200,0,.5,'sawtooth',.08,800); tone(400,.05,.4,'triangle',.08,1200); } else tone(700,0,.15,'square',.06,1400); },
  boom:()=>{ tone(120,0,.5,'sawtooth',.12,40); tone(80,.02,.6,'square',.08,30); },
  block:()=>{ tone(1500,0,.25,'sine',.1); tone(2200,.05,.2,'sine',.08); },
  landed:()=>{ tone(1100,0,.08,'triangle',.08); tone(1650,.06,.1,'triangle',.08); },
    finish:()=>[523,659,784,1047,784,1047].forEach((f,i)=>tone(f,i*.13,.25,'triangle',.13)),
};
// 引擎：每幀以玩家速度更新
export function engine(speed,drifting,active){
  const a=ctx(); if(!a) return;
  if(!eng){ eng=a.createOscillator(); eng.type='sawtooth'; engFilter=a.createBiquadFilter(); engFilter.type='lowpass'; engFilter.frequency.value=600; engGain=a.createGain(); engGain.gain.value=0; eng.connect(engFilter).connect(engGain).connect(a.destination); eng.start();
    screech=a.createGain(); screech.gain.value=0; const n=noise(), bp=a.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=2600; bp.Q.value=3; n.connect(bp).connect(screech).connect(a.destination); n.start(); }
  const t=a.currentTime;
  eng.frequency.setTargetAtTime(55+speed*5.5,t,.08); engFilter.frequency.setTargetAtTime(400+speed*40,t,.1);
  engGain.gain.setTargetAtTime(active&&!muted?.035:0,t,.15);
  screech.gain.setTargetAtTime(active&&drifting&&!muted?.035:0,t,.05);
}
export function stopEngine(){ if(engGain&&ac){ engGain.gain.setTargetAtTime(0,ac.currentTime,.05); screech.gain.setTargetAtTime(0,ac.currentTime,.05); } }
