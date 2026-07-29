# Arquitetura do LinkPad Studio

## Camadas

```text
LinkPad Studio
  Project Manager
  Hardware Catalog
  Agent Endpoint Configuration
  Protocol Profile Manager
  Tag Manager
  Canonical Data Binding Selector
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
index.html (bootstrap visual anterior ao React)
src/main.tsx
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
src/domain/project/dataBindings.ts
src/features/
src/components/data-binding/DataBindingField.tsx
src/components/data-binding/ConnectorAddressEditor.tsx
src/features/screens/ScreenControlsEditor.tsx
src/features/screens/ScreenCanvas.tsx
src/features/screens/WidgetArrangeMenu.tsx
src/features/screens/WidgetOrderMenu.tsx
src/features/screens/WidgetGroupMenu.tsx
src/features/screens/WidgetCatalogPanel.tsx
src/features/screens/widgetCatalog.ts
src/features/screens/widgetGeometry.ts
src/features/screens/useWidgetEditorController.ts
src/features/screens/WidgetPropertiesPanel.tsx
src/features/tags/TagEditorDialog.tsx
src-tauri/src/firmware.rs
src-tauri/src/serial_ports.rs
src-tauri/src/toolchain.rs
src-tauri/templates/m5stickc-plus2/
src-tauri/templates/m5stickc-plus2/include/LinkPadInputAdapter.h
```

O shell original foi preservado. A versao `0.2.0` adicionou editores funcionais e gerador de runtime. A versao `0.3.0` acrescentou o manifesto/editor declarativo do `siemens-s7`. A versao `0.4.0` completa o gerenciador de perfis e o runtime multi-conectores. A versao `0.5.0` adiciona o overlay portatil de status orientado pelo manifesto de hardware, sem mudar o papel do Agent. A versao `0.5.1` move a descoberta de portas seriais para o backend nativo. A versao `0.6.0` acrescenta controles e acoes declarativas por tela, sem acoplar o contrato a botoes M5. A versão `0.7.0` centraliza toda seleção industrial em `DataBindingField`, sem interfaces próprias por widget ou hardware. A versão `0.7.1` reorganiza a apresentação em Rede LinkPad, Comunicações, PLCs e pontos. A versão `0.7.2` compacta o apontamento e separa endereço de comportamento de escrita. A versão `0.8.0` acrescenta Tags globais internas, retenção local opcional e edição de Tags por popup. A versão `0.9.0` habilita OPC UA genérico com Node ID no mesmo modelo declarativo. A versão `0.9.1` move o catálogo de widgets para o painel direito de Contexto da tela ativa. A versao `0.10.0` acrescenta geometria deterministica, manipulacao profissional e historico compartilhado; `0.11.0` acrescenta organizacao e camadas; `0.12.0`, guias inteligentes; `0.13.0`, sistema portatil com sete widgets; `0.14.0`, auditoria visual calculada; `0.15.0`, sequencias de controles, long press e energia portatil; `0.16.0`, a acao unificada e tipada de alteracao de valores; `0.17.0`, o painel inferior extensivel por guias; e `0.17.1`, a poda de Tags sem consumidores e o isolamento de qualidade por ponto no runtime.

## Fluxo Principal

```text
Usuario cria projeto
Usuario escolhe hardware
Usuario informa o endpoint do agente
Usuario cria perfis declarativos de protocolo
Usuario seleciona enderecos diretos e, quando desejar reutilizacao, cria/importa Tags globais
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

No Studio `0.4.0`, o modelo permite criar, selecionar, habilitar e remover perfis sem tags vinculadas. Cada tag escolhe explicitamente um perfil. O runtime abre uma sessao por perfil habilitado e agrupa leitura/escrita por essa associacao. No Studio `0.7.1`, a interface apresenta esses perfis como PLCs em `Comunicações`, mantendo o nome técnico somente no domínio e nos arquivos do projeto.

No Studio `0.5.0`, indicadores permanentes pertencem a uma camada de overlay do runtime, separada de widgets e telas. O preview React e o template embarcado consomem o mesmo descritor `hardware.statusOverlay`; cada renderer adapta a geometria ao display alvo.

No Studio `0.6.0`, entradas fisicas pertencem a uma camada `Hardware Input Adapter`. O manifesto informa controles/eventos disponiveis, a tela salva `inputBindings` e o `Event Engine` executa a acao. No Studio `0.15.0`, varias entradas consecutivas com o mesmo `inputId/event` formam uma sequencia ordenada. O editor deriva uma grade plana e agrupada diretamente desses bindings: ha um unico cabecalho, celulas repetidas viram continuidade visual e a posicao vertical define a execucao. A criacao ocorre em modal exclusivo; a edicao transforma somente a linha ativa em formulario. Rascunhos de criacao/edicao e expansao de detalhes nao entram no projeto antes da confirmacao. Rotulos, icones e categorias ficam em `screenControlCatalog.ts`, enquanto disponibilidade continua vindo do manifesto. O editor nunca referencia `M5.BtnA`; somente o adaptador do template M5 conhece essa API. Energia segue a mesma fronteira: `powerOff` e uma intencao do projeto, e cada template implementa sua API local quando a capacidade estiver no manifesto.

No Studio `0.16.0`, `changeValue` substitui as intencoes separadas de escrita e alternancia. O editor oferece operacoes conforme o tipo/acesso do `DataBinding`; o gerador compila o apontamento para um ponto tecnico e o Device Runtime executa `set`, `add`, `subtract` ou `toggle`. Somente o valor final de uma Tag externa atravessa o LinkPad Protocol, preservando a independencia entre editor, hardware e driver industrial.

No Studio `0.17.0`, ferramentas que precisam de largura e contexto da tela passam a poder ocupar `ScreenBottomPanel`. O componente recebe guias declarativas e mantem expansao/selecao apenas na sessao. Controles deixam de abrir um workspace modal e usam a primeira guia; Alertas deixa o drawer direito e usa a segunda, mantendo a selecao de widgets pelo controller compartilhado. O modal pontual de criacao de acao permanece independente. Projeto, Runtime e Agent nao conhecem essa composicao visual.

No Studio `0.17.1`, `compile_data_bindings` separa o catalogo de Tags globais do conjunto embarcado: somente IDs alcançados por bindings de widgets ou controles sao materializados no firmware, preservando a ordem do projeto. O Device Runtime `0.12.1` conserva saude agregada apenas para diagnostico do perfil; autorizacao de `add`, `subtract` e `toggle` usa sessao ativa e qualidade `good` do ponto-alvo. Resposta parcial atualiza cada ponto independentemente, e falha de transporte, parse ou sessao invalida a qualidade antes de outro calculo relativo.

No Studio `0.7.0`, seleção de dados pertence a uma camada canônica acima de widgets e hardwares. Consumidores declaram acesso e tipos aceitos; `DataBindingField` fornece as duas origens e o catálogo interno fornece o formulário de endereço. Desde `0.7.1`, as abas visíveis são `PLC` e `Tags globais`. No `0.7.2`, `ConnectorAddressEditor` também é consumido por Tags globais e limites de escrita pertencem ao widget/ação, embora o gerador continue incorporando-os ao ponto enviado pelo runtime.

No Studio/runtime `0.8.0`, uma Tag global interna é uma variável do Device Runtime e não uma comunicação industrial. O Tag Manager salva `initialValue` e o atributo `retentive`; o gerador mantém o ponto local sem perfil/endereço e o runtime resolve a escrita antes da camada LinkPad Protocol. A implementação ESP32 usa NVS por projeto e ID estável, enquanto Tags externas continuam seguindo o fluxo oficial pelo Agent.

No Studio `0.9.0`, OPC UA é uma comunicação externa genérica. O Studio conhece somente endpoint, opções e Node ID; `asyncua`, sessão OPC UA, VariantType, StatusCode e reconexão pertencem ao Agent. O Device Runtime `0.8.0` não muda porque já encaminha descritores genéricos por perfil.

No Studio `0.9.1`, `ContextPanel` recebe a aba ativa e apresenta `WidgetCatalogPanel` somente para `screen`. O catálogo declarativo e a fábrica em `widgetCatalog.ts` concentram os tipos e valores iniciais; o painel apenas solicita a inclusão na tela ativa. Na evolucao atual, `ScreenEditor` permanece responsavel pelo display, selecao e arraste, enquanto `ContextPanel` hospeda o resumo e as propriedades do widget selecionado em duas secoes verticais. Essa fronteira permite evoluir o contexto direito sem criar catálogos ou formularios diferentes por hardware.

No Studio `0.10.0`, `useWidgetEditorController` sobe para o workspace e passa a ser a fonte unica de selecao e historico. Nao existe estado separado de popup ou modo de edicao: a selecao unica alimenta diretamente `WidgetPropertiesPanel`. `ScreenCanvas` mantem somente estados efemeros de manipulacao e marquee; `widgetGeometry.ts` concentra movimentos, resize, snap, alinhamento, distribuicao, centralizacao e tamanho em pixels logicos. O Contexto chama as mesmas operacoes sobre a mesma selecao. A escala visual e o zoom nao alteram as coordenadas persistidas.

No Studio `0.11.0`, `editor.locked` e `editor.groupId` passam a compor apenas o documento de engenharia. Camadas, grupos e area de transferencia operam sobre os mesmos widgets e o gerador remove o objeto `editor` antes de montar a configuracao embarcada. Grupos nao sao containers de runtime e nao alteram ordem, geometria ou renderizacao no hardware.

No Studio `0.12.0`, o modulo de geometria tambem calcula snap inteligente e guias a partir de bordas/centros de widgets e display. Grade, tamanho da grade, guias e destaques continuam efemeros; as coordenadas finais permanecem os unicos valores persistidos.

No Studio `0.13.0`, `gauge` e `progress_bar` entram no catalogo declarativo, reutilizam `DataBindingField` e aceitam somente dados numericos. O schema `0.7.0` normaliza estilo visual comum. O preview e o renderer M5 consomem as mesmas propriedades, enquanto um futuro hardware implementa apenas a adaptacao grafica.

No Studio `0.14.0`, `widgetAudit.ts` calcula problemas de qualidade a partir do projeto atual. Na composicao atual, a guia inferior `Alertas` e o canvas consomem esse resultado, mas nenhum alerta e serializado. Auditoria e assistencia de engenharia, nao comportamento do Device Runtime.

Na evolucao atual da interface, `ContextPanel` funciona como inspector orientado pela selecao. Catalogo e camadas sao drawers temporarios acionados por uma barra compacta; a auditoria usa a guia `Alertas` do painel inferior. Selecionar um widget devolve o foco ao inspector sem interferir na ferramenta inferior aberta. `WidgetPropertiesPanel` concentra geometria, visibilidade, conteudo e aparencia; a barra do canvas conserva somente a identidade compacta. `WidgetArrangeMenu`, `WidgetOrderMenu` e `WidgetGroupMenu` levam alinhamento/distribuicao/igualacao, ordem de camadas e agrupamento para a barra, que e o contexto natural dessas operacoes sobre a selecao. `ScreenEditor` controla qual desses menus esta aberto para garantir expansao mutuamente exclusiva. Area de transferencia, duplicacao, bloqueio e exclusao ficam no menu de contexto criado pelo `ScreenCanvas`, fora do recorte do display por meio de portal.

O duplo clique no canvas publica uma nova selecao unitaria mesmo quando o widget ja era o item primario. `ContextPanel` observa a identidade completa dessa selecao e recolhe o drawer ativo, tornando o inspector de propriedades o destino deterministico da acao sem criar estado persistente ou modo de edicao adicional.

Na navegacao esquerda, `Projeto` e a raiz funcional dos dados gerais e do hardware selecionado. O resumo antes apresentado por uma aba `Device` independente passa a ser uma secao interna da pagina de projeto, enquanto Rede LinkPad, Comunicacoes, Tags globais, Telas, Build e Diagnostico continuam destinos proprios. `Assets` nao e um destino navegavel porque ainda nao existe importador nem consumidor de imagem/fonte; o campo `assets` permanece serializado somente para compatibilidade com projetos existentes e para uma evolucao futura contratada.

`WidgetPropertiesPanel` unifica configuracao funcional e estilo portatil em uma lista `Propriedade | Valor | Animacao`, com a ultima coluna reservada para o futuro contrato de animacoes. A lista usa grupos recolhiveis com estado local por widget: `Conteudo` e `Visual` iniciam abertos; `Borda e espaco` e `Posicao e exibicao` iniciam recolhidos, sendo geometria e visibilidade o ultimo grupo. Selecao multipla nao mostra propriedades individuais, mas o menu de contexto preserva o conjunto quando aberto sobre um de seus membros. Os grupos continuam gravando exatamente as mesmas propriedades em `widget.props` e na geometria do widget; sua expansao e apenas estado visual.

O catalogo e o canvas usam Pointer Events. O catalogo publica um evento interno de movimento/entrega na mesma janela e mostra um fantasma visual; o canvas aceita a entrega somente dentro dos seus limites. Nenhum `DataTransfer` do sistema e usado. Depois que o widget esta na tela, a mesma familia de eventos controla mouse, caneta e touch. A geometria intermediaria existe apenas durante o gesto; uma unica entrada de historico e criada ao soltar.

As propriedades `fontSize`, `color`, `backgroundColor`, `transparent`, `textAlign`, `verticalAlign`, `padding`, `borderWidth`, `borderColor` e `borderRadius` pertencem ao widget, nao ao M5. O preview usa pixels logicos relativos ao display e cada template converte para sua API grafica. O runtime M5 `0.10.0` adapta esses valores aos recursos do M5Unified; um futuro hardware pode usar fonte vetorial sem alterar o projeto.

O bootstrap visual do Studio pertence ao `index.html`, com estilos criticos inline para aparecer antes do download e da execucao do bundle React. A janela Tauri usa a mesma cor de fundo para evitar flash branco antes do HTML. `main.tsx` remove o bootstrap no primeiro efeito posterior a montagem de `App`; nao existe duracao minima, porcentagem simulada nem dependencia de backend. Se a inicializacao evoluir para tarefas assincronas reais, seus estados devem substituir esse indicador indeterminado por progresso observavel.

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
run_firmware_build
list_serial_ports
get_toolchain_status
prepare_toolchain
```

`toolchain.rs` gerencia o Python portatil e o PlatformIO privados do Studio. A UI consulta o estado pelo comando `get_toolchain_status`; `prepare_toolchain` executa a preparacao fora da thread principal e publica progresso pelo evento `toolchain-progress`.

O build nunca resolve `pio` pelo `PATH`. O comando usa o executavel absoluto em `%LOCALAPPDATA%\LinkPadStudio\pio`, sincroniza o fonte gerado em `%LOCALAPPDATA%\LinkPadStudio\b\<id>` e copia os artefatos finais de volta para o projeto. O staging compacto evita falhas do toolchain ESP32 provocadas por caminhos longos no Windows.

`run_firmware_build` tambem executa em uma tarefa bloqueante separada da thread da interface. Ele sempre gera novamente o codigo do projeto antes de chamar o PlatformIO: no modo `build`, conclui apos a compilacao; no modo `flash`, compila e grava na porta selecionada. A saida padrao e a saida de erro do PlatformIO sao lidas enquanto o processo esta ativo e convertidas em eventos `firmware-progress`, mantendo a janela responsiva durante compilacoes e gravacoes longas. A geracao isolada permanece uma funcao interna testavel do backend, nao uma etapa manual da interface.

O template M5 inclui `LinkPadInputAdapter.h`, que emite eventos logicos `primary/press` e `secondary/press`. `LinkPadRuntime` localiza o vinculo na tela corrente e executa navegacao ou escrita pelo motor generico; outros hardwares devem fornecer seu proprio adaptador mantendo o mesmo contrato.

`list_serial_ports` consulta o sistema operacional em uma tarefa bloqueante e devolve somente descritores de portas atualmente detectadas. O frontend preserva uma porta salva que esteja temporariamente ausente para diagnostico, mas nao permite iniciar `flash` ate que uma porta retornada por esse comando seja selecionada. Esse estado e configuracao local de deploy e nao afeta o runtime gerado.

`test_connector_connection` executa em tarefa bloqueante, usa o cliente HTTP Rust e envia somente o target do perfil. Ele cria e encerra uma sessao LinkPad Protocol para validar o handshake do driver; nao recebe endereco de tag e nao chama leitura/escrita.

A capability Tauri `main-events`, em `src-tauri/capabilities/default.json`, autoriza a janela `main` somente a registrar e remover listeners (`core:event:allow-listen` e `core:event:allow-unlisten`). O frontend nao recebe permissao para emitir eventos; `firmware-progress` e `toolchain-progress` continuam sendo produzidos exclusivamente pelo backend Rust.

Nao usar APIs de arquivo do navegador, como `showDirectoryPicker`, `showOpenFilePicker` ou `<input type="file">`, porque elas geram prompts de permissao de site dentro do WebView e quebram a experiencia de aplicativo Windows.

## Fronteiras Para as Proximas Evolucoes

- Browse e teste de ponto devem alimentar `ConnectorAddressEditor`/`DataBindingField`; nao podem criar outro seletor por protocolo.
- Um novo hardware entra por manifesto, template e adaptadores de display/entrada/armazenamento; telas, widgets e `DataBinding` permanecem comuns.
- Retencao continua sendo atributo de Tag interna. Outro hardware implementa o backend local equivalente a NVS sem mudar o schema da Tag.
- Um novo driver so fica habilitado quando o Agent o anunciar em capabilities; o Studio conhece apenas schema declarativo de target/endereco.
- Certificados e credenciais OPC UA pertencem ao Agent. O projeto pode referenciar uma politica, mas nao deve incorporar chave privada ou senha industrial no firmware.
- Assinaturas/subscriptions, browse e novos endpoints exigem decisao de contrato e versionamento antes da interface.

O sequenciamento recomendado esta em `../../docs/06-estado-atual-e-proximos-passos.md`.
