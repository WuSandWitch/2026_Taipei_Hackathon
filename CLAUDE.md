# CLAUDE.md

本 repo 是隊伍「邱記黑可頌」參加 **2026 臺北秋季程式設計節・城市通微服務大黑客松**（Taipei Codefest 2026）的作品。
主辦：臺北市政府資訊局；承辦：台北市電腦商業同業公會。
比賽時間 2026/11/07 09:00 – 11/08 17:40，**11/08 10:00 開始初選**，在那之前必須能 demo。

> 這份檔案會被 Claude Code 自動讀取。下面的「硬性規則」是比賽規定，違反會直接扣「技術完整度／資料來源符合規定」的分數，甚至影響整併。寫任何程式碼前先確認沒踩到。

---

## 1. 題目

大方向：**數位平權 × 友善共融** — 從不同族群使用城市數位服務的情境出發，降低「操作、理解、服務取得」的門檻。

現場再細分成三個子題（抽籤決定，可跟其他組交換）：

| 子題 | 意思 | 典型族群／方向 |
|---|---|---|
| **用不了** | 數位輔助設計，降低「操作」門檻 | 長者、視障、手不方便的人：語音輸入、大字、簡化流程 |
| **看不懂** | 降低「理解」門檻 | 移工／新住民等看不懂中文的人：多語、圖示化、白話 |
| **拿不到** | 降低「取得」門檻 | 經濟弱勢、沒有設備／網路的人：數位設備補助、取得管道 |

**本隊抽到的子題：用不了（數位輔助設計，降低「操作」門檻）**
**作品名稱：Bussistant 公車幫**
**一句話：在手機上陪你把一趟公車搭完 —— 什麼時候該攔車、有沒有上對車、什麼時候該按鈴下車，都用大字、語音和震動主動告訴你。**

**主要使用者（2026/11/08 調整過，`docs/product-spec.md` 仍是舊版視障設定，以這裡為準）：
長者、不熟悉智慧型手機的人、看不懂中文的新住民。**
原本鎖定全盲使用者，後來改掉 —— 真正的全盲者操作手機的方式跟我們的假設差很多。
現在的設計重點是**大字、少步驟、多語**，螢幕閱讀器支援保留但不再是主軸。

因此「語言」和「字體大小」在 UI 上是**兩個獨立選項**，不是三選一的身分標籤：
新住民需要的是語言，長者需要的是大字，而一位看不清楚的越南籍長輩兩者都需要。

功能取捨一律以「這個子題的使用者真的會用到嗎」為準。完成比完美重要。

### 「用不了」子題的設計原則
目標族群是**會想用、但操作不來**的人：長者、視障／低視能、手部不便、不熟悉智慧型手機的人。

- **少步驟**：主流程控制在 3 步以內，一個畫面只做一件事，按鈕少而大。
- **多種輸入方式**：除了打字，提供語音、大按鈕選項、掃碼等替代輸入。
- **看得清楚、聽得到**：大字、高對比，重要資訊同時用文字 + 圖示 + 語音朗讀呈現。
- **容錯**：可以返回、可以重來，送出前要確認，錯誤訊息講人話並告訴使用者下一步怎麼做。
- **支援輔助科技**：VoiceOver／TalkBack 能完整操作（見第 6 節無障礙）。
- Demo 情境：用 mock 帳號切成長者身分（`account.json` 的 `birthday`），演示「原本做不到 → 用我們的服務做到」。

### 語音功能注意（灰色地帶，先確認）
- 語音辨識（STT）也算模型推論，依第 3.2 節，**執行時必須在裝置端完成**。
- **不要用網頁的 `SpeechRecognition` / `webkitSpeechRecognition`**：Chrome 會把音訊送到雲端辨識，Android WebView 通常也不支援。
- **語音合成（TTS）不在此限**：`window.speechSynthesis` 走的是系統內建引擎。目前 `frontend/src/lib/announcer.ts` 只把它當桌面開發的 fallback；在 App 內會先 probe `tts_speak`，成功就一律走原生 handler（`flutter_tts` + 系統引擎，裝置端執行）。不要為了「合規」把它拆掉。
- 做法：在 App 加自訂 Handler 呼叫原生裝置端辨識。可用 pub 套件 `speech_to_text`（iOS 要設定 on-device recognition；Android 要指定偏好離線辨識），或 whisper.cpp 類的 Flutter 套件跑本機模型。採用前確認授權，並用飛航模式實測。
- 語音朗讀（TTS）用系統內建引擎（例如 `flutter_tts`）走 App Handler，同樣要確認離線可用。
- 系統內建 STT／TTS 算不算「AI 推論」的規範範圍，要找主辦或 Coding 診療室確認，並把結論寫回這裡。

---

## 2. Repo 結構

```
.
├── app/        # 城市通 App（fork 自 taipei-doit/TownPass，Flutter 3.47.6）
├── frontend/   # 微服務網頁，跑在 App 的 WebView 裡（作品主體）
├── backend/    # 選配：需要存資料／處理邏輯／代理開放資料 API 時才用
├── scripts/    # 開發用腳本（setup.sh：裝 Flutter + 建置 app）
├── LICENSE     # AGPL-3.0（比賽規定）
└── README.md   # 繳交用 README，資訊局會照這份接手
```

架構：

```
城市通 App (Flutter) ⇄ flutterObject 雙向溝通 ⇄ frontend 微服務網頁 (WebView)
                                                      │ (選配)
                                                      ▼
                                                   backend API ──► 開放資料
```

作品通常是「一個微服務網頁 + 視需要的後端」。App 本身可改可不改：要掛上我們的服務入口一定要改；要用到內建沒有的原生能力（例如語音、裝置端 AI）就要在 App 加自訂 Handler。

- `frontend/` 技術棧：Vue 3 + Vite + TypeScript（npm）。流程與 API 約定見 `frontend/README.md`
- `backend/` 技術棧：Python 3.12 + FastAPI（uvicorn），代理 TDX 公車 API。端點、欄位與快取策略見 `backend/README.md`

---

## 3. 硬性規則（比賽規定，不准違反）

### 3.1 資料來源：只能用這四個
1. 臺北市資料大平臺 https://data.taipei （優先使用）
2. 政府資料開放平臺 https://data.gov.tw
3. TDX 運輸資料流通服務 https://tdx.transportdata.tw （需註冊取得金鑰）
4. 臺北城市儀表板 https://citydashboard.taipei （開源：github.com/tpe-doit/Taipei-City-Dashboard；工作坊簡報寫的 dashboard.gov.taipei 連不到）

- **核心資料**必須是上面來源的合法開放資料，並註明出處。
- **非核心資料**可以用模擬資料，但要在 README 標明是模擬的。
- 每用一個資料集，就同步更新 README 的「資料來源」表（名稱 + 連結 + 是否模擬）。
- **不要憑印象寫資料集名稱、API 網址或欄位。** 先實際打 API／打開頁面確認，再寫程式。不確定就停下來問。

### 3.2 執行階段的 AI：推論只能在裝置端
- 開發階段用雲端 AI（例如 Claude Code）沒問題。
- **作品執行時禁止呼叫任何雲端 LLM API 或遠端模型**（OpenAI、Anthropic、Gemini API 等都不行）。使用者輸入和作品資料的 LLM 推論都必須在手機上完成。
- **禁用「危害國家資通安全清單」所列的 AI 工具與模型（含大陸廠牌）**，例如 Qwen、DeepSeek 等系列都不要用。
- 評審可能**關閉網路**現場出題驗證 LLM 功能，所以 AI 功能要能離線運作。
- 一般後端（登入、資料庫、檔案、排行榜、同步）可以用。預先生成的固定文字／圖片可以用，但要如實說明。
- 建議做法：App 加一個自訂 Handler（例如 `llm_ask`），用 `flutter_edge_ai`（MIT）或 `llamadart`（MIT）在手機上跑模型；建議模型 Gemma 4 E2B（Apache 2.0）。模型檔有好幾 GB，**不要 commit 進 repo**。
- 用了 AI 就要在 README 揭露：模型名稱、版本、量化格式、推論框架、來源。
- 沒有 AI 功能也能拿好成績。不要為了加 AI 而加。

### 3.3 授權與套件
- 整個作品授權為 **AGPL-3.0**，repo 從第一天就公開，得獎後至少公開一年。TownPass 本身是 GPL-3.0，可以併入 AGPL 專案。
- 只能用**開源、免費**的套件。MIT / BSD / Apache-2.0 可以；「僅供個人使用」「不得再散布」的不行。
- 新增任何依賴（npm、pub、pip…）前先確認 LICENSE，並更新 README 的「第三方套件」表。
- **地圖只能用開源方案**：Leaflet 或 MapLibre，搭配 OpenStreetMap 或國土測繪中心（NLSC）圖資。**禁用 Google Maps（含 `google_maps_flutter`）和 Mapbox。**
- 不要用任何需要付費金鑰的服務。部署平台只用免費方案。

### 3.4 Demo 規則
- 決賽與初選**不准用簡報**，必須直接操作實際作品。初選每隊約 2 分鐘，決選約 5 分鐘 + 問答。
- Demo 流程：打開城市通 → 找到我們的服務 → 完成一條主要流程 → 回首頁。所有功能都要能在**實機上、App 內**跑通。

---

## 4. 評分重點（做取捨時參考）

**初選**：服務應用 40（創意、符合題目）／視覺呈現 30（介面清楚、操作簡單、美觀，至少一個服務介面）／技術完整度 30（流程順、資料來源合規、功能能跑）

**決選**：服務應用 25（情境完整、解決痛點）／服務完整度 30（資料可持續取得、功能完整、成本合理）／技術完整度 20（流暢、無明顯錯誤、可擴充）／視覺呈現 15／創意及公益性 10（開源、公共利益）

結論：**一條穩定能跑的主流程 > 很多半成品功能。** 得獎作品會被資訊局整併進台北通，所以程式碼要讓別人接得住。

---

## 5. App（`app/`）

Flutter **3.47.6**，Dart ≥ 3.13，iOS 最低 15（UIScene、Swift Package Manager），Android：AGP 9.1.0、Kotlin 2.4.0、Gradle 9.3.1、Java 17。

常用指令（在 `app/` 下執行；用 FVM 的人在前面加 `fvm`）：

```bash
flutter pub get
dart run build_runner build --delete-conflicting-outputs   # 新增 SVG 或改 @JsonSerializable model 後要重跑
flutter run
flutter clean   # 建置怪怪的時候先試這個
```

`*.g.dart`、`*.gen.dart` 是生成檔，已被 gitignore，**不要手改**。

### 重要位置
| 用途 | 路徑 |
|---|---|
| 服務清單（加入口） | `lib/page/city_service/model/my_service_model.dart` |
| 熱門服務 | `lib/page/city_service/model/trending_service_model.dart` |
| 服務拼貼卡片 | `lib/page/city_service/widget/official_service_card/` |
| WebView | `lib/util/tp_web_view.dart` |
| 雙向溝通 Handler | `lib/util/web_message_handler/` |
| 測試帳號（假資料） | `assets/mock_data/account.json`（改 `citizen`、`birthday` 可切換非市民／長者身分） |
| 圖示 | `assets/svg/`（snake_case 檔名 → `Assets.svg.iconXxx.svg()`） |
| 色票／字級 | `lib/util/tp_colors.dart`、`lib/util/tp_text_styles.dart` |

### 把我們的服務掛進 App
1. SVG 放進 `assets/svg/`（例如 `icon_my_service.svg`），跑 build_runner。
2. 在 `MyServiceItemId` enum 新增 id。
3. 在 `MyServiceIdExt` 的 switch 加 case：`MyServiceItem(title, description, icon, category, destinationUrl, forceWebViewTitle?)`。`category` 有 5 類：市政服務、防疫醫療、城市生活、探索臺北、其他服務。
4. `destinationUrl` 填 frontend 部署後的 **HTTPS** 網址。
5. `flutter run` → 服務 › 更多 → 加入我的服務。

### 自訂 Handler（擴充原生能力）
1. 繼承 `TPWebMessageHandler`，覆寫 `name` 和 `handle({message, sourceOrigin, isMainFrame, onReply})`。
2. 用 `onReply?.call(replyWebMessage(data))` 回傳。
3. 加進 `tp_web_message_listener.dart` 的 handler 清單。
4. `name` 不要跟內建的重複。
5. 用到的 pub 套件必須開源免費，並設定雙平台權限（`ios/Runner/Info.plist` 寫用途說明、`android/app/src/main/AndroidManifest.xml` 加 permission）。

---

## 6. 微服務網頁（`frontend/`）⇄ App 雙向溝通

App 在 WebView 注入 `window.flutterObject`（底層是 flutter_inappwebview 的 WebMessageListener）。訊息格式一律是 **JSON 字串** `{ name, data }`。

```js
// 送出
window.flutterObject.postMessage(JSON.stringify({ name: 'location', data: null }));

// 接收（App 回的也是 JSON 字串）
const onReply = (event) => {
  const { name, data } = JSON.parse(event.data);
  if (name === 'location') { /* data.latitude, data.longitude ... */ }
};
window.flutterObject.addEventListener('message', onReply);
// 用完要 removeEventListener，避免重複觸發
```

內建 handler 的 `name`：`userinfo`、`location`、`deviceinfo`、`notify`、`qr_code_scan`、`launch_map`、`open_link`、`phone_call`、`1999agree`。
**每個 handler 的 `data` 格式以 `app/lib/util/web_message_handler/tp_web_message_handler.dart` 的實作為準，用之前先讀原始碼，不要猜。**

本作品自訂的 handler（`app/lib/util/web_message_handler/bus_assist_message_handler.dart`，**已實作，不要重做**）：

| name | data | 回覆 |
|---|---|---|
| `tts_speak` | `{ text: string, probe?: boolean }` | `bool`；`probe: true` 只回報可用性、不發聲 |
| `tts_stop` | `null` | 無 |
| `vibrate` | `{ pattern: number[] }`（毫秒，震／停交替，上限 6 秒） | 無 |

TTS 用 `flutter_tts`（MIT）＋系統內建引擎，iOS 設 playback category 讓靜音模式也出聲；
震動用 Flutter 內建 `HapticFeedback`，不需額外套件或權限。

前端必須遵守：
- 一般瀏覽器沒有 `flutterObject`。**一律先判斷是否存在**，不存在時改用 mock 資料，這樣才能在桌面瀏覽器開發。把橋接包成一個模組（例如 `useTownPass()` / `bridge.ts`），不要在元件裡到處直接呼叫。
- 以手機直式版面為主（用 Chrome DevTools 裝置模擬），完成後一定要在 App 內實測。
- iOS WebView 預設會擋彈出視窗，Android 要自己處理，不要依賴 `window.open` / `alert`。
- 切頁或進背景時釋放資源（計時器、監聽器、地圖實例）。
- 部署要 HTTPS（Firebase Hosting / GitHub Pages / Cloudflare Pages / Vercel 皆可）。

### 視覺規範（跟城市通一致）
- 色票：Primary 500 `#5AB4C5`、Secondary 500 `#F5BA4B`、Grayscale 500 `#738995`（各有 50–950 色階，見 `tp_colors.dart`）
- 字體：中文 PingFang TC，英數 Roboto
- 字級：h1 36／h2 24／title 18／h3 16／body 14／caption 12
- Figma：官方 kit 已 duplicate 成可讀的檔案（Figma MCP 讀得到，community 連結本身沒有編輯權限）：
  `https://www.figma.com/design/BMUosXZVZUMeLgPzeedzLZ/` — fileKey `BMUosXZVZUMeLgPzeedzLZ`
  頁面 `1:2 📱Foundation & UI kit`；常用 frame：`3:15` Typography、`3:141` Main colors、
  `3:390` Semantic colors、`3:4828` button、`3:5024` card、`3:5071` top navigation、`3:4717` list item。
  用 `get_variable_defs` 取變數前先 `create_session`。
- kit 的語意色（2026/11/07 從 Figma 變數實際讀出）：`background-color/light` #ffffff、
  `background-color/dark` #f1f3f4、`disable-color` #e3e7e9、`text-color/primary` #30383d、
  `text-color/second` #475259、`text-color/derection` #91a0a8、`alarm-color/default` #d45251、
  **`reminder-color/default` #fd853a**（橘，提醒用，跟 alarm 的紅要分清楚）。
- kit 的字級含行高：H1 36/48、H2 24/32、H3 16/22、Body 14/20、Caption 12/18，regular 400／semibold 600。
  **前端刻意用更大的字和更鬆的行高**（base 112.5%、body 行高 1.5），因為使用者是低視能者，
  WCAG 1.4.12 也要求 body 行高 ≥1.5。色彩角色跟 kit，字級不跟 —— 不要「照 kit 修正」回去。
- kit 的字體變數寫 `PingFang SC`，但本服務用 **TC**（繁體服務，見本節字體規定），那是設計師字型選單的結果不是指示。
- **前端的色票已經接好了**：`frontend/src/styles.css` 是兩層 token——
  第一層 `--tp-*` 是從 `app/lib/util/tp_colors.dart` 照抄的官方色階，第二層是語意角色
  （`--ink`、`--teal`、`--danger`…）。元件只用語意角色，**不要在元件裡寫死色碼**，
  也不要改第一層的值。要新色階就從 `tp_colors.dart` 補。
- 注意品牌色不等於可讀色：Primary 500 在白底只有 2.39:1，所以文字和按鈕降到
  Primary 700／800。改配色前先算對比度（本服務的使用者是視障者，這不是加分項）。

### 無障礙（本題的核心，不是加分項）
- 觸控目標至少 48×48 dp；文字放大 200% 仍可閱讀、不破版
- 圖示要有替代文字，裝飾圖要對螢幕閱讀器隱藏；表單欄位要有清楚的 label
- 不用閃爍內容；焦點順序由上到下、由左到右；每頁一個清楚的標題
- 用語白話；多語介面不要只靠機翻文字，搭配圖示

---

## 7. 後端（`backend/`，選配）

- 語言不限，**一定要有 Dockerfile**（資訊局要能接手、移轉、維運）。
- 服務要讀環境變數 `PORT` 當埠號（Cloud Run 會提供）。
- 前端（web.app）和 API（run.app）不同網域，要設定 CORS。
- 部署：`gcloud run deploy <name> --source . --region asia-east1`。gcr.io / Container Registry 已關閉，不要用。
- 金鑰（例如 TDX client id/secret）放 `.env`，**不要 commit**；提供 `.env.example`。

---

## 8. 繳交清單（README 要有）

- [ ] 所有原始碼（frontend、backend、修改後的 app）
- [ ] LICENSE：AGPL-3.0 + 主辦指定的授權聲明（`TODO：聲明原文待確認`）
- [ ] README：照著做就能建置與執行
- [ ] 資料來源清單：資料集名稱、連結、哪些是模擬資料
- [ ] 第三方套件清單：名稱、授權
- [ ] 有用 AI：模型名稱、版本、量化格式、推論框架、來源
- [ ] 架構圖、環境變數說明

---

## 9. 給 Claude Code 的工作守則

- 回覆用繁體中文；程式碼、識別字、commit message 用英文。
- 時間很緊：先做能 demo 的最小主流程，再加功能。大改動先列計畫再動手。
- 版本很新（Flutter 3.47、AGP 9），訓練資料可能過時。遇到 API 不確定時，以 `app/pubspec.yaml`、實際原始碼與官方文件為準。
- 新增依賴前確認授權，並同步更新 README 表格。
- 動到 `app/` 的 Dart 檔後，確認 `flutter analyze` 沒有新錯誤；有新增 SVG 或 model 時記得重跑 build_runner。
- 不要 commit：金鑰、`.env`、模型檔（`*.gguf`、`*.litertlm`、`*.task`）、`build/`、`node_modules/`。

## 已查到可用的資料集
見 `docs/data-sources.md`（「用不了」子題相關，2026/11/07 查證）。

## 參考資源
- TownPass 原始碼：https://github.com/taipei-doit/TownPass
- 開發文件：https://tpe-guideline.web.app
- 競賽官網／須知：https://codefest.taipei/2026-fall
- 往屆整併作品（可參考寫法與 README）：taipei-doit/townpass2024-parking、townpass2025-RideFlow、townpass2024-weather
