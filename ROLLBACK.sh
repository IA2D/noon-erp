#!/usr/bin/env bash
set -euo pipefail

BASE_COMMIT="${1:-a6fff06e5562a51d7622c9d6662ec3f4a2f8e529}"
git rev-parse --verify "${BASE_COMMIT}^{commit}" >/dev/null
test -z "$(git status --porcelain)" || { echo "ROLLBACK_ABORTED dirty_worktree=true"; exit 2; }

for commit in $(git rev-list "${BASE_COMMIT}..HEAD"); do
  git revert --no-edit "$commit"
done

BASE_TREE="$(git rev-parse "${BASE_COMMIT}^{tree}")"
RESTORED_TREE="$(git rev-parse 'HEAD^{tree}')"
test "$BASE_TREE" = "$RESTORED_TREE"
echo "ROLLBACK_OK base=${BASE_COMMIT} restored_tree=${RESTORED_TREE}"
