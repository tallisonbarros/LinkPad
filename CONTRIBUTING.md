# Contribuindo com o LinkPad

## Principio

O colaborador informa o resultado desejado; o repositorio fornece aos humanos e agentes o caminho de arquitetura, isolamento, validacao e entrega.

Antes de qualquer alteracao, leia `AGENTS.md`, `docs/05-fluxo-colaboracao.md` e `docs/06-estado-atual-e-proximos-passos.md`. Se a ferramenta de IA nao carregar `AGENTS.md` automaticamente, instrua-a uma vez a trata-lo como regra canonica.

O processo aceita dois modos: uma unica linha de trabalho local, mais simples para iteracoes guiadas pelo proprietario, ou branches/PRs simultaneos quando duas pessoas realmente precisarem trabalhar em paralelo. Nao crie mecanica de colaboracao sem necessidade; use isolamento remoto quando ele resolver uma sobreposicao concreta.

## Inicio de Uma Tarefa

Em um clone novo, prepare e valide todo o ambiente uma vez pela raiz:

```bat
setup-dev.cmd
```

O comando cria apenas dependencias e ambientes ignorados pelo Git. Depois dele, `LinkPadStudioApp\run-dev.cmd` e `LinkPadAgenteApp\run-dev.cmd` iniciam os produtos em desenvolvimento.

Para trabalho paralelo ou uma entrega que sera publicada como Pull Request, parta de uma `main` limpa e atualizada:

```powershell
.\scripts\start-work.ps1 -Branch feat/hardware-cores3
```

O script:

- recusa uma arvore de trabalho com mudancas nao entregues;
- atualiza a visao de `origin`;
- avanca a `main` somente por fast-forward;
- cria uma branch com nome validado;
- publica a branch cedo para tornar o trabalho visivel.

Em uma sequencia local conduzida por uma pessoa, continue na branch de trabalho atual, preserve o worktree e publique somente quando o conjunto estiver coerente. `-NoPublish` pode ser usado para uma tarefa explicitamente local.

## Nomes de Branch

Use um dos prefixos:

```text
feat/
fix/
docs/
studio/
agent/
runtime/
contract/
driver/
build/
security/
```

O restante do nome usa minusculas, numeros e hifens, por exemplo `runtime/touch-navigation`.

## Trabalho Simultaneo

Antes de alterar uma area compartilhada:

```powershell
git fetch origin --prune
git branch -r
```

Consulte tambem Pull Requests abertos quando a ferramenta possuir acesso ao GitHub. Uma branch publicada indica intencao, mas o Pull Request deve explicar arquivos, contratos e possiveis sobreposicoes.

Se outra entrega tocar o mesmo contrato, combine a ordem ou reduza o escopo. Nao substitua arquivos inteiros apenas para evitar um conflito.

## Sincronizacao

Antes da entrega:

```powershell
git fetch origin --prune
git merge origin/main
```

Branches publicadas nao devem ser reescritas. Resolva conflitos preservando os dois objetivos ou solicite uma decisao quando forem incompativeis.

## Validacao

```powershell
.\scripts\validate-work.ps1
```

Opcoes:

```powershell
.\scripts\validate-work.ps1 -All
.\scripts\validate-work.ps1 -Bootstrap
```

`-All` valida Agent, UI e backend Rust independentemente dos arquivos alterados. `-Bootstrap` cria/prepara dependencias locais antes dos testes.

## Entrega

Para uma entrega em branch/PR:

1. Revise `git status` e o diff completo.
2. Atualize os Markdown e changelogs aplicaveis.
3. Faca um commit com um dos tipos da governanca.
4. Envie a branch.
5. Abra um Pull Request usando o template.
6. Aguarde CI e aprovacao humana.

O agente pode preparar branch, commit, push e Pull Request quando estiver autorizado e autenticado. O merge na `main` nunca e automatico.

Para uma iteracao local sequencial, os passos 4 a 6 podem esperar ate o conjunto estar pronto para publicacao. Revisao de diff, documentacao e validacao continuam obrigatorias; o que muda e apenas o momento de criar branch/PR remoto.

## Exemplo de Intencao

Uma solicitacao pode ser curta:

> Integre suporte ao hardware M5Stack CoreS3.

O agente deve descobrir o impacto pelos contratos, implementar a menor fatia vertical utilizavel e registrar como continuacao qualquer widget ou capacidade futura que nao seja necessaria para o suporte inicial.
