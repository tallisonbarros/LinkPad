# Catalogo de Hardwares

## Objetivo

Permitir que o Studio suporte multiplos devices sem acoplar a interface a um unico M5.

## Manifesto de Hardware

Cada hardware deve ter um manifesto.

Exemplo inicial:

```json
{
  "id": "m5stickc-plus2",
  "name": "M5StickC Plus2",
  "family": "m5stack",
  "runtime": "arduino-esp32",
  "display": {
    "width": 240,
    "height": 135,
    "touch": false,
    "color": true,
    "statusOverlay": {
      "enabled": true,
      "placement": "top-right",
      "style": "watermark",
      "indicators": ["wifi", "agent"]
    }
  },
  "inputs": [
    {
      "id": "primary",
      "label": "Botao A",
      "kind": "button",
      "events": ["press"],
      "configurable": true
    },
    {
      "id": "secondary",
      "label": "Botao B",
      "kind": "button",
      "events": ["press"],
      "configurable": true
    },
    {
      "id": "power",
      "label": "Power",
      "kind": "button",
      "events": [],
      "configurable": false
    }
  ],
  "network": ["wifi"],
  "storage": ["nvs", "spiffs"],
  "capabilities": {
    "battery": true,
    "buzzer": true,
    "imu": true
  }
}
```

## Capacidades

O Studio deve usar capacidades para liberar ou bloquear recursos.

Exemplos:

- Device sem touch nao recebe widgets que dependem de toque direto.
- Device sem display nao usa editor visual de tela.
- Device com poucos botoes precisa de navegacao por foco.
- Device com Ethernet nativo pode aceitar perfis de rede cabeada.
- Posicao e indicadores permanentes do runtime sao definidos pelo `statusOverlay` do manifesto, sem coordenadas absolutas especificas do M5.

## Entradas e Controles

`inputs` nao contem nomes de APIs de bibliotecas. Cada item declara um identificador logico estavel, rotulo de interface, tipo de controle, eventos normalizados e se o projeto pode configura-lo. Tipos previstos: `button`, `encoder`, `key` e `touch`. Eventos previstos: `press`, `longPress`, `doublePress`, `rotateLeft` e `rotateRight`.

O Studio deve renderizar somente os controles e eventos do manifesto. O template do hardware converte sua API fisica nesses identificadores; por exemplo, o adaptador M5 converte `M5.BtnA` em `primary/press`. Um projeto nunca salva `M5.BtnA`, pino GPIO ou chamada de biblioteca em `screens.json`.

Um controle com `configurable: false` pode aparecer para diagnostico, mas nao aceita vinculos. No M5StickC Plus2, Power fica reservado ate que o runtime ofereca um evento seguro e validado.

## Overlay de Status

O contrato aceita `top-left`, `top-right`, `bottom-left` e `bottom-right`. O renderer calcula tamanho, margem e espacamento a partir da menor dimensao do display. Novos hardwares podem mudar a posicao ou os indicadores no manifesto sem alterar telas e widgets do projeto.

O estilo `watermark` e uma camada nao interativa renderizada depois dos widgets. Os indicadores iniciais sao `wifi` e `agent`; eles nao representam qualidade de tag ou estado global de PLC.

## Primeiro Hardware

O primeiro alvo e `m5stickc-plus2`.

O exemplo existente deve ser usado como referencia para:

- Resolucao.
- Botao A, B e Power.
- Wi-Fi.
- Bateria.
- Display ST7789.
- NVS/Preferences.

## Futuro

Adicionar familias:

- M5Stack Core.
- M5Stack Core2/CoreS3.
- M5Atom.
- ESP32 customizado.
- Painel industrial Linux.
- Gateway sem tela.
