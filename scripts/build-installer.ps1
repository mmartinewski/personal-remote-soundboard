$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

Write-Host "[installer] Installing dependencies..."
npm install

Write-Host "[installer] Fetching runtime binaries..."
npm run fetch:bin

Write-Host "[installer] Building Windows installer..."
npm run dist:win

Write-Host "[installer] Done. Check the release directory for the generated installer."
