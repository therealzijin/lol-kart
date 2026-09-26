// 8 位英雄。qi / ri 是 Data Dragon spells[] 的索引（用來顯示官方技能圖示與名稱）。
// 實際效果在 skills.js。
export const ROSTER=[
  {id:'Teemo',      key:17,  color:0x7ED36B, qi:0, ri:3, name:{zh:'提摩',ja:'ティーモ'},
   kit:{p:{zh:'斥候：開到草地上幾乎不減速',ja:'偵察：芝生でもほとんど減速しない'}, q:{zh:'追蹤前方的人，打中後畫面變暗＋減速',ja:'前の相手を追尾。当たると画面が暗くなりスロー'}, r:{zh:'在身後種 3 顆蘑菇，踩到的人打轉',ja:'後ろにキノコを3つ設置。踏むとスピン'}}},
  {id:'Jinx',       key:222, color:0xE76BD6, qi:1, ri:3, name:{zh:'吉茵珂絲',ja:'ジンクス'},
   kit:{p:{zh:'興奮了！超車後短暫加速',ja:'ゲット・エキサイテッド！追い抜くと一瞬加速'}, q:{zh:'直線電擊彈，打中暈眩一下並減速',ja:'直進する電撃弾。当たると一瞬スタン＋スロー'}, r:{zh:'沿著賽道追擊第一名，爆炸擊飛',ja:'コースに沿って1位を追いかけ、爆発で打ち上げ'}}},
  {id:'Blitzcrank', key:53,  color:0xF2C14E, qi:0, ri:3, name:{zh:'布里茨',ja:'ブリッツクランク'},
   kit:{p:{zh:'魔力屏障：每 20 秒自動擋下一次攻擊',ja:'マナバリア：20秒ごとに1回だけ自動で防ぐ'}, q:{zh:'飛爪抓到的人被拉到自己身後',ja:'つかんだ相手を自分の後ろへ引き戻す'}, r:{zh:'周圍 10 公尺的人全部擊飛',ja:'周囲10mの相手をまとめて打ち上げ'}}},
  {id:'Ezreal',     key:81,  color:0x5FA8FF, qi:0, ri:3, name:{zh:'伊澤瑞爾',ja:'エズリアル'},
   kit:{p:{zh:'秘術射擊打中後，冷卻大幅縮短',ja:'ミスティックショットが当たるとクールダウン大幅短縮'}, q:{zh:'高速直線彈，打中打轉',ja:'高速の直進弾。当たるとスピン'}, r:{zh:'沿賽道飛行的巨大光束，貫穿所有人',ja:'コースに沿って飛ぶ巨大光線。全員を貫通'}}},
  {id:'Twitch',     key:29,  color:0x8FBF4A, qi:0, ri:1, name:{zh:'圖奇',ja:'トゥイッチ'},
   kit:{p:{zh:'緊跟在後面的人會中毒、稍微變慢',ja:'すぐ後ろの相手は毒で少し遅くなる'}, q:{zh:'隱形 5 秒並加速，追蹤技能鎖定不到',ja:'5秒間透明化して加速。追尾スキルに狙われない'}, r:{zh:'4 秒內在身後留下毒霧，經過的人減速',ja:'4秒間、後ろに毒の霧を残す。通るとスロー'}}},
  {id:'Sivir',      key:15,  color:0xF5A442, qi:2, ri:3, name:{zh:'希維爾',ja:'シヴィア'},
   kit:{p:{zh:'甩尾加速時間比別人長 30%',ja:'ドリフトのターボが30%長い'}, q:{zh:'護盾擋下一次攻擊，擋到就加速',ja:'シールドで1回防ぐ。防げたら加速'}, r:{zh:'長時間大幅加速',ja:'長い大加速'}}},
  {id:'Rammus',     key:33,  color:0xC99A5B, qi:0, ri:3, name:{zh:'拉姆斯',ja:'ラムス'},
   kit:{p:{zh:'身體重，撞人時對方被彈得更遠',ja:'体が重く、ぶつかった相手を大きく弾く'}, q:{zh:'縮成球加速 3 秒，撞到人就擊飛',ja:'ボールになって3秒加速。ぶつかると打ち上げ'}, r:{zh:'4 秒內身邊出現減速地帶',ja:'4秒間、自分の周りがスロー地帯に'}}},
  {id:'Ashe',       key:22,  color:0x8FD3FF, qi:1, ri:3, name:{zh:'艾希',ja:'アッシュ'},
   kit:{p:{zh:'所有攻擊都附帶減速',ja:'すべての攻撃にスロー効果'}, q:{zh:'扇形射出 5 支箭，打中減速',ja:'扇状に5本の矢。当たるとスロー'}, r:{zh:'沿賽道飛行的水晶箭，打中暈眩，周圍減速',ja:'コースに沿って飛ぶ水晶の矢。当たるとスタン、周りもスロー'}}},
];
export const byId=id=>ROSTER.find(c=>c.id===id)||ROSTER[0];
const MV='https://cdn.modelviewer.lol/lol';
export const modelUrl=(cid,sid)=>`${MV}/models/${cid.toLowerCase()}/${sid}/model-compressed.wasm?c=1`;
export const circleUrl=sid=>`${MV}/circles/${sid}.webp`;
export const DD='https://ddragon.leagueoflegends.com';
