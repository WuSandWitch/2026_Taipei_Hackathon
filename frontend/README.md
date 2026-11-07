# frontend — 公車陪你搭（視障公車輔助）微服務網頁

在城市通 App 的 WebView 中執行。技術棧：**Vue 3 + Vite + TypeScript**（無 UI 框架，樣式用原生 CSS 變數）。
開發規範見根目錄 `CLAUDE.md` 第 6 節。

## 主流程（4 步）

| 步驟 | 畫面 | 做什麼 |
|---|---|---|
| 1 | `PlanView` | 定位 → 找到最近站牌 → 選公車 → 選下車站 → 確認 |
| 2 | `WaitView` | 倒數到站；**別的公車進站時提醒「不是你的車」**；車到站時強震動＋語音；「給司機看」全螢幕大字卡 |
| 3 | `BoardCheckView` | 比對使用者位置和該路線公車的即時位置，確認有沒有上對車；搭錯時引導下車重新等 |
| 4 | `RideView` | 每離開一站報「下一站」；剩兩站預告；**剩一站時「請按下車鈴」**（最強震動＋通知）；到站提醒下車 |

每個提醒都同時走三個管道：螢幕閱讀器 live region（VoiceOver／TalkBack）、語音（TTS）、震動。統一由 `src/lib/announcer.ts` 的 `say()` 處理。

## 執行

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 ，手機同網路可用 http://<電腦IP>:5173
npm run build      # 型別檢查 + 產出 dist/
```

沒有設定 `VITE_API_BASE` 時自動使用**模擬資料**（畫面左上角會顯示「模擬資料」）。

### Demo 用網址參數

| 參數 | 作用 |
|---|---|
| `?speed=30` | 模擬時間加速（預設 10 倍）。Demo 建議 20–30 |
| `?wrong=1` | 讓「確認上車」失敗，展示搭錯車的流程 |
| `?mock=1` | 已設定後端時，強制改用模擬資料 |

## 檔案結構

```
src/
├── lib/bridge.ts        # 城市通雙向溝通（flutterObject），瀏覽器中自動 fallback
├── lib/announcer.ts     # 語音／震動／螢幕閱讀器播報
├── data/types.ts        # 前端使用的資料型別（後端照這個格式回傳）
├── data/api.ts          # 真實資料：呼叫 backend
├── data/mock.ts         # 模擬資料 + 時間模擬（非真實路線）
├── stores/trip.ts       # 行程狀態
├── components/          # LedSign（車頭路線牌）、BigButton、DriverCard、StepHeading
└── views/               # 4 個步驟畫面 + 到站畫面
```

## 在城市通 App 的 WebView 裡執行

服務已掛進 App：「服務」頁的「我的服務」第一個、「熱門」第一個都是「公車陪你搭」。網址由 `app/lib/util/bus_assist_config.dart` 的 `BUS_ASSIST_URL` 決定。

```bash
# 終端機 1：前端
cd frontend && npm run dev          # 已加 --host，同 Wi-Fi 的手機連得到

# 終端機 2：App（第一次或新增圖示後要跑 build_runner）
cd app
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter run --dart-define=BUS_ASSIST_URL=http://localhost:5173/?speed=20        # iOS 模擬器
flutter run --dart-define=BUS_ASSIST_URL=http://10.0.2.2:5173/?speed=20         # Android 模擬器
flutter run --dart-define=BUS_ASSIST_URL=http://<電腦IP>:5173/?speed=20          # 實機（同一個 Wi-Fi）
```

開發用的 http 連線設定：iOS 在 `Info.plist` 加了 `NSAllowsLocalNetworking`（只放行區網／localhost），Android 只在 debug 版開 `usesCleartextTraffic`。正式 Demo 請部署到 Firebase Hosting（HTTPS），再把 `bus_assist_config.dart` 的 `defaultValue` 改成正式網址。

### App 端自訂 Handler（已實作：`app/lib/util/web_message_handler/bus_assist_message_handler.dart`）

| name | data | 回覆 | 實作 |
|---|---|---|---|
| `tts_speak` | `{ text: string, probe?: boolean }` | `true`／`false`（`probe: true` 時只回覆，不發聲） | `flutter_tts`（MIT），系統內建語音引擎、裝置端執行；iOS 靜音模式也會出聲 |
| `tts_stop` | `null` | 無 | `flutter_tts.stop()` |
| `vibrate` | `{ pattern: number[] }`（毫秒，震／停交替） | 無 | Flutter 內建 `HapticFeedback`，不需額外套件和權限；新的震動會中斷舊的 |

內建 handler 用到：`location`（定位）、`notify`（`{ title, content }`，下車前推播）。
在一般瀏覽器開發時，語音改用 Web Speech、震動改用 `navigator.vibrate`。

已知限制：手機鎖屏或 App 進背景時 WebView 的計時器可能暫停。正式版的「下車提醒」應移到 App 端做背景定位＋本機通知（參考往屆 ParkFlow 的 `timer_set` 做法）。

## 後端 API 約定（`data/api.ts`）

設定 `.env` 的 `VITE_API_BASE` 後啟用。所有回應格式見 `src/data/types.ts`。

| Method & Path | Query | 回傳 |
|---|---|---|
| `GET /stops/nearest` | `lat`, `lng` | `BusStop` |
| `GET /stops/{stopId}/routes` | | `RouteOption[]` |
| `GET /routes/{routeId}/stops` | `direction`, `from`（上車站 stopId） | `RouteStop[]`（上車站之後的站，依序） |
| `GET /arrivals` | `routeId`, `direction`, `stopId` | `ArrivalUpdate`（前端每 15 秒輪詢） |
| `GET /board-check` | `routeId`, `direction`, `plate?`, `lat`, `lng` | `BoardCheck` |
| `GET /buses/{plate}` | `routeId`, `direction` | `RidePosition`（前端每 10 秒輪詢） |

後端預計從 TDX 公車 API 取得：站牌、路線站序、預估到站、公車即時位置／進出站動態。**實際的 endpoint 與欄位請打 API 確認後再寫**，並更新根目錄 README 的資料來源表。

## 無障礙檢查重點

- 每個畫面一個 `h1`，換步驟時焦點自動移到標題（`StepHeading`）
- 所有提醒寫入 `aria-live` 區域；緊急提醒（車到、搭錯、下車）用 `assertive`
- 按鈕至少 72px 高；文字放大 200% 不破版；支援深色模式
- 無閃爍、無自動輪播；`prefers-reduced-motion` 時關閉動畫
- 「結束行程」要按兩次，避免誤觸中斷行程
- 用 VoiceOver／TalkBack 的人可以關掉「語音播報」，只聽螢幕閱讀器，避免聽到兩次
