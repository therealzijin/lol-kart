// 懸浮滑板的街機式物理（不用物理引擎）。前進方向 = (sin h, 0, cos h)。
// 輸入 input：steer（-1 左 … +1 右）、drift（按住甩尾）。
import * as THREE from 'three';

export const K={
  MAX:27, ACC:13, OFFROAD:.55, BOOST:1.42, TURN:1.85, DRIFT_TURN:2.35, GRIP:9, DRIFT_GRIP:2.6,
  R:.95,                                   // 碰撞半徑
  CHARGE:[.7,1.45,2.3], TURBO:[.7,1.15,1.7], // 甩尾集氣門檻（秒）與對應加速秒數
};

export class Kart{
  constructor(idx,opts){
    this.idx=idx; Object.assign(this,opts);        // name, champ, skin, human, cpu
    this.pos=new THREE.Vector3(); this.vel=new THREE.Vector3(); this.heading=0; this.speed=0;
    this.input={steer:0,drift:false}; this.y=0; this.vy=0;
    this.drift=0; this.driftT=0; this.level=0; this.boostT=0; this.spinT=0; this.slowT=0; this.stunT=0; this.bumpT=0; this.hopT=0;
    this.offroad=false; this.rubber=1; this.lastI=-1; this.s=0; this.lap=0; this.half=true; this.progress=0;
    this.finished=false; this.finishTime=0; this.rank=idx+1; this.events=[];
    this.qCD=0; this.rCharge=15; this.shieldT=0; this.blindT=0; this.invisT=0; this.pasT=0; this.ballT=0; this.huntT=0; this.lightSlowT=0; this.trailT=0; this.warnT=0;
  }
  place(track,s,lat){
    const m=track.sample(s); this.pos.set(m.pos.x+m.nrm.x*lat,0,m.pos.z+m.nrm.z*lat);
    this.heading=Math.atan2(m.tan.x,m.tan.z); this.vel.set(0,0,0); this.speed=0;
    const q=track.nearest(this.pos,-1); this.lastI=q.i; this.s=q.s; this.lap=0; this.half=true; this.calcProgress(track);
  }
  fwd(){ return new THREE.Vector3(Math.sin(this.heading),0,Math.cos(this.heading)); }
  boost(sec){ this.boostT=Math.max(this.boostT,sec); this.events.push('boost'); }
  _spin(sec){ if(this.spinT<=0){ this.spinH=this.heading; this.spinDur=sec; } this.spinT=Math.max(this.spinT,sec); this.spinDur=Math.max(this.spinDur,this.spinT); this.drift=0; this.level=0; }
  // 所有技能的效果都走這裡：eff = {spin, knock, slow, stun, blind}。回傳 'block'（被擋）或 true（命中）
  hit(eff){
    if(this.finished) return false;
    const block=()=>{ this.events.push('block'); if(this.champ==='Sivir'&&this.blockedBySpell){ this.boost(1.3); this.rCharge=Math.min(100,this.rCharge+20); } this.blockedBySpell=false; return 'block'; };
    if(this.shieldT>0){ this.shieldT=0; this.blockedBySpell=true; return block(); }
    if(this.champ==='Blitzcrank'&&this.pasT<=0){ this.pasT=20; return block(); }       // 被動：魔力屏障
    if(eff.knock){ this.vy=Math.max(this.vy,eff.knock); this._spin(Math.max(.9,eff.spin||0)); }
    if(eff.spin) this._spin(eff.spin);
    if(eff.slow) this.slowT=Math.max(this.slowT,eff.slow);
    if(eff.stun){ this.stunT=Math.max(this.stunT,eff.stun); this.drift=0; this.level=0; }
    if(eff.blind) this.blindT=Math.max(this.blindT,eff.blind);
    this.rCharge=Math.min(100,this.rCharge+8);
    this.events.push('hit'); return true;
  }

  update(dt,track,racing){
    const I=this.input, T=track;
    ['boostT','spinT','slowT','stunT','bumpT','hopT','shieldT','blindT','invisT','pasT','ballT','huntT','lightSlowT','trailT','warnT','qCD'].forEach(k=>{ if(this[k]>0) this[k]=Math.max(0,this[k]-dt); });
    const control=racing&&!this.finished&&this.spinT<=0&&this.stunT<=0&&this.y<=.01;
    // 目標速度
    let max=K.MAX*this.rubber;
    if(this.boostT>0) max*=K.BOOST; else if(this.offroad) max*=this.champ==='Teemo'?.9:K.OFFROAD;   // 提摩被動：草地不減速
    if(this.ballT>0) max*=1.22; if(this.huntT>0) max*=1.12;
    if(this.slowT>0) max*=.6; else if(this.lightSlowT>0) max*=.9;
    if(!racing) max=0;
    if(this.finished) max*=.55;
    if(this.spinT>0) this.speed*=Math.exp(-2.4*dt);
    else if(this.stunT>0) this.speed*=Math.exp(-4*dt);
    else if(this.speed<max) this.speed=Math.min(max,this.speed+(this.boostT>0?K.ACC*2.2:K.ACC)*dt*(1-this.speed/(max*1.15+.01)*.5));
    else this.speed=Math.max(max,this.speed-(this.offroad?30:14)*dt);
    // 轉向與甩尾
    let turn=0; const steer=control?I.steer:0, sp01=Math.min(1,this.speed/10);
    if(control&&I.drift&&!this.drift&&Math.abs(steer)>.25&&this.speed>11){ this.drift=Math.sign(steer); this.driftT=0; this.level=0; this.hopT=.18; this.events.push('drift'); }
    if(this.drift){
      if(!control||this.speed<8){ this.drift=0; this.level=0; }
      else if(!I.drift){ // 放開：依集氣等級加速
        if(this.level>0){ this.boost(K.TURBO[this.level-1]*(this.champ==='Sivir'?1.3:1)); this.rCharge=Math.min(100,this.rCharge+3*this.level); this.events.push('turbo'+this.level); }
        this.drift=0; this.level=0;
      } else {
        this.driftT+=dt*(1+.6*Math.max(0,steer*this.drift));   // 往甩尾方向壓得越深，集氣越快
        this.level=K.CHARGE.filter(c=>this.driftT>=c).length;
        turn=(this.drift*.62+steer*.38)*K.DRIFT_TURN;
      }
    }
    if(!this.drift) turn=steer*K.TURN*(.45+.55*sp01)*(this.boostT>0?.85:1);
    if(this.spinT>0) this.heading=this.spinH+(1-this.spinT/this.spinDur)*Math.PI*4;   // 被打中：轉兩圈後回到原方向
    else this.heading-=turn*dt*sp01;                              // steer 正 = 右轉
    // 速度向量（甩尾時側滑）
    const f=this.fwd(), target=f.multiplyScalar(this.speed), grip=this.drift?K.DRIFT_GRIP:(this.spinT>0?1.5:K.GRIP);
    this.vel.lerp(target,1-Math.exp(-grip*dt));
    this.pos.addScaledVector(this.vel,dt);
    // 垂直（擊飛）
    if(this.y>0||this.vy>0){ this.vy-=24*dt; this.y+=this.vy*dt; if(this.y<=0){ this.y=0; if(this.vy<-4) this.events.push('land'); this.vy=0; } }
    // 賽道：草地、牆
    const q=T.nearest(this.pos,this.lastI); this.lastI=q.i;
    const edge=T.half+T.off-K.R*.6;
    this.offroad=Math.abs(q.lat)>T.half+.4;
    if(Math.abs(q.lat)>edge){
      const n=T.Nm[q.i], side=Math.sign(q.lat), push=Math.abs(q.lat)-edge;
      this.pos.x-=n.x*side*push; this.pos.z-=n.z*side*push;
      const vn=this.vel.x*n.x*side+this.vel.z*n.z*side;
      if(vn>0){ this.vel.x-=n.x*side*vn*1.5; this.vel.z-=n.z*side*vn*1.5; this.speed*=vn>8?.72:.92; if(vn>5){ this.bumpT=.25; this.events.push('wall'); } }
    }
    // 加速板
    for(const pd of T.pads){ let ds=q.s-pd.s; if(ds>T.L/2) ds-=T.L; if(ds<-T.L/2) ds+=T.L; if(Math.abs(ds)<pd.len/2&&Math.abs(q.lat-pd.lat)<pd.w/2&&this.y<.3){ if(this.boostT<.9) this.boost(1.1); } }
    // 圈數：往前越過起跑線才算，而且要先經過半圈檢查點
    const prev=this.s; this.s=q.s; const L=T.L;
    if(this.s>L*.4&&this.s<L*.6) this.half=true;
    if(prev>L*.75&&this.s<L*.25){ if(this.half){ this.lap++; this.half=false; this.events.push('lap'); } }
    else if(prev<L*.25&&this.s>L*.75){ this.lap--; this.half=true; }
    this.calcProgress(T);
  }
  calcProgress(T){ this.progress=(this.lap-1)*T.L+this.s; }
}

// 兩台之間的碰撞：推開並交換側向動量
export function collide(a,b){
  const dx=b.pos.x-a.pos.x, dz=b.pos.z-a.pos.z, d2=dx*dx+dz*dz, R=K.R*2;
  if(d2>=R*R||d2<1e-6||Math.abs(a.y-b.y)>1.2) return false;
  const d=Math.sqrt(d2), nx=dx/d, nz=dz/d, pen=(R-d)/2;
  a.pos.x-=nx*pen; a.pos.z-=nz*pen; b.pos.x+=nx*pen; b.pos.z+=nz*pen;
  const rel=(b.vel.x-a.vel.x)*nx+(b.vel.z-a.vel.z)*nz;
  if(rel<0){ const ka=a.heavy||1, kb=b.heavy||1, j=-rel*.9; a.vel.x-=nx*j*kb/(ka+kb)*1.6; a.vel.z-=nz*j*kb/(ka+kb)*1.6; b.vel.x+=nx*j*ka/(ka+kb)*1.6; b.vel.z+=nz*j*ka/(ka+kb)*1.6; }
  a.bumpT=b.bumpT=.15; return true;
}
