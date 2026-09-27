// 觸控（左半邊類比搖桿、右下按鈕）＋鍵盤（←→/AD 轉彎、空白鍵甩尾、Q、R）＋傾斜手機轉向（選項）。
export const input={steer:0,drift:false,q:false,r:false};
const keys={};
let stickId=null, ox=0, oy=0;
const $=id=>document.getElementById(id);

export function initInput(){
  const stick=$('stick'), knob=$('knob'), dot=knob.querySelector('i');
  stick.addEventListener('touchstart',e=>{ e.preventDefault(); const t=e.changedTouches[0]; stickId=t.identifier; ox=t.clientX; oy=t.clientY; knob.style.display='block'; knob.style.left=ox+'px'; knob.style.top=oy+'px'; dot.style.transform='translate(-50%,-50%)'; },{passive:false});
  // 方向：±80px、中間 8px 不反應，並用反應曲線（小幅度只微調，推到底才急轉）
  stick.addEventListener('touchmove',e=>{ e.preventDefault(); for(const t of e.changedTouches) if(t.identifier===stickId){ const dx=Math.max(-80,Math.min(80,t.clientX-ox)), v=Math.max(0,Math.min(1,(Math.abs(dx)-8)/72)); input.steer=Math.sign(dx)*Math.pow(v,1.7); dot.style.transform=`translate(calc(-50% + ${dx}px),-50%)`; } },{passive:false});
  const end=e=>{ for(const t of e.changedTouches) if(t.identifier===stickId){ stickId=null; input.steer=0; knob.style.display='none'; } };
  stick.addEventListener('touchend',end); stick.addEventListener('touchcancel',end);
  const hold=(id,key)=>{ const b=$(id);
    const on=e=>{ e.preventDefault(); input[key]=true; b.classList.add('on'); }, off=e=>{ e.preventDefault(); input[key]=false; b.classList.remove('on'); };
    b.addEventListener('touchstart',on,{passive:false}); b.addEventListener('touchend',off); b.addEventListener('touchcancel',off);
    b.addEventListener('mousedown',on); b.addEventListener('mouseup',off); b.addEventListener('mouseleave',off); };
  hold('b-drift','drift'); hold('b-q','q'); hold('b-r','r');
  addEventListener('keydown',e=>{ keys[e.code]=true; if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault(); });
  addEventListener('keyup',e=>{ keys[e.code]=false; });
}
// 每幀呼叫：合併鍵盤
export function pollInput(){
  const kl=keys.ArrowLeft||keys.KeyA, kr=keys.ArrowRight||keys.KeyD;
  if(kl||kr) input.steer=(kr?1:0)-(kl?1:0); else if(tilt.on&&tilt.ok&&stickId==null) input.steer=tilt.steer; else if(stickId==null&&input._kb) input.steer=0;
  input._kb=!!(kl||kr);
  input.driftKey=!!(keys.Space||keys.ShiftLeft||keys.ShiftRight);
  input.qKey=!!keys.KeyQ; input.rKey=!!keys.KeyR;
  return {steer:input.steer, drift:input.drift||input.driftKey, q:input.q||input.qKey, r:input.r||input.rKey};
}

/* ---------- 傾斜手機轉向 ----------
   用重力在螢幕平面的方向算「方向盤轉了幾度」，以起跑時的拿法為中心（不用放平）。
   iPhone 的重力方向跟 Android 相反，但算的是相對角度，正負會自動抵銷。 */
const tilt={on:false, th0:null, th:0, gx:0, gy:0, steer:0, ok:false};
const TILT_MAX=25*Math.PI/180, TILT_DEAD=2.5*Math.PI/180;
function onMotion(e){ const g=e.accelerationIncludingGravity; if(!g||g.x==null) return; tilt.ok=true;
  tilt.gx+=(g.x-tilt.gx)*.35; tilt.gy+=(g.y-tilt.gy)*.35;                 // 簡單低通，去掉手抖
  if(Math.hypot(tilt.gx,tilt.gy)<2.5){ tilt.steer=0; return; }              // 手機幾乎平放：量不準就不轉
  tilt.th=Math.atan2(tilt.gy,tilt.gx); if(tilt.th0==null) tilt.th0=tilt.th;
  let d=tilt.th-tilt.th0; d=Math.atan2(Math.sin(d),Math.cos(d));
  const v=Math.max(0,Math.min(1,(Math.abs(d)-TILT_DEAD)/(TILT_MAX-TILT_DEAD))); tilt.steer=Math.sign(d)*Math.pow(v,1.5); }
// iPhone 要在點擊時請求權限；回傳是否可用
export async function enableTilt(){
  try{ if(typeof DeviceMotionEvent!=='undefined'&&DeviceMotionEvent.requestPermission){ const r=await DeviceMotionEvent.requestPermission(); if(r!=='granted') return false; } }catch(e){ return false; }
  if(!tilt.listening){ addEventListener('devicemotion',onMotion); tilt.listening=true; }
  tilt.on=true; tilt.th0=null; return true; }
export function disableTilt(){ tilt.on=false; }
export function recenterTilt(){ tilt.th0=tilt.ok?tilt.th:null; }                 // 起跑時：目前的拿法＝正中間
export const tiltOn=()=>tilt.on;

