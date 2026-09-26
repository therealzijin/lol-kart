// 8 位英雄。技能內容先寫成說明文字，下一步再接上實際效果。
export const ROSTER=[
  {id:'Teemo',      key:17,  color:0x7ED36B, name:{zh:'提摩',ja:'ティーモ'},
   kit:{p:{zh:'躲在草叢時速度微幅提升',ja:'茂みの中で少し速くなる'}, q:{zh:'致盲吹箭：打中的人畫面變暗',ja:'目つぶしの吹き矢：当たると画面が暗くなる'}, r:{zh:'種蘑菇：踩到的人被減速',ja:'キノコの罠：踏むとスロー'}}},
  {id:'Jinx',       key:222, color:0xE76BD6, name:{zh:'吉茵珂絲',ja:'ジンクス'},
   kit:{p:{zh:'超車後短暫加速',ja:'追い抜くと一瞬加速'}, q:{zh:'電擊砲：直線彈，打中減速',ja:'ザップ！：直進弾、当たるとスロー'}, r:{zh:'超究極死神飛彈：追擊第一名',ja:'スーパーメガデスロケット：1位を追尾'}}},
  {id:'Blitzcrank', key:53,  color:0xF2C14E, name:{zh:'布里茨',ja:'ブリッツクランク'},
   kit:{p:{zh:'被打中時自動張開護盾一次',ja:'被弾すると一度だけシールド'}, q:{zh:'機械飛爪：把前方的人拉回來',ja:'ロケットグラブ：前の相手を引き戻す'}, r:{zh:'靜電力場：周圍的人被擊飛',ja:'静電フィールド：周囲を打ち上げる'}}},
  {id:'Ezreal',     key:81,  color:0x5FA8FF, name:{zh:'伊澤瑞爾',ja:'エズリアル'},
   kit:{p:{zh:'技能打中會縮短冷卻',ja:'スキル命中でクールダウン短縮'}, q:{zh:'秘術射擊：直線彈',ja:'ミスティックショット：直進弾'}, r:{zh:'精準彈幕：全圖直線大光束',ja:'トゥルーショット：一直線の大光線'}}},
  {id:'Twitch',     key:29,  color:0x8FBF4A, name:{zh:'圖奇',ja:'トゥイッチ'},
   kit:{p:{zh:'後方的人會中毒減速',ja:'後ろにいる相手に毒'}, q:{zh:'伏擊：隱形，不會被鎖定',ja:'アンブッシュ：透明化して狙われない'}, r:{zh:'毒霧：在身後留下減速霧',ja:'毒の霧：後ろに減速の霧を残す'}}},
  {id:'Sivir',      key:15,  color:0xF5A442, name:{zh:'希維爾',ja:'シヴィア'},
   kit:{p:{zh:'甩尾加速更強',ja:'ドリフトのターボが強い'}, q:{zh:'法術護盾：擋下一次攻擊',ja:'スペルシールド：一度だけ防ぐ'}, r:{zh:'狩獵號令：大幅加速',ja:'狩りの号令：大加速'}}},
  {id:'Rammus',     key:33,  color:0xC99A5B, name:{zh:'拉姆斯',ja:'ラムス'},
   kit:{p:{zh:'撞人時對方被彈開更遠',ja:'ぶつかった相手を大きく弾く'}, q:{zh:'動力滾球：加速衝撞',ja:'パワーボール：加速して体当たり'}, r:{zh:'震地：周圍減速地帶',ja:'ソリッドボム：周囲にスロー地帯'}}},
  {id:'Ashe',       key:22,  color:0x8FD3FF, name:{zh:'艾希',ja:'アッシュ'},
   kit:{p:{zh:'技能附帶緩速',ja:'攻撃にスロー効果'}, q:{zh:'萬箭齊發：扇形箭雨',ja:'ボレー：扇状の矢'}, r:{zh:'魔法水晶箭：飛越全圖，打中暈眩',ja:'クリスタルアロー：遠くまで飛んでスタン'}}},
];
export const byId=id=>ROSTER.find(c=>c.id===id)||ROSTER[0];
const MV='https://cdn.modelviewer.lol/lol';
export const modelUrl=(cid,sid)=>`${MV}/models/${cid.toLowerCase()}/${sid}/model-compressed.wasm?c=1`;
export const circleUrl=sid=>`${MV}/circles/${sid}.webp`;
export const DD='https://ddragon.leagueoflegends.com';
