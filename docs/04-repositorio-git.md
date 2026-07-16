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

## Branches

- `main`: estado integrado e validado.
- `feat/<assunto>`: funcionalidade.
- `fix/<assunto>`: correcao.
- `docs/<assunto>`: documentacao sem mudanca de comportamento.

Para o MVP, branches curtas e merge na `main` sao suficientes. Antes do merge, codigo, contratos e Markdown devem estar coerentes.

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

## Publicacao

Enquanto o produto estiver em MVP, a recomendacao e usar um repositorio privado. Depois de criar o repositorio vazio no provedor, sem README ou `.gitignore` adicionais:

```powershell
git remote add origin <URL-DO-REPOSITORIO>
git push -u origin main
```

Nunca cole token de acesso na URL do remoto. Use o gerenciador de credenciais do Git para HTTPS ou uma chave SSH protegida.

## Tags de Release

Studio e Agent possuem versoes independentes. Quando houver um instalador validado, use tags com o produto no nome:

```text
studio-v0.5.0
agent-v0.2.0
```

Uma tag de release deve apontar para um commit que atualize o `CHANGELOG.md` do produto e tenha o fluxo de build correspondente validado.

## Prototipos Legados

Os dois prototipos legados permanecem intactos no computador como referencia historica. Eles sao ignorados integralmente para evitar publicar codigo descontinuado, artefatos gerados e configuracoes locais hardcoded.
