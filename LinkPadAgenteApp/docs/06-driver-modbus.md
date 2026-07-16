# Driver Modbus

## Objetivo

Definir direcao para suporte Modbus no LinkPad Agente.

## Protocolos

Prioridade:

1. Modbus TCP.
2. Modbus RTU via serial/RS485.

## Modelo de Tag Modbus

O Device Runtime deve enviar um descritor de target e enderecos por ponto.

Target:

```json
{
  "driver": "modbus-tcp",
  "endpoint": "192.168.0.30:502",
  "options": {
    "timeoutMs": 1500
  }
}
```

Endereco de ponto:

```json
{
  "unitId": 1,
  "area": "holding_register",
  "address": 40001,
  "type": "uint16",
  "scale": 0.1,
  "offset": 0
}
```

## Areas

- coil.
- discrete_input.
- input_register.
- holding_register.

## Tipos

- bool.
- int16.
- uint16.
- int32.
- uint32.
- float32.
- string futuro.

## Pontos de Atencao

- Enderecamento 0-based vs 1-based.
- Ordem de words.
- Ordem de bytes.
- Escala.
- Conversao de tipo.
- Timeout por device.

## MVP

O primeiro suporte Modbus deve ser um driver do Agente. O M5 envia descritores LinkPad Protocol e nao implementa Modbus.
