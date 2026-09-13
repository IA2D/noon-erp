param([string]$Commit)
if (-not $Commit) { throw 'Pass the fiscal-isolation commit hash.' }
git revert --no-edit $Commit
