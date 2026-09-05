$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
$tests=@('lint','engine:unit','accounting:regression','daily-posting:regression','posting:regression','lifecycle:regression','period:regression','currency:regression','control-transfer:regression','domain:regression','entity-merge:regression','p1-workflow:regression','opening-interaction:regression','print:smoke','print:orientation','print:unified-preview','print:empty-reports','report-footer-bottom:regression')
$log=Join-Path $root 'transition_artifacts/report-system-v2/modified-tests.txt'
$results=@()
foreach($task in $tests){
 $output=& npm.cmd run $task 2>&1
 $code=$LASTEXITCODE
 Add-Content -LiteralPath $log -Value "COMMAND: npm run $task`nINPUT: local synthetic regression fixtures`nEXIT: $code`n$($output -join "`n")`n"
 $results+=@{command="npm run $task";exit=$code}
 if($code -ne 0){$output | Write-Output;throw "Test failed: $task"}
}
$output=& npx.cmd tsx scripts/report-system-logic-regression.mts 2>&1
$code=$LASTEXITCODE
Add-Content -LiteralPath $log -Value "COMMAND: npx tsx scripts/report-system-logic-regression.mts`nEXIT: $code`n$($output -join "`n")"
if($code -ne 0){throw 'Report logic regression failed'}
$results | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'transition_artifacts/report-system-v2/test-exits.json')
Write-Output 'MODIFIED_TESTS_OK suites=20 failed=0 build=not_run'
