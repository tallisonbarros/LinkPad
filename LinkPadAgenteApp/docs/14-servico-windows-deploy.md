# Servico Windows e Deploy

## Implementacao 0.3.0

O produto e separado em dois executaveis PyInstaller `onedir`:

```text
LinkPadAgentService.exe
LinkPadAgentTray.exe
```

Os diretorios intermediarios sao versionados em `dist\<versao>`, permitindo compilar uma atualizacao mesmo quando a bandeja instalada/anterior ainda estiver em execucao.

`LinkPadAgentService.exe` usa a API nativa de servicos do `pywin32`, inicia automaticamente e executa as APIs publica e local em background. NSSM nao e usado.

`LinkPadAgentTray.exe` e iniciado no login pelo registro `HKLM\Software\Microsoft\Windows\CurrentVersion\Run` e pode ser encerrado independentemente.

## Instalador

O Inno Setup gera:

```text
dist\installer\LinkPadAgent-Setup-0.3.0.exe
```

O instalador:

- exige privilegio administrativo;
- instala e inicia o servico `LinkPadAgent`;
- configura inicio automatico;
- registra a bandeja para os logins seguintes;
- encerra bandejas de versoes anteriores durante upgrade;
- atualiza o servico quando ele ja existe;
- cria regra de firewall TCP 8008 apenas para perfis Domain/Private;
- cria `%ProgramData%\LinkPad\Agent\logs`;
- preserva config e logs no uninstall.

O firewall do instalador cobre a porta padrao. Se `server.port` for alterada, a regra precisa ser ajustada pelo administrador.

## Build

No diretorio `LinkPadAgenteApp`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev,windows,build]"
.\packaging\build.ps1
```

Dependencias:

- Python 3.11 ou superior;
- Inno Setup 6 para o instalador.

`packaging\build.ps1 -SkipInstaller` gera apenas os dois executaveis.

O workpath temporario do PyInstaller fica em `%LOCALAPPDATA%\LinkPad\AgentBuild\<versao>`, evitando bloqueios de cache quando o repositorio esta no OneDrive. `dist` continua sendo a saida final.

## Dados Operacionais

```text
%ProgramData%\LinkPad\Agent\config.json
%ProgramData%\LinkPad\Agent\logs\agent.log
```

Atualizacoes nao devem substituir esses dados. Sessoes e conexoes efemeras nunca sao restauradas depois de reinicio.

## Desenvolvimento

`run-dev.ps1` nao instala servico nem usa ProgramData. Ele garante automaticamente `python-snap7 3.0.0` e `asyncua 2.0.1`, inicia core e bandeja juntos, usa `.dev` para dados locais e deve ser encerrado pelo menu do icone azul `D`. Como recuperacao, `reset-dev.ps1` tambem encerra o processo Python desse modo de desenvolvimento.

S7 e OPC UA sao dependencias obrigatorias do pacote do servico. O build PyInstaller `0.3.0` foi reconstruido e o executavel passou por smoke test de `/lpp/v1/capabilities` e abertura/encerramento de sessao com um servidor OPC UA real; os metadados/licenca do `asyncua` tambem foram coletados no diretorio `_internal`.

Artefato gerado neste ciclo:

```text
dist\installer\LinkPadAgent-Setup-0.3.0.exe
```

## Limitacoes de Release

- os binarios ainda nao possuem assinatura digital;
- a instalacao silenciosa e o ciclo completo instalar/atualizar/desinstalar ainda precisam de validacao em VM limpa.

Proxima rodada de release deve validar VM limpa, upgrade preservando `config.json`, reinicio do servico, regra de firewall, bandeja unica, remocao e rollback. Assinatura Authenticode e publicacao com hash devem preceder distribuicao fora da bancada.
