#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
TARGET="${1:-$ROOT}"
BASELINE="2050dbd"
FILES=(
  electron/legacy-fiscal-migration.mjs electron/main.mjs package.json
  scripts/canonical-control-openings-migration-regression.mjs scripts/fiscal-year-closing-regression.mts
  src/components/modules/OpeningBalancesView.tsx src/services/openingBalancesService.ts
  src/utils/fiscalYearClosing.ts src/types/erp.ts
)
for file in "${FILES[@]}"; do
  mkdir -p "$TARGET/$(dirname "$file")"
  if git -C "$ROOT" cat-file -e "$BASELINE:$file" 2>/dev/null; then
    git -C "$ROOT" show "$BASELINE:$file" > "$TARGET/$file"
  else
    rm -f "$TARGET/$file"
  fi
done
