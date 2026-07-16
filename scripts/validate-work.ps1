#requires -Version 5.1

[CmdletBinding()]
param(
    [switch]$All,
    [switch]$Bootstrap
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-Native {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [string[]]$Arguments = @(),

        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory
    )

    Push-Location -LiteralPath $WorkingDirectory
    try {
        & $FilePath @Arguments
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }

    if ($exitCode -ne 0) {
        throw "'$FilePath $($Arguments -join ' ')' falhou com codigo $exitCode."
    }
}

function Add-ChangedPaths {
    param(
        [System.Collections.Generic.HashSet[string]]$Target,
        [object[]]$Paths
    )

    foreach ($path in @($Paths)) {
        if (-not [string]::IsNullOrWhiteSpace([string]$path)) {
            [void]$Target.Add(([string]$path).Trim())
        }
    }
}

$repoRootOutput = & git rev-parse --show-toplevel
$repoRootExitCode = $LASTEXITCODE
$repoRoot = ($repoRootOutput | Select-Object -First 1).Trim()
if ($repoRootExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($repoRoot)) {
    throw "Execute este script dentro do repositorio LinkPad."
}
Set-Location -LiteralPath $repoRoot

Write-Host "Verificando whitespace e staging..."
& git diff --check
if ($LASTEXITCODE -ne 0) {
    throw "git diff --check encontrou problemas."
}
& git diff --cached --check
if ($LASTEXITCODE -ne 0) {
    throw "git diff --cached --check encontrou problemas."
}

$changed = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

& git show-ref --verify --quiet refs/remotes/origin/main
$hasOriginMain = $LASTEXITCODE -eq 0
if ($hasOriginMain) {
    Add-ChangedPaths -Target $changed -Paths @(& git diff --name-only "origin/main...HEAD")
    & git diff --check "origin/main...HEAD"
    if ($LASTEXITCODE -ne 0) {
        throw "O diff da branch contra origin/main possui problemas."
    }
}

Add-ChangedPaths -Target $changed -Paths @(& git diff --name-only)
Add-ChangedPaths -Target $changed -Paths @(& git diff --cached --name-only)
Add-ChangedPaths -Target $changed -Paths @(& git ls-files --others --exclude-standard)

$runAgent = $All.IsPresent
$runStudio = $All.IsPresent
foreach ($path in $changed) {
    if ($path -like "LinkPadAgenteApp/*") {
        $runAgent = $true
    }
    if ($path -like "LinkPadStudioApp/*") {
        $runStudio = $true
    }
}

$agentDir = Join-Path $repoRoot "LinkPadAgenteApp"
$studioDir = Join-Path $repoRoot "LinkPadStudioApp"
$tauriDir = Join-Path $studioDir "src-tauri"

if ($runAgent) {
    $agentPython = Join-Path $agentDir ".venv\Scripts\python.exe"
    if ($Bootstrap -and -not (Test-Path -LiteralPath $agentPython)) {
        $systemPython = (Get-Command python -ErrorAction Stop).Source
        Invoke-Native -FilePath $systemPython -Arguments @("-m", "venv", ".venv") -WorkingDirectory $agentDir
    }
    if (-not (Test-Path -LiteralPath $agentPython)) {
        throw "Ambiente Python do Agent nao encontrado. Execute novamente com -Bootstrap."
    }
    if ($Bootstrap) {
        Invoke-Native -FilePath $agentPython -Arguments @("-m", "pip", "install", "--upgrade", "pip") -WorkingDirectory $agentDir
        Invoke-Native -FilePath $agentPython -Arguments @("-m", "pip", "install", "-e", ".[dev]") -WorkingDirectory $agentDir
    }

    Write-Host "Executando Agent / Python tests..."
    Invoke-Native -FilePath $agentPython -Arguments @("-m", "pytest", "-q") -WorkingDirectory $agentDir
}

if ($runStudio) {
    if ($Bootstrap) {
        Invoke-Native -FilePath "npm" -Arguments @("ci") -WorkingDirectory $studioDir
    } elseif (-not (Test-Path -LiteralPath (Join-Path $studioDir "node_modules"))) {
        throw "Dependencias Node do Studio nao encontradas. Execute novamente com -Bootstrap."
    }

    [void](Get-Command cargo -ErrorAction Stop)

    Write-Host "Executando Studio / TypeScript and UI..."
    Invoke-Native -FilePath "npm" -Arguments @("test") -WorkingDirectory $studioDir
    Invoke-Native -FilePath "npm" -Arguments @("run", "check") -WorkingDirectory $studioDir

    Write-Host "Executando Studio / Rust backend..."
    Invoke-Native -FilePath "cargo" -Arguments @("test", "--locked", "--quiet") -WorkingDirectory $tauriDir
}

if (-not $runAgent -and -not $runStudio) {
    Write-Host "Nenhum produto alterado; somente verificacoes de Git e documentacao foram necessarias."
}

Write-Host "Validacao concluida com sucesso."
