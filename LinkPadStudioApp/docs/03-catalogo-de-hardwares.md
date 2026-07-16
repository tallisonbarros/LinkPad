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
  "inputs": ["button_a", "button_b", "power_button"],
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
