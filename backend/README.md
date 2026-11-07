# backend — 公車陪你搭 API

把 TDX 的公車資料轉成前端四個畫面需要的六個端點。金鑰只留在這一層，不會進到手機；
即時資料在這裡統一快取，所有使用者共用一份，避免每台手機各自打爆 TDX 流量限制。

技術棧：**Python 3.12 + FastAPI**。開發規範見根目錄 `CLAUDE.md` 第 7 節。

## 執行

```bash
cd backend
cp .env.example .env          # 填入 TDX_CLIENT_ID / TDX_CLIENT_SECRET
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8080
```

互動式文件（FastAPI 自動產生）：http://localhost:8080/docs
健康檢查：`GET /healthz` → `{"ok":true,"city":"Taipei","tdxConfigured":true}`

**沒設金鑰也會啟動**，但所有資料端點會回 `503` 並附上中文說明，方便前端先接。

前端接上來：在 `frontend/.env` 設 `VITE_API_BASE=http://localhost:8080`（不設就用模擬資料）。

### Docker / Cloud Run

```bash
docker build -t bus-assist-api .
docker run --rm -p 8080:8080 --env-file .env bus-assist-api

gcloud run deploy bus-assist-api --source . --region asia-east1 \
  --set-env-vars TDX_CLIENT_ID=...,TDX_CLIENT_SECRET=...,ALLOWED_ORIGINS=https://<前端網域>
```

服務讀環境變數 `PORT`（Cloud Run 會提供）。

## 端點

契約與 `frontend/src/data/types.ts` 一致，回應欄位是 camelCase。

| Method & Path | Query | 回傳 |
|---|---|---|
| `GET /stops/nearest` | `lat`, `lng` | `BusStop` |
| `GET /stops/{stopId}/routes` | | `RouteOption[]`（依到站時間排序） |
| `GET /routes/{routeId}/stops` | `direction`, `from` | `RouteStop[]`（上車站之後的站，依站序） |
| `GET /arrivals` | `routeId`, `direction`, `stopId` | `ArrivalUpdate` |
| `GET /board-check` | `routeId`, `direction`, `lat`, `lng`, `plate?` | `BoardCheck` |
| `GET /buses/{plate}` | `routeId`, `direction` | `RidePosition` |

`stopId` 是 TDX 的 **StationUID（站位）**，不是 StopUID。站位代表「人站的那個地方」，
底下有多個站牌（StopUID，每條路線每個方向一個），即時資料都是以 StopUID 為鍵。
讓使用者只選一次「這個站」，方向留到選路線時再決定，所以對外用站位、內部才展開成站牌。

錯誤處理：TDX 失敗一律回 `503` + 中文 `detail`，前端保留上一個狀態並繼續輪詢。

## 資料來源（TDX，全部對照 2026/11/07 的線上 OpenAPI spec 查證）

spec：`https://tdx.transportdata.tw/webapi/File/Swagger/V3/2998e851-81d0-40f5-b26d-77e2f5ac4118`
API base：`https://tdx.transportdata.tw/api/basic`
Token：`POST https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token`（`client_credentials`，有效 24 小時）

| 代號 | 端點 | 用來做什麼 | 用到的欄位 |
|---|---|---|---|
| — | `/v2/Bus/Station/City/Taipei` | 最近站牌 | `StationUID`、`StationName`、`StationPosition.PositionLat/Lon`、`Stops[].StopUID`、`Stops[].RouteName` |
| — | `/v2/Bus/Route/City/Taipei` | 路線去／返程的終點名稱（播報「往板橋前站」） | `RouteUID`、`RouteName`、`DepartureStopNameZh`、`DestinationStopNameZh` |
| — | `/v2/Bus/StopOfRoute/City/Taipei/{RouteName}` | 站序（算剩幾站） | `RouteUID`、`Direction`、`Stops[].StopUID/StopName/StopSequence/StopPosition` |
| **N1** | `/v2/Bus/EstimatedTimeOfArrival/City/Taipei` | 預估到站、有哪些路線停這站 | `RouteUID`、`Direction`、`StopUID`、`EstimateTime`、`StopStatus`、`PlateNumb` |
| **A2** | `/v2/Bus/RealTimeNearStop/City/Taipei/{RouteName}` | 進站／離站事件、車輛目前站序 | `PlateNumb`、`StopUID`、`StopSequence`、`A2EventType`、`GPSTime` |
| **A1** | `/v2/Bus/RealTimeByFrequency/City/Taipei` | 車輛即時位置（確認上車） | `PlateNumb`、`RouteUID`、`Direction`、`BusPosition.PositionLat/Lon` |
| — | `/v2/Bus/Vehicle/City/Taipei` | 是不是低地板 | `PlateNumb`、`IsLowFloor`、`HasLiftOrRamp` |

spec 裡確認過的代碼（程式用的就是這些，不要憑印象改）：

- N1 `StopStatus`：`0 正常／1 尚未發車／2 交管不停靠／3 末班車已過／4 今日未營運`
- N1 `PlateNumb`：值為 `"-1"` 表示該站目前無車輛行駛
- N1 `EstimateTime`：單位秒；`StopStatus` 為 2–4 或 `PlateNumb` 為 -1 時為 `null`
- A2 `A2EventType`：`0 離站／1 進站`
- `Direction`：`0 去程／1 返程／2 迴圈／10 循環線／255 未知`
- `Vehicle.IsLowFloor`／`HasLiftOrRamp`：`0 否／1 是`

## 設計決定（都是實打 TDX 之後才知道的，改之前先讀）

1. **最近站牌是後端自己算的。** 公車 API 的 query 參數只有 `$select/$filter/$orderby/$top/$skip/$format`，
   **沒有 `$spatialFilter`**，所以沒辦法叫 TDX 做鄰近查詢。做法是把全市站位抓一次放記憶體
   （`TTL_STATIC`，預設 12 小時），再用 haversine 掃一遍。臺北幾千筆，掃一次不到 1 毫秒。

2. **方向是從 N1 推出來的。** `Station.Stops[]` 沒有 `Direction` 欄位，而 N1 即使沒車在跑也會
   回一筆帶著 `Direction`，所以「這站有哪些路線、哪些方向」用一次 N1 查詢就夠。

3. **「往哪裡」必須用站序的末站，不能用 `DestinationStopNameZh`。**
   實測：藍10（TPE10292）的 Route 層級寫 `Destination=南港花園社區`，但 dir 0 的站序真正的末站是
   **成福路口**；臺北市的 `SubRoutes[].Headsign` 全部是 `null`。對視障使用者播報錯的方向是這個服務
   最嚴重的 bug，所以 headsign 一律取 `StopOfRoute` 該方向的最後一站，Route metadata 只當
   查不到站序時的 fallback。

4. **全市站序在啟動時背景抓一次，不要改成逐條路線抓。**
   第一版是每條路線打一次 `/StopOfRoute/City/Taipei/{RouteName}`，結果標出一個站牌的 17 條路線
   要 **49 秒**。改成一次抓全市（`$select=RouteUID,SubRouteUID,Direction,Stops`，約 13 MB／13 秒），
   之後所有站序與 headsign 查詢都免費，同一個請求變成 **0.39 秒**。
   這份快取在 `lifespan` 用背景 task 暖機，所以服務立刻 ready；暖機期間進來的請求會被 single-flight
   併到同一次載入，不會重打。

5. **一個路線＋方向可能有多筆 `StopOfRoute`（附屬路線）。** 藍5 回 10 筆，其中
   `藍5返程半 dir=0` **只有 1 站**。取第一筆符合的會抽到它，所以規則是
   「`SubRouteUID == RouteUID` 的主線優先，否則取站數最多的」。

6. **臺北市的 N1 不提供 `PlateNumb` 和 `StopSequence`（實測全部是 `null`）。**
   車牌只能從 **A2** 拿（A2 有 `PlateNumb`、`StopSequence`、`A2EventType`）。這對功能沒影響：
   車牌只在「車進站的那一刻」需要，之後用它追蹤該車輛。所以等車時 `/arrivals` 的 `plate` 是
   `null` 是正常的，車真的進站（A2 有 `A2EventType=1`）才會有值。

7. **終點就是這一站的路線會被濾掉。** 捷運市政府站有 17 條路線的 N1 資料，但其中 12 條
   （552、藍5、藍7、承德幹線…）的那個方向終點就是這一站，站在這裡搭不到任何地方。
   讓使用者選了才在下一個畫面失敗，對靠聽覺操作的人是死路，所以 `/stops/{id}/routes`
   只回「這個方向還有下一站」的路線（實測 17 → 5 條）。

8. **「搭錯車」的警告要求對方的車真的在旁邊。** 只比「比較近」不夠：人站在離所有藍10 三公里外的
   地方時，最近的剛好是某台 671，不能因此播報「你搭錯車了，下一站下車」。條件是別條路線的車
   同時滿足「在 `BOARD_RADIUS_M` 內」且「比目標車近 `WRONG_BUS_MARGIN_M` 以上」。

## 快取

| 鍵 | 內容 | TTL |
|---|---|---|
| `stations` / `routes` / `stopofroute` / `vehicles` | 靜態資料（啟動時背景暖機） | `TTL_STATIC`（12 小時） |
| `n1:<站位>` / `a2:<路線名>` / `a1` | 即時資料 | `TTL_REALTIME`（15 秒） |

實測快取效果：`/arrivals` 第一次 0.21 秒，之後 0.0012 秒。

`app/cache.py` 有三個行為是刻意的：**single-flight**（同一個鍵同時有多個請求時只打一次
TDX）、**TTL**、以及 **TDX 掛掉時回傳過期資料**（Demo 中途網路抖一下不會讓播報中斷）。
TDX 即時資料本身大約每分鐘更新，`TTL_REALTIME` 不要調到 5 秒以下。

## 已知限制（Demo 要誠實說明）

- **確認上車有延遲。** A1 車輛位置約 15–60 秒更新一次，所以「確認你在 307 上」會晚大約一分鐘。
- **同站同時發車分不出來。** 兩台同路線的車一起進站時，單靠一次 A1 取樣無法確定是哪一台。
- `board-check` 是**無狀態單次取樣**：產品規格寫的「連續 N 次吻合才確認」目前由前端重複呼叫達成，
  沒有在後端累積軌跡。
- **TDX 會回 429。** 限制是「每個呼叫來源 IP 每秒最多 50 次，不分 API 金鑰」，開發時實測踩到過幾次。
  `app/tdx.py` 遇到 429 會退避 1.5 秒重試一次，再失敗就讓快取回傳過期資料。
  **因為限制是綁來源 IP 而不是金鑰，Demo 前務必把後端部署到 Cloud Run**：會場 WiFi 是共用出口 IP，
  如果有別組也在打 TDX，用筆電當後端會被連坐。

## 第三方套件

| 套件 | 授權 |
|---|---|
| fastapi | MIT |
| uvicorn | BSD-3-Clause |
| httpx | BSD-3-Clause |
| python-dotenv | BSD-3-Clause |
| pydantic（fastapi 相依） | MIT |
