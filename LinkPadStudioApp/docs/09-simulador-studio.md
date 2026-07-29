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

O preview do editor usa `simulationValue` das tags e permite visualizar os sete widgets implementados. O driver `sim` do Agent e usado pelo firmware gerado, no mesmo campo de comunicacao usado por PLCs reais.

No Studio `0.10.0`, o preview tambem usa o seletor canonico, mostra o overlay Wi-Fi/Agent, aceita Tags internas/externas e recebe novos widgets pelo painel direito de Contexto. Na evolucao atual, selecionar um unico widget mostra diretamente suas propriedades na secao inferior desse painel, sem cobrir o canvas. O canvas oferece zoom, grade, snap, selecao multipla, marquee, resize, alinhamento e historico. `simulationValue` continua sendo apenas dado de preview; a comunicacao `sim` do firmware continua uma sessao real no Agent.

No Studio `0.14.0`, o preview acrescenta grupos/camadas, grade configuravel, guias inteligentes, medidor, barra de progresso e marcadores de auditoria. Esses recursos de engenharia nao simulam rede nem PLC e nao alteram o valor real mantido pelo driver `sim`.

Na ausencia de valor simulado, widgets mostram placeholder de acordo com o tipo e nunca o endereco industrial. Tamanho de fonte, cor e transparencia usam as mesmas propriedades enviadas ao runtime, embora o renderer M5 possa arredondar a fonte para uma escala suportada pelo display.

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

## Proxima Entrega do Simulador

Prioridade recomendada:

1. disparar os eventos oferecidos por `hardware.inputs` na tela atual;
2. simular Agent/PLC offline, stale, partial e falha de escrita;
3. controlar criacao, expiracao e recuperacao de sessoes por perfil;
4. editar valores/qualidade de Tags internas e externas em um painel unico;
5. oferecer sequencias temporais e snapshots reproduziveis.

O simulador deve consumir os mesmos manifestos, bindings e acoes do runtime. Nao deve implementar uma segunda logica de widget ou protocolo.
