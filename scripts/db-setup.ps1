# One-time (idempotent) setup of a private, user-space PostgreSQL 17 + PostGIS
# for Windows dev. No admin rights, no Docker, no Windows service.
#
#   powershell -ExecutionPolicy Bypass -File scripts\db-setup.ps1
#
# Result: cluster in %LOCALAPPDATA%\rnlam-pg\data on localhost:5433, role and
# database "rnlam" with PostGIS, DATABASE_URL written to backend\.env.
# Passwords are generated here and never printed.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'db-common.ps1')

if ((Test-InsidePackage) -and -not $env:RNLAM_PG_DATA) {
    Write-Host 'This shell runs inside a packaged (MSIX) app, which redirects %LOCALAPPDATA%' -ForegroundColor Yellow
    Write-Host 'writes into its own private folder. Run this script from a normal PowerShell window.' -ForegroundColor Yellow
    exit 2
}

$Downloads  = Join-Path $PgRoot 'downloads'
$PgZipUrl   = "https://get.enterprisedb.com/postgresql/postgresql-$PgVersion-1-windows-x64-binaries.zip"
$GisZipName = "postgis-bundle-pg17-${PostgisVersion}x64.zip"
$GisZipUrl  = "https://download.osgeo.org/postgis/windows/pg17/$GisZipName"
$Tar        = Join-Path $env:SystemRoot 'System32\tar.exe'   # bsdtar: reads zip

function Write-Step([string]$m) { Write-Host "==> $m" -ForegroundColor Cyan }

function Get-File([string]$Url, [string]$Dest) {
    if (Test-Path $Dest) { return }
    Write-Step "Downloading $Url"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $tmp = "$Dest.part"
    (New-Object Net.WebClient).DownloadFile($Url, $tmp)
    Move-Item $tmp $Dest
}

# --- 1. Binaries -------------------------------------------------------------
New-Item -ItemType Directory -Force $Downloads | Out-Null
$bundle = Join-Path $PgRoot ("postgis-bundle-pg17-${PostgisVersion}x64")
$postgisControl = Join-Path $PgHome 'share\extension\postgis.control'
if (-not (Test-Path (Join-Path $PgBin 'postgres.exe')) -or -not (Test-Path $postgisControl)) {
    $pgZip  = Join-Path $Downloads 'pg.zip'
    $gisZip = Join-Path $Downloads 'postgis.zip'
    Get-File $PgZipUrl $pgZip
    Get-File $GisZipUrl $gisZip

    # OSGeo publishes an MD5; EDB publishes none for the binaries zip, so we
    # at least check that archive is readable end to end.
    $md5Line = (New-Object Net.WebClient).DownloadString("$GisZipUrl.md5")
    $expected = ($md5Line -split '\s+')[0].ToLower()
    $actual = (Get-FileHash $gisZip -Algorithm MD5).Hash.ToLower()
    if ($expected -ne $actual) { throw "PostGIS bundle MD5 mismatch (expected $expected, got $actual)" }
    & $Tar -tf $pgZip | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL zip is corrupt' }

    Push-Location $PgRoot
    try {
        if (-not (Test-Path (Join-Path $PgBin 'postgres.exe'))) { Write-Step 'Extracting PostgreSQL'; & $Tar -xf $pgZip }
        if (-not (Test-Path $bundle)) { Write-Step 'Extracting PostGIS'; & $Tar -xf $gisZip }
    } finally { Pop-Location }

    # Bundle README: copy its folders over the PostgreSQL folder, mirroring structure.
    Write-Step 'Merging PostGIS bundle into PostgreSQL'
    robocopy $bundle $PgHome /E /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" }
    Remove-Item $bundle -Recurse -Force
}

# --- 2. Cluster --------------------------------------------------------------
if (-not (Test-Path (Join-Path $PgData 'PG_VERSION'))) {
    Write-Step "Initialising cluster in $PgData"
    Set-Content -Path $PgSuperPwd -Value (New-RandomSecret 32) -NoNewline -Encoding ascii
    icacls $PgSuperPwd /inheritance:r /grant:r "${env:USERNAME}:(R,W)" | Out-Null

    $pwFile = Join-Path $PgRoot ("pw-" + [guid]::NewGuid().ToString('N') + '.tmp')
    try {
        Copy-Item $PgSuperPwd $pwFile
        & (Join-Path $PgBin 'initdb.exe') -D $PgData -U postgres --auth=scram-sha-256 `
            "--pwfile=$pwFile" -E UTF8 --no-locale | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "initdb failed ($LASTEXITCODE)" }
    } finally {
        Remove-Item $pwFile -Force -ErrorAction SilentlyContinue
    }

    # Later settings win, so appending overrides the defaults above them.
    $conf = @"

# --- R-NLAM dev overrides (low-RAM laptop) ---
listen_addresses = 'localhost'
port = $PgPort
max_connections = 30
shared_buffers = 64MB
work_mem = 4MB
maintenance_work_mem = 32MB
effective_cache_size = 256MB
wal_buffers = 2MB
max_wal_size = 256MB
timezone = 'UTC'
log_timezone = 'UTC'
"@
    Add-Content -Path (Join-Path $PgData 'postgresql.conf') -Value $conf -Encoding ascii
}

# --- 3. Start ----------------------------------------------------------------
& (Join-Path $PSScriptRoot 'db-start.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Could not start Postgres' }

# --- 4. Role, database, PostGIS ---------------------------------------------
$roleExists = (Invoke-PgSuperSql "SELECT 1 FROM pg_roles WHERE rolname = 'rnlam';") -eq '1'
$envHasUrl = (Test-Path $BackendEnv) -and
    ((Get-Content $BackendEnv) -match "^DATABASE_URL=postgresql://rnlam:[^@]+@localhost:$PgPort/rnlam")

if (-not $roleExists -or -not $envHasUrl) {
    Write-Step 'Setting password for role rnlam and writing backend\.env'
    $appPwd = New-RandomSecret 32
    $verb = if ($roleExists) { 'ALTER' } else { 'CREATE' }
    Invoke-PgSuperSql "$verb ROLE rnlam LOGIN CREATEDB PASSWORD '$appPwd';" | Out-Null

    $url = "DATABASE_URL=postgresql://rnlam:$([uri]::EscapeDataString($appPwd))@localhost:$PgPort/rnlam?schema=public"
    $lines = @()
    if (Test-Path $BackendEnv) { $lines = @(Get-Content $BackendEnv | Where-Object { $_ -notmatch '^DATABASE_URL=' }) }
    $lines = @($url) + $lines
    [IO.File]::WriteAllLines($BackendEnv, [string[]]$lines, (New-Object Text.UTF8Encoding($false)))
}

if ((Invoke-PgSuperSql "SELECT 1 FROM pg_database WHERE datname = 'rnlam';") -ne '1') {
    Write-Step 'Creating database rnlam'
    Invoke-PgSuperSql 'CREATE DATABASE rnlam OWNER rnlam;' | Out-Null
}
# PostGIS is not a trusted extension, so only a superuser can create it; the
# migrations' CREATE EXTENSION IF NOT EXISTS is then a no-op.
# Extensions live in their own schema "extensions", not "public": otherwise Prisma
# sees spatial_ref_sys as an unknown table and generates migrations that drop it.
# template1 gets them too, so any database rnlam creates (tests) starts ready.
$ext = @'
DO $$
BEGIN
  -- Relocate an earlier install from public (PostGIS cannot be moved in place),
  -- but only while no table depends on it.
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis' AND extnamespace = 'public'::regnamespace)
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE udt_name = 'geometry' AND table_schema = 'public') THEN
    DROP EXTENSION postgis CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm' AND extnamespace = 'public'::regnamespace) THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'fuzzystrmatch' AND extnamespace = 'public'::regnamespace) THEN
    ALTER EXTENSION fuzzystrmatch SET SCHEMA extensions;
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO PUBLIC;
'@
foreach ($db in 'template1', 'rnlam') {
    Invoke-PgSuperSql 'CREATE SCHEMA IF NOT EXISTS extensions;' $db | Out-Null
    Invoke-PgSuperSql $ext $db | Out-Null
}
Invoke-PgSuperSql 'ALTER DATABASE rnlam SET search_path TO public, extensions;' | Out-Null
Invoke-PgSuperSql 'ALTER SCHEMA public OWNER TO rnlam;' 'rnlam' | Out-Null

$ver = Invoke-PgSuperSql 'SELECT postgis_full_version();' 'rnlam'
Write-Step 'Ready'
Write-Host "  localhost:$PgPort / database rnlam"
Write-Host "  $ver"
