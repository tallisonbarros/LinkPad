# API HTTP Device-Agent: LinkPad Protocol

## Objetivo

Definir o contrato HTTP/JSON entre Device Runtime e LinkPad Agente.

Versao implementada:

```text
linkpad-protocol: 0.1.0
```

O contrato nao depende do Studio em runtime e nao exige configuracao de PLC ou projeto no Agente.

## Endpoints Publicos

```text
GET    /lpp/v1/status
GET    /lpp/v1/capabilities
POST   /lpp/v1/sessions
DELETE /lpp/v1/sessions/{sessionId}
POST   /lpp/v1/read
POST   /lpp/v1/write
```

O servidor publico usa `0.0.0.0:8008` por padrao.

## Seguranca HTTP

Quando `security.token` estiver preenchido, todos os endpoints publicos exigem:

```text
X-LINKPAD-TOKEN: token
```

A versao `0.1.0` aplica token, whitelist de `deviceId`, whitelist de drivers, limites globais, limite de sessoes e politica de rede. O Agent `0.2.0` instala `sim` e `siemens-s7`; este ultimo exige IPv4 permitido e TCP 102.

## GET /lpp/v1/status

O status representa o servico, sem um PLC global:

```json
{
  "ok": true,
  "status": "ok",
  "service": "online",
  "state": "ready",
  "product": "LinkPad Agent",
  "version": "0.2.0",
  "protocolVersion": "0.1.0",
  "startedAt": "2026-07-15T12:00:00Z",
  "uptime": 120.5,
  "drivers": ["sim", "siemens-s7"],
  "activeSessions": 2,
  "pooledConnections": 1,
  "reads": 10,
  "writes": 2,
  "dedupHits": 1,
  "rateLimitBlocks": 0,
  "lastError": ""
}
```

## GET /lpp/v1/capabilities

As capacidades sao dinamicas. O Agent `0.2.0` anuncia `sim` e `siemens-s7`:

```json
{
  "ok": true,
  "status": "ok",
  "protocolVersion": "0.1.0",
  "protocol": {
    "id": "linkpad-protocol",
    "version": "0.1.0",
    "supportedVersions": ["0.1.0"]
  },
  "drivers": [
    {
      "id": "sim",
      "displayName": "Simulador LinkPad",
      "operations": ["read", "write"],
      "addressSchemaVersion": "0.1.0",
      "target": {"endpointScheme": "memory"},
      "pointFields": ["key", "address", "nodeId", "tag"]
    },
    {
      "id": "siemens-s7",
      "displayName": "Siemens S7 nativo",
      "operations": ["read", "write"],
      "addressSchemaVersion": "0.2.0",
      "target": {
        "endpointScheme": "s7",
        "defaultPort": 102,
        "options": ["rack", "slot", "timeoutMs"]
      },
      "point": {
        "areas": ["DB"],
        "dataTypes": ["BOOL", "INT", "DINT", "REAL"]
      }
    }
  ],
  "limits": {
    "maxSessions": 100,
    "readRps": 50,
    "writeRps": 10
  }
}
```

Outros conectores Siemens e Rockwell so devem aparecer quando seus drivers forem instalados e funcionais.

## POST /lpp/v1/sessions

Cria uma sessao efemera e abre ou reutiliza uma conexao equivalente.

Request implementado no driver `sim`:

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

O descritor pode conter `auth`, mas ele nunca aparece nos diagnosticos. A sessao e a conexao sao perdidas no reinicio e devem ser recriadas pelo device.

Um mesmo `deviceId`/`projectId` pode criar varias sessoes simultaneas, uma por perfil industrial incorporado no runtime. O Agent trata cada sessao de forma independente e pode reutilizar conexoes quando os targets forem equivalentes.

Request implementado no driver S7:

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

O S7 nativo rejeita `auth`, hostname, IPv6, porta diferente de 102 e rede nao liberada.

O Studio pode usar a mesma operacao para o botao explicito `Testar conexao` do perfil. Nesse caso ele envia apenas target/device/projeto, nao executa `/read` nem `/write` e encerra a sessao imediatamente. Isso e um diagnostico efemero, nao pareamento ou configuracao do Agent.

## DELETE /lpp/v1/sessions/{sessionId}

Encerra a sessao. A operacao e idempotente e responde `200`:

```json
{
  "ok": true,
  "status": "closed",
  "sessionId": "session-abc123"
}
```

Se ela ja nao existir, `status` sera `already_closed`.

Fechar a sessao reduz a referencia da conexao. A conexao fisica pode permanecer ociosa no pool ate `idleConnectionTtlSeconds`, permitindo reutilizacao, mas nenhuma sessao de teste permanece ativa.

Em runtime multi-conectores, expirar ou fechar uma sessao nao invalida as sessoes dos outros perfis.

## POST /lpp/v1/read

`address` e o descritor canonico interpretado pelo driver:

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

Falhas isoladas usam `status: partial` no lote e `status: error` no item.

Leitura S7 de `DB100.DBD0`:

```json
{
  "requestId": "read-s7-1",
  "sessionId": "session-abc123",
  "points": [{
    "id": "MotorSpeed",
    "type": "float",
    "address": {"area": "DB", "dbNumber": 100, "byteOffset": 0, "dataType": "REAL"}
  }]
}
```

## POST /lpp/v1/write

`requestId` e obrigatorio. `value` e canonico e `valor` e aceito como alias temporario.

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

Resposta:

```json
{
  "ok": true,
  "status": "ok",
  "requestId": "write-0001",
  "results": [
    {
      "id": "MotorSpeedSetpoint",
      "status": "written",
      "value": 45,
      "valor": 45,
      "quality": "good",
      "timestamp": "2026-07-15T12:00:00Z"
    }
  ]
}
```

Valores numericos respeitam `min` e `max` quando informados. Repeticoes da mesma intencao e do mesmo `requestId` para o mesmo device, dentro de `dedupWindowMs`, recebem a resposta armazenada sem repetir a escrita. Reutilizar o identificador com outro payload retorna `409`.

No S7, o sucesso so e devolvido depois de ler o valor gravado. Falha de confirmacao retorna um resultado individual com `quality: "uncertain"`, `error.code: "write_confirmation_failed"` e `error.retryable: false`; o Agent nao repete essa escrita automaticamente.

## Erros

Formato comum:

```json
{
  "ok": false,
  "status": "error",
  "error": {
    "code": "session_not_found",
    "message": "Sessao nao encontrada."
  }
}
```

Codigos HTTP usados em `0.1.0`:

- `400`: corpo invalido;
- `401`: token ausente ou incorreto;
- `403`: device ou driver nao permitido;
- `404`: sessao desconhecida;
- `409`: `requestId` reutilizado com outro payload;
- `410`: sessao expirada;
- `422`: versao, driver ou target nao suportado;
- `429`: limite de sessoes ou taxa atingido;
- `503`: excesso de requisicoes pendentes.
- `503`: driver/target temporariamente offline durante a abertura da sessao, com erro JSON `target_offline`, `quality: offline` e `retryable: true`.

## API Local de Gerenciamento

A bandeja usa uma API separada, restrita por validacao de configuracao a `127.0.0.1:8009`:

```text
GET /management/v1/status
GET /management/v1/sessions
GET /management/v1/connections
```

Ela nao faz parte do contrato Device-Agent e nao deve ser exposta na rede.

## Compatibilidade Legada

O campo `valor` esta implementado como alias. Os endpoints antigos `/status`, `/read_tag`, `/read_tags` e `/write_tag` ainda nao fazem parte da versao `0.1.0`; `legacy.enabled` permanece reservado e desabilitado.
