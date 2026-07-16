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

## Branches

- `main`: estado integrado e validado.
- `feat/<assunto>`: funcionalidade.
- `fix/<assunto>`: correcao.
- `docs/<assunto>`: documentacao sem mudanca de comportamento.
- `studio/<assunto>`, `agent/<assunto>`, `runtime/<assunto>`, `driver/<assunto>`, `contract/<assunto>`, `build/<assunto>` e `security/<assunto>`: mudancas alinhadas aos tipos da governanca.

Branches devem ser curtas, publicadas cedo e integradas somente por Pull Request. Antes do merge, codigo, contratos, Markdown e CI devem estar coerentes. O processo operacional esta em `docs/05-fluxo-colaboracao.md`.

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
studio-v0.5.0
agent-v0.2.0
```

Uma tag de release deve apontar para um commit que atualize o `CHANGELOG.md` do produto e tenha o fluxo de build correspondente validado.

## Prototipos Legados

Os dois prototipos legados permanecem intactos no computador como referencia historica. Eles sao ignorados integralmente para evitar publicar codigo descontinuado, artefatos gerados e configuracoes locais hardcoded.
