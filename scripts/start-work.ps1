#requires -Version 5.1

[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = "Low")]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern("^(feat|fix|docs|studio|agent|runtime|contract|driver|build|security)/[a-z0-9][a-z0-9.-]*$")]
    [string]$Branch,

    [switch]$NoPublish
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-Git {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$GitArguments
    )

    $output = & git @GitArguments
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArguments -join ' ') falhou com codigo $LASTEXITCODE."
    }
    return $output
}

$repoRoot = (Invoke-Git rev-parse --show-toplevel | Select-Object -First 1).Trim()
Set-Location -LiteralPath $repoRoot

$pending = @(Invoke-Git status --porcelain)
if ($pending.Count -gt 0) {
    throw "A arvore de trabalho possui alteracoes. Entregue ou preserve esse trabalho antes de iniciar outra branch."
}

$currentBranch = (Invoke-Git branch --show-current | Select-Object -First 1).Trim()
if ($currentBranch -ne "main") {
    throw "A tarefa deve partir da main. Branch atual: '$currentBranch'."
}

[void](Invoke-Git remote get-url origin)

if (-not $PSCmdlet.ShouldProcess($Branch, "Atualizar main, criar branch e publicar intencao")) {
    return
}

Invoke-Git fetch origin --prune
Invoke-Git show-ref --verify --quiet refs/remotes/origin/main
Invoke-Git merge --ff-only origin/main

$localMain = (Invoke-Git rev-parse main | Select-Object -First 1).Trim()
$remoteMain = (Invoke-Git rev-parse origin/main | Select-Object -First 1).Trim()
if ($localMain -ne $remoteMain) {
    throw "A main local possui commits que nao estao em origin/main. Publique ou revise esses commits antes de criar a tarefa."
}

& git show-ref --verify --quiet "refs/heads/$Branch"
if ($LASTEXITCODE -eq 0) {
    throw "A branch local '$Branch' ja existe."
}

& git show-ref --verify --quiet "refs/remotes/origin/$Branch"
if ($LASTEXITCODE -eq 0) {
    throw "A branch remota 'origin/$Branch' ja existe."
}

Invoke-Git switch -c $Branch

if (-not $NoPublish) {
    Invoke-Git push -u origin $Branch
    Write-Host "Branch '$Branch' criada e publicada. Abra um Pull Request draft quando a ferramenta permitir."
} else {
    Write-Host "Branch '$Branch' criada somente no ambiente local."
}
