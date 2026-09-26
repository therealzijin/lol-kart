// 觸控（左半邊類比搖桿、右下按鈕）＋鍵盤（←→/AD 轉彎、空白鍵甩尾、Q、R）。
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
  if(kl||kr) input.steer=(kr?1:0)-(kl?1:0); else if(stickId==null&&input._kb) input.steer=0;
  input._kb=!!(kl||kr);
  input.driftKey=!!(keys.Space||keys.ShiftLeft||keys.ShiftRight);
  input.qKey=!!keys.KeyQ; input.rKey=!!keys.KeyR;
  return {steer:input.steer, drift:input.drift||input.driftKey, q:input.q||input.qKey, r:input.r||input.rKey};
}
