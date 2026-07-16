# LinkPad Agente App

Gateway Windows independente e orientado a requisicoes industriais.

## Arquitetura Alvo

O Device Runtime envia descritores autodescritivos pelo LinkPad Protocol. O Agente seleciona o driver, cria sessoes efemeras e reutiliza conexoes internamente.

O fluxo normal nao exige configurar PLC, tags ou projeto no Windows e nao possui pareamento com o LinkPad Studio.

Drivers priorizados:

- `sim` para fundacao e testes;
- `siemens-s7` para o primeiro MVP real com S7-1200/S7-1500;
- `siemens-opcua` como conector Siemens posterior;
- `rockwell-logix` com `pycomm3`, validado pelo prototipo.

## Estado Atual

A versao do aplicativo `0.2.0` esta implementada sobre o LinkPad Protocol `0.1.0` e entrega:

- LinkPad Protocol HTTP/JSON `0.1.0`;
- sessoes efemeras e connection pool;
- driver `sim` com leitura e escrita em memoria;
- driver `siemens-s7` com DBs, `BOOL`, `INT`, `DINT`, `REAL`, confirmacao de escrita e reconexao de leitura;
- politica de destino IPv4/CIDR aplicada aos drivers de rede;
- autenticacao por token, whitelist de devices e drivers;
- rate limit, limite de requisicoes pendentes e deduplicacao de escrita;
- servico Windows headless;
- processo PySide6 independente com icone na bandeja;
- instalador Inno Setup.

Esta versao ainda nao inclui Siemens OPC UA, Rockwell Logix nem o adaptador HTTP legado. As capacidades anunciam `sim` e `siemens-s7`.

Contratos principais:

- `docs/01-arquitetura-agente.md`
- `docs/02-api-http-device-agent.md`
- `docs/03-modelo-de-configuracao.md`
- `docs/04-drivers-industriais.md`
- `docs/04a-driver-siemens-opcua.md`
- `docs/04b-driver-siemens-s7-nativo.md`
- `docs/15-mvp-agente-roadmap.md`

## Desenvolvimento

Requer Python 3.11 ou superior:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev,windows,build]"
.\.venv\Scripts\python.exe -m pytest -q
.\run-dev.ps1
```

`run-dev.ps1` verifica e instala automaticamente a dependencia S7 fixada quando ela ainda nao existir, depois inicia API e bandeja no mesmo processo. Um unico icone azul com `D` aparece; clique nele e use `Encerrar Agent de desenvolvimento` para finalizar tudo sem deixar processos soltos.

O desenvolvimento usa `.dev\config.json` e `.dev\logs`, sem alterar `%ProgramData%`. Se as portas 8008/8009 estiverem ocupadas por um servico instalado, o launcher informa o conflito e nao abre outra bandeja.

Se houver uma bandeja antiga ou servico ativo, execute uma vez:

```powershell
.\reset-dev.ps1
.\run-dev.ps1
```

`reset-dev.ps1` solicita elevacao, encerra apenas processos LinkPad e para o servico sem desinstala-lo.

Na instalacao normal, a configuracao fica em `%ProgramData%\LinkPad\Agent\config.json`.

## Build Windows

Com Inno Setup 6 instalado:

```powershell
.\packaging\build.ps1
```

Artefato final:

```text
dist\installer\LinkPadAgent-Setup-0.2.0.exe
```

Use `-SkipInstaller` para gerar apenas `LinkPadAgentService.exe` e `LinkPadAgentTray.exe`.
