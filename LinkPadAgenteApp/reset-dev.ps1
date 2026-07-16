param(
    [switch]$Elevated
)

$ErrorActionPreference = "Stop"
$IsAdministrator = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)

if (-not $IsAdministrator) {
    $Arguments = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", "`"$PSCommandPath`"",
        "-Elevated"
    )
    $Process = Start-Process powershell.exe -Verb RunAs -ArgumentList $Arguments -Wait -PassThru
    exit $Process.ExitCode
}

$Trays = Get-Process -Name "LinkPadAgentTray" -ErrorAction SilentlyContinue
if ($Trays) {
    $Trays | Stop-Process -Force
    $Trays | Wait-Process -Timeout 5 -ErrorAction SilentlyContinue
}

$DevelopmentProcesses = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -match '^python(w)?\.exe$' -and
    $_.CommandLine -match 'linkpad_agent\.dev_main'
}
if ($DevelopmentProcesses) {
    $DevelopmentProcesses.ProcessId | ForEach-Object {
        Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
    }
}

$Service = Get-Service -Name "LinkPadAgent" -ErrorAction SilentlyContinue
if ($Service -and $Service.Status -ne "Stopped") {
    Stop-Service -Name "LinkPadAgent" -Force
    $Service.WaitForStatus("Stopped", [TimeSpan]::FromSeconds(15))
}

Write-Host "Instancias do LinkPad Agent encerradas. A instalação não foi removida."
