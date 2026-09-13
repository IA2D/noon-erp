#!/usr/bin/env bash
set -euo pipefail
BASE="a3c79df"
ROOT="${1:-$(pwd)}"
cd "$ROOT"
git cat-file -e "$BASE^{commit}"
git restore --source="$BASE" -- \
  electron/legacy-fiscal-migration.mjs \
  electron/main.mjs \
  package.json \
  scripts/fiscal-year-closing-regression.mts \
  src/components/modules/OpeningBalancesView.tsx \
  src/services/openingBalancesService.ts \
  src/utils/fiscalYearClosing.ts
git rm -f --ignore-unmatch -- scripts/rollover-opening-residual-migration-regression.mjs >/dev/null
printf 'ROLLBACK_OK base=%s\n' "$BASE"
