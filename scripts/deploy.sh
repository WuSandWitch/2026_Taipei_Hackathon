#!/usr/bin/env bash
# 部署「公車陪你搭」到 Cloud Run（後端）+ Firebase Hosting（前端）。
#
# 順序是刻意的，不要調換：
#   1. 後端先上，才拿得到它的 HTTPS 網址。
#   2. 前端的 VITE_API_BASE 是 Vite 的編譯期變數，所以必須拿到後端網址之後才 build，
#      build 完網址就寫死在 bundle 裡了。順序顛倒的話前端會指向 localhost。
#   3. 最後把前端網址填進 app/lib/util/bus_assist_config.dart，重新 flutter run。
#
# 前置（只要做一次，而且必須是你本人在終端機跑，不能由 agent 代做）：
#   gcloud auth login
#   gcloud config set project <你的專案>
#   firebase login
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGION="${REGION:-asia-east1}"
SERVICE="${SERVICE:-bus-assist-api}"

PROJECT="$(gcloud config get-value project 2>/dev/null)"
if [ -z "$PROJECT" ] || [ "$PROJECT" = "(unset)" ]; then
  echo "❌ 還沒設定 GCP 專案：gcloud config set project <專案 id>" >&2
  exit 1
fi
echo "專案：$PROJECT   區域：$REGION   服務：$SERVICE"

# Cloud Run / Cloud Build 需要專案綁定帳單帳戶（用量在免費額度內不會扣款，但一定要綁卡）。
if [ "$(gcloud billing projects describe "$PROJECT" --format='value(billingEnabled)' 2>/dev/null)" != "True" ]; then
  echo "❌ 專案 $PROJECT 還沒綁定帳單帳戶。" >&2
  echo "   到 https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT 綁定後再跑一次。" >&2
  exit 1
fi

# Cloud Run 從原始碼部署會用到這三個 API。重複啟用是安全的。
echo "▸ 啟用必要的 API（第一次會比較久）"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# 金鑰從本機 .env 讀，不寫進 repo 也不印出來。
ENV_FILE="$ROOT/backend/.env"
[ -f "$ENV_FILE" ] || { echo "❌ 找不到 ${ENV_FILE}（參考 backend/.env.example）" >&2; exit 1; }
# shellcheck disable=SC1090
TDX_CLIENT_ID="$(grep -E '^TDX_CLIENT_ID=' "$ENV_FILE" | cut -d= -f2-)"
TDX_CLIENT_SECRET="$(grep -E '^TDX_CLIENT_SECRET=' "$ENV_FILE" | cut -d= -f2-)"
[ -n "$TDX_CLIENT_ID" ] && [ -n "$TDX_CLIENT_SECRET" ] || { echo "❌ .env 裡的 TDX 金鑰是空的" >&2; exit 1; }

echo "▸ 部署後端到 Cloud Run"
gcloud run deploy "$SERVICE" \
  --source "$ROOT/backend" \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 512Mi \
  --timeout 60 \
  --set-env-vars "TDX_CLIENT_ID=${TDX_CLIENT_ID},TDX_CLIENT_SECRET=${TDX_CLIENT_SECRET},TDX_CITY=Taipei,ALLOWED_ORIGINS=*" \
  --quiet

API_BASE="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
echo "✅ 後端：$API_BASE"

echo "▸ 確認後端活著"
curl -fsS "$API_BASE/health" && echo || { echo "❌ 後端沒回應，先別部署前端" >&2; exit 1; }

echo "▸ build 前端（把 $API_BASE 寫進 bundle）"
cd "$ROOT/frontend"
VITE_API_BASE="$API_BASE" npm run build

echo "▸ 部署前端到 Firebase Hosting"
FB="npx --yes firebase-tools"
# 同一個 GCP 專案加上 Firebase（已經加過會失敗，忽略即可），再確保預設 Hosting 網站存在。
$FB projects:addfirebase "$PROJECT" >/dev/null 2>&1 || true
$FB hosting:sites:create "$PROJECT" --project "$PROJECT" >/dev/null 2>&1 || true
$FB deploy --only hosting --project "$PROJECT"

SITE="$($FB hosting:sites:list --project "$PROJECT" --json 2>/dev/null \
  | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["result"]["sites"][0]["defaultUrl"])' 2>/dev/null || true)"

SITE="${SITE:-https://$PROJECT.web.app}"
CONFIG="$ROOT/app/lib/util/bus_assist_config.dart"
sed -i.bak -E "s#defaultValue: '[^']*'#defaultValue: '${SITE%/}/'#" "$CONFIG" && rm -f "$CONFIG.bak"
echo "✅ 已把 $CONFIG 的網址改成 ${SITE%/}/"

echo
echo "────────────────────────────────────────────"
echo "後端 API ：$API_BASE"
echo "前端網頁 ：$SITE"
echo
echo "最後一步：cd app && flutter run（不用再加 --dart-define），在實機上從城市通進去實測。"
echo "────────────────────────────────────────────"
