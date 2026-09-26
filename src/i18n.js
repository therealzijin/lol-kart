// 中文／日本語。data-i 屬性的元素會自動套用。
const STR={
  zh:{
    title:'LOL 峽谷 GP', sub:'騎上懸浮滑板，在召喚峽谷用英雄技能互相干擾，搶先跑完 3 圈！',
    yourName:'你的名字', namePh:'例如：周', pickChamp:'選擇英雄', pickSkin:'選擇造型',
    solo:'單人練習（對戰電腦）',
    online:'兩支手機對戰', onlineTitle:'兩支手機對戰', makeRoom:'開新房間', orJoin:'或輸入對方的房號加入', join:'加入', codePh:'4 位數房號',
    host:'房主', guest:'來賓', tellCode:'把房號告訴對方，讓對方輸入加入。', waitingGuest:'等待對方加入…', guestJoined:'{n} 加入了！房主可以開始。', waitingHost:'已加入，等房主按開始…',
    cpuCount:'電腦人數', start:'開始比賽', connecting:'連線中…', hostFail:'開房失敗，請再試一次。', badCode:'房號是 4 位數字。', notFound:'找不到這個房號。確認對方有開房，兩支手機都連上網路。',
    waitOther:'等待對方讀取完成…', hostWillRestart:'等房主開下一場…', oppLeft:'對方斷線了，改由電腦代跑。', oppLeft2:'對方已離開。', disconnected:'連線中斷了。',
    onlineNote:'兩支手機各自選好英雄後，一人開房、一人輸入房號。建議兩支手機連同一個 Wi-Fi。電腦越少，讀取越快、越順。',
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
    solo:'ひとりで練習（CPU と対戦）',
    online:'スマホ2台で対戦', onlineTitle:'スマホ2台で対戦', makeRoom:'部屋を作る', orJoin:'または相手の部屋番号を入力して参加', join:'参加', codePh:'4桁の部屋番号',
    host:'ホスト', guest:'ゲスト', tellCode:'この番号を相手に伝えて、入力してもらってください。', waitingGuest:'相手の参加を待っています…', guestJoined:'{n} が参加しました！ホストがスタートできます。', waitingHost:'参加しました。ホストのスタートを待っています…',
    cpuCount:'CPU の人数', start:'レース開始', connecting:'接続中…', hostFail:'部屋を作れませんでした。もう一度お試しください。', badCode:'部屋番号は4桁の数字です。', notFound:'その部屋が見つかりません。相手が部屋を作っているか、通信状態を確認してください。',
    waitOther:'相手の読み込みを待っています…', hostWillRestart:'ホストの次のレースを待っています…', oppLeft:'相手の接続が切れたので、CPU が代わりに走ります。', oppLeft2:'相手が退出しました。', disconnected:'接続が切れました。',
    onlineNote:'それぞれチャンピオンを選んでから、1人が部屋を作り、もう1人が番号を入力します。同じ Wi-Fi がおすすめ。CPU が少ないほど読み込みが速く、動きも軽くなります。',
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
