# Modelo de Tags no Studio

## Objetivo

Definir como o Studio representa tags industriais.

## Tag LinkPad

Uma tag LinkPad e uma abstracao usada por tela, widget, simulador e runtime.

Exemplo:

```json
{
  "name": "DG01Amp",
  "type": "float",
  "direction": "read",
  "source": "agent",
  "protocolProfileId": "rockwell-main",
  "address": {
    "tag": "DG01Amp"
  },
  "unit": "A",
  "pollMs": 1000,
  "format": "0.0",
  "simulationValue": 12.4,
  "quality": "unknown"
}
```

## Campos

- `name`: nome unico no projeto.
- `type`: `bool`, `int`, `float`, `string`.
- `direction`: `read`, `write`, `readWrite`.
- `source`: `agent`, `internal`, `system`, `simulated`.
- `protocolProfileId`: perfil de `protocols.json` enviado ao Agente ao abrir a sessao.
- `address`: endereco declarativo interpretado pelo driver selecionado.
- `agentTag`: alias legado para projetos `0.1.0`; nao deve ser usado em novos projetos.
- `unit`: unidade visual.
- `pollMs`: ciclo desejado de leitura.
- `min` e `max`: limites de escrita quando aplicavel.
- `scale`: fator opcional.
- `offset`: offset opcional.
- `quality`: estado da leitura.
- `simulationValue`: valor usado somente pelo preview/editor; nao substitui a leitura do Agent no firmware.
- `write`: politica de escrita declarada pelo Studio.

## Qualidade

Valores esperados:

- `good`
- `bad`
- `stale`
- `offline`
- `unknown`

## Escrita

Tags de escrita devem declarar:

```json
{
  "write": {
    "mode": "debounced",
    "debounceMs": 600,
    "confirm": true
  }
}
```

O Studio deve exigir `min`, `max` e confirmacao quando a operacao puder alterar processo industrial de forma sensivel.

## Enderecos Por Driver

Siemens S7 nativo, `DB100.DBD0`:

```json
{
  "protocolProfileId": "siemens-s7-main",
  "type": "float",
  "address": {
    "area": "DB",
    "dbNumber": 100,
    "byteOffset": 0,
    "dataType": "REAL"
  }
}
```

Para `BOOL`, acrescentar `bitOffset` entre 0 e 7. O Studio `0.3.0` permite `BOOL -> bool`, `INT/DINT -> int` e `REAL -> float`; string S7 ainda nao e suportada.

Siemens OPC UA:

```json
{
  "protocolProfileId": "siemens-main",
  "address": {
    "nodeId": "ns=3;s=Motor.Speed"
  }
}
```

Rockwell Logix:

```json
{
  "protocolProfileId": "rockwell-main",
  "address": {
    "tag": "DG01Amp"
  }
}
```

O formato de `address` e validado pelo manifesto/schema do driver conhecido pelo Studio. O Studio nao conhece a biblioteca interna usada pelo Agente.

## Compatibilidade Com Agente

O nome da tag LinkPad e independente do endereco industrial. Essa separacao passa a ser feita por `protocolProfileId` e `address`.

O Studio pode declarar o tipo esperado, mas o Agente deve validar o tipo nativo quando o driver permitir descoberta.

## Implementacao MVP

O CRUD do Studio `0.2.0` permite nome, tipo, direcao, perfil, endereco, unidade, poll, valor de simulacao e faixa numerica. Novas tags usam o perfil `sim-main` e endereco `{"key": "NomeDaTag"}` por padrao.

No Studio `0.3.0`, ao selecionar `siemens-s7`, novas tags recebem area DB, `dbNumber: 1`, offsets iniciais e tipo S7 coerente. A UI permite editar DB/byte/bit/tipo sem digitar JSON.

No Studio `0.4.0`, varios perfis podem ficar habilitados. A tag seleciona o perfil pelo nome e driver, e novas tags usam o primeiro perfil habilitado como default. Trocar o perfil recalcula o endereco inicial conforme o driver. Um perfil com tags vinculadas nao pode ser excluido ate que essas tags sejam reassociadas ou removidas.

O build bloqueia:

- nomes duplicados;
- tag industrial sem perfil/endereco;
- perfil ausente ou desabilitado;
- identificador de perfil duplicado;
- escrita numerica sem `min`/`max`;
- faixa invertida.
- target S7 fora de IPv4 privado/TCP 102;
- endereco S7 invalido ou tipo PLC incompativel.
