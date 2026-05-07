[CmdletBinding()]
param(
  [ValidateSet('setup', 'up', 'down', 'status')]
  [string]$Action = 'up',

  [ValidateSet('native', 'compose')]
  [string]$Mode = 'native',

  [switch]$SkipDependencyInstall,
  [switch]$ForceEnvRefresh,
  [switch]$InfraOnly,
  [switch]$RebuildCompose
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$StateDir = Join-Path $RepoRoot '.local-dev'
$LogsDir = Join-Path $StateDir 'logs'
$PidsDir = Join-Path $StateDir 'pids'

$FrontendDir = Join-Path $RepoRoot 'nextJs'
$BackendDir = Join-Path $RepoRoot 'nestJs'
$NativeEnvFile = Join-Path $RepoRoot '.env.localdev'
$ComposeEnvFile = Join-Path $RepoRoot '.env'

$FrontendPidFile = Join-Path $PidsDir 'frontend.pid'
$BackendPidFile = Join-Path $PidsDir 'backend.pid'
$FrontendLogFile = Join-Path $LogsDir 'frontend.log'
$BackendLogFile = Join-Path $LogsDir 'backend.log'

function Write-Step([string]$Message) {
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Warn([string]$Message) {
  Write-Warning $Message
}

function Ensure-Directory([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Test-CommandAvailable([string]$CommandName) {
  return $null -ne (Get-Command $CommandName -ErrorAction SilentlyContinue)
}

function Assert-Command([string]$CommandName, [string]$FriendlyName) {
  if (-not (Test-CommandAvailable $CommandName)) {
    throw "Prerequisito ausente: $FriendlyName"
  }
}

function Ensure-EnvFile([string]$TemplatePath, [string]$TargetPath) {
  if ((Test-Path -LiteralPath $TargetPath) -and -not $ForceEnvRefresh) {
    Write-Host "mantido: $TargetPath"
    return
  }

  if (-not (Test-Path -LiteralPath $TemplatePath)) {
    throw "Template nao encontrado: $TemplatePath"
  }

  Copy-Item -LiteralPath $TemplatePath -Destination $TargetPath -Force
  Write-Host "gerado: $TargetPath"
}

function Get-EnvMap([string]$Path) {
  $values = @{}

  if (-not (Test-Path -LiteralPath $Path)) {
    return $values
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match '^\s*#' -or $line -notmatch '^[A-Za-z_][A-Za-z0-9_]*=') {
      continue
    }

    $parts = $line -split '=', 2
    $values[$parts[0]] = $parts[1]
  }

  return $values
}

function Test-PlaceholderValue([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $true
  }

  return $Value -match '^(change-me|your-|https://your-project|postgresql://postgres:postgres@db\.example\.com)'
}

function Warn-IfMissingConfig([string]$Path, [string[]]$Keys) {
  $envMap = Get-EnvMap $Path
  $missingKeys = @()

  foreach ($key in $Keys) {
    if (-not $envMap.ContainsKey($key) -or (Test-PlaceholderValue $envMap[$key])) {
      $missingKeys += $key
    }
  }

  if ($missingKeys.Count -gt 0) {
    Write-Warn ("Revise {0}. Variaveis pendentes: {1}" -f $Path, ($missingKeys -join ', '))
  }
}

function Install-Dependencies([string]$WorkingDirectory) {
  if ($SkipDependencyInstall) {
    Write-Host "dependencias ignoradas em $WorkingDirectory"
    return
  }

  Write-Step "Instalando dependencias em $WorkingDirectory"
  & npm ci
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao instalar dependencias em $WorkingDirectory"
  }
}

function Invoke-InDirectory([string]$WorkingDirectory, [scriptblock]$ScriptBlock) {
  Push-Location $WorkingDirectory
  try {
    & $ScriptBlock
  }
  finally {
    Pop-Location
  }
}

function Read-Pid([string]$PidFile) {
  if (-not (Test-Path -LiteralPath $PidFile)) {
    return $null
  }

  try {
    return [int](Get-Content -LiteralPath $PidFile -Raw).Trim()
  }
  catch {
    return $null
  }
}

function Get-RunningProcessFromPidFile([string]$PidFile) {
  $processId = Read-Pid $PidFile
  if (-not $processId) {
    return $null
  }

  return Get-Process -Id $processId -ErrorAction SilentlyContinue
}

function Start-DevProcess(
  [string]$Name,
  [string]$WorkingDirectory,
  [string]$Command,
  [string]$PidFile,
  [string]$LogFile
) {
  $existing = Get-RunningProcessFromPidFile $PidFile
  if ($existing) {
    Write-Host "$Name ja esta rodando com PID $($existing.Id)"
    return
  }

  if (Test-Path -LiteralPath $PidFile) {
    Remove-Item -LiteralPath $PidFile -Force
  }

  $escapedWorkingDirectory = $WorkingDirectory.Replace("'", "''")
  $escapedLogFile = $LogFile.Replace("'", "''")
  $runner = "Set-Location -LiteralPath '$escapedWorkingDirectory'; $Command *>> '$escapedLogFile'"

  Write-Step "Iniciando $Name"
  $process = Start-Process `
    -FilePath 'pwsh' `
    -ArgumentList @('-NoLogo', '-NoProfile', '-Command', $runner) `
    -WorkingDirectory $WorkingDirectory `
    -WindowStyle Hidden `
    -PassThru

  Set-Content -LiteralPath $PidFile -Value $process.Id
  Write-Host "$Name iniciado com PID $($process.Id)"
}

function Stop-DevProcess([string]$Name, [string]$PidFile) {
  $process = Get-RunningProcessFromPidFile $PidFile
  if (-not $process) {
    if (Test-Path -LiteralPath $PidFile) {
      Remove-Item -LiteralPath $PidFile -Force
    }
    Write-Host "$Name nao estava rodando"
    return
  }

  Write-Step "Parando $Name"
  Stop-Process -Id $process.Id -Force
  Remove-Item -LiteralPath $PidFile -Force
}

function Invoke-DockerComposeDev([string[]]$Arguments) {
  & docker compose -f (Join-Path $RepoRoot 'docker-compose.dev.yml') --env-file (Join-Path $RepoRoot '.env.localdev') @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao executar docker compose dev"
  }
}

function Invoke-DockerComposeMain([string[]]$Arguments) {
  & docker compose --env-file (Join-Path $RepoRoot '.env') @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao executar docker compose principal"
  }
}

function Show-NativeStatus() {
  $frontend = Get-RunningProcessFromPidFile $FrontendPidFile
  $backend = Get-RunningProcessFromPidFile $BackendPidFile

  Write-Host ''
  Write-Host 'FLOW native debug'
  Write-Host "frontend: $(if ($frontend) { "rodando (PID $($frontend.Id))" } else { 'parado' })"
  Write-Host "backend:  $(if ($backend) { "rodando (PID $($backend.Id))" } else { 'parado' })"
  Write-Host "logs:     $LogsDir"
  Write-Host 'urls:     http://localhost:3000 | http://localhost:3001/health | http://localhost:8081'
  Write-Host ''

  if (-not (Test-Path -LiteralPath $NativeEnvFile)) {
    Write-Warn 'Arquivo .env.localdev ainda nao foi gerado. Rode o script com -Action setup.'
    return
  }

  try {
    Invoke-DockerComposeDev @('ps')
  }
  catch {
    Write-Warn 'Nao foi possivel consultar os containers locais. Verifique se o Docker Desktop esta em execucao.'
  }
}

function Show-ComposeStatus() {
  Write-Host ''
  Write-Host 'FLOW compose parity'
  Write-Host 'urls: http://localhost:3021 | http://localhost:3022/health | http://localhost:8081'
  Write-Host ''

  if (-not (Test-Path -LiteralPath $ComposeEnvFile)) {
    Write-Warn 'Arquivo .env ainda nao foi gerado. Rode o script com -Action setup.'
    return
  }

  try {
    Invoke-DockerComposeMain @('ps')
  }
  catch {
    Write-Warn 'Nao foi possivel consultar o compose principal. Verifique se o Docker Desktop esta em execucao.'
  }
}

function Ensure-Prerequisites() {
  Assert-Command 'node' 'Node.js'
  Assert-Command 'npm' 'npm'
  Assert-Command 'docker' 'Docker'

  & docker compose version | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw 'Prerequisito ausente: docker compose'
  }
}

function Ensure-EnvironmentFiles() {
  Ensure-EnvFile (Join-Path $RepoRoot '.env.localdev.example') $NativeEnvFile
  Ensure-EnvFile (Join-Path $RepoRoot '.env.example') $ComposeEnvFile
  Ensure-EnvFile (Join-Path $FrontendDir '.env.local.example') (Join-Path $FrontendDir '.env.local')
  Ensure-EnvFile (Join-Path $BackendDir '.env.example') (Join-Path $BackendDir '.env')

  Warn-IfMissingConfig $NativeEnvFile @(
    'SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DATABASE_URL',
    'ENCRYPTION_KEY'
  )

  Warn-IfMissingConfig (Join-Path $FrontendDir '.env.local') @(
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
    'NEXT_PUBLIC_API_URL'
  )

  Warn-IfMissingConfig (Join-Path $BackendDir '.env') @(
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DATABASE_URL',
    'REDIS_URL',
    'ENCRYPTION_KEY'
  )
}

function Setup-NativeMode() {
  Ensure-Prerequisites
  Ensure-Directory $StateDir
  Ensure-Directory $LogsDir
  Ensure-Directory $PidsDir
  Ensure-EnvironmentFiles

  Invoke-InDirectory $FrontendDir { Install-Dependencies $FrontendDir }
  Invoke-InDirectory $BackendDir { Install-Dependencies $BackendDir }
}

function Setup-ComposeMode() {
  Ensure-Prerequisites
  Ensure-Directory $StateDir
  Ensure-EnvironmentFiles
}

switch ($Action) {
  'setup' {
    if ($Mode -eq 'native') {
      Setup-NativeMode
      Show-NativeStatus
    }
    else {
      Setup-ComposeMode
      Show-ComposeStatus
    }
  }

  'up' {
    if ($Mode -eq 'native') {
      Setup-NativeMode
      Write-Step 'Subindo infraestrutura local'
      Invoke-DockerComposeDev @('up', '-d')

      if (-not $InfraOnly) {
        Start-DevProcess -Name 'frontend' -WorkingDirectory $FrontendDir -Command 'npm run dev' -PidFile $FrontendPidFile -LogFile $FrontendLogFile
        Start-DevProcess -Name 'backend' -WorkingDirectory $BackendDir -Command 'npm run start:dev' -PidFile $BackendPidFile -LogFile $BackendLogFile
      }

      Show-NativeStatus
    }
    else {
      Setup-ComposeMode
      $composeArgs = @('up', '-d')
      if ($RebuildCompose) {
        $composeArgs += '--build'
      }
      Invoke-DockerComposeMain $composeArgs
      Show-ComposeStatus
    }
  }

  'down' {
    if ($Mode -eq 'native') {
      Stop-DevProcess -Name 'frontend' -PidFile $FrontendPidFile
      Stop-DevProcess -Name 'backend' -PidFile $BackendPidFile
      Write-Step 'Derrubando infraestrutura local'
      Invoke-DockerComposeDev @('down')
      Show-NativeStatus
    }
    else {
      Write-Step 'Derrubando compose parity'
      Invoke-DockerComposeMain @('down')
      Show-ComposeStatus
    }
  }

  'status' {
    if ($Mode -eq 'native') {
      Show-NativeStatus
    }
    else {
      Show-ComposeStatus
    }
  }
}
