param(
    [switch]$CheckOnly,
    [switch]$UiOnly
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$DevDirectory = Join-Path $ProjectRoot ".dev"
$LockPath = Join-Path $DevDirectory "studio-dev.lock"

function Find-RequiredCommand {
    param(
        [string]$Name,
        [string]$InstallHint
    )

    $Command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $Command) {
        throw "$Name não foi encontrado. $InstallHint"
    }
    return $Command
}
$Node = Find-RequiredCommand "node.exe" "Instale o Node.js e abra um novo terminal."
$Npm = Find-RequiredCommand "npm.cmd" "Instale o Node.js e abra um novo terminal."

if (-not $UiOnly) {
    $Cargo = Get-Command "cargo.exe" -ErrorAction SilentlyContinue
    $DefaultCargoDirectory = Join-Path $env:USERPROFILE ".cargo\bin"
    if (-not $Cargo -and (Test-Path -LiteralPath (Join-Path $DefaultCargoDirectory "cargo.exe"))) {
        $env:Path = "$DefaultCargoDirectory;$env:Path"
        $Cargo = Get-Command "cargo.exe" -ErrorAction SilentlyContinue
    }
    if (-not $Cargo) {
        throw "cargo.exe não foi encontrado. Instale o Rust conforme os pré-requisitos do Tauri."
    }
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "node_modules\@tauri-apps\cli"))) {
    throw "Dependências npm não encontradas. Execute 'npm install' nesta pasta."
}

$ExistingStudio = Get-Process -Name "linkpad-studio" -ErrorAction SilentlyContinue
$PortInUse = Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue

$Mode = if ($UiOnly) { "UI Vite" } else { "Desktop Tauri" }
Write-Host "LinkPad Studio DEV"
Write-Host "Modo: $Mode"
Write-Host "Node: $(& $Node.Source --version)"
if (-not $UiOnly) {
    Write-Host "Cargo: $(& $Cargo.Source --version)"
}

if ($ExistingStudio) {
    throw "Já existe uma instância do LinkPad Studio em execução. Encerre-a antes de iniciar outra."
}
if ($PortInUse) {
    throw "A porta 5173 já está em uso. Encerre o servidor anterior antes de iniciar o Studio."
}

if ($CheckOnly) {
    Write-Host "Ambiente pronto. Nenhuma aplicação foi iniciada."
    exit 0
}

New-Item -ItemType Directory -Path $DevDirectory -Force | Out-Null
$LockStream = $null
try {
    try {
        $LockStream = [System.IO.File]::Open(
            $LockPath,
            [System.IO.FileMode]::OpenOrCreate,
            [System.IO.FileAccess]::ReadWrite,
            [System.IO.FileShare]::None
        )
    }
    catch {
        throw "Outra sessão de desenvolvimento do LinkPad Studio já está ativa."
    }

    Push-Location $ProjectRoot
    try {
        $ScriptName = if ($UiOnly) { "ui:dev" } else { "dev" }
        & $Npm.Source run $ScriptName
        if ($LASTEXITCODE -ne 0) {
            throw "O ambiente de desenvolvimento encerrou com código $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    if ($LockStream) {
        $LockStream.Close()
        $LockStream.Dispose()
    }
    Remove-Item -LiteralPath $LockPath -Force -ErrorAction SilentlyContinue
}
