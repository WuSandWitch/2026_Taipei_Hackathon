# TODO：作品名稱

> 2026 臺北秋季程式設計節・城市通微服務大黑客松 — 隊伍「邱記黑可頌」

**子題**：用不了（數位輔助設計）

**一句話**：TODO

## 使用情境
TODO：誰、在什麼時候、遇到什麼問題、用了這個服務之後怎麼解決。

## 架構
```
城市通 App (app/, Flutter) ⇄ flutterObject ⇄ 微服務網頁 (frontend/) ─► 後端 (backend/, 選配) ─► 開放資料
```

## 執行方式
### App
```bash
cd app
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter run
```
需求：Flutter 3.47.6、Xcode（iOS）或 Android Studio + Java 17（Android）。

### 微服務網頁
```bash
cd frontend
npm install
npm run dev     # 未設定 VITE_API_BASE 時使用模擬資料
npm run build
```
Vue 3 + Vite + TypeScript。流程、Demo 參數、**在城市通 WebView 裡執行的方法**、後端 API 約定與 App 端 Handler 見 [`frontend/README.md`](frontend/README.md)。

### 後端
TODO（含環境變數說明，見 `backend/.env.example`）

## 資料來源
| 資料集 | 來源平台 | 連結 | 核心／模擬 |
|---|---|---|---|
| TODO：公車站牌、路線站序、預估到站、公車即時位置（後端串接後填入） | TDX | | 核心 |
| 前端模擬路線與到站資料（`frontend/src/data/mock.ts`，非真實路線） | — | — | 模擬 |

## 第三方套件
| 套件 | 用在哪 | 授權 |
|---|---|---|
| TownPass | app | GPL-3.0 |
| flutter_tts | app（語音播報） | MIT |
| vue | frontend | MIT |
| vue-router | frontend | MIT |
| vite、@vitejs/plugin-vue（開發用） | frontend | MIT |
| typescript（開發用） | frontend | Apache-2.0 |
| vue-tsc、@vue/tsconfig（開發用） | frontend | MIT |

## AI 使用聲明
- 開發階段：使用 Claude Code 等工具協助開發。
- 執行階段：TODO（無／模型名稱、版本、量化格式、推論框架、來源）

## 授權
本作品以 [AGPL-3.0](LICENSE) 授權。`app/` 衍生自 [taipei-doit/TownPass](https://github.com/taipei-doit/TownPass)（GPL-3.0）。

## 團隊
邱記黑可頌：吳盛瑋、周佑康、劉竑毅、連語馨、鄭知庭
