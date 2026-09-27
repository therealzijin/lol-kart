// 多支手機之間的連線（PeerJS / WebRTC）。房主的 Peer ID = 'lkart-' + 4 位數房號。
// 星狀：來賓只連房主，房主把來賓的消息轉給其他來賓（最多 5 位來賓＝6 人）。
// 訊息都是 JSON：{t:'類型', ...}。on(type, fn(m, from)) 註冊處理函式；from＝對方的 peer id（房主＝'host'）。
const PFX='lkart-';
export const MAX_PLAYERS=6;
export class Net{
  // 每條連線有兩個通道：c 可靠（開賽、技能、命中）、f 不必依序（位置），掉封包也不會卡住後面的
  constructor(){ this.peer=null; this.links=new Map(); this.handlers={}; this.isHost=false; this.code=''; this.closed=false; this.rtt=60; this.id='host'; this.timeout=null; this.expectFast=false; }
  on(t,fn){ (this.handlers[t]=this.handlers[t]||[]).push(fn); return this; }
  emit(t,m,from){ (this.handlers[t]||[]).forEach(f=>f(m,from)); }
  _send(ch,m,to){ const s=typeof m==='string'?m:JSON.stringify(m);
    for(const [id,L] of this.links){ if(to!=null&&id!==to) continue; const c=ch==='f'&&L.f&&L.f.open&&!L.noFast?L.f:L.c; if(c&&c.open){ try{ c.send(s); }catch(e){} } } }
  send(m,to){ this._send('c',m,to); }                      // 房主：給所有來賓（或指定一位）；來賓：給房主
  sendFast(m,to){ this._send('f',m,to); }
  // 房主：把某位來賓傳來的消息轉給其他人
  relay(m,from,fast){ for(const [id,L] of this.links){ if(id===from) continue; const c=fast&&L.f&&L.f.open&&!L.noFast?L.f:L.c; if(c&&c.open){ try{ c.send(JSON.stringify(m)); }catch(e){} } } }
  get open(){ for(const L of this.links.values()) if(L.c&&L.c.open) return true; return false; }
  get peers(){ return [...this.links.keys()]; }
  _data(d,from){ let m; try{ m=typeof d==='string'?JSON.parse(d):d; }catch(e){ return; } if(m&&m.t){ const L=this.links.get(from); if(L) L.last=performance.now(); this.emit(m.t,m,from); } }
  _link(id){ let L=this.links.get(id); if(!L){ L={c:null,f:null,last:performance.now()}; this.links.set(id,L); } return L; }
  _wire(c,id){
    const L=this._link(id); L.c=c;
    c.on('data',d=>this._data(d,id));
    const gone=()=>{ if(this.closed||!this.links.has(id)) return; if(this.links.get(id).c!==c) return; this.links.delete(id); this.emit('_close',{},id); };
    c.on('close',gone); c.on('error',gone);
  }
  _wireFast(c,id){ const L=this._link(id); L.f=c; L.noFast=false; L.lastF=performance.now(); c.on('data',d=>{ L.lastF=performance.now(); this._data(d,id); }); }
  // 比賽中兩邊都會一直送位置：快速通道 2 秒沒收到東西、但可靠通道還活著 → 請對方改用可靠通道送（有些手機的不可靠通道會悄悄卡住）
  watchFast(on){ this.expectFast=on; const now=performance.now(); for(const L of this.links.values()){ L.lastF=now; L.askedSlow=false; } }
  // 房主：安靜地移除一位來賓（不觸發斷線事件）
  drop(id){ const L=this.links.get(id); if(!L) return; this.links.delete(id); try{ L.c&&L.c.close(); L.f&&L.f.close(); }catch(e){} }
  // 放棄這條連線（不送 bye、不觸發事件）：重新連線前用
  kill(){ this.closed=true; clearInterval(this._ping); const ls=[...this.links.values()]; this.links.clear(); for(const L of ls){ try{ L.c&&L.c.close(); L.f&&L.f.close(); }catch(e){} } try{ this.peer&&this.peer.destroy(); }catch(e){} }
  // 量延遲＋心跳：每 2 秒 ping；timeout 內沒收到對方任何消息就當作斷線（大廳：房主 20 秒、來賓 30 秒；比賽中由 online.js 調短）
  _beat(){
    clearInterval(this._ping); let tick=performance.now();
    this.on('_ping',(m,from)=>this.send({t:'_pong',c:m.c},from)).on('_pong',m=>{ const r=performance.now()-m.c; if(r>0&&r<3000) this.rtt=this.rtt*.7+r*.3; })
      .on('_slow',(m,from)=>{ const L=this.links.get(from); if(L) L.noFast=true; });
    this._ping=setInterval(()=>{ const now=performance.now(), gap=now-tick; tick=now;
      if(gap>8000){ for(const L of this.links.values()) L.last=now; return; }   // 自己剛被暫停（切到別的 App）：重算，不誤判
      this.send({t:'_ping',c:now});
      if(this.expectFast) for(const [id,L] of this.links) if(L.f&&!L.askedSlow&&now-L.lastF>2000&&now-L.last<3000){ L.askedSlow=true; this.send({t:'_slow'},id); }
      const lim=this.timeout||(this.isHost?20000:30000);
      for(const [id,L] of [...this.links]) if(now-L.last>lim){ try{ L.c&&L.c.close(); L.f&&L.f.close(); }catch(e){} this.links.delete(id); this.emit('_close',{},id); } },2000);
  }
  // 開房：回傳房號
  host(){
    this.isHost=true; this.id='host';
    return new Promise((ok,fail)=>{
      let tries=0;
      const make=()=>{
        this.code=String(1000+Math.floor(Math.random()*9000));
        const p=this.peer=new Peer(PFX+this.code);
        p.on('open',()=>{ this._beat(); ok(this.code); });
        p.on('error',e=>{ if(e.type==='unavailable-id'&&tries++<4){ p.destroy(); make(); } else if(!this.links.size) fail(e); });
        p.on('connection',c=>{ const id=c.peer;
          if(c.label==='fast'){ c.on('open',()=>this._wireFast(c,id)); return; }
          if(!this.links.has(id)&&this.links.size>=MAX_PLAYERS-1){ c.on('open',()=>{ try{ c.send(JSON.stringify({t:'full'})); }catch(e){} setTimeout(()=>c.close(),300); }); return; }
          c.on('open',()=>{ this._wire(c,id); this.emit('_join',{},id); }); });
        p.on('disconnected',()=>{ try{ p.reconnect(); }catch(e){} });   // 和配對伺服器斷線時重連（已建立的連線不受影響）
      };
      make();
    });
  }
  // 加入：10 秒內連不上就失敗
  join(code){
    this.isHost=false; this.code=code;
    return new Promise((ok,fail)=>{
      let done=false; const t=setTimeout(()=>{ if(!done){ done=true; fail(new Error('timeout')); } },10000);
      const p=this.peer=new Peer();
      p.on('error',e=>{ if(!done){ done=true; clearTimeout(t); fail(e); } });
      p.on('open',id=>{ this.id=id; const c=p.connect(PFX+code,{reliable:true});
        c.on('data',d=>{ if(!done){ let m; try{ m=JSON.parse(d); }catch(e){} if(m&&m.t==='full'){ done=true; clearTimeout(t); fail(new Error('full')); } } });
        c.on('open',()=>{ if(done) return; done=true; clearTimeout(t); this._wire(c,'host'); const f=p.connect(PFX+code,{reliable:false,label:'fast'}); f.on('open',()=>this._wireFast(f,'host')); this._beat(); ok(); }); });
    });
  }
  close(){ this.closed=true; clearInterval(this._ping); try{ this.send({t:'bye'}); }catch(e){} setTimeout(()=>{ for(const L of this.links.values()){ try{ L.c&&L.c.close(); }catch(e){} try{ L.f&&L.f.close(); }catch(e){} } try{ this.peer&&this.peer.destroy(); }catch(e){} },100); }
}
