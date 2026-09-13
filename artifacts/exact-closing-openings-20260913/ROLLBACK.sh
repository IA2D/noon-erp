#!/usr/bin/env bash
set -euo pipefail
BASE="b112b29"
ROOT="${1:-$(pwd)}"
cd "$ROOT"
git cat-file -e "$BASE^{commit}"
git restore --source="$BASE" -- \
  src/utils/fiscalYearClosing.ts \
  src/App.tsx \
  scripts/fiscal-year-closing-regression.mts
printf 'ROLLBACK_OK base=%s\n' "$BASE"
