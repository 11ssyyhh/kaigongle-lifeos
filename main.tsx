$ErrorActionPreference = "Stop"
Write-Host "[开工了] Installing dependencies..." -ForegroundColor Cyan
npm install
Write-Host "[开工了] Starting Electron + React..." -ForegroundColor Green
npm run dev
