# Build e Deploy de Devices

## Objetivo

Definir como o Studio compila e envia runtimes para hardware.

## MVP

Para M5StickC Plus2, o build usa PlatformIO Core em um ambiente privado gerenciado pelo Studio. O usuario nao instala Python ou PlatformIO e nao configura `PATH`.

## Build do Studio Windows

O Studio e um aplicativo Windows desktop via Tauri.

A UI interna usa:

```text
React
TypeScript
Vite como empacotador interno
lucide-react
```

Comandos atuais:

```powershell
npm install
.\run-dev.ps1
npm run build
npm run check
npm run test
```

- `run-dev.ps1`: valida Node, dependencias e Cargo; impede sessoes duplicadas; abre Tauri e Vite juntos.
- `npm run build`: gera o app Windows via Tauri.
- `npm run check`: valida a UI React/TypeScript.
- `npm run test`: executa os testes de schema/migracao/validacao.

Opcoes de desenvolvimento:

```powershell
.\run-dev.ps1 -CheckOnly
.\run-dev.ps1 -UiOnly
```

No Prompt de Comando, `run-dev.cmd` encaminha para o mesmo launcher PowerShell.

A porta Vite `5173` e estrita. Se estiver ocupada, o launcher falha em vez de iniciar em outra porta que o Tauri nao conhece.

`ui:dev` e `ui:build` sao scripts internos chamados pelo Tauri. Eles nao sao o modo oficial de uso do Studio.

O build do aplicativo Studio empacota a interface desktop. A aba Build, dentro do produto, gera e compila o firmware do projeto aberto.

Saidas atuais do build desktop:

```text
src-tauri/target/release/linkpad-studio.exe
src-tauri/target/release/bundle/msi/
src-tauri/target/release/bundle/nsis/
```

Saidas do firmware:

```text
Projeto.linkpad/generated/m5stickc-plus2/
Projeto.linkpad/build/latest.log
Projeto.linkpad/build/firmware/
```

Ambiente gerenciado:

```text
%LOCALAPPDATA%\LinkPadStudio\pio\
  python\
  installer\
  core\penv\Scripts\platformio.exe

%LOCALAPPDATA%\LinkPadStudio\b\<id-do-projeto>\
```

Na primeira compilacao ou gravacao, o Studio:

1. baixa o Python portatil oficial selecionado para Windows x64;
2. valida seu SHA-256 e extrai no ambiente privado;
3. baixa uma revisao fixada do instalador oficial do PlatformIO e valida seu SHA-256;
4. instala o PlatformIO Core no diretorio privado;
5. valida o executavel por caminho absoluto;
6. baixa plataforma e bibliotecas fixadas pelo `platformio.ini` durante o primeiro build.

O botao `Preparar ambiente` permite antecipar as quatro primeiras etapas e mostra o progresso. `Compilar` e `Gravar device` executam essa preparacao automaticamente quando necessario. Nao ha instalacao manual, permissao administrativa ou dependencia de um PlatformIO global. A internet e necessaria apenas quando algum componente ainda precisa ser baixado.

O build e executado em staging de caminho curto para evitar o limite de linha de comando das ferramentas ESP32 no Windows. Depois do sucesso, os binarios sao copiados para `build/firmware/` no projeto e o diagnostico completo permanece em `build/latest.log`.

Compilacao e gravacao sao executadas fora da thread da interface. Enquanto o PlatformIO esta ativo, o backend transmite eventos `firmware-progress` com etapa, percentual e a linha de diagnostico atual. A aba Build apresenta uma barra de progresso e as ultimas linhas recebidas, sem deixar a janela do Studio em estado `Nao respondendo`. Durante a gravacao, percentuais encontrados na saida do uploader sao refletidos na barra; nas demais etapas o percentual representa o marco operacional estimado.

A janela principal possui capability Tauri explicita para `core:event:allow-listen` e `core:event:allow-unlisten`. Essas permissoes sao necessarias para acompanhar `firmware-progress` e `toolchain-progress`; permissoes de emissao de eventos nao sao concedidas ao frontend.

## Selecao da Porta Serial

No Studio `0.5.1`, a porta de upload nao e digitada. Ao abrir a aba Build, o comando nativo `list_serial_ports` consulta as portas atualmente detectadas pelo sistema operacional e alimenta uma lista suspensa. O botao de atualizacao repete a consulta depois que um device e conectado ou removido.

Regras do seletor:

- se o projeto ainda nao possui porta e exatamente uma foi detectada, ela e selecionada automaticamente;
- se a porta salva estiver desconectada, ela permanece visivel como `nao detectada` para explicar o estado do projeto;
- uma porta ausente nunca habilita `Gravar device`;
- `Compilar` continua disponivel sem porta serial e sempre gera o codigo antes do build;
- o upload usa exatamente o valor detectado e selecionado no comando `pio run --target upload --upload-port COMx`.

A descoberta depende do driver USB/serial do hardware estar instalado e do Windows reconhecer a porta. Se o device for conectado depois que a tela ja estiver aberta, o usuario deve clicar em atualizar.

Observacao operacional:

Se `cargo` nao for reconhecido apos instalar Rust, reinicie o PowerShell ou adicione temporariamente `C:\Users\<usuario>\.cargo\bin` ao PATH da sessao.

## Regras Para Arquivos do Studio

O Studio deve usar dialogos e escrita nativa via Tauri para arquivos/pastas.

Nao usar APIs de filesystem do navegador para operacoes do produto, incluindo:

- `showDirectoryPicker`
- `showOpenFilePicker`
- `showSaveFilePicker`
- `<input type="file">` para carregar projeto

Essas APIs podem exibir prompts de permissao de site no WebView. Para um app Windows, esse comportamento deve ser evitado.

## Fluxo

```text
Compilar
  Validar projeto -> preparar ambiente -> gerar codigo -> compilar -> registrar diagnostico

Gravar device
  Validar projeto -> validar porta -> preparar ambiente -> gerar codigo -> compilar -> gravar -> registrar diagnostico
```

`Gerar codigo` nao e uma acao principal independente. Isso evita compilar ou gravar um fonte antigo quando o projeto foi alterado. `Compilar` permanece como acao secundaria para teste; `Gravar device` e a acao completa de deploy serial.

Implementacao `0.2.0`:

- validacao na UI;
- geracao deterministica obrigatoria no inicio de cada build;
- `Compilar` encadeia geracao e `pio run`;
- `Gravar device` encadeia geracao, compilacao e `pio run --target upload --upload-port COMx`;
- preparacao automatica da toolchain gerenciada;
- execucao assincrona de compilacao/gravacao fora da thread da interface;
- progresso e diagnostico incremental pelo evento `firmware-progress`;
- descoberta nativa da porta e selecao somente entre devices detectados;
- staging interno com identificador deterministico por caminho de projeto;
- copia de binarios para `build/firmware/`;
- log em `build/latest.log`;
- porta serial escolhida pelo usuario em uma lista fornecida pelo sistema operacional.

## Configuracoes

O Studio deve permitir configurar:

- Porta serial.
- Baud rate.
- Board profile.
- Flash mode.
- Credenciais Wi-Fi.
- Host/porta do Agente.
- Token opcional.
- Perfis de protocolo incorporados ao runtime.
- Enderecos industriais e limites de escrita.

## Regras

- Segredos nao devem ficar hardcoded em exemplos.
- O build deve alertar quando um perfil incorporar credenciais no firmware.
- Builds devem ser reproduziveis.
- Logs de build devem ser armazenados.
- Falhas devem ter mensagem acionavel.
- A gravacao nao deve iniciar com uma porta salva que nao esteja atualmente detectada.

## Futuro

- OTA.
- Deploy por rede.
- Perfis por planta.
- Gerenciamento de frota.

## Estado de Release e Proxima Evolucao

A toolchain gerenciada, o build assincrono, o progresso, o staging curto e a selecao de porta foram validados em desenvolvimento. O template M5 Runtime `0.12.1`, incluindo os sete widgets, estilo portatil, A/B/Power, long press, sequencias, `changeValue`, isolamento de qualidade por ponto e desligamento, foi compilado de verdade. O instalador desktop existente comprova o pipeline Tauri, mas a versao Studio `0.17.1` ainda precisa de uma rodada final de `npm run build`, instalacao/upgrade em maquina limpa e registro dos artefatos antes de ser tratada como release distribuivel.

Antes de OTA ou frota:

- assinar binarios do Studio e firmwares quando a politica de chaves existir;
- validar instalacao, upgrade e desinstalacao em VM limpa;
- definir identidade do device e transporte seguro;
- definir rollback e compatibilidade entre runtime/Agent;
- preservar log local acionavel e build serial como caminho de recuperacao.
