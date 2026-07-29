param(
    [switch]$SmokeTest
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $Python)) {
    throw "Ambiente .venv não encontrado. Execute as instruções de instalação do README primeiro."
}

& $Python -c "from importlib.metadata import version; assert version('python-snap7') == '3.0.0'; assert version('asyncua') == '2.0.1'" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Atualizando as dependências de desenvolvimento do LinkPad Agent..."
    & $Python -m pip install -e "${ProjectRoot}[dev,windows]"
    if ($LASTEXITCODE -ne 0) {
        throw "Não foi possível preparar as dependências do Agent."
    }
}

$InstalledTrays = Get-Process -Name "LinkPadAgentTray" -ErrorAction SilentlyContinue
$InstalledService = Get-Service -Name "LinkPadAgent" -ErrorAction SilentlyContinue
if ($InstalledTrays -or ($InstalledService -and $InstalledService.Status -ne "Stopped")) {
    throw "Existe uma instalação/processo do LinkPad Agent em execução. Execute .\reset-dev.ps1 e tente novamente."
}

Push-Location $ProjectRoot
try {
    $Arguments = @("-m", "linkpad_agent.dev_main")
    if ($SmokeTest) {
        $Arguments += "--smoke-test"
    }
    & $Python @Arguments
    exit $LASTEXITCODE
}

finally {
    Pop-Location
}
