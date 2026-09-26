// 電腦駕駛：追前方的目標點；彎急就放慢、甩尾；快出界就往中間修；落後人類時稍微加速、領先時稍微放慢（橡皮筋）。
export function initAI(k,rand){
  k.ai={lane:(rand()-.5)*.8, wob:rand()*6, skill:.9+rand()*.1, holdDrift:0};
}
const ang=a=>Math.atan2(Math.sin(a),Math.cos(a));
const yawOf=t=>Math.atan2(t.x,t.z);
export function driveAI(k,track,karts,t){
  const A=k.ai, I=k.input, half=track.half;
  const q=track.nearest(k.pos,k.lastI);
  // 前方彎道的急緩：比較 12 m 與 30 m 後的切線方向
  const near=track.sample(k.s+10), far=track.sample(k.s+10+22);
  const bend=Math.abs(ang(yawOf(far.tan)-yawOf(near.tan)));
  // 彎裡走內側一點，直線走自己的線
  const turnDir=Math.sign(ang(yawOf(far.tan)-yawOf(near.tan)));           // 正 = 左彎
  const laneWant=Math.max(-.55,Math.min(.55,A.lane+Math.sin(t*.21+A.wob)*.18+turnDir*Math.min(.35,bend*.4)))*half;
  const look=4.5+k.speed*.36, m=track.sample(k.s+look);
  const tx=m.pos.x+m.nrm.x*laneWant, tz=m.pos.z+m.nrm.z*laneWant;
  const diff=ang(Math.atan2(tx-k.pos.x,tz-k.pos.z)-k.heading);               // 正 = 目標在左
  let steer=-diff*2.8;
  // 靠近路邊時往中間修（lat 正 = 在左側，要往右 = steer 正）
  const edge=half-1.2; if(Math.abs(q.lat)>edge) steer+=Math.sign(q.lat)*(Math.abs(q.lat)-edge)*.45;
  I.steer=Math.max(-1,Math.min(1,steer));
  // 甩尾：急彎、速度夠、方向一致時才甩
  if(!k.drift&&bend>.7&&k.speed>18&&Math.sign(I.steer)===-turnDir&&Math.abs(q.lat)<half-1.5) A.holdDrift=.8+bend*.6;
  if(A.holdDrift>0){ A.holdDrift-=1/60; if(Math.abs(q.lat)>half) A.holdDrift=0; I.drift=A.holdDrift>0; } else I.drift=false;
  // 速度：彎急就收一點；再加上橡皮筋
  const cap=1-Math.min(.3,Math.max(0,bend-.55)*.45);
  const hum=karts.filter(x=>x.human&&!x.finished);
  const ref=hum.length?Math.max(...hum.map(x=>x.progress)):null;
  let rb=1; if(ref!=null){ const gap=ref-k.progress; rb=gap>0?1+Math.min(.12,gap/700):1-Math.min(.1,-gap/900); }
  k.rubber=A.skill*cap*rb;
}
