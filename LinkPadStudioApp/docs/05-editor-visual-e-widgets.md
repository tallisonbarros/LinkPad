# Editor Visual e Widgets

## Objetivo

Definir o editor drag-and-drop do Studio e a biblioteca inicial de widgets.

## Editor

O editor deve permitir:

- Criar telas.
- Posicionar widgets.
- Ajustar propriedades.
- Vincular widgets a tags.
- Simular estados.
- Validar limites do hardware.

## Widgets MVP

- Texto estatico.
- Valor de tag.
- Indicador booleano.
- Indicador de status.
- Botao de escrita.
- Campo numerico.
- Gauge simples.
- Barra de progresso.
- Icone de Wi-Fi/rede.
- Icone de agente/PLC.
- Icone de bateria.
- Lista de logs basica.

## Implementacao 0.2.0

O editor atual implementa:

- texto estatico;
- valor de tag;
- indicador booleano;
- indicador de status;
- botao de escrita;
- selecao e edicao de propriedades;
- posicionamento por arraste ou coordenadas;
- tamanho, visibilidade, cor e vinculo com tag;
- preview com `simulationValue`.

Gauge, barra, campo numerico, icones especializados e logs permanecem no roadmap. A validacao de build bloqueia widgets fora da tela, referencias a tags inexistentes e botoes ligados a tags somente leitura.

## Overlay Permanente do Runtime

No Studio `0.5.0`, o preview mostra a mesma marca d'agua de Wi-Fi e Agent gerada no firmware. Ela nao pertence a `screen.widgets`, nao pode ser selecionada/arrastada e aparece em todas as telas conforme `hardware.statusOverlay`.

Essa separacao evita duplicar widgets de diagnostico em cada tela e permite adaptar posicao e escala pelo manifesto de futuros hardwares.

## Propriedades Comuns

Todo widget deve ter:

```json
{
  "id": "widget-id",
  "type": "tag_value",
  "x": 0,
  "y": 0,
  "width": 80,
  "height": 24,
  "visible": true
}
```

## Vinculo Com Tags

Widgets que exibem dados devem aceitar:

- `tag`
- vinculo indireto ao `protocolProfileId` e ao endereco definido na tag;
- `format`
- `unit`
- `offlineText`
- `qualityBehavior`

## Validacao

O Studio deve impedir:

- Widget fora da tela.
- Texto que nao cabe sem estrategia de fallback.
- Widget touch em hardware sem touch sem interacao alternativa.
- Escrita em tag read-only.
- Tag industrial sem perfil de protocolo ou endereco valido.
