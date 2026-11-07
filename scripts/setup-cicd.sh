#!/usr/bin/env bash
# CI/CD 的一次性設定：建立部署用 service account，並讓 GitHub Actions 能用
# Workload Identity Federation 冒用它（不產生任何長期金鑰檔案）。
#
# 為什麼不用 service account key：repo 依比賽規定必須公開，而 key 檔案一旦外流
# 就等於整個 GCP 專案外流。WIF 讓 GitHub 用短期 OIDC token 換取權限，沒有東西可以被偷。
#
# 這支腳本會修改 GCP 的 IAM，所以請你本人執行（agent 不該代為授權）：
#   ./scripts/setup-cicd.sh
set -euo pipefail

PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
REPO="${REPO:-WuSandWitch/2026_Taipei_Hackathon}"
POOL="${POOL:-github}"
PROVIDER="${PROVIDER:-github-oidc}"
SA_NAME="github-deployer"

[ -n "$PROJECT" ] && [ "$PROJECT" != "(unset)" ] || { echo "❌ 先設定專案：gcloud config set project <id>" >&2; exit 1; }
PNUM="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
SA="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"
echo "專案 ${PROJECT}（號碼 ${PNUM}）   repo $REPO"

echo "▸ 啟用需要的 API"
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com iam.googleapis.com \
  cloudresourcemanager.googleapis.com --project "$PROJECT"

# 不要用 `|| echo 已存在` 吞掉錯誤：權限不足也會長得像「已存在」，然後在後面
# 莫名失敗。一律先查，真的不存在才建立，建立失敗就讓它停下來。
echo "▸ 建立 service account"
if gcloud iam service-accounts describe "$SA" --project "$PROJECT" >/dev/null 2>&1; then
  echo "   （已存在，略過）"
else
  gcloud iam service-accounts create "$SA_NAME" \
    --display-name="GitHub Actions deployer" --project "$PROJECT"
  echo "   ✅ 已建立"
fi

echo "▸ 授權"
# run.admin：部署 Cloud Run；serviceAccountUser：以執行身分啟動服務；
# cloudbuild + artifactregistry + storage：--source 部署會用 Cloud Build 建 image；
# firebasehosting.admin：部署前端。
#
# firebase.viewer 是後來補的：firebase-tools 在部署前會先打 serviceusage API 查
# 「Hosting API 有沒有啟用」，少了 serviceusage.services.get 就會在那一步 403：
#     Permission denied to get service [firebasehosting.googleapis.com]
# firebasehosting.admin 不含這個權限。firebase.viewer 同時給 serviceusage.services.get
# 和 firebase.projects.get（firebase-tools 也要讀專案資訊），所以一個角色就夠，
# 不需要再加 serviceusage.serviceUsageViewer。
for role in roles/run.admin roles/iam.serviceAccountUser roles/cloudbuild.builds.editor \
            roles/artifactregistry.writer roles/storage.admin roles/firebasehosting.admin \
            roles/firebase.viewer; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:${SA}" --role="$role" --condition=None >/dev/null
  echo "   ✅ $role"
done

echo "▸ 建立 Workload Identity Pool"
if gcloud iam workload-identity-pools describe "$POOL" \
     --location=global --project "$PROJECT" >/dev/null 2>&1; then
  echo "   （已存在，略過）"
else
  gcloud iam workload-identity-pools create "$POOL" \
    --location=global --display-name="GitHub Actions" --project "$PROJECT"
  echo "   ✅ 已建立"
fi

# attribute-condition 把這個 provider 鎖死在我們這個 repo。沒有它的話，
# 任何 GitHub repo 都能拿 token 來換取你專案的權限。
echo "▸ 建立 OIDC Provider"
if gcloud iam workload-identity-pools providers describe "$PROVIDER" \
     --location=global --workload-identity-pool="$POOL" --project "$PROJECT" >/dev/null 2>&1; then
  echo "   （已存在，略過。若要改 attribute-condition 請用 update-oidc）"
else
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --location=global --workload-identity-pool="$POOL" \
    --display-name="GitHub OIDC" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
    --attribute-condition="assertion.repository=='${REPO}'" \
    --project "$PROJECT"
  echo "   ✅ 已建立（已鎖定只有 $REPO 能使用）"
fi

echo "▸ 允許這個 repo 冒用 service account"
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PNUM}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${REPO}" \
  --project "$PROJECT" >/dev/null
echo "   ✅ 完成"

WIF="projects/${PNUM}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"

echo "▸ 寫入 GitHub repo variables（不是 secret，這些都不是機密）"
if command -v gh >/dev/null; then
  gh variable set GCP_PROJECT_ID  --body "$PROJECT" --repo "$REPO"
  gh variable set GCP_WIF_PROVIDER --body "$WIF"    --repo "$REPO"
  gh variable set GCP_DEPLOY_SA    --body "$SA"     --repo "$REPO"
  echo "   ✅ 三個 variable 已設定"
else
  echo "   ⚠️ 沒有 gh CLI，請到 GitHub › Settings › Secrets and variables › Actions › Variables 手動加："
  printf '      GCP_PROJECT_ID   = %s\n      GCP_WIF_PROVIDER = %s\n      GCP_DEPLOY_SA    = %s\n' "$PROJECT" "$WIF" "$SA"
fi

echo "▸ 驗證最終狀態"
FAIL=0
gcloud iam service-accounts describe "$SA" --project "$PROJECT" >/dev/null 2>&1 \
  && echo "   ✅ service account" || { echo "   ❌ service account 不存在"; FAIL=1; }
gcloud iam workload-identity-pools providers describe "$PROVIDER" \
  --location=global --workload-identity-pool="$POOL" --project "$PROJECT" >/dev/null 2>&1 \
  && echo "   ✅ workload identity provider" || { echo "   ❌ provider 不存在"; FAIL=1; }
if command -v gh >/dev/null; then
  for v in GCP_PROJECT_ID GCP_WIF_PROVIDER GCP_DEPLOY_SA; do
    gh variable list --repo "$REPO" 2>/dev/null | grep -q "^$v" \
      && echo "   ✅ repo variable $v" || { echo "   ❌ repo variable $v 沒設定"; FAIL=1; }
  done
fi
[ "$FAIL" = "0" ] || { echo; echo "❌ 設定不完整，上面有標記。修好再跑一次（這支腳本可以重複執行）。" >&2; exit 1; }

echo
echo "────────────────────────────────────────────"
echo "設定完成。驗證方式："
echo "  gh workflow run Deploy --repo $REPO"
echo "  gh run watch --repo $REPO"
echo
echo "注意：TDX 金鑰不在 GitHub，是直接掛在 Cloud Run 的服務設定上。"
echo "deploy.yml 刻意不帶 --set-env-vars，重新部署會保留現有環境變數。"
echo "────────────────────────────────────────────"
