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
      "events": ["press", "longPress"],
      "deviceActions": [],
      "configurable": true
    },
    {
      "id": "secondary",
      "label": "Botao B",
      "kind": "button",
      "events": ["press", "longPress"],
      "deviceActions": [],
      "configurable": true
    },
    {
      "id": "power",
      "label": "Power",
      "kind": "button",
      "events": ["press", "longPress"],
      "deviceActions": ["powerOff"],
      "configurable": true
    }
  ],
  "network": ["wifi"],
  "storage": ["nvs", "spiffs"],
  "capabilities": {
    "battery": true,
    "buzzer": true,
    "imu": true,
    "powerOff": true
  }
}
```

## Capacidades

O Studio deve usar capacidades para liberar ou bloquear recursos.

Seleção de dados não pertence ao manifesto de hardware. Todo hardware usa o mesmo `DataBindingField`; o manifesto pode limitar widgets e interações disponíveis, mas nunca redefine as abas PLC/Tags globais ou os formulários de endereço.

Exemplos:

- Device sem touch nao recebe widgets que dependem de toque direto.
- Device sem display nao usa editor visual de tela.
- Device com poucos botoes precisa de navegacao por foco.
- Device com Ethernet nativo pode aceitar perfis de rede cabeada.
- Posicao e indicadores permanentes do runtime sao definidos pelo `statusOverlay` do manifesto, sem coordenadas absolutas especificas do M5.

## Entradas e Controles

`inputs` nao contem nomes de APIs de bibliotecas. Cada item declara um identificador logico estavel, rotulo de interface, tipo de controle, eventos normalizados, acoes especiais de dispositivo e se o projeto pode configura-lo. Tipos previstos: `button`, `encoder`, `key` e `touch`. Eventos previstos: `press`, `longPress`, `doublePress`, `rotateLeft` e `rotateRight`.

O Studio deve renderizar somente os controles e eventos do manifesto. O template do hardware converte sua API fisica nesses identificadores; por exemplo, o adaptador M5 converte `M5.BtnA` em `primary/press`. Um projeto nunca salva `M5.BtnA`, pino GPIO ou chamada de biblioteca em `screens.json`.

Um controle com `configurable: false` pode aparecer para diagnostico, mas nao aceita vinculos. `deviceActions` restringe acoes especiais por entrada sem limitar navegacao, interface ou dados. Para oferecer `powerOff`, o hardware precisa declarar `capabilities.powerOff: true` e a entrada precisa incluir `powerOff` em `deviceActions`.

No M5StickC Plus2, A, B e Power sao configuraveis e oferecem `press` e `longPress`, mas somente Power declara `deviceActions: ["powerOff"]`. A e B nao exibem a acao Desligar. Essa regra vem integralmente do manifesto; a interface nao testa o nome `power` nem conhece a API M5.

## Overlay de Status

O contrato aceita `top-left`, `top-right`, `bottom-left` e `bottom-right`. O renderer calcula tamanho, margem e espacamento a partir da menor dimensao do display. Novos hardwares podem mudar a posicao ou os indicadores no manifesto sem alterar telas e widgets do projeto.

O estilo `watermark` e uma camada nao interativa renderizada depois dos widgets. Os indicadores iniciais sao `wifi` e `agent`; eles nao representam qualidade de tag ou estado global de PLC.

## Primeiro Hardware

O primeiro alvo e `m5stickc-plus2`.

Estado implementado:

| Capacidade | M5StickC Plus2 |
| --- | --- |
| Template/runtime | Arduino ESP32 compilado |
| Display | 240x135 colorido, sem touch |
| Entradas | A/B/Power com `press` e `longPress` |
| Status permanente | overlay vetorial Wi-Fi/Agent |
| Rede | Wi-Fi |
| Retencao | NVS via `Preferences` |
| Build/deploy | PlatformIO gerenciado e porta serial detectada |

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

## Contrato Para o Segundo Hardware

O proximo hardware deve ser adicionado sem duplicar editores ou modelos de projeto. A entrega minima inclui:

- manifesto com display, entradas, rede, storage e capacidades;
- template/runtime e renderer compativeis;
- renderer dos sete widgets comuns (`static_text`, `tag_value`, `boolean_indicator`, `status_indicator`, `write_button`, `gauge`, `progress_bar`) e adaptacao do estilo logico do schema `0.9.0`;
- adaptador de entradas que emita eventos logicos;
- implementacao de `powerOff` somente quando a capacidade for anunciada pelo hardware e autorizada em `input.deviceActions`;
- backend de retencao para Tags internas quando `storage` oferecer persistencia;
- definicao do `statusOverlay` apropriado ao display;
- teste de geracao e compilacao real.

Widgets exclusivos, touch avancado, sensores e recursos cosmeticos podem ser entregas posteriores. A primeira meta e comprovar que telas, `DataBinding`, controles e Tags retentivas nao dependem do M5Stick. O plano compartilhado fica em `../../docs/06-estado-atual-e-proximos-passos.md`.
