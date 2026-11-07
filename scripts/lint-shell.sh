#!/usr/bin/env bash
# 檢查 scripts/ 下的 shell 腳本。CI 會跑，本機也可以直接跑。
#
# 第二項檢查是因為一個真實踩過的 bug：`echo "專案 $PROJECT（號碼）"` 裡的 $PROJECT
# 緊接著全角括號，bash 解析變數名時會把那個多位元組字元的前導 byte 併進名稱，
# 於是去找一個不存在的變數，在 `set -u` 下直接中止：
#     setup-cicd.sh: line 21: PROJECT?: unbound variable
# `bash -n` 不會抓到，因為語法是合法的，只有執行到那一行才炸。
# 寫成 ${PROJECT} 就沒事，所以這裡要求變數後面接非 ASCII 字元時一定要加大括號。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

echo "▸ 語法檢查（bash -n）"
for f in "$ROOT"/scripts/*.sh; do
  if bash -n "$f" 2>/dev/null; then
    echo "   ✅ $(basename "$f")"
  else
    echo "   ❌ $(basename "$f")"; bash -n "$f" || true; FAIL=1
  fi
done

echo "▸ 未加大括號的變數後接非 ASCII 字元"
if python3 - "$ROOT" <<'PY'
import pathlib, re, sys
root = pathlib.Path(sys.argv[1])
pat = re.compile(rb'\$([A-Za-z_][A-Za-z0-9_]*)(?=[\x80-\xff])')
bad = False
for f in sorted(root.glob('scripts/*.sh')):
    for i, line in enumerate(f.read_bytes().split(b'\n'), 1):
        # 註解不會被 bash 展開，所以註解裡寫出壞例子不算問題（這支腳本自己就有一個）。
        if line.lstrip().startswith(b'#'):
            continue
        for m in pat.finditer(line):
            var = m.group(1).decode()
            print(f"   ❌ {f.name}:{i}  ${var} 後面接了非 ASCII 字元，請改成 ${{{var}}}")
            print(f"      {line.decode('utf-8', 'replace').strip()[:100]}")
            bad = True
sys.exit(1 if bad else 0)
PY
then
  echo "   ✅ 沒有問題"
else
  FAIL=1
fi

[ "$FAIL" = "0" ] || { echo; echo "❌ shell 檢查未通過" >&2; exit 1; }
echo
echo "✅ shell 檢查全部通過"
