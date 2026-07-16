param(
    [switch]$SkipInstaller,
    [string]$Python
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$AppVersion = "0.2.0"
$VersionedDist = Join-Path $ProjectRoot "dist\$AppVersion"
if (-not $Python) {
    $Python = if (Test-Path $VenvPython) { $VenvPython } else { "python" }
}

function Invoke-Python {
    param([string[]]$Arguments)
    & $Python @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Python encerrou com código $LASTEXITCODE."
    }
}

Push-Location $PSScriptRoot
try {
    Invoke-Python @("-m", "PyInstaller", "--noconfirm", "--clean", "service.spec", "--distpath", $VersionedDist, "--workpath", "$ProjectRoot\build\service")
    Invoke-Python @("-m", "PyInstaller", "--noconfirm", "--clean", "tray.spec", "--distpath", $VersionedDist, "--workpath", "$ProjectRoot\build\tray")

    if (-not $SkipInstaller) {
        $iscc = Get-Command ISCC.exe -ErrorAction SilentlyContinue
        if (-not $iscc) {
            $isccCandidates = @(
                (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe"),
                (Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe"),
                (Join-Path $env:ProgramFiles "Inno Setup 6\ISCC.exe")
            )
            $iscc = $isccCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
        }
        if (-not $iscc) {
            throw "ISCC.exe não encontrado. Instale o Inno Setup 6 ou use -SkipInstaller."
        }
        $isccPath = if ($iscc.Source) { $iscc.Source } else { [string]$iscc }
        & $isccPath "$PSScriptRoot\installer.iss"
        if ($LASTEXITCODE -ne 0) {
            throw "Inno Setup encerrou com código $LASTEXITCODE."
        }
    }
}
finally {
    Pop-Location
}
