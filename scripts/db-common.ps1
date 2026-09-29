# Shared settings for the user-space Postgres + PostGIS used in Windows dev.
# Lives outside OneDrive on purpose: a synced data directory corrupts.
# Default root is C:\dev\rnlam-pg: unlike %LOCALAPPDATA%, packaged (MSIX) apps
# do not redirect it, so the cluster is the same for every terminal and app.
# RNLAM_PG_ROOT / RNLAM_PG_DATA / RNLAM_PG_PORT override root, cluster and port.

$PgVersion      = '17.11'
$PostgisVersion = '3.6.2'
$PgPort         = if ($env:RNLAM_PG_PORT) { [int]$env:RNLAM_PG_PORT } else { 5433 }

$PgRoot     = if ($env:RNLAM_PG_ROOT) { $env:RNLAM_PG_ROOT } else { 'C:\dev\rnlam-pg' }
$PgHome     = Join-Path $PgRoot 'pgsql'
$PgBin      = Join-Path $PgHome 'bin'
$PgData     = if ($env:RNLAM_PG_DATA) { $env:RNLAM_PG_DATA } else { Join-Path $PgRoot 'data' }
$PgLog      = Join-Path $PgRoot 'postgres.log'
$PgSuperPwd = Join-Path $PgRoot 'superuser.txt'

$RepoRoot   = Split-Path -Parent $PSScriptRoot
$BackendEnv = Join-Path $RepoRoot 'backend\.env'

Add-Type -Namespace RNlam -Name AppModel -MemberDefinition @'
[DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
public static extern int GetCurrentPackageFullName(ref int length, System.Text.StringBuilder name);
'@ -ErrorAction SilentlyContinue

function Test-InsidePackage {
    # MSIX-packaged hosts (e.g. an IDE or agent app from the Store) silently
    # redirect new files under %LOCALAPPDATA% into their own package folder, so a
    # cluster created from there is invisible to your normal terminal.
    # 15700 = APPMODEL_ERROR_NO_PACKAGE.
    $len = 0
    return ([RNlam.AppModel]::GetCurrentPackageFullName([ref]$len, $null) -ne 15700)
}

# Only a root under %LOCALAPPDATA% is redirected by a packaged app.
function Test-Redirected {
    return (Test-InsidePackage) -and -not $env:RNLAM_PG_DATA -and $PgRoot.StartsWith($env:LOCALAPPDATA, [StringComparison]::OrdinalIgnoreCase)
}

function Test-PgRunning {
    if (-not (Test-Path (Join-Path $PgData 'PG_VERSION'))) { return $false }
    & (Join-Path $PgBin 'pg_isready.exe') -h localhost -p $PgPort -q
    return ($LASTEXITCODE -eq 0)
}

function New-RandomSecret([int]$Length = 32) {
    # Alphanumeric only, so it survives URLs, .env files and shells unescaped.
    $chars = [char[]]'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
    $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
    $bytes = New-Object byte[] $Length
    $rng.GetBytes($bytes)
    -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

function Invoke-PgSuperSql([string]$Sql, [string]$Database = 'postgres') {
    # SQL goes through stdin so secrets never appear on a command line.
    $env:PGPASSWORD = (Get-Content $PgSuperPwd -Raw).Trim()
    $env:PGOPTIONS = '-c client_min_messages=warning'
    try {
        $Sql | & (Join-Path $PgBin 'psql.exe') -h localhost -p $PgPort -U postgres -d $Database -v ON_ERROR_STOP=1 -q -t -A
        if ($LASTEXITCODE -ne 0) { throw "psql failed (exit $LASTEXITCODE)" }
    } finally {
        Remove-Item Env:\PGPASSWORD, Env:\PGOPTIONS -ErrorAction SilentlyContinue
    }
}
