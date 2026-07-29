# LinkPad Studio - Entrada Para Agentes de IA

Este arquivo e a entrada obrigatoria para qualquer agente de IA ou programador que trabalhe neste repositorio.

O projeto esta dividido em dois produtos principais:

- `LinkPadStudioApp`: ambiente de engenharia usado para criar projetos, telas, tags, catalogos de hardware, simulacao e geracao de runtimes.
- `LinkPadAgenteApp`: agente/gateway industrial orientado a requisicoes. Ele expoe o LinkPad Protocol via HTTP/JSON e executa descritores enviados pelo Device Runtime. Estao implementados `sim`, Siemens S7 nativo e OPC UA generico; Rockwell, Modbus e PROFINET permanecem evolucoes.

Quando presentes no ambiente local, as pastas `App Exemplo M5Stick` e `App Exemplo Agente LinkPad` sao referencias funcionais. Elas sao ignoradas pelo Git, nao fazem parte do clone colaborativo e nao devem ser alteradas sem pedido explicito do usuario. Nenhuma tarefa pode depender da existencia dessas pastas.

## Regra Principal

Toda alteracao de codigo que muda comportamento, contrato, configuracao, fluxo de build, runtime, API, tag, protocolo ou arquitetura deve atualizar a documentacao correspondente no mesmo PR/commit.

Se uma mudanca nao exige atualizacao de Markdown, o agente deve declarar isso no resumo final e explicar por que.

## Leitura Obrigatoria Antes de Alterar Codigo

Antes de implementar qualquer mudanca, leia:

1. `docs/00-governanca-ia.md`
2. `docs/01-contratos-de-mudanca.md`
3. `docs/02-versionamento.md`
4. `docs/05-fluxo-colaboracao.md`
5. `docs/06-estado-atual-e-proximos-passos.md`
6. O documento da area alterada em `LinkPadStudioApp/docs` ou `LinkPadAgenteApp/docs`

Para mudancas entre device e agente, leia tambem:

1. `LinkPadStudioApp/docs/07-integracao-com-agent-http.md`
2. `LinkPadAgenteApp/docs/02-api-http-device-agent.md`

## Fluxo de Trabalho

O repositorio aceita trabalho sequencial ou simultaneo. Nao imponha branch/PR novo quando uma unica pessoa estiver conduzindo iteracoes locais na linha atual; use isolamento remoto quando houver paralelismo real, revisao ou publicacao.

Sempre:

1. Inspecione `git status` e a branch atual sem descartar mudancas existentes.
2. Leia os contratos e delimite a menor fatia vertical que entrega o objetivo.
3. Preserve alteracoes existentes e nao use descarte em massa, force push ou reescrita de historico.
4. Atualize documentacao e consumidores de qualquer contrato alterado.
5. Execute validacao proporcional e revise diff, segredos e artefatos antes da entrega.

No modo sequencial:

- continue na branch/worktree atual fornecida pelo usuario ou ambiente;
- nao faca fetch, commit, push, troca de branch ou Pull Request sem necessidade/autorizacao;
- publique o conjunto apenas quando estiver coerente.

No modo simultaneo ou em uma entrega para revisao remota:

- atualize a visao de `origin`, verifique branches/PRs sobrepostos e use uma branch curta por objetivo;
- publique cedo quando autorizado e integre a base antes da entrega;
- prepare Pull Request e CI; merge na `main` continua sendo decisao humana.

Se o ambiente gerencia worktree ou branch automaticamente, respeite esse isolamento. O fluxo completo e canonico em `docs/05-fluxo-colaboracao.md`.

## Contratos Canonicos

Os contratos canonicos do projeto sao:

- LinkPad Protocol Device-Agent: `LinkPadAgenteApp/docs/02-api-http-device-agent.md`
- Integracao Studio-Agent: `LinkPadStudioApp/docs/07-integracao-com-agent-http.md`
- Modelo de tags no Studio: `LinkPadStudioApp/docs/06-modelo-de-tags.md`
- Gerenciamento de tags no Agente: `LinkPadAgenteApp/docs/08-gerenciamento-de-tags.md`
- Catalogo de hardwares: `LinkPadStudioApp/docs/03-catalogo-de-hardwares.md`
- Runtime embarcado: `LinkPadStudioApp/docs/04-runtime-device.md`
- Configuracao do Agente: `LinkPadAgenteApp/docs/03-modelo-de-configuracao.md`
- Colaboracao sequencial ou simultanea: `docs/05-fluxo-colaboracao.md`

Quando dois documentos descrevem o mesmo contrato, eles devem permanecer consistentes.

## Regras Para Agentes Codex

- Nao altere `App Exemplo M5Stick` nem `App Exemplo Agente LinkPad` salvo instrucao explicita.
- Nao introduza protocolo industrial direto no device como padrao. O padrao e `Device Runtime -> LinkPad Protocol HTTP/JSON -> LinkPad Agent -> PLC`.
- Nao acople o Studio a bibliotecas ou detalhes internos de um driver PLC. O Studio conhece perfis declarativos de protocolo, tags, devices, telas e o LinkPad Protocol; o Agente conhece e executa os drivers industriais.
- Nao introduza configuracao global de PLC, tags ou projeto como requisito do novo Agente. O Device Runtime envia o descritor de destino e os enderecos pelo LinkPad Protocol.
- Nao introduza pareamento ou dependencia direta entre Studio e Agente. Ambos devem poder ser instalados, configurados e executados independentemente.
- O Agente pode manter sessoes efemeras, pool de conexoes, cache e filas internamente, mas esses estados nao constituem configuracao persistente de projeto.
- Nao remova compatibilidade com `valor` nas respostas HTTP enquanto o runtime M5 legado depender dela. O contrato novo deve preferir `value` e manter `valor` como alias temporario.
- Mudancas em endpoint exigem atualizacao dos docs de API nos dois lados.
- Mudancas em tag exigem atualizacao dos docs de modelo de tags nos dois lados.
- Mudancas em firmware/runtime exigem atualizacao dos docs de runtime e geracao de firmware.
- Mudancas em build/deploy exigem atualizacao do roadmap ou documento operacional correspondente.
- Mudancas arquiteturais exigem decisao registrada em `docs/01-contratos-de-mudanca.md` ou documento de arquitetura aplicavel.

## Checklist Antes de Finalizar Uma Tarefa

- A mudanca respeita a separacao Studio, Runtime e Agente?
- Os Markdown afetados foram atualizados?
- Os exemplos existentes foram preservados?
- Quando houve paralelismo/publicacao, a tarefa foi isolada e sincronizada com a base?
- Quando houve Pull Request, ele descreve sobreposicoes, validacoes e continuacoes?
- O contrato HTTP segue compatibilidade `value` e `valor` quando aplicavel?
- O modo simulado continua possivel?
- Estados de erro, offline, timeout e permissao foram considerados?
- A alteracao tem caminho de migracao ou nota de versionamento?

## Padrao de Resumo Final

Ao concluir, informe:

- Arquivos alterados.
- Contratos afetados.
- Markdown atualizados.
- Testes ou validacoes executadas.
- Riscos restantes.
- Branch publicada e Pull Request, quando fizerem parte da entrega autorizada.
