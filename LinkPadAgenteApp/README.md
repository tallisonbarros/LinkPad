# LinkPad Agente App

Gateway Windows independente e orientado a requisicoes industriais.

## Arquitetura Alvo

O Device Runtime envia descritores autodescritivos pelo LinkPad Protocol. O Agente seleciona o driver, cria sessoes efemeras e reutiliza conexoes internamente.

O fluxo normal nao exige configurar PLC, tags ou projeto no Windows e nao possui pareamento com o LinkPad Studio.

Drivers priorizados:

- `sim` para fundacao e testes;
- `siemens-s7` para o primeiro MVP real com S7-1200/S7-1500;
- `opcua` como conector generico, validado com servidor real e tendo Siemens como primeiro alvo fisico;
- `rockwell-logix` com `pycomm3`, validado pelo prototipo.

## Estado Atual

A versao do aplicativo `0.3.0` esta implementada sobre o LinkPad Protocol `0.1.0` e entrega:

- LinkPad Protocol HTTP/JSON `0.1.0`;
- sessoes efemeras e connection pool;
- driver `sim` com leitura e escrita em memoria;
- driver `siemens-s7` com DBs, `BOOL`, `INT`, `DINT`, `REAL`, confirmacao de escrita e reconexao de leitura;
- driver `opcua` com Node ID, tipos escalares, qualidade/timestamp do DataValue, reconexao de leitura e confirmacao de escrita;
- politica de destino IPv4/CIDR aplicada aos drivers de rede;
- autenticacao por token, whitelist de devices e drivers;
- rate limit, limite de requisicoes pendentes e deduplicacao de escrita;
- servico Windows headless;
- processo PySide6 independente com icone na bandeja;
- instalador Inno Setup.

O OPC UA inicial aceita somente IPv4 privado, TCP 4840 e modo anonimo/None para laboratorio. Certificados, credenciais protegidas, browse online, Rockwell Logix e o adaptador HTTP legado permanecem posteriores. As capacidades anunciam `sim`, `siemens-s7` e `opcua`.

Validacoes atuais: o S7 nativo ja participou do fluxo real M5 -> Agent -> S7-1200 em leitura; OPC UA passou por leitura/escrita automatizada contra servidor real e o executavel empacotado abriu uma sessao OPC UA. A validacao OPC UA no S7-1200 fisico e testes prolongados de escrita/reconexao ainda estao abertos.

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
.\run-dev.cmd
```

Em um clone novo do monorepo, `setup-dev.cmd` na raiz automatiza a criacao do ambiente, instala os extras `dev,windows` e executa todas as validacoes. O wrapper `run-dev.cmd` evita depender da politica global de execucao do PowerShell; internamente, `run-dev.ps1` verifica e instala automaticamente `python-snap7 3.0.0` e `asyncua 2.0.1` quando necessario, depois inicia API e bandeja no mesmo processo. Um unico icone azul com `D` aparece; clique nele e use `Encerrar Agent de desenvolvimento` para finalizar tudo sem deixar processos soltos.

O desenvolvimento usa `.dev\config.json` e `.dev\logs`, sem alterar `%ProgramData%`. Se as portas 8008/8009 estiverem ocupadas por um servico instalado, o launcher informa o conflito e nao abre outra bandeja.

Se houver uma bandeja antiga ou servico ativo, execute uma vez:

```powershell
.\reset-dev.ps1
.\run-dev.cmd
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
dist\installer\LinkPadAgent-Setup-0.3.0.exe
```

Use `-SkipInstaller` para gerar apenas `LinkPadAgentService.exe` e `LinkPadAgentTray.exe`.

O diretorio temporario do PyInstaller fica em `%LOCALAPPDATA%\LinkPad\AgentBuild\<versao>` para evitar locks de sincronizacao do OneDrive. Os artefatos finais continuam em `dist`.

## Proximos Passos

- fechar a bancada OPC UA no S7-1200 e a campanha prolongada S7/OPC;
- adicionar certificados, trust store e `SignAndEncrypt` antes de producao;
- criar browse/teste de ponto como contratos separados do handshake;
- adaptar o driver Rockwell Logix do prototipo para sessoes/targets;
- reforcar cache, limites por device, auditoria, TLS e testes de upgrade.

O estado compartilhado e a ordem completa estao em `../docs/06-estado-atual-e-proximos-passos.md`.
