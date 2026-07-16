# Cache, Rate Limit e Fila de Escrita

## Implementado em 0.1.0

- limite global de leituras por segundo;
- limite global de escritas por segundo;
- limite de requisicoes simultaneamente pendentes;
- deduplicacao de escrita por `deviceId` e `requestId`;
- janela de deduplicacao configurada por `dedupWindowMs`;
- resposta de escrita somente depois que o driver retorna confirmacao ou falha;
- isolamento de falha por item do lote.

Rate limit retorna `429`. Saturacao do limite de pendencias retorna `503`.

## Estado Efemero

Os limites, a tabela de deduplicacao, as sessoes e o pool existem apenas em memoria. Reiniciar o servico limpa todo esse estado.

## Ainda Nao Implementado

- cache ou deduplicacao de leituras;
- limites por device, sessao ou target;
- fila persistente/ordenada por conexao;
- timeout `writeConfirmTimeoutMs` aplicado pelo core;
- estados publicos enfileirada/em execucao/cancelada;
- historico recente de operacoes.

Drivers futuros podem exigir serializacao por conexao. Essa fila deve preservar confirmacao e deduplicacao sem transformar o Agente em armazenamento de projeto.

## Concorrencia de Conexao em 0.2.0

- o mapa do pool usa lock global somente para operacoes curtas em memoria;
- cada target possui lock proprio para impedir conexao duplicada;
- targets diferentes podem conectar em paralelo;
- o Session Manager nao segura seu lock enquanto `driver.connect()` aguarda a rede;
- fechamento ocioso e shutdown retiram entradas sob lock e desconectam fora do lock global.

Essa separacao e necessaria para que um teste de conector ou PLC offline nao interrompa leituras de sessoes ja ativas.
