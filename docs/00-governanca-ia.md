# Governanca Para Agentes de IA

## Objetivo

Definir como agentes de IA, Codex e programadores humanos devem trabalhar no LinkPad sem degradar arquitetura, contratos e documentacao.

O projeto nasce com duas aplicacoes independentes e um runtime embarcado:

- LinkPad Studio: cria projetos industriais, telas, tags, perfis declarativos de protocolo, catalogo de hardware, simulador e firmware.
- Device Runtime: leva no firmware os descritores gerados pelo Studio e solicita operacoes industriais ao Agente.
- LinkPad Agente: expoe o LinkPad Protocol via HTTP/JSON e executa requisicoes por drivers industriais.

## Principio de Separacao

O Studio nao deve falar diretamente com PLC em runtime de producao e nao deve depender de um Agente especifico durante a edicao ou geracao do projeto.

O fluxo oficial e:

```text
LinkPad Studio -> gera projeto/runtime com descritores de protocolo
Device Runtime -> LinkPad Protocol HTTP/JSON -> LinkPad Agente
LinkPad Agente -> seleciona driver e reutiliza conexao efemera -> PLC
```

O novo Agente nao possui um PLC ou projeto configurado globalmente. Cada Device Runtime informa o destino, o driver e os enderecos necessarios. O Agente valida a requisicao e mantem apenas estado operacional, como sessoes efemeras, pool de conexoes, cache, rate limit e filas.

Nao existe pareamento ou envio de configuracao entre Studio e Agente. A independencia entre eles e requisito do produto.

Comunicacao industrial direta do device pode existir no futuro, mas deve ser tratada como capacidade opcional por hardware/protocolo, nao como padrao.

## Papel Dos Exemplos

`App Exemplo M5Stick` e `App Exemplo Agente LinkPad` sao referencias.

Eles servem para entender:

- UI embarcada no M5.
- Polling e escrita de tags.
- API HTTP atual.
- Estado online/offline.
- Cache, deduplicacao, rate limit e fila de escrita.
- Configuracao, instalacao e operacao do agente legado.

Eles nao sao a base final a ser copiada. O novo produto deve reciclar conceitos, nao o modelo legado de um PLC global configurado na UI do Agente.

## Documentacao Como Contrato

Todo Markdown em `docs`, `LinkPadStudioApp/docs` e `LinkPadAgenteApp/docs` tem valor de contrato tecnico.

Uma mudanca de implementacao que contradiz um Markdown deve atualizar o Markdown na mesma entrega.

## Tipos de Mudanca

Use estes tipos ao descrever alteracoes:

- `docs`: documentacao apenas.
- `studio`: mudanca no LinkPad Studio.
- `agent`: mudanca no LinkPad Agente.
- `runtime`: mudanca no firmware/runtime embarcado.
- `contract`: mudanca em contrato entre componentes.
- `driver`: mudanca em driver industrial.
- `build`: mudanca em build, deploy, empacotamento ou instalacao.
- `security`: mudanca em token, whitelist, autenticacao, autorizacao ou hardening.

## Criterio de Pronto

Uma tarefa so esta pronta quando:

- Codigo e docs estao coerentes.
- Contratos impactados foram revisados.
- Comportamentos offline e erro foram considerados.
- Compatibilidade com MVP foi preservada ou a quebra foi documentada.
- O resumo final indica validacao executada.
