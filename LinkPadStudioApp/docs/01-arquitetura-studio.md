# Arquitetura do LinkPad Studio

## Camadas

```text
LinkPad Studio
  Project Manager
  Hardware Catalog
  Agent Endpoint Configuration
  Protocol Profile Manager
  Tag Manager
  Screen Editor
  Widget Library
  Simulator
  Runtime Generator
  Build/Deploy Manager
```

## Implementacao Inicial

A fundacao inicial do Studio foi criada como um aplicativo Windows desktop com Tauri.

A interface interna usa React/TypeScript, e Vite atua apenas como empacotador da UI para a janela Tauri.

Componentes principais:

```text
src/App.tsx
src/components/StartupModal.tsx
src/components/WorkspaceShell.tsx
src/components/workspace/ProjectTree.tsx
src/components/workspace/Workbench.tsx
src/components/workspace/ContextPanel.tsx
src/components/workspace/BottomTabs.tsx
src/services/projectService.ts
src/services/agentService.ts
src/services/firmwareService.ts
src/data/hardwareCatalog.ts
src/data/connectorCatalog.ts
src/domain/project/
src/features/
src/features/screens/ScreenControlsEditor.tsx
src-tauri/src/firmware.rs
src-tauri/src/serial_ports.rs
src-tauri/src/toolchain.rs
src-tauri/templates/m5stickc-plus2/
src-tauri/templates/m5stickc-plus2/include/LinkPadInputAdapter.h
```

O shell original foi preservado. A versao `0.2.0` adicionou editores funcionais e gerador de runtime. A versao `0.3.0` acrescentou o manifesto/editor declarativo do `siemens-s7`. A versao `0.4.0` completa o gerenciador de perfis e o runtime multi-conectores. A versao `0.5.0` adiciona o overlay portatil de status orientado pelo manifesto de hardware, sem mudar o papel do Agent. A versao `0.5.1` move a descoberta de portas seriais para o backend nativo. A versao `0.6.0` acrescenta controles e acoes declarativas por tela, sem acoplar o contrato a botoes M5.

## Fluxo Principal

```text
Usuario cria projeto
Usuario escolhe hardware
Usuario informa o endpoint do agente
Usuario cria perfis declarativos de protocolo
Usuario cria/importa tags
Usuario cria telas
Usuario associa controles do hardware a acoes por tela
Usuario simula
Studio gera runtime
Studio prepara/reutiliza a toolchain privada
Studio faz build/deploy em staging interno
Device comunica com agente
```

## Separacao de Responsabilidades

O Studio conhece:

- Projeto.
- Hardware alvo.
- Telas.
- Widgets.
- Tags LinkPad e seus enderecos declarativos.
- Perfis de protocolo usados pelo runtime.
- Endpoint HTTP e politica de acesso ao Agente.
- Geracao de firmware.
- Controles logicos oferecidos pelo manifesto e acoes declaradas em cada tela.

O Studio nao conhece:

- Implementacao interna das bibliotecas OPC UA, `pycomm3` ou outros drivers.
- Detalhes privados do PLC.
- Threads internas do Agente.
- Fila real de escrita do PLC, exceto por diagnostico exposto na API.
- Configuracao persistente interna do Agente.

O Studio conhece o schema publico de cada conector para editar e validar descritores. Para S7 nativo isso inclui endpoint, rack, slot, timeout, DB, offset e tipo; nao inclui socket, PDU, reconexao nem a API de `python-snap7`, que permanecem internos ao Agent.

## Contratos Externos

O Studio depende de:

- LinkPad Protocol HTTP/JSON.
- Schema de projeto LinkPad.
- Manifesto de hardware.
- Schema de tags.
- Schema de perfis de protocolo.
- Templates de runtime.

## Decisao Inicial

O Studio deve tratar o Agente como a camada executora industrial oficial, sem depender de uma instancia especifica do Agente.

Consequencia: o Device Runtime fica leve e reutilizavel em hardwares com recursos limitados.

## Decisao de Independencia

O Studio nao pareia com o Agente, nao envia configuracoes ao Agente e nao exige que o Agente esteja instalado para criar ou compilar um projeto.

O Studio gera no projeto:

- endpoint HTTP do Agente;
- perfis declarativos de protocolo;
- enderecos industriais das tags;
- limites e permissoes de escrita;
- versao do LinkPad Protocol.

O Device Runtime usa essas informacoes para abrir sessoes efemeras no Agente. O Agente interpreta os descritores e seleciona o driver adequado.

No Studio `0.4.0`, a tela Conectores permite criar, selecionar, habilitar e remover perfis sem tags vinculadas. Cada tag escolhe explicitamente um perfil. O runtime abre uma sessao por perfil habilitado e agrupa leitura/escrita por essa associacao.

No Studio `0.5.0`, indicadores permanentes pertencem a uma camada de overlay do runtime, separada de widgets e telas. O preview React e o template embarcado consomem o mesmo descritor `hardware.statusOverlay`; cada renderer adapta a geometria ao display alvo.

No Studio `0.6.0`, entradas fisicas pertencem a uma camada `Hardware Input Adapter`. O manifesto informa controles/eventos disponiveis, a tela salva `inputBindings` e o `Event Engine` executa a acao. O editor nunca referencia `M5.BtnA`; somente o adaptador do template M5 conhece essa API.

## Decisao de Desktop

Contexto:

O produto final deve ser um Studio desktop Windows. A UI React/TypeScript foi mantida por produtividade, mas o caminho oficial de execucao e Tauri.

Decisao:

Usar Tauri 2 como runtime desktop Windows e React/TypeScript como camada de interface. Vite deve permanecer apenas como ferramenta interna invocada pelo Tauri.

Consequencias:

- O fluxo visual pode evoluir rapidamente.
- O comando principal de desenvolvimento deve abrir janela desktop.
- Persistencia real em disco deve ser implementada via APIs/commands Tauri.
- Scripts puramente Vite nao devem ser apresentados como forma oficial de uso do produto.

## Arquivos e Pastas

Selecao de pasta, carregamento de projeto e escrita da estrutura `.linkpad`, incluindo `protocols.json`, devem passar por comandos nativos Tauri.

Implementacao inicial:

```text
pick_project_folder
open_project_from_dialog
save_project_to_disk
test_agent_connection
test_connector_connection
generate_firmware
run_firmware_build
list_serial_ports
get_toolchain_status
prepare_toolchain
```

`toolchain.rs` gerencia o Python portatil e o PlatformIO privados do Studio. A UI consulta o estado pelo comando `get_toolchain_status`; `prepare_toolchain` executa a preparacao fora da thread principal e publica progresso pelo evento `toolchain-progress`.

O build nunca resolve `pio` pelo `PATH`. O comando usa o executavel absoluto em `%LOCALAPPDATA%\LinkPadStudio\pio`, sincroniza o fonte gerado em `%LOCALAPPDATA%\LinkPadStudio\b\<id>` e copia os artefatos finais de volta para o projeto. O staging compacto evita falhas do toolchain ESP32 provocadas por caminhos longos no Windows.

`run_firmware_build` tambem executa em uma tarefa bloqueante separada da thread da interface. A saida padrao e a saida de erro do PlatformIO sao lidas enquanto o processo esta ativo e convertidas em eventos `firmware-progress`, mantendo a janela responsiva durante compilacoes e gravacoes longas.

O template M5 inclui `LinkPadInputAdapter.h`, que emite eventos logicos `primary/press` e `secondary/press`. `LinkPadRuntime` localiza o vinculo na tela corrente e executa navegacao ou escrita pelo motor generico; outros hardwares devem fornecer seu proprio adaptador mantendo o mesmo contrato.

`list_serial_ports` consulta o sistema operacional em uma tarefa bloqueante e devolve somente descritores de portas atualmente detectadas. O frontend preserva uma porta salva que esteja temporariamente ausente para diagnostico, mas nao permite iniciar `flash` ate que uma porta retornada por esse comando seja selecionada. Esse estado e configuracao local de deploy e nao afeta o runtime gerado.

`test_connector_connection` executa em tarefa bloqueante, usa o cliente HTTP Rust e envia somente o target do perfil. Ele cria e encerra uma sessao LinkPad Protocol para validar o handshake do driver; nao recebe endereco de tag e nao chama leitura/escrita.

A capability Tauri `main-events`, em `src-tauri/capabilities/default.json`, autoriza a janela `main` somente a registrar e remover listeners (`core:event:allow-listen` e `core:event:allow-unlisten`). O frontend nao recebe permissao para emitir eventos; `firmware-progress` e `toolchain-progress` continuam sendo produzidos exclusivamente pelo backend Rust.

Nao usar APIs de arquivo do navegador, como `showDirectoryPicker`, `showOpenFilePicker` ou `<input type="file">`, porque elas geram prompts de permissao de site dentro do WebView e quebram a experiencia de aplicativo Windows.
