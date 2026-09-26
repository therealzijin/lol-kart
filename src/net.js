// 兩支手機之間的連線（PeerJS / WebRTC）。房主的 Peer ID = 'lkart-' + 4 位數房號。
// 訊息都是 JSON：{t:'類型', ...}。on(type, fn) 註冊處理函式。
const PFX='lkart-';
export class Net{
  constructor(){ this.peer=null; this.conn=null; this.handlers={}; this.isHost=false; this.code=''; this.closed=false; }
  on(t,fn){ (this.handlers[t]=this.handlers[t]||[]).push(fn); return this; }
  emit(t,m){ (this.handlers[t]||[]).forEach(f=>f(m)); }
  send(m){ if(this.conn&&this.conn.open){ try{ this.conn.send(JSON.stringify(m)); }catch(e){} } }
  get open(){ return !!(this.conn&&this.conn.open); }
  _wire(c){
    this.conn=c;
    c.on('data',d=>{ let m; try{ m=typeof d==='string'?JSON.parse(d):d; }catch(e){ return; } if(m&&m.t) this.emit(m.t,m); });
    c.on('close',()=>{ if(!this.closed) this.emit('_close',{}); });
    c.on('error',()=>{ if(!this.closed) this.emit('_close',{}); });
  }
  // 開房：回傳房號
  host(){
    this.isHost=true;
    return new Promise((ok,fail)=>{
      let tries=0;
      const make=()=>{
        this.code=String(1000+Math.floor(Math.random()*9000));
        const p=this.peer=new Peer(PFX+this.code);
        p.on('open',()=>ok(this.code));
        p.on('error',e=>{ if(e.type==='unavailable-id'&&tries++<4){ p.destroy(); make(); } else if(!this.conn) fail(e); });
        p.on('connection',c=>{ if(this.conn&&this.conn.open){ c.close(); return; } c.on('open',()=>{ this._wire(c); this.emit('_join',{}); }); });
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
      p.on('open',()=>{ const c=p.connect(PFX+code,{reliable:true}); c.on('open',()=>{ if(done) return; done=true; clearTimeout(t); this._wire(c); ok(); }); });
    });
  }
  close(){ this.closed=true; try{ this.send({t:'bye'}); }catch(e){} setTimeout(()=>{ try{ this.conn&&this.conn.close(); }catch(e){} try{ this.peer&&this.peer.destroy(); }catch(e){} },100); }
}
