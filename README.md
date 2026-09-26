# LOL 峽谷 GP / LOL リフトGP

英雄聯盟角色騎懸浮滑板、在召喚峽谷用技能互相干擾的賽車遊戲（Mario Kart 風格）。手機橫向遊玩，中文／日文。

## 兩支手機對戰
一人按「兩支手機對戰 → 開新房間」，另一人輸入 4 位數房號加入。每支手機負責自己的車（房主另外負責電腦），每秒互傳 20 次狀態；技能只傳「誰在哪裡朝哪放」，對方重播；命中由被打的那一方判定。

## 開發
```
python3 dev.py        # http://localhost:8766 （關閉快取）
```
- `src/track.js` 賽道（樣條中心線 → 路面、牆、場景；nearest/sample 給物理與 AI 用）
- `src/kart.js` 懸浮滑板物理（自動加速、甩尾三段集氣、草地減速、牆、加速板、擊飛）
- `src/ai.js` 電腦駕駛　`src/race.js` 比賽流程（60Hz 固定步長）
- `src/view.js` Three.js 畫面、英雄模型、粒子、鏡頭　`src/main.js` 標題／讀取／HUD／結果
- `src/skills.js` 8 位英雄的 Q／R／被動　`src/net.js` PeerJS 連線　`src/online.js` 兩支手機對戰（大廳、狀態同步、技能重播、斷線接手）
- 英雄模型：modelviewer.lol（glTF，meshopt + KTX2），資料：Riot Data Dragon

本作為依據 Riot Games「Legal Jibber Jabber」政策製作的非商業粉絲作品，Riot Games 並未背書或贊助。
