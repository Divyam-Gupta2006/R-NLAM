# Report whether the user-space Postgres is installed, running and PostGIS-enabled.
. (Join-Path $PSScriptRoot 'db-common.ps1')

Write-Host "Install : $PgHome"
Write-Host "Data    : $PgData"
if (-not (Test-Path (Join-Path $PgData 'PG_VERSION'))) {
    Write-Host 'Status  : NOT INITIALISED (run scripts\db-setup.ps1)' -ForegroundColor Yellow
    exit 1
}
if (-not (Test-PgRunning)) {
    Write-Host 'Status  : STOPPED (run scripts\db-start.ps1)' -ForegroundColor Yellow
    exit 1
}
Write-Host "Status  : RUNNING on localhost:$PgPort" -ForegroundColor Green
try {
    $v = Invoke-PgSuperSql 'SELECT postgis_lib_version();' 'rnlam'
    Write-Host "PostGIS : $v (database rnlam)"
} catch {
    Write-Host 'PostGIS : unavailable in database rnlam' -ForegroundColor Yellow
}
