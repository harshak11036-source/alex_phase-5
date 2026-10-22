$ErrorActionPreference = 'Stop'
$databaseUrl = $env:DATABASE_URL
if (-not $databaseUrl) { $databaseUrl = (Get-Content .env.local | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1) -replace '^DATABASE_URL="?', '' -replace '"?$', '' }
if ($databaseUrl -notmatch 'localhost:5432/alex(?:\?|$)') { throw 'Refusing reset: DATABASE_URL must target localhost:5432/alex.' }
Write-Host 'Resetting the local ALEX database only...' -ForegroundColor Yellow
$schemaPath = Join-Path $PSScriptRoot '..\apps\web\prisma\schema.prisma'
$seedPath = Join-Path $PSScriptRoot '..\apps\web\prisma\seed.ts'
& (Join-Path $PSScriptRoot '..\node_modules\.bin\prisma.cmd') db push --schema=$schemaPath --force-reset
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& (Join-Path $PSScriptRoot '..\node_modules\.bin\tsx.cmd') $seedPath
exit $LASTEXITCODE