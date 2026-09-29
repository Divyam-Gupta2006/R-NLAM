# Stop the user-space Postgres (fast shutdown: rolls back open transactions).
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'db-common.ps1')

if (-not (Test-PgRunning)) {
    Write-Host 'Postgres is not running.'
    exit 0
}
& (Join-Path $PgBin 'pg_ctl.exe') stop -D $PgData -m fast -w | Out-Null
Write-Host 'Postgres stopped.'
