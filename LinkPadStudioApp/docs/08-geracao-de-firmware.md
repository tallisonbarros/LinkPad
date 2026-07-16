# Geracao de Firmware

## Objetivo

Definir como o Studio gera firmware/runtime para devices.

## Estrategia

O Studio deve gerar firmware a partir de templates por runtime/hardware.

Nao gerar um unico `.ino` monolitico por concatenacao fragil.

## Estrutura Conceitual

```text
templates/
  m5stickc-plus2/
    platformio.ini
    include/
      LinkPadRuntime.h
      LinkPadStatusOverlay.h
    src/
      main.cpp
      LinkPadRuntime.cpp

Projeto.linkpad/generated/m5stickc-plus2/
  platformio.ini
    include/
      LinkPadRuntime.h
      LinkPadStatusOverlay.h
      generated_project.h
  src/
    main.cpp
    LinkPadRuntime.cpp
```

## Entradas

- `project.json`
- `hardware.json`
- `agent.json`
- `protocols.json`
- `tags.json`
- `screens.json`
- assets

## Saidas

- Codigo fonte gerado.
- Arquivos de configuracao gerados.
- Assets convertidos para o formato do device.
- Artefato de build quando aplicavel.

## Regras

- Geracao deve ser deterministica.
- Arquivos gerados devem indicar que sao gerados.
- Templates devem conter runtime reutilizavel.
- Configuracoes do projeto devem ficar separadas do runtime base.
- Descritores de protocolo devem ser serializados de forma deterministica.
- O firmware nao deve conter implementacoes OPC UA, EtherNet/IP ou Modbus.
- Credenciais incorporadas devem gerar aviso de seguranca no Studio e nunca aparecer em logs de build.

## M5Stick MVP

O primeiro firmware deve suportar:

- Wi-Fi.
- HTTP client.
- `/lpp/v1/status` e `/lpp/v1/capabilities`.
- criacao e renovacao de sessao.
- `/lpp/v1/read` em lote.
- `/lpp/v1/write` com `requestId`.
- Renderizacao basica.
- Botoes fisicos.
- Indicadores de rede, agente, PLC e bateria.

## Implementacao 0.5.0

O comando Tauri `generate_firmware` copia os templates versionados e cria `generated_project.h` com um JSON compacto contendo apenas rede, Agent, protocolos, tags e telas. A geracao nao inclui timestamps e e coberta por teste de determinismo.

O projeto gerado usa PlatformIO, `espressif32@6.7.0`, board `m5stick-c`, `M5Unified@0.2.18` e `ArduinoJson@6.21.5`. As versoes ficam fixadas no `platformio.ini` do template para que atualizacoes externas nao alterem silenciosamente o firmware.

O Studio prepara e usa sua propria instalacao do PlatformIO em `%LOCALAPPDATA%\LinkPadStudio\pio`; nao existe dependencia de `pio` no `PATH`. A primeira preparacao baixa os componentes ausentes e valida os pacotes de bootstrap por SHA-256.

Para proteger o build contra caminhos longos do Windows, o fonte gerado e sincronizado em `%LOCALAPPDATA%\LinkPadStudio\b\<id-do-projeto>` durante a compilacao. Ao concluir, `firmware.bin`, `firmware.elf`, `bootloader.bin` e `partitions.bin` disponiveis sao copiados para `Projeto.linkpad/build/firmware/`.

Implementado: Wi-Fi, status, capabilities, sessoes por perfil, read em lote agrupado por perfil, write roteado pelo perfil da tag, renderizacao basica e botoes A/B. Indicadores de bateria, navegacao avancada e assets convertidos permanecem pendentes.

O runtime `0.5.0` continua copiando `type` e `address` de cada tag para o LinkPad Protocol. Portanto, perfis `sim` e `siemens-s7` simultaneos usam o mesmo template: o firmware nao importa nem executa bibliotecas industriais.

O estado embarcado guarda `sessionId`, proxima tentativa e saude das tags por identificador de perfil. Falha em uma sessao nao apaga as outras. O template e compilado em teste com dois perfis habilitados para validar o caminho multi-conectores no ESP32.

`generated_project.h` inclui `ui.statusOverlay`, derivado do manifesto do hardware. `LinkPadStatusOverlay.h` e um renderer vetorial sem coordenadas fixas: ele consulta largura/altura do display, calcula a geometria responsiva e desenha somente os indicadores declarados. O runtime M5 usa primitivas compativeis com a abstracao grafica; futuros templates podem reutilizar o contrato e o renderer quando a API de display for equivalente.

Os icones sao renderizados por ultimo, como marca d'agua nao interativa sobre todas as telas. Nao existe faixa de texto reservada e os contadores internos de sessoes/tags nao sao expostos na tela principal.
