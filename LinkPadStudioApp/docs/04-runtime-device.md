# Runtime Device

## Objetivo

Definir o firmware/runtime que o Studio gera para cada hardware.

## Responsabilidades

O Device Runtime deve:

- Inicializar hardware.
- Conectar rede.
- Comunicar com qualquer LinkPad Agente compativel via LinkPad Protocol HTTP/JSON.
- Consultar capacidades e versao do Agente.
- Criar e renovar sessoes efemeras enviando descritores de protocolo.
- Ler e escrever enderecos industriais declarativos.
- Manter cache local.
- Executar Tags internas sem depender de rede ou Agente.
- Renderizar telas.
- Tratar botoes/touch.
- Mostrar estados de comunicacao.
- Persistir configuracoes locais quando permitido.

## Arquitetura Conceitual

```text
Device Runtime
  Hardware Abstraction
  Network Manager
  LinkPad Protocol Client
  Protocol Descriptor Store
  Tag Cache
  Screen Renderer
  Input Manager
  Event Engine
  Local Settings
  Diagnostics
```

## Estados Minimos

- `booting`
- `network_connecting`
- `agent_offline`
- `agent_online`
- `session_opening`
- `target_pending`
- `target_online`
- `tag_stale`
- `write_pending`
- `write_failed`

## Entradas e Acoes

O runtime recebe eventos normalizados do adaptador do hardware. O `Input Manager` nao conhece telas ou tags; ele apenas fornece `inputId` e `event`. O `Event Engine` consulta `inputBindings` da tela corrente e executa, na ordem salva, todas as acoes declaradas para o mesmo par.

Acoes implementadas no runtime `0.6.0`:

- `navigate`: proxima tela, tela anterior ou `screenId` especifico;
- `changeValue`: define, soma, subtrai ou inverte o valor, conforme o tipo e o acesso da Tag;
- `activateWidget`: executa um `write_button` especifico da tela.
- `powerOff`: solicita desligamento ao adaptador de energia quando o hardware oferece essa capacidade e a entrada autoriza a acao em `deviceActions`.

Falhas de escrita entram em `write_failed` e nunca geram repeticao automatica. Uma falha nao interrompe as demais acoes do evento. `powerOff` encerra fisicamente a sequencia, por isso o Studio avisa quando nao estiver por ultimo. Controles/eventos ausentes sao ignorados pelo runtime e bloqueados pela validacao do Studio.

## M5StickC Plus2

No M5StickC Plus2, o adaptador `LinkPadInputAdapter` mapeia:

- Botao A: `primary/press` e `primary/longPress`.
- Botao B: `secondary/press` e `secondary/longPress`.
- Power: `power/press` e `power/longPress`.

Os tres controles emitem eventos, mas somente Power autoriza `powerOff` no manifesto. A restricao e validada pelo Studio; o runtime continua recebendo a mesma acao logica e nao depende do nome fisico do botao.

No runtime `0.11.0`, `press` usa `wasClicked` e so ocorre ao concluir um clique curto; `longPress` usa `wasHold` no inicio da retencao. Assim, segurar nao dispara tambem a acao curta. Duplo clique e outros eventos permanecem previstos no contrato, mas so aparecem quando o adaptador e o manifesto do hardware os oferecerem.

## Runtime MVP Implementado

O template `m5stickc-plus2` implementa:

- conexao Wi-Fi;
- consulta de `/lpp/v1/status` e `/lpp/v1/capabilities`;
- criacao e recuperacao de uma sessao para cada perfil habilitado;
- leitura em lote agrupada por `protocolProfileId`;
- escrita acionada por `write_button`, com `requestId` novo por intencao;
- invalidacao e recriacao de sessao apos `404` ou `410`;
- tratamento de `status: partial` e erros por ponto sem apagar o ultimo valor, mas invalidando a qualidade somente do ponto afetado;
- escrita considerada concluida somente quando o item retorna `status: written`;
- backoff simples para rede/Agent indisponivel;
- renderizacao de texto, valor, booleano, status, botao, medidor e barra de progresso;
- adaptador fisico A/B/Power e motor declarativo de sequencias por evento;
- Tags internas inicializadas e escritas no cache local, com retenção NVS opcional.

Limitacoes do MVP:

- conectores liberados no Studio: `sim`, `siemens-s7` e `opcua`;
- sem menu local de edicao de rede;
- sem OTA;
- confirmacao visual de escrita ainda simplificada.

## Regra Importante

O runtime nao implementa S7, OPC UA, EtherNet/IP, PROFINET IO ou Modbus. Ele apenas serializa descritores declarativos e fala LinkPad Protocol com o Agente. A liberacao de `siemens-s7` ou `opcua` nao adiciona biblioteca industrial ao M5.

O Studio `0.17.1` gera o Device Runtime `0.12.1`. O suporte OPC UA continua usando o caminho generico (`driver`, `endpoint`, `options`, `auth`, `type` e `address.nodeId`); o painel inferior e apenas interface do Studio, e controles, operacoes de valor e desligamento nao adicionam bibliotecas industriais ao device.

Se o Agente reiniciar ou uma sessao expirar, o runtime deve recriar somente a sessao correspondente usando o perfil incorporado ao firmware. As demais sessoes continuam operando.

HTTP 200 nao implica sucesso industrial do lote. O runtime usa `status`/`quality` de cada ponto: leitura parcial entra em `tag_stale`, e escrita `uncertain` entra em `write_failed` sem gerar repeticao automatica.

O runtime `0.5.0` remove a faixa textual `WiFi/Agent/S/T`. Cada tela recebe uma marca d'agua com dois icones vetoriais: Wi-Fi e Agent em verde quando disponiveis e vermelho quando indisponiveis. Sessoes e saude de tags continuam no estado interno, mas nao ocupam a interface principal.

O overlay e uma camada do `Screen Renderer`, nao um widget salvo em cada tela. Ele usa o descritor `hardware.statusOverlay`, escala pela dimensao do display e e renderizado depois dos widgets. Assim, novas familias de hardware podem reutilizar o mesmo contrato e fornecer apenas o adaptador grafico do seu template.

No runtime `0.12.0`, o mesmo principio se aplica a entrada e energia: `LinkPadRuntime` recebe eventos logicos e a acao `powerOff`; apenas `LinkPadInputAdapter.h` conhece A/B/Power, enquanto a implementacao M5 da acao chama `M5.Power.powerOff()`. Novos templates substituem essas adaptacoes e mantem o motor de acoes.

## Alteracao de valor no runtime 0.12.1

`changeValue` usa quatro operacoes internas:

- `set`: grava `operand` diretamente e requer apenas acesso de escrita;
- `add` e `subtract`: calculam um novo numero a partir do ultimo valor conhecido;
- `toggle`: inverte uma Tag booleana.

As tres operacoes relativas exigem uma Tag `readWrite` com qualidade individual `good`. Para uma Tag externa, a sessao do perfil precisa estar ativa, mas a falha de outro ponto do mesmo PLC nao bloqueia a operacao. Para uma Tag interna, o cache local ja e a fonte de verdade. `min` e `max` validam o resultado calculado. Quando uma acao da sequencia grava com sucesso, o cache e atualizado e a acao seguinte observa esse novo valor.

Antes de processar cada lote de leitura, os pontos daquele perfil passam transitoriamente a `unknown`; cada item retornado recupera sua propria qualidade. Falha HTTP, resposta JSON invalida ou perda de sessao invalida os pontos do perfil. Assim, o isolamento por Tag nao permite que uma operacao relativa use silenciosamente um valor antigo depois de perda de comunicacao.

O runtime envia ao Agent somente o valor final pelo `/lpp/v1/write`. Portanto, a leitura-modificacao-escrita e deterministica dentro da sequencia local, mas nao e atomica diante de outro hardware, supervisório ou PLC escrevendo o mesmo ponto entre a leitura e a gravacao.

## DataBinding compilado no runtime 0.7.0

O schema editável `0.4.0` permite que widgets e ações referenciem diretamente um conector/endereço ou uma Tag global. O runtime embarcado não interpreta essa escolha de engenharia. Durante a geração, o Studio resolve todos os `DataBinding` para pontos da configuração embarcada:

- Tags globais são resolvidas por ID estável para seu nome lógico;
- Tags globais sem consumidor em widget ou controle permanecem no projeto, mas nao entram no JSON embarcado nem no polling;
- endereços diretos equivalentes são deduplicados;
- usos de leitura e escrita compartilham o mesmo ponto quando perfil, tipo e endereço coincidem;
- o identificador técnico alimenta cache e requisições HTTP;
- o rótulo legível, como `DB10.DBD4`, permanece separado para renderização.

Depois dessa compilação, polling, cache, agrupamento por `protocolProfileId`, escrita e recuperação de sessão seguem o mesmo fluxo existente. O LinkPad Protocol permanece `0.1.0` e o runtime continua sem bibliotecas industriais.

## Tags internas no runtime 0.8.0

Tags globais `source: internal` não possuem `protocolProfileId` nem `address`. O runtime inicializa seu cache com `initialValue` antes da primeira renderização e atribui qualidade `good`. Widgets e ações usam o mesmo nome técnico compilado, mas leituras e escritas permanecem inteiramente no device.

Uma escrita interna valida direção, tipo e limites efetivos agregados pelo gerador. O valor é atualizado no cache e a tela pode ser renderizada mesmo quando Wi-Fi ou Agent estão offline. Nenhuma sessão é criada e nenhum endpoint HTTP é chamado por causa da Tag interna.

`retentive` é um atributo booleano exclusivo da Tag interna. Quando ativo no template ESP32, o último valor é persistido em NVS por `projectId` e ID estável da Tag. Atualizações próximas são consolidadas por 500 ms para reduzir desgaste da flash. Trocar o projeto ou alterar tipo/faixa de forma incompatível descarta o valor armazenado e restaura `initialValue`.

## Estilo de widgets no runtime 0.9.0

O renderer recebe `fontSize`, `color`, `backgroundColor` e `transparent` dentro de `widget.props`. Esses campos sao independentes de hardware: usam pixels logicos e cores `#RRGGBB`; cada template e responsavel por adaptar aos recursos de seu display.

No M5StickC Plus2, `fontSize` entre 6 e 32 e arredondado para a escala inteira 1 a 4 oferecida pela fonte nativa do M5Unified. Fundo opaco pinta os limites do widget antes do conteudo; fundo transparente preserva a tela abaixo. Texto, valor, booleano, status e botao usam o mesmo contrato. Projetos antigos aplicam defaults e continuam renderizaveis.

Essa evolucao nao adiciona biblioteca industrial, nao altera o overlay, nao muda o LinkPad Protocol e nao cria dependencia do M5 no schema do widget.

## Sistema de widgets no runtime 0.10.0

O runtime `0.10.0` amplia o contrato visual com `textAlign`, `verticalAlign`, `padding`, `borderWidth`, `borderColor` e `borderRadius`. As medidas continuam em pixels logicos e cada renderer pode adaptar limitacoes de fonte e primitivas graficas sem mudar o projeto.

`gauge` e `progress_bar` sao consumidores numericos de leitura. Ambos recebem o ponto tecnico compilado em `props.tag`, faixa visual `min`/`max` e `showValue`. A faixa serve apenas para representacao e nao altera escala, permissao ou limites industriais da Tag.

Metadados `widget.editor` usados para grupo e bloqueio sao removidos pelo gerador. Guias, grade, auditoria e selecao nunca entram no JSON embarcado. O template M5 `0.10.0` com os sete widgets foi compilado pela toolchain PlatformIO gerenciada.

## Estado Consolidado e Evolucoes

O Runtime `0.12.1` esta compilado e validado no M5StickC Plus2 com sete widgets, estilo portatil, sequencias de acoes, alteracao de valores isolada por ponto, A/B/Power com clique curto/segurar, desligamento, `sim`, S7 nativo e descritor OPC UA generico. O caminho S7 real ja foi validado em leitura; OPC UA ainda precisa de bancada no S7-1200 fisico.

Proximas evolucoes do runtime:

- adaptadores de display, entrada e armazenamento para um segundo hardware;
- eventos adicionais, como long press e encoder, somente quando o manifesto/template os implementarem;
- simulacao equivalente desses eventos no Studio;
- melhor feedback visual de escrita e qualidade por widget;
- configuracao local/OTA apenas depois de definir seguranca e politica de provisionamento.

Subscriptions OPC UA, browse e drivers industriais nao pertencem ao firmware. Se o LinkPad Protocol evoluir para notificacoes, o runtime recebera uma capacidade generica, sem importar bibliotecas do PLC.
