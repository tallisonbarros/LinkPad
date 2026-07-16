# Simulador do Studio

## Objetivo

Permitir testar telas, tags e estados antes de gravar no hardware.

## Funcoes MVP

- Renderizar tela no tamanho real do hardware.
- Simular tags.
- Simular estados online/offline.
- Simular erro de token/whitelist.
- Simular PLC offline.
- Simular escrita pendente.
- Simular botoes fisicos.

## Fontes de Dados

O simulador pode usar:

- Valores manuais.
- Sequencias temporais.
- Driver `sim` do Agente por uma sessao LinkPad Protocol normal.
- Snapshots de diagnostico.

## Implementacao 0.2.0

O preview do editor usa `simulationValue` das tags e permite visualizar os cinco widgets implementados. O driver `sim` do Agent e usado pelo firmware gerado, no mesmo campo de conector em que futuramente serao selecionados Siemens/Rockwell.

Ainda nao implementado no preview do Studio: sessao HTTP real, sequencias temporais, expiracao forcada, simulacao de botoes e estados detalhados de falha.

## Estados Simulados

- Agente online.
- Agente offline.
- Target industrial conectado.
- Target industrial desconectado.
- Tag stale.
- Escrita confirmada.
- Escrita com timeout.
- Sessao expirada e recriacao de sessao.
- Driver nao suportado pelo Agente.

## Validacao Visual

O simulador deve avisar:

- Texto cortado.
- Widget fora da tela.
- Contraste ruim.
- Acao indisponivel no hardware.
