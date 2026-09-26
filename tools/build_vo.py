# 賽車用英雄語音：從 Riot 更新伺服器抽 12 位英雄的基本造型語音（英文／日配）→ voice/{en|ja}/{英雄}/{類別}{n}.m4a
# 需要：tools/vo.py、vgmstream-cli、afconvert（macOS）、python 套件 cdtb zstandard xxhash requests
import sys, os, re, json, random, subprocess, tempfile
sys.path.insert(0,os.path.dirname(__file__)); from vo import *
OUT=os.path.join(os.path.dirname(__file__),'..','voice'); LANGS={'en':'en_US','ja':'ja_JP'}
CATS=[('move',r'Move2D(?!First)',5),('first',r'Move2DFirst',2),('attack',r'Attack2D',4),('death',r'Death3D',3),('kill',r'Kill3D(General)?$',3),
      ('laugh',r'Laugh3D',2),('taunt',r'Taunt3DGeneral',1),('recall',r'Recall3D',2)]
# 賽車的 Q / R 對應到遊戲裡哪個技能的施放台詞（沒有就用攻擊台詞代替）
SPELL={'Teemo':('TeemoQ_cast','TeemoR_cast'),'Jinx':('JinxW_cast','JinxR_cast'),'Blitzcrank':(None,None),'Ezreal':('EzrealQ_cast','EzrealR_cast'),
 'Twitch':('TwitchHideInShadows_cast','TwitchVenomCask_cast'),'Sivir':('Spell3DEHit',None),'Rammus':(None,None),'Ashe':('Volley_cast3D$','EnchantedCrystalArrow_cast'),
 'Kled':('KledQMissile_hit','KledR_cast'),'Anivia':(None,None),'MasterYi':('AlphaStrike_cast','Highlander_cast'),'Zac':('ZacE_cast','ZacR_cast')}
def conv(wem,dst):
    with tempfile.TemporaryDirectory() as td:
        open(f'{td}/a.wem','wb').write(wem)
        if subprocess.run(['vgmstream-cli','-o',f'{td}/a.wav',f'{td}/a.wem'],capture_output=True).returncode: return None
        info=subprocess.run(['afinfo',f'{td}/a.wav'],capture_output=True,text=True).stdout; m=re.search(r'estimated duration: ([\d.]+)',info)
        subprocess.run(['afconvert','-f','m4af','-d','aac','-c','1','-b','24000',f'{td}/a.wav',dst],check=True,capture_output=True); return float(m.group(1)) if m else 0
MF={k.lower():v for k,v in manifest().items()}
out={'en':{},'ja':{}}
for cid,(qx,rx) in SPELL.items():
    d=S.get(f'https://raw.communitydragon.org/latest/game/data/characters/{cid.lower()}/skins/skin0.bin.json').json()
    root=next(v for k,v in d.items() if k.lower().endswith('skins/skin0'))
    units=[bu for bu in root['skinAudioProperties']['bankUnits'] if any('/vo/' in p.lower() for p in bu['bankPath'])]
    cats=CATS+[('q',qx,4)]*(qx is not None)+[('r',rx,3)]*(rx is not None)
    for L,loc in LANGS.items():
        rf=RemoteFile(MF[f'data/final/champions/{cid.lower()}.{loc.lower()}.wad.client']); E=wad_entries(rf); picks={}; W={}
        for bu in units:
            paths=[p.lower() for p in bu['bankPath']]; ev=wad_get(rf,E,next(p for p in paths if p.endswith('events.bnk'))); wp=wad_get(rf,E,next(p for p in paths if p.endswith('.wpk')))
            if not ev or not wp: continue
            objs=hirc(ev); w=wpk(wp); W.update(w)
            for name,ids in event_media(objs,bu.get('events',[])).items():
                for cat,rx_,n in cats:
                    if re.search(rx_,name): picks.setdefault(cat,[]).extend(i for i in ids if i in w)
        idx={}; os.makedirs(f'{OUT}/{L}/{cid}',exist_ok=True)
        for cat,ids in picks.items():
            ids=sorted(set(ids)); random.Random(cid+cat).shuffle(ids); lim=next(n for c,_,n in cats if c==cat); k=0
            for i in ids:
                if k>=lim: break
                dst=f'{OUT}/{L}/{cid}/{cat}{k}.m4a'; du=conv(W[i],dst)
                if du is None: continue
                if du>4.5 and len(ids)>lim: os.remove(dst); continue
                k+=1
            if k: idx[cat]=k
        out[L][cid]=idx; print(cid,L,idx,flush=True)
for L in out: json.dump(out[L],open(f'{OUT}/{L}/index.json','w'),separators=(',',':'),sort_keys=True)
