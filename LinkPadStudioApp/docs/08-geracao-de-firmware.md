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
      LinkPadInputAdapter.h
      LinkPadRuntime.h
      LinkPadStatusOverlay.h
    src/
      main.cpp
      LinkPadRuntime.cpp

Projeto.linkpad/generated/m5stickc-plus2/
  platformio.ini
    include/
      LinkPadInputAdapter.h
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

## Saidas

- Codigo fonte gerado.
- Arquivos de configuracao gerados.
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
- Indicadores permanentes de Wi-Fi e Agent pelo overlay; diagnostico de PLC/tag permanece interno.

## Implementação 0.9.0

A funcao interna `firmware::generate` copia os templates versionados e cria `generated_project.h` com um JSON compacto contendo apenas rede, Agent, protocolos, pontos compilados e telas. A geração não inclui timestamps e é coberta por teste de determinismo. Ela nao e uma etapa manual: o comando Tauri `run_firmware_build` sempre a executa antes de compilar e, no modo de gravacao, antes de compilar e enviar ao device.

O projeto gerado usa PlatformIO, `espressif32@6.7.0`, board `m5stick-c`, `M5Unified@0.2.18` e `ArduinoJson@6.21.5`. As versoes ficam fixadas no `platformio.ini` do template para que atualizacoes externas nao alterem silenciosamente o firmware.

O Studio prepara e usa sua propria instalacao do PlatformIO em `%LOCALAPPDATA%\LinkPadStudio\pio`; nao existe dependencia de `pio` no `PATH`. A primeira preparacao baixa os componentes ausentes e valida os pacotes de bootstrap por SHA-256.

Para proteger o build contra caminhos longos do Windows, o fonte gerado e sincronizado em `%LOCALAPPDATA%\LinkPadStudio\b\<id-do-projeto>` durante a compilacao. Ao concluir, `firmware.bin`, `firmware.elf`, `bootloader.bin` e `partitions.bin` disponiveis sao copiados para `Projeto.linkpad/build/firmware/`.

Implementado: Wi-Fi, status, capabilities, sessoes por perfil, read em lote agrupado por perfil, write roteado pelo perfil da tag, renderizacao basica, adaptador A/B e motor de acoes por tela. Indicadores de bateria permanecem pendentes.

O campo `assets` ainda e preservado no schema e na estrutura de projetos antigos, mas nao possui editor, entrada de geracao ou item na arvore. Imagens e fontes so devem retornar a interface quando houver importacao, validacao de limites e conversao implementadas ponta a ponta.

O runtime `0.6.0` continua copiando `type` e `address` de cada tag para o LinkPad Protocol. Portanto, perfis `sim`, `siemens-s7` e `opcua` simultaneos usam o mesmo template: o firmware nao importa nem executa bibliotecas industriais.

No Studio `0.9.0`, um perfil OPC UA compila `driver: opcua`, endpoint, options, auth anonimo e `address.nodeId` sem alterar o template C++. `asyncua` existe exclusivamente no pacote do Agent.

No runtime `0.7.0`, o gerador resolve o `DataBinding` de cada widget e ação antes de escrever o header. Referências globais usam o ID estável da Tag global; endereços diretos geram pontos técnicos determinísticos. Perfil, tipo e endereço iguais são deduplicados, combinando direção e usando o menor `pollMs`. Desde o Studio `0.17.1`, Tags globais sem referencia em widget ou controle sao podadas somente do artefato embarcado; continuam intactas no projeto. O JSON embarcado mantém `props.tag`/`action.tag` apenas como formato interno consumido pelo runtime existente.

Widgets com endereço direto também recebem `props.label`, por exemplo `DB10.DBD4`. O cache e o protocolo usam o identificador técnico, enquanto o renderer usa o rótulo legível. Os detalhes internos nunca aparecem para o operador.

No Studio `0.7.2`, limites vêm do widget ou ação de escrita. Durante a compilação, o gerador aplica esses valores ao ponto global ou direto resolvido; quando vários consumidores escrevem no mesmo ponto, usa o maior mínimo e o menor máximo. O JSON enviado ao Agent mantém o contrato anterior.

O estado embarcado guarda `sessionId`, proxima tentativa e saude das tags por identificador de perfil. Falha em uma sessao nao apaga as outras. O template e compilado em teste com dois perfis habilitados para validar o caminho multi-conectores no ESP32.

`generated_project.h` inclui `ui.statusOverlay`, derivado do manifesto do hardware. `LinkPadStatusOverlay.h` e um renderer vetorial sem coordenadas fixas: ele consulta largura/altura do display, calcula a geometria responsiva e desenha somente os indicadores declarados. O runtime M5 usa primitivas compativeis com a abstracao grafica; futuros templates podem reutilizar o contrato e o renderer quando a API de display for equivalente.

Os icones sao renderizados por ultimo, como marca d'agua nao interativa sobre todas as telas. Nao existe faixa de texto reservada e os contadores internos de sessoes/tags nao sao expostos na tela principal.

`LinkPadInputAdapter.h` e a unica parte de entrada do template M5 que chama `M5.BtnA`, `M5.BtnB` e `M5.BtnPWR`. No runtime `0.12.0`, clique curto usa `wasClicked` e retencao usa `wasHold`, gerando `press` ou `longPress` sem disparo duplo. `LinkPadRuntime.cpp` consulta `inputBindings` e executa todas as correspondencias em ordem, permitindo que futuros templates substituam apenas as adaptacoes do hardware.

O firmware gerado inclui `inputBindings` dentro de cada item de `screens`. Bindings consecutivos podem repetir o mesmo `inputId/event`; cada `action` continua autocontida e e executada na ordem. No runtime `0.12.0`, `changeValue` preserva `operation`, `operand`, `min` e `max`; o gerador exige leitura/escrita para operacoes relativas. Essa extensao nao altera o LinkPad Protocol: o resultado final e enviado ao endpoint `/lpp/v1/write` existente, com `requestId` novo para cada intencao e sem retry automatico.

`powerOff` nao percorre o Agent. No template M5, o runtime força a gravacao de Tags retentivas pendentes e chama `M5.Power.powerOff()`. Outros templates devem implementar a mesma intencao com sua API local somente quando o manifesto declarar `capabilities.powerOff`.

No runtime `0.8.0`, essa última regra vale somente para Tags externas. Tags globais `source: internal` referenciadas permanecem no JSON embarcado com `initialValue` e `retentive`, mas sem `protocolProfileId`/`address`. `LinkPadRuntime` inicializa o valor antes da primeira tela e intercepta a escrita local antes do cliente HTTP.

O template ESP32 usa `Preferences`, incluído no Arduino ESP32, para armazenar um documento JSON de valores retentivos na NVS. O armazenamento é isolado por `projectId` e usa o ID estável da Tag como chave lógica. Alterações são consolidadas por 500 ms; valores incompatíveis após mudança de tipo/faixa são descartados. Essa capacidade não adiciona biblioteca industrial nem dependência ao Agent.

No runtime `0.9.0`, o gerador preserva `fontSize`, `color`, `backgroundColor` e `transparent` em `widget.props`. O template M5 valida cores `#RRGGBB`, converte tamanho logico de 6 a 32 para escala nativa 1 a 4 e pinta o fundo apenas quando solicitado. O contrato e portatil: outro template pode usar fonte vetorial ou outro formato interno sem alterar o projeto. A compilacao real do template com essas propriedades faz parte da validacao automatizada opt-in da toolchain gerenciada.

No runtime `0.10.0`, o gerador tambem preserva alinhamentos, padding, borda e arredondamento, e compila vinculos de `gauge`/`progress_bar` como leituras numericas. `editor.locked` e `editor.groupId` sao removidos de cada widget; grade, guias e auditoria existem somente no frontend. O template M5 com os sete tipos foi compilado pela validacao real opt-in.

No runtime `0.11.0`, o gerador preserva sequencias de controles, resolve os `DataBinding` de cada acao repetida e mantem `powerOff` como operacao local. O template completo com A/B/Power, clique curto, long press, execucao ordenada e desligamento foi compilado pela toolchain gerenciada.

No runtime `0.12.0`, o gerador compila `changeValue` para o mesmo ponto tecnico usado por widgets e Tags globais. `set` pode usar um ponto gravavel; `add`, `subtract` e `toggle` exigem `readWrite` porque dependem do cache atual. O template M5 completo foi novamente compilado pela toolchain gerenciada.

No runtime `0.12.1`, a qualidade agregada do perfil permanece diagnostica, mas nao autoriza nem bloqueia operacoes relativas. Cada operacao exige sessao ativa e qualidade `good` somente no ponto-alvo. O leitor invalida qualidades diante de falha de transporte, parse ou sessao e atualiza individualmente os itens de respostas parciais. O template real foi recompilado com a toolchain gerenciada.

## Proximas Evolucoes da Geracao

- incluir um segundo template de hardware e validar compilacao real;
- formalizar adaptadores de display, entrada e armazenamento local por runtime;
- converter assets/fontes somente quando o pipeline tiver manifestos e limites definidos;
- acrescentar assinatura/identificacao de artefato antes de OTA;
- manter geracao offline possivel depois que dependencias da toolchain estiverem preparadas.

Um novo conector declarativo nao exige alterar o template quando cabe em `driver`, `endpoint`, `options`, `auth`, `type` e `address`. Mudancas no C++ sao justificadas apenas por nova capacidade do Device Runtime, nao por detalhes internos de um PLC.
