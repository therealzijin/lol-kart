// 懸浮滑板的街機式物理（不用物理引擎）。前進方向 = (sin h, 0, cos h)。
// 輸入 input：steer（-1 左 … +1 右）、drift（按住甩尾）。
import * as THREE from 'three';

export const K={
  MAX:27, ACC:13, OFFROAD:.55, BOOST:1.42, TURN:1.6, DRIFT_TURN:2.2, GRIP:9, DRIFT_GRIP:2.6,
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
    this.qCD=0; this.rCharge=15; this.shieldT=0; this.wallT=0; this.immuneT=0; this.steerS=0; this.blindT=0; this.invisT=0; this.pasT=0; this.ballT=0; this.huntT=0; this.lightSlowT=0; this.trailT=0; this.warnT=0;
    this.chargeT=0; this.yiT=0; this.bounceT=0; this.eggT=0; this.egg=false; this.air=null; this.trick=false; this.prevDrift=false; this.honey={};
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
    if(this.immuneT>0) return 'immune';                 // 剛被打過：短暫無敵，避免被連續控場
    const block=()=>{ this.events.push('block'); if(this.champ==='Sivir'&&this.blockedBySpell){ this.boost(1.3); this.rCharge=Math.min(100,this.rCharge+20); } this.blockedBySpell=false; return 'block'; };
    if(this.shieldT>0){ this.shieldT=0; this.blockedBySpell=true; return block(); }
    if(this.champ==='Blitzcrank'&&this.pasT<=0){ this.pasT=20; return block(); }       // 被動：魔力屏障
    const cc=this.champ==='Zac'?.7:1;                  // 札克被動：控制時間縮短
    if(eff.knock){ this.vy=Math.max(this.vy,eff.knock); this._spin(Math.max(.9,eff.spin||0)*cc); }
    if(eff.spin) this._spin(eff.spin*cc);
    if(eff.slow&&this.yiT<=0) this.slowT=Math.max(this.slowT,eff.slow*cc);   // 易大師大招：不怕減速／致盲
    if(eff.stun){ this.stunT=Math.max(this.stunT,eff.stun*cc); this.drift=0; this.level=0; }
    if(eff.blind&&this.yiT<=0) this.blindT=Math.max(this.blindT,eff.blind);
    if(this.champ==='Anivia'&&this.eggT<=0&&(eff.spin||eff.knock||eff.stun)){ this.egg=true; this.eggT=25; }   // 艾妮維亞被動：復原後重生加速
    this.rCharge=Math.min(100,this.rCharge+8);
    const cct=Math.max(this.spinT,this.stunT,this.vy>0?this.vy/12:0); this.immuneT=Math.max(this.immuneT,cct+1.1);
    this.events.push('hit'); return true;
  }

  update(dt,track,racing){
    const I=this.input, T=track;
    ['boostT','spinT','slowT','stunT','bumpT','hopT','shieldT','blindT','invisT','pasT','ballT','huntT','lightSlowT','trailT','warnT','qCD','immuneT','wallT','chargeT','yiT','eggT'].forEach(k=>{ if(this[k]>0) this[k]=Math.max(0,this[k]-dt); });
    const control=racing&&!this.finished&&this.spinT<=0&&this.stunT<=0;   // 空中（跳台、札克）也能轉向；被擊飛時一定在打轉，所以不能操作
    if(this.egg&&control){ this.egg=false; this.boost(1.2); this.events.push('egg'); }
    // 目標速度
    let max=K.MAX*this.rubber;
    if(this.boostT>0) max*=K.BOOST; else if(this.offroad) max*=this.champ==='Teemo'?.9:K.OFFROAD;   // 提摩被動：草地不減速
    if(this.ballT>0) max*=1.22; if(this.huntT>0) max*=1.12; if(this.chargeT>0) max*=1.12; if(this.yiT>0) max*=1.15;
    if(this.slowT>0) max*=.6; else if(this.lightSlowT>0) max*=.9;
    if(!racing) max=0;
    if(this.finished) max*=.55;
    if(this.spinT>0) this.speed*=Math.exp(-2.4*dt);
    else if(this.stunT>0) this.speed*=Math.exp(-4*dt);
    else if(this.speed<max) this.speed=Math.min(max,this.speed+(this.boostT>0?K.ACC*2.2:K.ACC)*(this.champ==='Kled'?1.3:1)*dt*(1-this.speed/(max*1.15+.01)*.5));
    else this.speed=Math.max(max,this.speed-(this.offroad?30:14)*dt);
    // 轉向與甩尾
    // 玩家的方向輸入稍微平滑，避免手指一抖就猛轉
    this.steerS=this.human?this.steerS+((control?I.steer:0)-this.steerS)*Math.min(1,dt*14):(control?I.steer:0);
    let turn=0; const steer=this.steerS, sp01=Math.min(1,this.speed/10);
    if(control&&this.y<=.01&&!this.air&&I.drift&&!this.drift&&Math.abs(steer)>.25&&this.speed>11){ this.drift=Math.sign(steer); this.driftT=0; this.level=0; this.hopT=.18; this.events.push('drift'); }
    if(this.drift){
      if(!control||this.speed<8){ this.drift=0; this.level=0; }
      else if(!I.drift){ // 放開：依集氣等級加速
        if(this.level>0){ this.boost(K.TURBO[this.level-1]*(this.champ==='Sivir'?1.3:1)); this.rCharge=Math.min(100,this.rCharge+3*this.level); this.events.push('turbo'+this.level); }
        this.drift=0; this.level=0;
      } else {
        this.driftT+=dt*(1+.6*Math.max(0,steer*this.drift))*(this.champ==='MasterYi'?1.25:1);   // 往甩尾方向壓得越深，集氣越快
        this.level=K.CHARGE.filter(c=>this.driftT>=c).length;
        turn=(this.drift*.62+steer*.38)*K.DRIFT_TURN;
      }
    }
    if(!this.drift) turn=steer*K.TURN*(.45+.55*sp01)*(this.boostT>0?.85:1);
    if(this.spinT>0) this.heading=this.spinH+(1-this.spinT/this.spinDur)*Math.PI*4;   // 被打中：轉兩圈後回到原方向
    else this.heading-=turn*dt*Math.max(sp01,.55);                // steer 正 = 右轉；速度很慢時也保有轉向力（撞牆後才轉得出來）
    // 速度向量（甩尾時側滑）
    const f=this.fwd(), target=f.multiplyScalar(this.speed), grip=this.drift?K.DRIFT_GRIP:(this.spinT>0?1.5:K.GRIP);
    this.vel.lerp(target,1-Math.exp(-grip*dt));
    this.pos.addScaledVector(this.vel,dt);
    // 垂直（擊飛）
    if(this.y>0||this.vy>0){ this.vy-=24*dt; this.y+=this.vy*dt; if(this.y<=0){ this.y=0; if(this.vy<-4) this.events.push('land'); this.vy=0;
        if(this.trick){ this.trick=false; this.boost(1.1); this.events.push('trickBoost'); } this.air=null; } }
    // 跳台特技：飛在空中時按一下甩尾 → 落地加速（跟瑪利歐賽車一樣）
    if(this.air&&this.y>.3&&I.drift&&!this.prevDrift&&!this.trick&&this.spinT<=0){ this.trick=true; this.events.push('trick'); }
    this.prevDrift=!!I.drift;
    // 賽道：草地、牆
    const q=T.nearest(this.pos,this.lastI); this.lastI=q.i;
    const edge=T.half+T.off-K.R*.6;
    this.offroad=Math.abs(q.lat)>T.half+.4;
    if(Math.abs(q.lat)>edge){
      const n=T.Nm[q.i], side=Math.sign(q.lat), push=Math.abs(q.lat)-edge;
      this.pos.x-=n.x*side*push; this.pos.z-=n.z*side*push;
      const vn=this.vel.x*n.x*side+this.vel.z*n.z*side, vm=Math.hypot(this.vel.x,this.vel.z);
      if(vn>0){
        if(this.wallT<=0&&vn>3){                                        // 撞上的那一下：依正面程度扣速度，並稍微彈開
          const impact=Math.min(1,vn/Math.max(1,vm));
          this.speed*=1-.5*impact; this.wallT=.35;
          this.vel.x-=n.x*side*vn*1.4; this.vel.z-=n.z*side*vn*1.4;
          if(vn>5){ this.bumpT=.25; this.events.push('wall'); }
        } else { this.vel.x-=n.x*side*vn; this.vel.z-=n.z*side*vn; }   // 持續貼牆：只去掉撞進牆的分量，沿牆滑行
      }
      // 車頭對著牆：自動慢慢轉向賽道前進方向（玩家往反方向打時讓步）
      const f=this.fwd(), into=f.x*n.x*side+f.z*n.z*side;
      if(into>.35&&this.spinT<=0){
        const t=T.T[q.i], want=Math.atan2(t.x,t.z); let d=want-this.heading; d=Math.atan2(Math.sin(d),Math.cos(d));
        const assist=Math.sign(d)*Math.min(Math.abs(d),2.6*dt*into);
        if(!(this.human&&this.input.steer*d>0&&Math.abs(this.input.steer)>.3)) this.heading+=assist;   // steer 正是右轉＝heading 減少
        this.speed+=(Math.max(vm,4)-this.speed)*Math.min(1,dt*2);      // 卡著不動時速度不要虛高
      }
    }
    // 加速板
    const near=(o,len,w)=>{ let ds=q.s-o.s; if(ds>T.L/2) ds-=T.L; if(ds<-T.L/2) ds+=T.L; return Math.abs(ds)<len/2&&Math.abs(q.lat-o.lat)<w/2; };
    if(this.y<.3){
      for(const pd of T.pads) if(near(pd,pd.len,pd.w)&&this.boostT<.9) this.boost(1.1);
      // 跳台：往上飛，空中可以做特技
      for(const rp of T.ramps) if(near(rp,rp.len,rp.w)&&this.vy<=0&&this.speed>8){ this.vy=rp.vy; this.y=.31; this.air='ramp'; this.events.push('jump'); if(rp.boost&&this.boostT<.6) this.boost(rp.boost); }
    }
    if(this.y<.8){
      // 石柱：撞到就彈開、掉速
      for(const pl of T.pillars){ const dx=this.pos.x-pl.x, dz=this.pos.z-pl.z, rr=pl.r+K.R, d2=dx*dx+dz*dz;
        if(d2<rr*rr&&d2>1e-6){ const d=Math.sqrt(d2), nx=dx/d, nz=dz/d; this.pos.x=pl.x+nx*rr; this.pos.z=pl.z+nz*rr;
          const vn=this.vel.x*nx+this.vel.z*nz; if(vn<0){ this.vel.x-=nx*vn*1.5; this.vel.z-=nz*vn*1.5;
            if(this.wallT<=0&&vn<-4){ this.speed*=.55; this.wallT=.35; this.bumpT=.25; this.events.push('wall'); } } } }
    }
    // 蜂蜜果：大招充能 +25，但會黏一下（每顆果子每人 12 秒內只能吃一次）
    for(let h=0;h<T.honey.length;h++){ if((this.honey[h]||0)>0){ this.honey[h]-=dt; continue; } const o=T.honey[h];
      if(this.y<1.2&&(this.pos.x-o.x)**2+(this.pos.z-o.z)**2<(1.1+K.R)**2){ this.honey[h]=12; this.rCharge=Math.min(100,this.rCharge+25); this.lightSlowT=Math.max(this.lightSlowT,.6); this.events.push('honey'); } }
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
// la / lb：這支手機負責哪一台（另一台是網路同步來的，不要推它）
export function collide(a,b,la=true,lb=true){
  const dx=b.pos.x-a.pos.x, dz=b.pos.z-a.pos.z, d2=dx*dx+dz*dz, R=K.R*2;
  if(d2>=R*R||d2<1e-6||Math.abs(a.y-b.y)>1.2) return false;
  const d=Math.sqrt(d2), nx=dx/d, nz=dz/d, pen=(R-d)/2;
  const wa=la&&lb?1:la?2:0, wb=la&&lb?1:lb?2:0;
  a.pos.x-=nx*pen*wa; a.pos.z-=nz*pen*wa; b.pos.x+=nx*pen*wb; b.pos.z+=nz*pen*wb;
  const rel=(b.vel.x-a.vel.x)*nx+(b.vel.z-a.vel.z)*nz;
  if(rel<0){ const ka=a.heavy||1, kb=b.heavy||1, j=-rel*.9; if(la){ a.vel.x-=nx*j*kb/(ka+kb)*1.6; a.vel.z-=nz*j*kb/(ka+kb)*1.6; } if(lb){ b.vel.x+=nx*j*ka/(ka+kb)*1.6; b.vel.z+=nz*j*ka/(ka+kb)*1.6; } }
  a.bumpT=b.bumpT=.15; return true;
}
