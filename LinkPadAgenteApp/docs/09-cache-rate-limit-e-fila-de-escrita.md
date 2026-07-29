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

## Concorrencia OPC UA em 0.3.0

- `asyncua` opera de forma assincrona no loop do Agent;
- cada conexao possui lock proprio para preservar sessao e cache de NodeIds/tipos;
- sessoes equivalentes podem compartilhar a conexao;
- leitura pode substituir a conexao e repetir uma vez depois de falha de transporte;
- escrita nunca e repetida e so conclui depois da releitura.

## Prioridade de Robustez

1. metricas e limites por device/sessao/target;
2. cache de leitura com idade/qualidade explicitas;
3. timeout de confirmacao realmente aplicado pelo core/driver;
4. auditoria de escrita sem expor segredos;
5. testes de carga, cancelamento e shutdown com varios PLCs.

Fila persistente nao e prioridade do MVP: uma escrita industrial ambigua nao pode ser repetida depois de reinicio sem uma politica de aplicacao explicita.
