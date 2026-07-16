# Visao Geral do LinkPad Agente

## Objetivo

O LinkPad Agente e o executor industrial oficial entre devices LinkPad e PLCs/equipamentos industriais.

Ele expoe o LinkPad Protocol via HTTP/JSON, recebe requisicoes autodescritivas do Device Runtime e seleciona o driver necessario.

## Fluxo Oficial

```text
Studio -> gera runtime com descritores
Device Runtime -> LinkPad Protocol -> LinkPad Agente
LinkPad Agente -> driver selecionado -> alvo industrial
```

Studio e Agente sao independentes. Nao existe pareamento, implantacao de perfil ou dependencia direta entre eles.

## Modelo Orientado a Requisicoes

O novo Agente nao possui:

- PLC global configurado;
- lista persistente de tags do projeto;
- perfil de planta enviado pelo Studio;
- estado global `plc_connected`;
- obrigacao de configurar protocolos na UI Windows.

O Device Runtime envia:

- versao do LinkPad Protocol;
- identidade do device e projeto;
- driver desejado;
- endpoint industrial;
- opcoes de conexao;
- enderecos declarativos de leitura/escrita.

## Responsabilidades

- Servir o LinkPad Protocol HTTP/JSON.
- Validar versao, autenticacao, destino e descritores.
- Criar sessoes efemeras.
- Selecionar o driver industrial.
- Reutilizar conexoes equivalentes em pool.
- Controlar rate limit e capacidade.
- Deduplicar leituras e escritas.
- Enfileirar e confirmar escritas.
- Normalizar valores, qualidade e erros.
- Expor capacidades e diagnostico.
- Permitir driver simulado.
- Rodar com UI minima, headless ou como servico Windows.

## Estado da Implementacao 0.2.0

Estao entregues API, sessoes, pool, drivers `sim` e `siemens-s7`, politica de destinos IPv4, rate limits globais, deduplicacao de escrita, diagnostico local, servico e bandeja.

O S7 serializa operacoes por conexao, reconecta leitura uma vez e confirma escrita sem repeti-la. Deduplicacao de leitura, rate limit por device e outros drivers industriais permanecem no roadmap.

## Plug And Play

A instalacao padrao deve iniciar com configuracao minima e defaults seguros. O usuario nao deve cadastrar PLC, tags ou projeto no Windows.

A UI local existe apenas para operacao do servico, seguranca, rede e diagnostico.

## Referencia Existente

`App Exemplo Agente LinkPad` mostra uma primeira versao funcional com FastAPI, `pycomm3`, PySide6, cache, rate limit e fila de escrita.

O novo Agente deve reaproveitar esses mecanismos, mas substituir o acoplamento a um PLC global por sessoes e descritores enviados pelo Device Runtime.
