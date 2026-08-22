$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$electron = Join-Path $projectDir 'node_modules\electron\dist\electron.exe'
if (!(Test-Path -LiteralPath $electron)) {
  Write-Error 'Electron is not installed. Run npm install first.'
  exit 1
}
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$envFile = Join-Path $projectDir '.env.local'
if (Test-Path -LiteralPath $envFile) {
  Get-Content -LiteralPath $envFile | ForEach-Object {
    if ($_ -match '^DEEPSEEK_API_KEY=(.+)$') { $env:DEEPSEEK_API_KEY = $Matches[1].Trim().Trim('"').Trim("'") }
  }
}
Start-Process -FilePath $electron -ArgumentList '.' -WorkingDirectory $projectDir
