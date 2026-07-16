# Integracao Com LinkPad Agente HTTP

## Objetivo

Definir como o Device Runtime gerado pelo Studio conversa com o LinkPad Agente sem pareamento e sem configuracao de projeto no Windows.

```text
linkpad-protocol: 0.1.0
```

## Fluxo Oficial

```text
Studio -> gera runtime com perfis e tags
Device Runtime -> abre sessao com target -> LinkPad Agente
Device Runtime -> le/escreve address -> sessao efemera
LinkPad Agente -> driver selecionado -> alvo industrial
```

O Studio nunca envia configuracao diretamente ao Agente.

O botao `Testar Agent` do Studio e apenas um diagnostico de leitura de `status` e `capabilities`. Ele nao pareia, nao cria sessao industrial e nao altera configuracao no Agent.

O botao `Testar conexao`, na tela Conectores, e diferente: por acao explicita ele cria uma sessao temporaria com o perfil atual e a encerra em seguida. Ele valida Agent, politica, driver, endpoint e handshake do PLC, mas nao envia `address`, nao chama `/read` ou `/write` e nao valida DB/tag. A operacao nao persiste perfil no Agent e nao constitui pareamento.

## Endpoints

```text
GET    /lpp/v1/status
GET    /lpp/v1/capabilities
POST   /lpp/v1/sessions
DELETE /lpp/v1/sessions/{sessionId}
POST   /lpp/v1/read
POST   /lpp/v1/write
```

Quando houver token no runtime:

```text
X-LINKPAD-TOKEN: token
```

## Descoberta

`GET /lpp/v1/status` devolve `service`, `state`, `version`, `protocolVersion`, `drivers`, `activeSessions` e `pooledConnections`.

`GET /lpp/v1/capabilities` e dinamico. O Agent `0.2.0` anuncia `sim` e `siemens-s7`; o runtime nao deve presumir outros conectores sem encontra-los na resposta.

## Criar Sessao

```json
{
  "contractVersion": "0.1.0",
  "deviceId": "linkpad-001",
  "projectId": "projeto-envase",
  "target": {
    "driver": "sim",
    "endpoint": "memory://linha-1",
    "options": {}
  }
}
```

Target S7 nativo:

```json
{
  "contractVersion": "0.1.0",
  "deviceId": "linkpad-001",
  "projectId": "projeto-envase",
  "target": {
    "driver": "siemens-s7",
    "endpoint": "s7://192.168.0.10:102",
    "options": {"rack": 0, "slot": 1, "timeoutMs": 2000}
  }
}
```

Resposta `201`:

```json
{
  "ok": true,
  "status": "ok",
  "contractVersion": "0.1.0",
  "sessionId": "session-abc123",
  "state": "ready",
  "expiresIn": 300,
  "expiresInSeconds": 300,
  "driver": "sim"
}
```

## Leitura

```json
{
  "requestId": "read-0001",
  "sessionId": "session-abc123",
  "points": [
    {
      "id": "MotorSpeed",
      "address": {"key": "Motor.Speed"},
      "type": "float"
    }
  ]
}
```

Resposta:

```json
{
  "ok": true,
  "status": "ok",
  "requestId": "read-0001",
  "values": [
    {
      "id": "MotorSpeed",
      "status": "ok",
      "value": 45.2,
      "valor": 45.2,
      "quality": "good",
      "timestamp": "2026-07-15T12:00:00Z"
    }
  ]
}
```

`value` e canonico. `valor` permanece como alias temporario.

Ponto S7 para `DB100.DBD0`:

```json
{
  "id": "MotorSpeed",
  "type": "float",
  "address": {"area": "DB", "dbNumber": 100, "byteOffset": 0, "dataType": "REAL"}
}
```

O Studio valida `BOOL/bool`, `INT|DINT/int` e `REAL/float`. O Agent repete uma leitura apenas uma vez depois de recriar uma conexao perdida.

## Escrita

```json
{
  "requestId": "write-0001",
  "sessionId": "session-abc123",
  "writes": [
    {
      "id": "MotorSpeedSetpoint",
      "address": {"key": "Motor.SpeedSetpoint"},
      "type": "float",
      "value": 45,
      "min": 0,
      "max": 60
    }
  ]
}
```

O retorno usa `results`, `status: written`, `value`, `valor`, `quality` e `timestamp`. `requestId` e obrigatorio e deve ser reutilizado somente ao repetir exatamente a mesma intencao de escrita. Outro payload com o mesmo identificador retorna `409`.

Para S7, cada escrita e seguida por leitura de confirmacao. Se o transporte falhar depois do envio, o resultado do ponto usa `quality: uncertain`, `write_confirmation_failed` e `retryable: false`. O runtime nao deve criar um novo `requestId` para repetir automaticamente esse caso.

O runtime nao interpreta HTTP 200 isoladamente como sucesso. `status: partial` preserva o ultimo valor valido e marca `tag_stale`; um resultado de escrita diferente de `written` marca `write_failed`.

## Fechar e Recriar Sessao

`DELETE /lpp/v1/sessions/{sessionId}` retorna `200` com `closed` ou `already_closed`.

No teste do conector, o Studio chama esse DELETE imediatamente depois do `201`. O Agent pode conservar a conexao fisica sem referencias ate o TTL do pool, mas a sessao diagnostica deixa de existir.

Quando a sessao retornar `404`/`410` ou o Agente reiniciar, o runtime deve:

1. invalidar o `sessionId` local;
2. aplicar backoff curto;
3. recriar a sessao com o target incorporado;
4. retomar operacoes seguras.

O runtime M5 gerado em `0.4.0` implementa esse fluxo de forma independente para cada perfil habilitado. Ele mantem `sessionId`, retry e estado de tags por `protocolProfileId`; `404`/`410` invalida somente a sessao afetada.

Leituras sao agrupadas por perfil para que cada lote use a sessao industrial correta. Escritas localizam o perfil da tag e usam o respectivo `sessionId`. Uma falha de PLC/tag nao transforma o estado HTTP do Agent em offline: no runtime `0.5.0`, o icone do Agent representa apenas o alcance HTTP do gateway.

## Erros e Backoff

- `400`: payload invalido;
- `401`: token invalido;
- `403`: device/driver nao permitido;
- `404`/`410`: recriar sessao;
- `409`: corrigir colisao de `requestId` sem repetir automaticamente;
- `422`: versao, driver ou target nao suportado;
- `429`: aplicar backoff;
- `503`: Agent ocupado, aplicar backoff.

## Compatibilidade Legada

Os endpoints antigos ainda nao estao implementados no novo Agente. O alias `valor` ja esta disponivel no LinkPad Protocol. `X-LYNK-TOKEN` permanece reservado ao futuro adaptador legado.
