# Fluxo de Colaboracao Simultanea

## Objetivo

Permitir desenvolvimento continuo por humanos e agentes de IA sem depender de instrucoes mecanicas repetidas e sem permitir que uma entrega sobrescreva silenciosamente outra.

O usuario informa a intencao. O agente usa os contratos versionados para descobrir escopo, dependencias, documentacao e validacoes.

## Fontes Canonicas

- `AGENTS.md`: regras obrigatorias para qualquer agente.
- `CONTRIBUTING.md`: entrada operacional para colaboradores.
- `docs/01-contratos-de-mudanca.md`: decisoes e matriz de impacto.
- Documentos da area em `LinkPadStudioApp/docs` e `LinkPadAgenteApp/docs`.
- `.github/pull_request_template.md`: evidencias exigidas na entrega.
- `.github/workflows/ci.yml`: validacao remota comum.

Instrucoes especificas de uma ferramenta podem apontar para essas fontes, mas nao devem duplicar ou contradizer o contrato canonico.

## Da Intencao Para a Entrega

Exemplo:

> Integre suporte ao hardware M5Stack CoreS3.

O agente deve:

1. inspecionar o estado Git e trabalho remoto potencialmente sobreposto;
2. criar e publicar uma branch descritiva;
3. localizar os contratos de catalogo, runtime, build e interface afetados;
4. declarar internamente a menor fatia vertical necessaria;
5. implementar sem ampliar silenciosamente o objetivo;
6. atualizar documentacao e testes;
7. integrar a `origin/main` atual;
8. validar localmente;
9. entregar Pull Request com riscos e continuacoes.

Para um novo hardware, a leitura minima inclui:

- `LinkPadStudioApp/docs/03-catalogo-de-hardwares.md`;
- `LinkPadStudioApp/docs/04-runtime-device.md`;
- `LinkPadStudioApp/docs/08-geracao-de-firmware.md`;
- `LinkPadStudioApp/docs/10-build-deploy-devices.md`.

`LinkPadStudioApp/docs/05-editor-visual-e-widgets.md` entra no escopo quando o novo hardware exige adaptacao do editor, layout ou widgets. Widgets adicionais desejaveis, mas nao necessarios para habilitar o hardware, devem virar uma continuacao separada.

## Isolamento

A `main` representa somente estado integrado. Cada objetivo usa uma branch curta.

O script recomendado e:

```powershell
.\scripts\start-work.ps1 -Branch feat/hardware-cores3
```

Quando um ambiente cria worktrees ou branches automaticamente, esse isolamento tem precedencia e o agente nao deve troca-lo por conta propria.

Publicar a branch no inicio comunica intencao. Quando a ferramenta tiver acesso ao GitHub, um Pull Request draft deve ser aberto cedo para documentar o escopo e facilitar a deteccao de sobreposicoes.

## Deteccao de Sobreposicao

Antes de editar:

```powershell
git fetch origin --prune
git branch -r
```

O agente deve consultar Pull Requests abertos quando tiver uma integracao GitHub disponivel. Ele compara:

- componentes e diretorios afetados;
- contratos e schemas compartilhados;
- endpoints, tipos e arquivos de catalogo;
- templates de firmware;
- testes que representam o mesmo comportamento.

Branches diferentes evitam sobrescrita fisica, mas nao conflitos semanticos. Se duas entregas mudarem o mesmo contrato, o agente deve reduzir o escopo, combinar a ordem ou solicitar decisao. Nao deve escolher silenciosamente uma das interpretacoes.

## Integracao da Base

Antes da entrega:

```powershell
git fetch origin --prune
git merge origin/main
```

O merge da base evita reescrever uma branch ja publicada. Em conflito:

1. identifique a intencao de cada lado;
2. preserve comportamentos compativeis;
3. atualize consumidores e testes do contrato resultante;
4. solicite decisao se os objetivos forem incompativeis;
5. nunca use descarte em massa para fazer o conflito desaparecer.

Sao proibidos como atalho de integracao:

- `git reset --hard`;
- `git checkout -- <arquivo>`;
- force push na `main`;
- substituir um diretorio inteiro sem revisar o diff;
- fazer merge automatico do Pull Request.

## Validacao Proporcional

`scripts/validate-work.ps1` detecta as areas alteradas em relacao a `origin/main` e executa:

- verificacoes de whitespace e staging;
- testes Python quando o Agent foi alterado;
- testes, TypeScript e build Vite quando o Studio foi alterado;
- testes Rust do backend Tauri quando o Studio foi alterado.

Mudancas transversais usam:

```powershell
.\scripts\validate-work.ps1 -All
```

A CI remota executa sempre os tres grupos para impedir que uma integracao local aparentemente isolada quebre outro componente.

## Pull Request Como Unidade de Integracao

O Pull Request descreve:

- resultado entregue;
- componentes e contratos afetados;
- trabalho simultaneo verificado;
- documentacao atualizada;
- testes executados;
- riscos e continuacoes.

O Pull Request deve permanecer pequeno o bastante para revisao. Uma grande funcionalidade pode ser entregue em fatias compativeis, protegidas por capacidade declarativa ou feature flag quando necessario.

## Protecao da Main

No GitHub, recomenda-se configurar a `main` com:

- Pull Request obrigatorio;
- checks `Agent / Python tests`, `Studio / TypeScript and UI` e `Studio / Rust backend`;
- conversas resolvidas antes do merge;
- force push e exclusao desabilitados;
- ao menos uma aprovacao quando houver outro revisor disponivel.

Essa configuracao e administrativa e nao pode ser imposta apenas por arquivos versionados. Se o plano da conta nao oferecer alguma protecao, a regra continua obrigatoria no processo da equipe.

## Responsabilidade Humana

O agente automatiza descoberta, Git, implementacao, documentacao, testes e preparacao do Pull Request. Permanecem humanos:

- prioridade do produto;
- decisoes arquiteturais sem resposta nos contratos;
- validacao visual ou em hardware real;
- aceitacao de riscos;
- aprovacao e merge.

## Criterio de Pronto

Uma entrega colaborativa esta pronta quando:

- a branch esta sincronizada com a base atual;
- nao ha trabalho simultaneo descartado;
- contratos e Markdown estao coerentes;
- validacoes locais e CI passaram;
- riscos e continuacoes estao explicitos;
- um humano aprovou o merge.
