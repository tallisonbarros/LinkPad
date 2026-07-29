# Repositorio Git e Releases

## Objetivo

Definir o fluxo inicial de versionamento e publicacao do monorepo LinkPad sem enviar segredos ou artefatos locais.

## Escopo do Repositorio

O repositorio raiz versiona em conjunto:

- contratos e governanca compartilhados;
- LinkPad Studio;
- LinkPad Agent.

Nao sao versionados:

- projetos `*.linkpad`, pois podem conter senha Wi-Fi, token e enderecos industriais;
- configuracoes `.dev` e dados em `%ProgramData%` ou `%LOCALAPPDATA%`;
- `node_modules`, ambientes virtuais Python e caches;
- builds, logs, executaveis e instaladores gerados;
- as pastas locais `App Exemplo M5Stick` e `App Exemplo Agente LinkPad`.

Os arquivos permanecem no computador; o `.gitignore` apenas impede que sejam adicionados ao historico.

A regra generica que ignora diretorios `build/` possui uma excecao explicita para `LinkPadStudioApp/src/features/build/`, pois esse caminho contem codigo-fonte da tela de compilacao e gravacao. Novas pastas-fonte nao devem receber nomes que coincidam com artefatos ignorados sem uma excecao equivalente e validada por `git status`.

## Clone Reproduzivel

O clone padrao deve partir da `main` integrada e conter todo codigo-fonte necessario. Depois de instalar Git, Python 3.11+, Node.js 24 e Rust/Cargo com os pre-requisitos do Tauri para Windows:

```bat
git clone https://github.com/tallisonbarros/LinkPad.git
cd LinkPad
setup-dev.cmd
```

O launcher raiz chama `scripts/validate-work.ps1 -All -Bootstrap` com politica restrita ao processo. Ele cria `.venv`, instala o Agent com extras `dev,windows`, executa `npm ci` e roda as suites Python, TypeScript/UI e Rust. Nenhuma dependencia ou configuracao local e versionada. O Studio e o Agent podem entao ser iniciados por seus respectivos `run-dev.cmd`.

O workflow `.github/workflows/ci.yml` reproduz o mesmo perfil Windows: instala os extras `dev,windows`, isola os temporarios do pytest em `.dev/pytest` e usa o lockfile completo aceito pelo npm fornecido com Node.js 24.

## Branches

- `main`: estado integrado e validado.
- `feat/<assunto>`: funcionalidade.
- `fix/<assunto>`: correcao.
- `docs/<assunto>`: documentacao sem mudanca de comportamento.
- `studio/<assunto>`, `agent/<assunto>`, `runtime/<assunto>`, `driver/<assunto>`, `contract/<assunto>`, `build/<assunto>` e `security/<assunto>`: mudancas alinhadas aos tipos da governanca.

Para trabalho paralelo ou revisao remota, branches devem ser curtas, publicadas cedo e integradas somente por Pull Request. Em uma linha local sequencial, o proprietario pode manter a branch de trabalho atual e publicar um conjunto coerente depois. Antes de qualquer merge na `main`, codigo, contratos, Markdown e CI devem estar coerentes. O processo operacional esta em `docs/05-fluxo-colaboracao.md`.

O comando recomendado para iniciar uma tarefa e:

```powershell
.\scripts\start-work.ps1 -Branch feat/hardware-cores3
```

## Commits

Use mensagens pequenas e descritivas, alinhadas aos tipos da governanca:

```text
studio: adiciona editor de conectores
agent: implementa driver siemens-s7
runtime: suporta multiplas sessoes
docs: registra fluxo de publicacao
build: atualiza empacotamento do agent
```

Antes de cada commit:

```powershell
git status --short
git diff --cached --stat
git diff --cached --check
```

Para executar automaticamente as validacoes proporcionais aos arquivos alterados:

```powershell
.\scripts\validate-work.ps1
```

Use `-All` para mudancas transversais e `-Bootstrap` em uma maquina que ainda nao preparou as dependencias locais.

## Publicacao

Enquanto o produto estiver em MVP, a recomendacao e usar um repositorio privado. Depois de criar o repositorio vazio no provedor, sem README ou `.gitignore` adicionais:

```powershell
git remote add origin <URL-DO-REPOSITORIO>
git push -u origin main
```

Nunca cole token de acesso na URL do remoto. Use o gerenciador de credenciais do Git para HTTPS ou uma chave SSH protegida.

## Pull Requests e CI

Todo Pull Request usa `.github/pull_request_template.md` e executa `.github/workflows/ci.yml`.

Os checks estaveis sao:

- `Agent / Python tests`;
- `Studio / TypeScript and UI`;
- `Studio / Rust backend`.

No GitHub, recomenda-se proteger a `main` com Pull Request obrigatorio, checks obrigatorios, conversas resolvidas e bloqueio de force push e exclusao. Quando o plano da conta nao permitir impor alguma regra, ela continua obrigatoria como politica da equipe.

## Tags de Release

Studio e Agent possuem versoes independentes. Quando houver um instalador validado, use tags com o produto no nome:

```text
studio-v0.9.0
agent-v0.3.0
```

Uma tag de release deve apontar para um commit que atualize o `CHANGELOG.md` do produto e tenha o fluxo de build correspondente validado.

## Prototipos Legados

Os dois prototipos legados permanecem intactos no computador como referencia historica. Eles sao ignorados integralmente para evitar publicar codigo descontinuado, artefatos gerados e configuracoes locais hardcoded.
