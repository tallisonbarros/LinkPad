# Servico Windows e Deploy

## Implementacao 0.2.0

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
dist\installer\LinkPadAgent-Setup-0.2.0.exe
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

## Dados Operacionais

```text
%ProgramData%\LinkPad\Agent\config.json
%ProgramData%\LinkPad\Agent\logs\agent.log
```

Atualizacoes nao devem substituir esses dados. Sessoes e conexoes efemeras nunca sao restauradas depois de reinicio.

## Desenvolvimento

`run-dev.ps1` nao instala servico nem usa ProgramData. Ele garante automaticamente a dependencia `python-snap7 3.0.0`, inicia core e bandeja juntos, usa `.dev` para dados locais e deve ser encerrado pelo menu do icone azul `D`. Como recuperacao, `reset-dev.ps1` tambem encerra o processo Python desse modo de desenvolvimento.

O driver S7 e dependencia obrigatoria do pacote do servico. O build PyInstaller deve inclui-la no executavel antes de gerar um instalador de release. Nesta iteracao de desenvolvimento os testes foram executados sem reconstruir os instaladores.

## Limitacoes de Release

- os binarios ainda nao possuem assinatura digital;
- a instalacao silenciosa e o ciclo completo instalar/atualizar/desinstalar ainda precisam de validacao em VM limpa.
