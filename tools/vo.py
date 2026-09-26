# 從 Riot 更新伺服器只抓某英雄語言 WAD 裡的「基本造型語音」：wpk（音檔）＋ bnk（事件→音檔對應）
import struct, io, requests, xxhash, zstandard, sys, os, json
from cdtb.patcher import PatcherManifest
CDN='https://lol.dyn.riotcdn.net/channels/public/bundles/%016X.bundle'
S=requests.Session(); S.headers['User-Agent']='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
_M=None
def manifest():
    global _M
    if _M is None: _M={f.name:f for f in (lambda m: m.files if isinstance(m.files,list) else list(m.files.values()))(PatcherManifest('/private/tmp/lolgame/game.manifest'))}
    return _M
class RemoteFile:
    """用 chunk 清單按需下載（HTTP Range），只下載讀到的部分"""
    def __init__(self,f):
        self.f=f; self.starts=[]; o=0
        for c in f.chunks: self.starts.append(o); o+=c.target_size
        self.cache={}
    def _chunk(self,i):
        if i not in self.cache:
            c=self.f.chunks[i]
            for t in range(4):
                try:
                    r=S.get(CDN%c.bundle.bundle_id,headers={'Range':f'bytes={c.offset}-{c.offset+c.size-1}'},timeout=60); r.raise_for_status()
                    self.cache[i]=zstandard.ZstdDecompressor().decompress(r.content,max_output_size=c.target_size); break
                except Exception as e:
                    if t==3: raise
        return self.cache[i]
    def read(self,off,n):
        out=bytearray(); import bisect
        i=bisect.bisect_right(self.starts,off)-1
        while n>0:
            d=self._chunk(i); s=off-self.starts[i]; take=min(n,len(d)-s); out+=d[s:s+take]; off+=take; n-=take; i+=1
        return bytes(out)
def wad_entries(rf):
    hdr=rf.read(0,4); assert hdr[:2]==b'RW', hdr; major=hdr[2]
    if major==3: base=4+256+8; 
    else: raise Exception('wad ver %d'%major)
    n=struct.unpack('<I',rf.read(base,4))[0]; raw=rf.read(base+4,32*n); E={}
    for k in range(n):
        h,off,csz,sz,typ=struct.unpack_from('<QIIIB',raw,k*32); E[h]=(off,csz,sz,typ&0xF)
    return E
def wad_get(rf,E,path):
    h=xxhash.xxh64(path.lower().encode()).intdigest()
    if h not in E: return None
    off,csz,sz,typ=E[h]; d=rf.read(off,csz)
    if typ==0: return d
    if typ in (3,4): return zstandard.ZstdDecompressor().decompress(d,max_output_size=sz)
    if typ==1: import gzip; return gzip.decompress(d)
    raise Exception('type %d'%typ)
def fnv1(s):
    h=0x811C9DC5
    for b in s.lower().encode(): h=(h*0x01000193)&0xFFFFFFFF; h^=b
    return h
def hirc(bnk):
    """回傳 {id:(type,body)}"""
    o=0; out={}
    while o<len(bnk):
        tag,ln=bnk[o:o+4],struct.unpack_from('<I',bnk,o+4)[0]; body=bnk[o+8:o+8+ln]; o+=8+ln
        if tag==b'HIRC':
            n=struct.unpack_from('<I',body,0)[0]; p=4
            for _ in range(n):
                t=body[p]; sz=struct.unpack_from('<I',body,p+1)[0]; b=body[p+5:p+5+sz]; out[struct.unpack_from('<I',b,0)[0]]=(t,b); p+=5+sz
    return out
def event_media(objs,events):
    """事件名稱 → 媒體（wem）ID 清單。容器的子物件用「身體裡含有父 ID」來找"""
    by_parent={}
    ids=list(objs.keys())
    def children(pid):
        if pid in by_parent: return by_parent[pid]
        pb=struct.pack('<I',pid); ch=[i for i in ids if i!=pid and objs[i][0] in (2,5,6,7) and pb in objs[i][1][4:40]]
        by_parent[pid]=ch; return ch
    def media(oid,depth=0):
        if oid not in objs or depth>5: return []
        t,b=objs[oid]
        if t==2: return [struct.unpack_from('<I',b,9)[0]]      # Sound：ulID(4) plugin(4) stream(1) sourceID(4)
        res=[]
        for c in children(oid): res+=media(c,depth+1)
        return res
    out={}
    for name in events:
        eid=fnv1(name)
        if eid not in objs or objs[eid][0]!=4: continue
        b=objs[eid][1]; n=b[4]; acts=struct.unpack_from('<%dI'%n,b,5) if n else ()
        # 有的版本 action 數是 u32
        if (n==0 or any(a not in objs for a in acts)) and len(b)>=8:
            n=struct.unpack_from('<I',b,4)[0]; acts=struct.unpack_from('<%dI'%n,b,8) if 0<n<64 and len(b)>=8+4*n else ()
        m=[]
        for a in acts:
            if a in objs and objs[a][0]==3:
                tgt=struct.unpack_from('<I',objs[a][1],6)[0]; m+=media(tgt)
        if m: out[name]=sorted(set(m))
    return out
def wpk(data):
    assert data[:4]==b'r3d2'; n=struct.unpack_from('<I',data,8)[0]; offs=struct.unpack_from('<%dI'%n,data,12); out={}
    for o in offs:
        if not o: continue
        do,ds,nl=struct.unpack_from('<III',data,o); name=data[o+12:o+12+nl*2].decode('utf-16le'); out[int(name.split('.')[0])]=data[do:do+ds]
    return out
