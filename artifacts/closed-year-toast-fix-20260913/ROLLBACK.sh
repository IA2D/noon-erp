#!/usr/bin/env bash
set -euo pipefail
git restore --source=085253b -- src/utils/useLocalStorageState.ts src/components/ui/StorageConflictToastBridge.tsx electron/main.mjs
git diff --exit-code -- src/utils/useLocalStorageState.ts src/components/ui/StorageConflictToastBridge.tsx electron/main.mjs
