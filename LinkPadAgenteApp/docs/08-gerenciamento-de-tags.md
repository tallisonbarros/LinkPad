# Gerenciamento de Tags no Agente

## Objetivo

Definir como o Agente valida e executa pontos enviados por sessoes LinkPad Protocol.

## Tag no Agente

O novo Agente nao mantem uma lista persistente de tags do projeto. Um ponto existe no contexto de uma requisicao e referencia um endereco declarativo.

Exemplo:

```json
{
  "id": "DG01Amp",
  "address": {
    "tag": "DG01Amp"
  },
  "type": "float"
}
```

## Relacao Com Studio

O Studio define o nome logico, o perfil e o endereco. O runtime envia esses dados. O Agente nao precisa conhecer o nome usado pelo widget ou pelo PLC fora da requisicao.

No runtime `0.4.0`, tags sao agrupadas por `protocolProfileId` antes da chamada HTTP. Cada lote chega ao Agent com o `sessionId` do perfil correspondente; o Agent continua recebendo apenas pontos autodescritivos e nao persiste esse vinculo.

Campos de engenharia como `unit`, `format`, `pollMs`, `simulationValue` e a configuracao visual do widget pertencem ao Studio/runtime. O runtime envia ao Agent apenas `id`, `address`, `type` e, em escrita, `value`, `min` e `max` conforme o LinkPad Protocol.

## Descoberta

Quando o driver permitir, o Agente pode oferecer `browse` como capacidade de sessao.

Para Logix, isso pode usar listagem de tags do PLC.

Para Modbus, os enderecos normalmente sao definidos no Studio e incorporados ao runtime.

## Qualidade

O Agente deve informar qualidade:

- `good`
- `bad`
- `stale`
- `offline`
- `unknown`

O driver `sim` entregue em `0.1.0` retorna `good`. Os demais estados serao normalizados quando entrarem drivers de rede.

O driver `siemens-s7` usa `good` no sucesso, `offline` quando uma leitura nao consegue reconectar e `uncertain` quando nao e possivel confirmar se uma escrita chegou ao PLC.

## Cache

O Agente pode manter cache efemero por chave de conexao/endereco para reduzir carga no PLC.

Cache nao deve esconder falhas por tempo indefinido. O retorno deve indicar qualidade ou idade do dado quando possivel.

## Escrita

Antes de escrever:

- Validar permissao.
- Validar tipo.
- Validar faixa quando configurada.
- Enfileirar ou aplicar conforme politica.
- Deduplicar por `requestId`.

Em `0.2.0`, faixa numerica e deduplicacao continuam no core. O S7 valida tipo LinkPad contra `BOOL`, `INT`, `DINT` ou `REAL`, serializa as operacoes por conexao e confirma a escrita por leitura. Permissao por ponto continua futura.

Exemplo S7:

```json
{
  "id": "MotorSpeed",
  "type": "float",
  "address": {"area": "DB", "dbNumber": 100, "byteOffset": 0, "dataType": "REAL"}
}
```
