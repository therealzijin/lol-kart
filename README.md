# LOL 峽谷 GP / LOL リフトGP

英雄聯盟角色騎懸浮滑板、在召喚峽谷用技能互相干擾的賽車遊戲（Mario Kart 風格）。手機橫向遊玩，中文／日文。

## 開發
```
python3 dev.py        # http://localhost:8766 （關閉快取）
```
- `src/track.js` 賽道（樣條中心線 → 路面、牆、場景；nearest/sample 給物理與 AI 用）
- `src/kart.js` 懸浮滑板物理（自動加速、甩尾三段集氣、草地減速、牆、加速板、擊飛）
- `src/ai.js` 電腦駕駛　`src/race.js` 比賽流程（60Hz 固定步長）
- `src/view.js` Three.js 畫面、英雄模型、粒子、鏡頭　`src/main.js` 標題／讀取／HUD／結果
- 英雄模型：modelviewer.lol（glTF，meshopt + KTX2），資料：Riot Data Dragon

本作為依據 Riot Games「Legal Jibber Jabber」政策製作的非商業粉絲作品，Riot Games 並未背書或贊助。
