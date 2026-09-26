// 比賽進行：起跑格、倒數、固定步長模擬、碰撞、名次、完賽。只有邏輯，沒有畫面。
import {Kart,collide} from './kart.js?v=20260926175029';
import {initAI,driveAI} from './ai.js?v=20260926175029';
import {stepSkills,cast,aiCast,onCollide} from './skills.js?v=20260926175029';

export const DT=1/60;
function rng(seed){ let s=seed>>>0; return ()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; }

export class Race{
  // opts.applyRemote(k)：連線時，把網路收到的狀態套到「不是這支手機負責」的車上
  constructor(track,entrants,seed,opts){
    opts=opts||{}; this.applyRemote=opts.applyRemote||null; this.onCast=opts.onCast||null; this.onHit=opts.onHit||null;
    this.track=track; this.rand=rng(seed||Date.now()); this.laps=track.laps;
    this.karts=entrants.map((e,i)=>new Kart(i,e)); this.fx=[];
    this.karts.forEach(k=>{ if(k.champ==='Rammus') k.heavy=2.5; if(k.local==null) k.local=true; k.castSeq=0; });
    // 起跑格：兩兩一排、交錯，人類排在後面（要超車才好玩）
    const order=[...this.karts].sort((a,b)=>(a.human?1:0)-(b.human?1:0));
    order.forEach((k,g)=>{ const row=Math.floor(g/2), col=g%2; k.place(track,track.L-7-row*6.5-col*2.5,col?3.4:-3.4); if(k.cpu) initAI(k,this.rand); });
    this.phase='countdown'; this.cd=3.2; this.time=0; this.t=0; this.order=[]; this.events=[]; this.endT=null;
    this.rank();
  }
  step(inputs){
    const T=this.track; this.t+=DT;
    if(this.phase==='countdown'){ const before=Math.ceil(this.cd); this.cd-=DT; const now=Math.ceil(this.cd);
      if(now!==before&&now>0) this.events.push({k:-1,e:'count',n:now});
      if(this.cd<=0){ this.phase='race'; this.events.push({k:-1,e:'go'}); } }
    const racing=this.phase!=='countdown';
    if(racing&&this.phase!=='done') this.time+=DT;
    for(const k of this.karts){
      if(!k.local){ if(this.applyRemote) this.applyRemote(k); continue; }
      if(k.human){ const I=inputs[k.idx]; if(I){ k.input.steer=I.steer; k.input.drift=I.drift;
          if(I.q&&!k.prevQ) cast(this,k,'q'); if(I.r&&!k.prevR) cast(this,k,'r'); k.prevQ=I.q; k.prevR=I.r; } }   // 按下的瞬間才施放
      else if(k.cpu&&racing){ driveAI(k,T,this.karts,this.t); aiCast(this,k); }
      k.update(DT,T,racing);
    }
    for(let a=0;a<this.karts.length;a++) for(let b=a+1;b<this.karts.length;b++) { const A=this.karts[a], B=this.karts[b]; if((A.local||B.local)&&collide(A,B,A.local,B.local)) onCollide(this,A,B); }
    stepSkills(this,DT);
    for(const k of this.karts){
      if(k.local&&!k.finished&&k.lap>this.laps) this.markFinished(k,this.time);
      k.events.forEach(e=>{
        if(e==='lap'&&k.lap===this.laps) this.events.push({k:k.idx,e:'final'});
        else this.events.push({k:k.idx,e});
      }); k.events.length=0;
    }
    this.rank();
    // 所有人類都完賽後，再等電腦最多 12 秒
    const hs=this.karts.filter(k=>k.human);
    if(this.phase==='race'&&(hs.length?hs.every(k=>k.finished):this.karts.every(k=>k.finished))){ this.phase='finish'; this.endT=this.time+12; }
    if(this.phase==='finish'&&(this.karts.every(k=>k.finished)||this.time>=this.endT)){ this.phase='done'; this.events.push({k:-1,e:'done'}); }
  }
  markFinished(k,t){ if(k.finished) return; k.finished=true; k.finishTime=t; this.order.push(k.idx); this.order.sort((a,b)=>this.karts[a].finishTime-this.karts[b].finishTime); k.events.push('finish'); }
  rank(){
    const fin=this.order.map(i=>this.karts[i]), rest=this.karts.filter(k=>!k.finished).sort((a,b)=>b.progress-a.progress);
    [...fin,...rest].forEach((k,i)=>k.rank=i+1);
  }
  // 結果：沒跑完的依剩餘距離估算時間
  results(){
    const L=this.track.L*this.laps;
    return [...this.karts].sort((a,b)=>a.rank-b.rank).map(k=>({idx:k.idx,name:k.name,champ:k.champ,skin:k.skin,human:k.human,rank:k.rank,
      time:k.finished?k.finishTime:null, est:k.finished?null:this.time+Math.max(0,L-k.progress)/Math.max(8,k.speed||20)}));
  }
}
