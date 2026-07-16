# Modo Simulador

## Objetivo

Permitir desenvolvimento e testes sem PLC real.

## Uso

O simulador e selecionado pelo target enviado pelo Device Runtime:

```json
{
  "target": {
    "driver": "sim",
    "endpoint": "memory://default",
    "options": {}
  }
}
```

## Comportamento

O simulador deve:

- responder leituras.
- aceitar escritas.
- manter valores escritos em memoria.
- gerar valores fake quando nao houver valor.
- expor status online.
- participar do mesmo fluxo de sessao, leitura e escrita dos drivers reais.

Todos esses comportamentos estao implementados em `0.1.0`. Valores ficam associados a conexao `memory://...` e podem ser compartilhados por sessoes que reutilizem o mesmo target.

## Tags Simuladas

Regras iniciais podem ser baseadas no nome:

- enderecos terminados em `Amp`, `Hz`, `Current` ou `Speed`: numero decimal deterministico;
- enderecos terminados em `Alarme`, `Alarm`, `Select` ou `Enabled`: booleano `false`;
- demais enderecos: zero.

Uma escrita substitui o valor inicial e leituras seguintes devolvem o valor escrito.

## Integracao Com Studio

O Studio gera um perfil `sim`; o Device Runtime abre uma sessao normal no Agente. Nao existe configuracao manual do simulador no Windows.
