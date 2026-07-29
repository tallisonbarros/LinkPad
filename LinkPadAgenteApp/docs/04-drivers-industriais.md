# Drivers Industriais

## Objetivo

Definir a camada de drivers industriais orientada a descritores e sessoes.

## Interface Conceitual

Todo driver deve implementar:

```text
id()
capabilities()
validate_target(target)
validate_address(address, operation)
connection_key(target)
connect(target)
disconnect(connection)
health_check(connection)
read(connection, points)
write(connection, writes)
browse(connection, query)
```

O driver recebe `target` enviado pelo Device Runtime. Ele nao le uma configuracao global de PLC.

`read` e `write` formam o contrato obrigatorio do MVP. `browse` e uma capacidade opcional e so deve ser anunciada quando existir endpoint LinkPad Protocol correspondente em versao futura.

## Interface Implementada 0.3.0

```text
id
display_name
capability()
validate_target(target)
connect(target)
disconnect(connection)
network_endpoint(target)
read(connection, point_id, address, declared_type)
write(connection, point_id, address, value, declared_type)
```

O core calcula a chave SHA-256 do target completo para impedir compartilhamento entre credenciais diferentes. Diagnosticos mostram apenas os primeiros caracteres desse hash.

`health_check` e `browse` permanecem futuros. O driver S7 valida target/endereco/tipo e implementa reconexao controlada de leitura.

## Drivers

- `sim`: implementado no core e usado pelos testes.
- `siemens-s7`: implementado para S7-1200/S7-1500, TCP 102 e enderecos absolutos de DB.
- `opcua`: implementado com Node ID e tipos escalares; validado primeiro com servidor `asyncua` e preparado para S7-1200/1500.
- `rockwell-logix`: integracao validada pelo prototipo, baseada em `pycomm3`.
- `modbus-tcp`: leitura/escrita de coils e registers.
- `modbus-rtu`: futuro via serial/RS485.
- `profinet-io`: futuro e distinto de OPC UA.

## Descritor de Destino

Formato base:

```json
{
  "driver": "driver-id",
  "endpoint": "driver-specific-endpoint",
  "options": {},
  "auth": {}
}
```

`auth` e opcional, sensivel e efemero.

## Responsabilidades do Driver

O driver deve conhecer:

- protocolo e biblioteca;
- endpoint e opcoes recebidos;
- schema de endereco;
- tipos nativos e conversao;
- erros especificos;
- estrategia de health check.

O driver nao deve conhecer:

- UI.
- Widgets.
- Layout de tela.
- Estrutura interna do Studio.
- Persistencia de projeto.

## Connection Pool

Na versao atual, o core fornece uma `connection_key` deterministica sem expor segredos. O pool usa essa chave para reutilizar conexoes equivalentes entre sessoes autorizadas.

Uma requisicao autodescritiva nao significa abrir conexao industrial a cada leitura.

No S7, a conexao compartilhada possui lock proprio: duas sessoes podem reutiliza-la, mas as operacoes no socket sao executadas em serie. Como `python-snap7 3.0.0` publica cliente sincrono, as chamadas rodam em worker thread e nao bloqueiam o loop HTTP.

No OPC UA, `asyncua 2.0.1` executa de forma assincrona. O MVP tambem usa lock por conexao, resolve namespaces `nsu=` e mantem cache efemero de NodeIds/tipos. Leitura pode reconectar uma vez; escrita nunca e repetida e exige releitura de confirmacao.

Estado atual:

| Driver | Agent | Studio | Validacao |
| --- | --- | --- | --- |
| `sim` | ativo | ativo | M5 ponta a ponta |
| `siemens-s7` | ativo | ativo | S7-1200 real em handshake/leitura |
| `opcua` | ativo | ativo | servidor real automatizado; S7 fisico pendente |
| `rockwell-logix` | futuro | desabilitado | somente prototipo legado validado |
| `modbus-tcp` | futuro | desabilitado | contrato preliminar |
| `profinet-io` | futuro | desabilitado | decisao de papel/certificacao pendente |

## Erros Normalizados

- destino indisponivel;
- timeout;
- descritor invalido;
- endereco invalido;
- valor ou tipo invalido;
- operacao nao suportada;
- autenticacao industrial falhou;
- erro interno.

Erros do driver podem acrescentar `quality` e `retryable` ao resultado individual. Escrita S7 sem confirmacao usa qualidade `uncertain` e nunca e marcada automaticamente como repetivel.

## Ordem de Evolucao

1. fechar escrita/reconexao prolongadas nos drivers Siemens reais;
2. acrescentar seguranca OPC UA de producao;
3. definir browse/teste de ponto no LinkPad Protocol;
4. adaptar Rockwell Logix do prototipo;
5. implementar Modbus TCP;
6. avaliar PROFINET IO apenas com papel e tecnologia definidos.

Novo driver deve chegar com capability, validacao de target/address, politica de rede, erros normalizados, testes e empacotamento. O Studio permanece desabilitado ate essa fatia existir.
