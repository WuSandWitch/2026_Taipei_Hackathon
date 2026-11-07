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
echo "專案 $PROJECT（號碼 $PNUM）   repo $REPO"

echo "▸ 啟用需要的 API"
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com iam.googleapis.com \
  cloudresourcemanager.googleapis.com --project "$PROJECT"

echo "▸ 建立 service account（已存在就略過）"
gcloud iam service-accounts create "$SA_NAME" \
  --display-name="GitHub Actions deployer" --project "$PROJECT" 2>/dev/null \
  || echo "   （已存在）"

echo "▸ 授權"
# run.admin：部署 Cloud Run；serviceAccountUser：以執行身分啟動服務；
# cloudbuild + artifactregistry + storage：--source 部署會用 Cloud Build 建 image；
# firebasehosting.admin：部署前端。
for role in roles/run.admin roles/iam.serviceAccountUser roles/cloudbuild.builds.editor \
            roles/artifactregistry.writer roles/storage.admin roles/firebasehosting.admin; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:${SA}" --role="$role" --condition=None >/dev/null
  echo "   ✅ $role"
done

echo "▸ 建立 Workload Identity Pool 與 Provider（已存在就略過）"
gcloud iam workload-identity-pools create "$POOL" \
  --location=global --display-name="GitHub Actions" --project "$PROJECT" 2>/dev/null \
  || echo "   （pool 已存在）"

# attribute-condition 把這個 provider 鎖死在我們這個 repo。沒有它的話，
# 任何 GitHub repo 都能拿 token 來換取你專案的權限。
gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
  --location=global --workload-identity-pool="$POOL" \
  --display-name="GitHub OIDC" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${REPO}'" \
  --project "$PROJECT" 2>/dev/null \
  || echo "   （provider 已存在）"

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

echo
echo "────────────────────────────────────────────"
echo "設定完成。驗證方式："
echo "  gh workflow run Deploy --repo $REPO"
echo "  gh run watch --repo $REPO"
echo
echo "注意：TDX 金鑰不在 GitHub，是直接掛在 Cloud Run 的服務設定上。"
echo "deploy.yml 刻意不帶 --set-env-vars，重新部署會保留現有環境變數。"
echo "────────────────────────────────────────────"
