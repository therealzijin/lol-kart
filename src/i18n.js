// 中文／日本語。data-i 屬性的元素會自動套用。
const STR={
  zh:{
    title:'LOL 峽谷 GP', sub:'騎上懸浮滑板，在召喚峽谷用英雄技能互相干擾，搶先跑完 3 圈！',
    yourName:'你的名字', namePh:'例如：周', pickChamp:'選擇英雄', pickSkin:'選擇造型',
    solo:'單人練習（對戰電腦）', online:'兩支手機對戰（下一步製作中）', onlineSoon:'兩支手機對戰還在製作中，先用單人練習試跑看看。',
    loading:'載入中…', loadModels:'下載英雄模型', loadHint:'每個造型約 3～8 MB，第二次會快很多。', loadFail:'有模型下載失敗，先用替身代跑。',
    rotate:'請把手機轉成橫向', steerHint:'← 左半邊滑動轉彎 →', drift:'甩尾',
    lap:'第 {l} / {n} 圈', finalLap:'最後一圈！', go:'GO!', finish:'抵達終點！',
    result:'比賽結果', again:'再跑一次', home:'回標題', dnf:'未完成',
    passive:'被動', skill:'Q', ult:'R 大招',
    riot:'本作為依據 Riot Games「Legal Jibber Jabber」政策製作的非商業粉絲作品，使用了 Riot Games 擁有的素材，Riot Games 並未背書或贊助。英雄 3D 模型來自 modelviewer.lol，資料來自 Riot Data Dragon。',
    classic:'經典', warn:'⚠ 飛彈鎖定你了！',
  },
  ja:{
    title:'LOL リフトGP', sub:'ホバーボードに乗って、サモナーズリフトでスキルを撃ち合いながら 3 周を競おう！',
    yourName:'あなたの名前', namePh:'例：なつ', pickChamp:'チャンピオンを選ぶ', pickSkin:'スキンを選ぶ',
    solo:'ひとりで練習（CPU と対戦）', online:'スマホ2台で対戦（次のステップで制作中）', onlineSoon:'スマホ2台の対戦は制作中です。まずはひとり練習で走ってみてください。',
    loading:'読み込み中…', loadModels:'チャンピオンのモデルをダウンロード中', loadHint:'スキンごとに約 3〜8 MB。2回目からは速くなります。', loadFail:'一部のモデルを取得できなかったので、代わりの姿で走ります。',
    rotate:'スマホを横向きにしてください', steerHint:'← 左半分をスライドしてハンドル →', drift:'ドリフト',
    lap:'ラップ {l} / {n}', finalLap:'ファイナルラップ！', go:'GO!', finish:'ゴール！',
    result:'レース結果', again:'もう一度', home:'タイトルへ', dnf:'未完走',
    passive:'パッシブ', skill:'Q', ult:'R アルティメット',
    riot:'本作は Riot Games の「Legal Jibber Jabber」ポリシーに基づく非営利のファン作品で、Riot Games 所有の素材を使用しています。Riot Games は本作を推奨・後援していません。3D モデルは modelviewer.lol、データは Riot Data Dragon を利用しています。',
    classic:'クラシック', warn:'⚠ ロケットに狙われている！',
  }
};
export let lang=(navigator.language||'').toLowerCase().startsWith('ja')?'ja':'zh';
try{ const s=localStorage.getItem('lk-lang'); if(s==='zh'||s==='ja') lang=s; }catch(e){}
const esc=s=>String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
export function T(k,p){ const t=(STR[lang]&&STR[lang][k])??STR.zh[k]??k; return p?t.replace(/\{(\w+)\}/g,(m,x)=>p[x]!=null?esc(p[x]):m):t; }
const listeners=[];
export function onLang(f){ listeners.push(f); }
export function applyLang(){
  document.documentElement.lang=lang==='ja'?'ja':'zh-Hant';
  document.querySelectorAll('[data-i]').forEach(e=>e.textContent=T(e.dataset.i));
  document.querySelectorAll('#seg-lang button').forEach(b=>b.classList.toggle('sel',b.dataset.v===lang));
  listeners.forEach(f=>f());
}
export function setLang(l){ lang=l; try{ localStorage.setItem('lk-lang',l); }catch(e){} applyLang(); }
