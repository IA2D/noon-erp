#!/usr/bin/env bash
set -euo pipefail
target="${1:?target directory required}"
repo_dir="$(cd "$(dirname "$0")/../.." && pwd)"
git -C "$repo_dir" apply --reverse --directory="$target" "$repo_dir/artifacts/fiscal-year-goal-20260913/DIFF_FILE"