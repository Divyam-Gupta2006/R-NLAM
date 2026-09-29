# Start the user-space Postgres (port 5433). Safe to run repeatedly.
# pg_ctl detaches the server, so it keeps running after this terminal closes.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'db-common.ps1')

if (Test-PgRunning) {
    Write-Host "Postgres already running on localhost:$PgPort"
    exit 0
}
if (Test-Redirected) {
    # A packaged app would split the cluster's writes between the real folder and
    # its private copy of %LOCALAPPDATA%, corrupting it. Refuse rather than risk that.
    Write-Host 'Refusing to start the cluster from inside a packaged (MSIX) app; run from a normal PowerShell.' -ForegroundColor Yellow
    exit 2
}
if (-not (Test-Path (Join-Path $PgData 'PG_VERSION'))) {
    Write-Host "No database cluster at $PgData. Run scripts\db-setup.ps1 first." -ForegroundColor Yellow
    exit 1
}
# Not "& pg_ctl ... | Out-Null": the server inherits that pipe, so the pipeline
# never closes and the script hangs. A separate hidden process has no pipe.
$p = Start-Process -FilePath (Join-Path $PgBin 'pg_ctl.exe') -WindowStyle Hidden -PassThru `
    -ArgumentList @('start', '-D', "`"$PgData`"", '-l', "`"$PgLog`"", '-w', '-t', '60', '-o', "`"-p $PgPort`"")
$p.WaitForExit()
if ($p.ExitCode -ne 0) {
    Write-Host "pg_ctl start failed; see $PgLog" -ForegroundColor Red
    exit 1
}
Write-Host "Postgres started on localhost:$PgPort"
exit 0
