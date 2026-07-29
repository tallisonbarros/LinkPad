# Monitoramento, Logs e Diagnostico

## API Publica

`GET /lpp/v1/status` informa:

- estado e versao do servico;
- versao do LinkPad Protocol;
- uptime e drivers instalados;
- sessoes e conexoes ativas;
- contadores de leitura, escrita e deduplicacao.

Nao existe `plc_connected` global.

## API Local

Restrita a `127.0.0.1:8009`:

```text
GET /management/v1/status
GET /management/v1/sessions
GET /management/v1/connections
```

O status local acrescenta metricas e alertas. O diagnostico de sessao mostra `sessionId`, device, projeto, driver, endpoint e TTL. O diagnostico de conexao mostra hash curto, driver, endpoint, referencias e ociosidade.

`auth` e token nunca sao retornados.

## Logs 0.3.0

Arquivo:

```text
%ProgramData%\LinkPad\Agent\logs\agent.log
```

A infraestrutura de rotacao por tamanho esta implementada. Startup do servidor e falhas fatais sao registrados. Respostas por ponto ja distinguem erro, qualidade e possibilidade de repeticao, mas auditoria detalhada de sessao, bloqueio de seguranca e escrita ainda precisa ser acrescentada antes de producao.

## Futuro

- auditoria de criacao/expiracao de sessao, bloqueios de seguranca e escrita;
- exportacao de diagnostico com redacao de segredos;
- metricas por device, target e driver;
- syslog/OpenTelemetry quando houver requisito operacional;
- dashboard somente depois que as metricas publicas estiverem estabilizadas.

O primeiro proximo passo e tornar logs suficientes para reproduzir perda de rede, reconexao e escrita incerta na bancada, sem registrar token, `auth`, senha, chave ou valor industrial marcado como sensivel.
