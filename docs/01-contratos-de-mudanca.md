# Contratos de Mudanca

## Objetivo

Padronizar como alteracoes tecnicas devem ser registradas e quais documentos devem ser atualizados.

## Regra Geral

Toda alteracao deve responder:

- O que mudou?
- Qual contrato foi afetado?
- Quais componentes dependem disso?
- Ha impacto em projetos existentes?
- Ha impacto no runtime embarcado?
- Ha impacto no agente?
- Ha migracao necessaria?

## Matriz de Impacto

| Mudanca | Docs obrigatorios |
| --- | --- |
| Endpoint HTTP | `LinkPadAgenteApp/docs/02-api-http-device-agent.md`, `LinkPadStudioApp/docs/07-integracao-com-agent-http.md` |
| Campo de resposta HTTP | `LinkPadAgenteApp/docs/02-api-http-device-agent.md`, `LinkPadStudioApp/docs/07-integracao-com-agent-http.md` |
| Modelo de tag | `LinkPadStudioApp/docs/06-modelo-de-tags.md`, `LinkPadAgenteApp/docs/08-gerenciamento-de-tags.md` |
| Novo hardware | `LinkPadStudioApp/docs/03-catalogo-de-hardwares.md`, `LinkPadStudioApp/docs/04-runtime-device.md` |
| Novo widget | `LinkPadStudioApp/docs/05-editor-visual-e-widgets.md`, `LinkPadStudioApp/docs/04-runtime-device.md` |
| Novo driver industrial | `LinkPadAgenteApp/docs/04-drivers-industriais.md` e doc especifico do driver |
| Mudanca de seguranca | `LinkPadAgenteApp/docs/10-seguranca-token-whitelist.md`, API se aplicavel |
| Mudanca em build/deploy | `LinkPadStudioApp/docs/10-build-deploy-devices.md` ou `LinkPadAgenteApp/docs/14-servico-windows-deploy.md` |
| Mudanca de roadmap | `LinkPadStudioApp/docs/11-mvp-studio-roadmap.md` ou `LinkPadAgenteApp/docs/15-mvp-agente-roadmap.md` |

## Contrato LinkPad Protocol

O LinkPad Protocol deve ser tratado como API publica interna entre Device Runtime e LinkPad Agente.

Mudancas devem preservar compatibilidade sempre que possivel.

No novo contrato, o Device Runtime cria uma sessao efemera enviando um descritor de destino industrial. Leituras e escritas posteriores referenciam essa sessao e enviam enderecos declarativos.

Cada resultado de leitura deve manter a transicao:

```json
{
  "id": "DG01Amp",
  "value": 12.4,
  "valor": 12.4,
  "quality": "good"
}
```

`value` e o nome canonico futuro. `valor` permanece enquanto houver runtime legado ou firmware derivado do exemplo.

O Agente nao deve exigir configuracao persistente de PLC, tags ou projeto para executar o LinkPad Protocol.

## Decisao Arquitetural: Agente Orientado a Requisicoes

Decisao:

O LinkPad Agente sera um executor generico de requisicoes industriais. O Device Runtime enviara, pelo LinkPad Protocol, o driver, o destino e os enderecos necessarios. O Studio e o Agente nao terao pareamento nem troca direta de configuracao.

Contexto:

O prototipo do Agente foi validado com um PLC Rockwell configurado localmente, UI extensa e estado global de conexao. Para aproximar o produto de uma experiencia plug and play, a configuracao de engenharia deve ser criada no Studio, incorporada ao runtime e apresentada ao Agente pelo hardware.

Alternativas consideradas:

- Manter PLC, tags e perfis configurados manualmente no Agente.
- Fazer o Studio implantar perfis diretamente no Agente.
- Executar os protocolos industriais diretamente no device.

Consequencias:

- O Agente pode atender simultaneamente varios devices, PLCs e protocolos.
- O Agente nao possui um estado global `plc_connected`; o estado e por sessao/conexao.
- O Agente continua internamente stateful para reutilizar conexoes, aplicar cache, rate limit e filas.
- O runtime passa a carregar descritores de protocolo e enderecos de tags.
- A seguranca deve impedir que o Agente se torne um proxy industrial aberto.
- A prioridade Siemens OPC UA registrada inicialmente foi substituida pela decisao Siemens S7 nativo abaixo; Rockwell Logix via `pycomm3` permanece como driver validado pelo prototipo.

Data:

2026-07-15

## Decisao Arquitetural: Siemens S7 Nativo Como Primeiro PLC Real

Decisao:

O primeiro conector industrial do MVP e `siemens-s7`, executado exclusivamente no LinkPad Agent. O Device Runtime envia um target `s7://IPv4:102` e enderecos absolutos de DB; o Studio apenas edita e incorpora esses descritores.

Contexto:

O fluxo completo com o driver `sim` foi validado no M5StickC Plus2. Para o primeiro teste com S7-1200, a comunicacao S7 nativa oferece uma fatia menor que OPC UA e passa a compor a familia permanente de conectores Siemens.

Alternativas consideradas:

- Siemens OPC UA como primeiro conector.
- PROFINET IO.
- Biblioteca S7 diretamente no device.

Consequencias:

- O Agent `0.2.0` inclui `siemens-s7` com `python-snap7 3.0.0`, conexoes serializadas e I/O fora da thread HTTP.
- O MVP aceita apenas IPv4 RFC1918, TCP 102, area DB e tipos `BOOL`, `INT`, `DINT` e `REAL`.
- Leituras podem reconectar e repetir uma vez; escritas nunca sao repetidas automaticamente e exigem leitura de confirmacao.
- O S7-1200 deve usar DB nao otimizado e permitir comunicacao PUT/GET para enderecamento absoluto.
- OPC UA permaneceu como conector posterior e foi entregue de forma generica no Studio `0.9.0`/Agent `0.3.0`; ele nao substitui o S7 nativo.
- LinkPad Protocol e schema de projeto permanecem em `0.1.0` e `0.2.0`, pois os descritores ja eram genericos.

Data:

2026-07-15

## Decisao Arquitetural: Teste Efemero de Conector Pelo Studio

Decisao:

O Studio pode, por acao explicita do usuario na tela de Conectores, criar e encerrar uma sessao temporaria do LinkPad Protocol para validar o caminho `Studio -> Agent -> driver -> PLC`. Esse teste nao envia endereco, nao le DB/tag e nao escreve.

Contexto:

O teste de Agent existente comprova apenas HTTP, token e capacidades. Durante a engenharia do perfil e util validar IP, porta, rack, slot e handshake do protocolo antes de gerar o firmware, sem exigir que uma tag ja esteja declarada.

Consequencias:

- O Studio continua sem pareamento e sem implantacao de configuracao no Agent.
- O teste usa `POST /lpp/v1/sessions` e `DELETE /lpp/v1/sessions/{sessionId}` existentes; nenhum endpoint ou versao do LinkPad Protocol e criado.
- O `deviceId` temporario e o `projectId` do projeto, preservando a mesma whitelist usada pelo runtime gerado.
- O sucesso comprova transporte e handshake do driver, nao DB, permissao PUT/GET ou endereco de tag.
- Testes de tag pertencerao futuramente ao editor de Tags e serao operacoes separadas.
- Uma conexao ociosa pode permanecer no pool pelo TTL local do Agent, mas a sessao de teste e encerrada imediatamente.

Data:

2026-07-15

## Decisao Arquitetural: Studio 0.2 e Runtime Gerado

Decisao:

O Studio `0.2.0` persiste rede, perfis de protocolo, tags, telas e build no projeto `.linkpad`. O runtime M5 e gerado como projeto PlatformIO a partir de templates versionados, com configuracao compilada separada do codigo reutilizavel.

Contexto:

O shell inicial do Studio ja criava projetos e telas, mas nao possuia editores funcionais, migracao, perfis persistidos nem gerador de runtime. O MVP precisa validar o fluxo com o driver `sim` antes dos testes reais Siemens e Rockwell.

Alternativas consideradas:

- Gerar um `.ino` monolitico por concatenacao.
- Fazer o Studio configurar o Agent diretamente.
- Habilitar conectores ainda nao implementados no Agent.

Consequencias:

- Projetos `0.1.0` sao migrados para `0.2.0` com backup no primeiro salvamento.
- `sim` foi o unico conector habilitavel no Studio `0.2.0`; o Studio `0.3.0` habilita tambem `siemens-s7` sem alterar o schema do projeto.
- O firmware usa LinkPad Protocol `0.1.0`; desde o runtime `0.4.0`, cria uma sessao efemera por perfil e recria somente a sessao afetada apos `404`/`410`.
- O build e a gravacao usam um PlatformIO gerenciado pelo Studio, sem depender de instalacao manual ou do `PATH`, e registram `build/latest.log`.
- A primeira preparacao baixa um Python portatil e o instalador oficial do PlatformIO, ambos fixados e validados por SHA-256.
- A toolchain fica isolada em `%LOCALAPPDATA%\LinkPadStudio\pio` e o build usa staging compacto em `%LOCALAPPDATA%\LinkPadStudio\b` para evitar limites de caminho e linha de comando do Windows.
- Senha Wi-Fi, token e autenticacao de perfis incorporados ao firmware sao segredos de build e geram alerta.

Data:

2026-07-15

## Decisao Arquitetural: Runtime Multi-Conectores

Decisao:

O Studio `0.4.0` permite varios perfis habilitados no mesmo projeto. Cada tag continua ligada a um `protocolProfileId`, e o Device Runtime `0.4.0` cria e mantem uma sessao LinkPad Protocol independente para cada perfil habilitado.

Contexto:

O schema `0.2.0` ja representava `protocols` como lista e cada tag ja continha o identificador do perfil. A primeira implementacao do runtime usava somente o primeiro perfil habilitado para reduzir a fatia inicial do MVP. Depois da validacao ponta a ponta com S7 real, essa limitacao artificial passou a gerar ambiguidade na UI e impedia aproveitar o modelo existente.

Consequencias:

- Um mesmo M5 pode consumir tags de simulacao, Siemens S7 e futuros drivers simultaneamente, desde que o Agent anuncie as capacidades correspondentes.
- Leituras sao agrupadas por perfil e enviadas com o `sessionId` correto; escritas usam a sessao do perfil associado a tag.
- Falha ou expiracao de uma sessao nao invalida as demais; o runtime aplica retry por perfil.
- O indicador do device separa alcance do Agent, quantidade de sessoes e saude das tags.
- O Agent nao recebe nova configuracao persistente e nao exige alteracao de endpoint: ele ja suportava varias sessoes por device/projeto.
- Schema de projeto e LinkPad Protocol permanecem inalterados; apenas Studio e Device Runtime avancam para `0.4.0`.

Data:

2026-07-15

## Decisao Arquitetural: Toolchain Gerenciada Pelo Studio

Decisao:

O usuario final nao deve instalar PlatformIO, Python, pacotes ESP32 ou configurar `PATH`. O Studio prepara e mantem uma toolchain privada por usuario na primeira compilacao ou quando o usuario aciona `Preparar ambiente`.

Contexto:

Exigir uma instalacao externa contradiz a experiencia instalavel e proxima de plug and play desejada para o LinkPad Studio. Tambem torna o build dependente de versoes e configuracoes globais da maquina.

Alternativas consideradas:

- Exigir PlatformIO Core instalado globalmente.
- Incluir toda a toolchain ESP32 dentro do instalador desktop.
- Baixar e manter a toolchain de forma automatica e isolada.

Consequencias:

- O instalador do Studio permanece menor e a primeira preparacao exige internet.
- O download, a instalacao e o uso do PlatformIO nao exigem acao administrativa ou instalacao manual.
- Python portatil e script de instalacao possuem origem e hash fixados; plataforma ESP32 e bibliotecas do firmware possuem versoes fixadas no template.
- O Studio usa apenas o executavel absoluto do ambiente gerenciado e nunca busca `pio` global no `PATH`.
- Os artefatos finais sao copiados do staging interno para `build/firmware/` no projeto.

Data:

2026-07-15

## Decisao Arquitetural: Overlay Portatil de Status do Runtime

Decisao:

O Device Runtime `0.5.0` apresenta somente os estados de Wi-Fi e Agent como icones vetoriais coloridos, sobrepostos como marca d'agua em todas as telas. Contadores de sessao e saude de tag deixam de ocupar a interface principal.

Contexto:

O diagnostico textual `WiFi`, `Agent`, `S` e `T` consumia uma faixa fixa do pequeno display e misturava informacao operacional detalhada com a tela criada pelo usuario. A evolucao para outros hardwares exige que indicadores permanentes sejam independentes de resolucao e de coordenadas especificas do M5.

Consequencias:

- O catalogo de hardware declara um `statusOverlay` com habilitacao, posicao, estilo e indicadores.
- Projetos anteriores recebem o overlay default durante a normalizacao, sem alterar o schema `0.2.0`.
- O firmware gerado carrega o descritor em `ui.statusOverlay` e calcula tamanho, margem e espacamento pela menor dimensao do display.
- O renderer usa primitivas graficas vetoriais e uma interface de display compativel, permitindo reutilizacao por futuros templates de hardware.
- Verde representa Wi-Fi/Agent disponivel e vermelho representa indisponivel; falha de PLC/tag nao altera o icone do Agent.
- Diagnosticos detalhados de sessoes, conectores e tags permanecem no estado interno e nas APIs, sem aparecer como texto fixo nas telas.
- LinkPad Protocol e API do Agent nao mudam.

Data:

2026-07-16

## Decisao Arquitetural: Colaboracao Sequencial ou Simultanea Orientada a Agentes

Decisao:

O repositorio usa `AGENTS.md` como contrato canonico e `docs/05-fluxo-colaboracao.md` como processo operacional. Uma linha local conduzida por uma pessoa pode evoluir sequencialmente e ser publicada quando estiver coerente. Quando houver paralelismo real ou revisao remota, cada objetivo ocorre fora da `main`, torna seu escopo visivel por branch/PR, integra a base atual e passa pela CI comum.

Contexto:

O ritmo de desenvolvimento assistido por IA permite varias mudancas relevantes em paralelo. Apenas compartilhar comandos Git nao evita conflitos semanticos, divergencia de contratos ou a substituicao acidental do trabalho de outro colaborador.

Alternativas consideradas:

- Manter instrucoes informais fora do repositorio.
- Concentrar toda integracao em uma branch longa.
- Permitir que cada agente escolha livremente seu fluxo e seus testes.

Consequencias:

- Uma intencao curta pode ser expandida pelo agente a partir dos contratos versionados.
- O fluxo sequencial evita mecanica Git desnecessaria durante iteracoes locais guiadas.
- Branches curtas e publicadas cedo tornam trabalhos simultaneos visiveis.
- Pull Requests e CI verificam a integracao antes da aprovacao humana.
- Nenhum agente recebe autorizacao implicita para fazer merge automatico na `main`.
- Mudancas relacionadas, mas fora do objetivo atual, devem virar continuacoes explicitas.
- Scripts locais reduzem o trabalho mecanico, mas nao substituem revisao de arquitetura e produto.

Data:

2026-07-16

## Decisao Arquitetural: Organizacao de Widgets como Engenharia

Decisao:

No Studio `0.11.0`, bloqueio e agrupamento sao metadados do documento de engenharia em `widget.editor`. Eles controlam selecao, camadas e manipulacao no Studio, mas sao removidos integralmente na geracao do Device Runtime. Visibilidade continua sendo propriedade funcional do widget e chega ao renderer.

Contexto:

Grupos, bloqueios e area de transferencia aumentam produtividade, mas transforma-los em containers ou estados de runtime acoplaria o firmware a ferramentas do editor e criaria diferencas desnecessarias entre hardwares.

Consequencias:

- schema de projeto passa a `0.6.0`, com migracao automatica e descarte de grupos com menos de dois membros;
- clique seleciona o grupo; `Alt` isola um membro para edicao; grupos sao copiados com novos IDs;
- widget bloqueado pode ser selecionado, mas nao movido, redimensionado ou removido ate ser desbloqueado;
- o compilador Rust remove `editor` de todos os widgets antes de gerar o JSON embarcado;
- Agent, LinkPad Protocol e Device Runtime permanecem inalterados.

Data:

2026-07-16

## Decisao Arquitetural: Precisao Efemera no Canvas

Decisao:

No Studio `0.12.0`, grade configuravel, snap inteligente e guias visuais pertencem exclusivamente a sessao do editor. Somente a geometria final em pixels logicos e persistida.

Contexto:

Cada integrador pode preferir uma densidade de grade diferente, e guias dependem do gesto corrente e do zoom. Persistir essas preferencias no projeto criaria ruido sem mudar a aplicacao embarcada.

Consequencias:

- movimento e resize podem encaixar em bordas e centros do display ou de outros widgets;
- guias distinguem referencias do display e de widgets;
- tamanho de grade nao altera schema nem renderer;
- a logica deterministica e compartilhada e coberta por testes de geometria.

Data:

2026-07-16

## Decisao Arquitetural: Sistema Portatil de Widgets e Auditoria

Decisao:

No Studio `0.13.0`/Runtime `0.10.0`, todos os widgets compartilham propriedades declarativas de estilo e o catalogo passa a incluir `gauge` e `progress_bar`. No Studio `0.14.0`, alertas de qualidade visual sao calculados na engenharia e nao fazem parte do projeto salvo nem do runtime.

Contexto:

Novos tipos e estilos precisam funcionar em mais de uma familia de hardware sem criar popups ou schemas especificos por device. Validacoes de contraste e capacidade de conteudo ajudam o integrador, mas nao devem aumentar o firmware nem mudar o resultado em campo.

Consequencias:

- schema passa a `0.7.0` e normaliza fonte, cores, transparencia, alinhamentos, padding, borda e arredondamento;
- medidor e barra aceitam apenas `int`/`float`, usam o seletor canonico e guardam faixa visual no consumidor;
- cada template de hardware converte o mesmo contrato para sua API grafica;
- o runtime M5 renderiza os sete tipos e foi compilado com a toolchain gerenciada;
- auditoria aponta vinculo ausente, intervalo invalido, corte, estouro e contraste sem ser serializada;
- Agent e LinkPad Protocol permanecem inalterados.

Data:

2026-07-16

## Decisao Arquitetural: Controles de Tela Independentes de Hardware

Decisao:

O Studio `0.6.0` trata botoes, teclas, encoders e futuras entradas como controles declarados pelo manifesto do hardware. Cada tela do schema `0.3.0` associa `inputId` e evento normalizado a uma acao declarativa em `inputBindings`. O runtime executa essas acoes por um motor comum; cada template fornece apenas um adaptador entre a API fisica do device e os identificadores logicos.

Contexto:

O primeiro runtime tratava `M5.BtnA` como proxima tela e `M5.BtnB` como acionamento implicito do primeiro `write_button`. Esse comportamento era ambiguo com varios widgets e tornava o fluxo exclusivo do M5StickC Plus2, contrariando a expansao planejada para outros hardwares.

Alternativas consideradas:

- Manter funcoes fixas por botao dentro de cada template.
- Configurar botoes M5 diretamente nos widgets.
- Declarar controles e acoes por tela, resolvidos por uma abstracao de entrada do runtime.

Consequencias:

- O catalogo declara entradas estruturadas com identificador, rotulo, tipo, eventos e disponibilidade.
- O Studio monta a interface de configuracao a partir do manifesto, sem listas fixas de botoes M5.
- O runtime M5 converte A/B em `primary/press` e `secondary/press`; futuros templates podem emitir outros controles e eventos.
- Navegacao, escrita de tag, alternancia booleana e acionamento de widget usam o mesmo motor de acoes.
- Na entrega 0.6.0, Power permaneceu reservado no M5; essa restricao foi removida pela decisao 0.15.0 abaixo.
- Escritas continuam usando o LinkPad Protocol existente e nunca sao repetidas automaticamente.
- Projetos `0.1.0`/`0.2.0` recebem migracao e backup; o comportamento implicito anterior vira vinculo explicito.
- Agent e LinkPad Protocol nao mudam.

Data:

2026-07-16

## Decisao Arquitetural: Sequencias de Acoes e Energia Portatil

Decisao:

O Studio `0.15.0` permite varias acoes ordenadas para o mesmo par `inputId/event`. O schema `0.8.0` representa a sequencia por bindings consecutivos com o mesmo par, preservando o formato unitario `action`; o Device Runtime `0.11.0` executa todas as correspondencias na ordem salva. `powerOff` e uma acao logica portatil, habilitada somente quando `hardware.capabilities.powerOff` for verdadeira e a entrada incluir a acao em `deviceActions`; a execucao pertence ao template do hardware.

Contexto:

Uma unica acao por evento obrigava o integrador a escolher entre navegar, escrever ou acionar um widget. Power permanecia reservado, e usar `wasPressed` junto de um futuro evento longo faria o mesmo gesto disparar as duas intencoes.

Alternativas consideradas:

- substituir `action` por um segundo formato `actions[]`, exigindo conversao estrutural de todos os consumidores;
- permitir bindings repetidos e ordenados, mantendo cada acao autocontida;
- acoplar desligamento diretamente ao botao Power do M5.

Consequencias:

- o modal principal usa uma grade compacta com um unico cabecalho; controle e evento sao agrupamentos visuais, enquanto cada linha continua sendo um `inputBinding` editavel;
- `Nova acao` abre um modal exclusivo, filtra evento e acao pelo manifesto e acrescenta automaticamente a configuracao ao grupo `inputId/event` correspondente;
- a posicao vertical dentro do evento substitui a coluna de ordem; comandos subir/descer reorganizam somente a sequencia desse ramo;
- fora da edicao, celulas exibem texto e resumo; somente a linha ativa vira formulario e valor/limites de escrita expandem abaixo dela;
- rascunhos do modal de criacao e da edicao inline permanecem transitorios ate a confirmacao e nao exigem mudanca de schema;
- A, B e Power do M5 oferecem `press` por `wasClicked` e `longPress` por `wasHold`, evitando disparo duplo no mesmo gesto;
- o runtime continua a sequencia mesmo quando uma acao falha; `powerOff` encerra fisicamente a execucao e deve ficar por ultimo;
- antes de desligar, o runtime forca a gravacao de Tags internas retentivas pendentes;
- no M5, somente Power inclui `powerOff` em `deviceActions`; A e B nao oferecem essa escolha, embora continuem configuraveis para as demais categorias;
- outros hardwares podem oferecer eventos ou desligamento diferentes apenas pelo manifesto e adaptador, sem expor APIs fisicas no projeto;
- projetos `0.7.0` recebem backup e avancam para `0.8.0`; Agent e LinkPad Protocol nao mudam.

Data:

2026-07-20

## Decisao Arquitetural: Seletor Canonico de Dados

Decisao:

O Studio `0.7.0` usa um unico seletor de dados para widgets, acoes de controles e futuros consumidores. O seletor oferece as abas `Conector` e `Tags globais`; widgets e hardwares apenas declaram tipo e permissao de acesso, sem implementar interfaces proprias de enderecamento. O schema de projeto `0.4.0` salva um `DataBinding` no consumidor.

Contexto:

Exigir a criacao previa de uma tag para exibir ou escrever um unico endereco adicionava uma etapa artificial. Expor `endereco direto` e `ponto reutilizavel` como conceitos paralelos tambem criava ambiguidade para o integrador. A selecao precisa permanecer identica quando novos widgets, protocolos e hardwares forem acrescentados.

Alternativas consideradas:

- Manter todo widget ligado obrigatoriamente a uma tag pelo nome.
- Implementar campos de conector separadamente em cada widget.
- Expor um seletor adicional de origem antes dos campos de dados.

Consequencias:

- `DataBinding` possui duas variantes internas: descritor direto de conector e referencia por ID a uma Tag global.
- Tags globais recebem IDs estaveis; renomear a tag nao quebra consumidores.
- O mesmo `DataBindingField` atende leitura, escrita e alternancia, filtrando tipos e permissoes conforme o uso declarado.
- Formularios de endereco pertencem ao registro de conectores e nao ao widget ou ao hardware.
- O gerador compila bindings diretos em pontos efemeros, deduplica perfil/tipo/endereco e converte referencias globais para o nome logico esperado pelo runtime.
- Projetos `0.1.0`, `0.2.0` e `0.3.0` sao migrados para `0.4.0`; vinculos antigos por nome tornam-se referencias a Tags globais.
- O Device Runtime passa a `0.7.0`, mas LinkPad Protocol e Agent permanecem inalterados porque continuam recebendo `id`, `type` e `address` autodescritivos.

Data:

2026-07-16

## Decisao Arquitetural: Linguagem Orientada ao Integrador

Decisao:

O Studio `0.7.1` apresenta a configuração em três níveis: `Rede LinkPad` define Wi-Fi e acesso ao Agente; `Comunicações` gerencia PLCs e simulação; widgets, ações e Tags globais escolhem o PLC e o endereço. Termos internos como perfil, sessão, driver e endpoint não devem dominar o fluxo principal.

Contexto:

O integrador pensa primeiro em como o LinkPad entra na rede, depois nos PLCs do projeto e finalmente nos endereços utilizados. A antiga tela expunha simultaneamente perfis, catálogo de conectores, drivers e sessões, embora esses conceitos sejam necessários principalmente à implementação.

Consequencias:

- `Comunicação` passa a ser apresentada como `Rede LinkPad`.
- `Conectores` passa a ser apresentada como `Comunicações`.
- A entidade visível principal é o PLC; `ProtocolProfile` continua sendo o modelo interno e serializado.
- Simulação permanece separada de PLCs físicos, embora use a mesma estrutura interna.
- Tipos de comunicação futuros aparecem como opções desabilitadas, sem cards explicativos permanentes.
- O seletor canônico usa as abas `PLC` e `Tags globais`; ao escolher o PLC, o protocolo e seu formulário de endereço são inferidos.
- A mudança não altera schema, firmware, LinkPad Protocol nem configuração persistente do Agent.

Data:

2026-07-16

## Decisao Arquitetural: Apontamento Compacto e Limites no Consumidor

Decisao:

O Studio `0.7.2` usa o diálogo compacto `Selecionar tag` somente para escolher PLC/Tag global, tipo e endereço. Limites mínimo/máximo não pertencem ao apontamento: são configurados no widget ou na ação que realiza a escrita.

Contexto:

O seletor anterior repetia o rótulo do consumidor, tipos LinkPad/S7, títulos e campos de comportamento. Isso tornava uma escolha de endereço semelhante a um formulário completo. Limites variam conforme a operação de escrita e precisam permanecer visíveis junto do valor escrito.

Consequencias:

- Siemens apresenta diretamente o tipo industrial e deriva o tipo LinkPad.
- Atualização fica em detalhes opcionais; o valor de teste aparece somente quando a comunicação selecionada é a simulação. O fluxo principal contém apenas a identificação do ponto.
- No corte `0.7.2`, a configuracao de widget usava um popup compartilhado. Na evolucao atual, a selecao unica mostra diretamente a secao inferior de propriedades no Contexto, sem clique adicional.
- `ConnectorAddressEditor` é compartilhado pelo seletor e por Tags globais.
- Widgets `write_button` guardam limites em `props.min`/`props.max`; no contrato atual, ações `changeValue` guardam limites na própria ação (`writeTag` era o nome legado).
- Limites legados no binding ou na Tag global são movidos para consumidores existentes durante a normalização.
- O compilador agrega limites dos consumidores no ponto técnico usando a faixa mais restritiva.
- O Agent continua recebendo `value`, `min` e `max`; não há mudança no LinkPad Protocol.

Data:

2026-07-16

## Decisao Arquitetural: Tags Globais Internas e Retentivas

Decisao:

O Studio e o Device Runtime `0.8.0` distinguem Tags globais `internal` e `agent`. Uma Tag interna pertence ao cache local do device, nao possui `protocolProfileId` nem `address` e pode declarar `retentive: true` como atributo. Retentiva nao e uma terceira origem de Tag.

Contexto:

Telas, controles e regras precisam compartilhar estados locais sem criar PLC, simulacao no Agent ou requisicao HTTP artificial. Alguns desses estados tambem precisam sobreviver a reinicializacoes do hardware.

Consequencias:

- O schema de projeto passa a `0.5.0` e acrescenta `initialValue` e `retentive` a Tags internas.
- A criacao de Tag global usa as abas `Interna` e `Externa`; Tags existentes sao configuradas em popup aberto por duplo clique.
- Tags internas sao inicializadas antes da primeira renderizacao, usam qualidade `good` e continuam operando com Wi-Fi ou Agent offline.
- Escritas internas atualizam somente o cache do runtime e respeitam tipo, direcao e limites compilados; nunca chamam o LinkPad Protocol.
- No template ESP32, `retentive: true` persiste o ultimo valor em NVS por ID estavel da Tag e por projeto. Escritas proximas sao consolidadas em uma janela de 500 ms para reduzir desgaste da flash.
- Alterar o projeto ou encontrar valor retido incompatível com o tipo/faixa descarta o valor antigo e usa `initialValue`.
- A simulacao mantida pelo driver `sim` continua sendo externa, pois ainda usa uma sessao no Agent.
- LinkPad Agent e LinkPad Protocol permanecem inalterados; Tags internas nao sao enviadas ao gateway.

Data:

2026-07-16

## Decisao Arquitetural: OPC UA Generico no Agent

Decisao:

O Agent `0.3.0` implementa um cliente OPC UA generico com identificador `opcua`. O driver foi validado com servidor OPC UA real; Siemens e o primeiro equipamento planejado para validacao fisica, mas nao faz parte do identificador nem do nucleo do driver. O placeholder anterior `siemens-opcua` e normalizado pelo Studio para `opcua`.

Contexto:

OPC UA e um protocolo multi fabricante. Vincular o driver a Siemens criaria duplicacao futura para servidores Kepware, Beckhoff, Codesys e outros. O projeto ja possuia target, options, auth e endereco declarativos suficientes para uma primeira fatia sem alterar endpoints.

Consequencias:

- Studio `0.9.0` habilita `OPC UA` em Comunicacoes e usa o editor compartilhado de `nodeId` para Tags globais e enderecos diretos.
- Agent `0.3.0` usa `asyncua 2.0.1`, mantem a sessao no pool, aceita escalares Boolean, inteiros, Float/Double e String, preserva qualidade/timestamp OPC UA e confirma escrita por releitura.
- O MVP aceita IPv4 privado, porta TCP 4840, autenticacao anonima, `SecurityPolicy None` e `SecurityMode None`; essa combinacao e restrita a validacao em rede de laboratorio.
- Credenciais e chaves privadas nao sao incorporadas ao firmware. Certificados, trust store e credenciais protegidas exigem decisao e entrega posterior no Agent.
- Browse online permanece posterior e exigira endpoint e versao nova do LinkPad Protocol. O MVP usa Node ID explicito e aceita namespace por indice (`ns=`) ou URI (`nsu=`).
- LinkPad Protocol permanece `0.1.0`, schema de projeto permanece `0.5.0` e Device Runtime permanece `0.8.0`, pois o device apenas encaminha o descritor generico existente.
- A configuracao local do Agent passa a `0.4.0`; o whitelist default anterior recebe `opcua`, enquanto listas personalizadas sao preservadas.

Data:

2026-07-16

## Decisao Arquitetural: Catalogo Contextual de Widgets

Decisao:

No Studio `0.9.1`, ferramentas de criacao de widgets pertencem ao painel direito `Contexto` da tela ativa. A barra horizontal do `ScreenEditor` e removida. O catalogo declarativo e a fabrica de valores iniciais ficam separados do painel visual e do renderer da tela.

Contexto:

O catalogo ocupava permanentemente uma linha acima do display e misturava ferramentas de criacao com a area de edicao. O painel direito ja representa o contexto da aba ativa e e o ponto natural para apresentar acoes que so fazem sentido durante a edicao de uma tela. A navegacao do projeto permanece isolada no painel esquerdo. A evolucao futura desse contexto nao pode criar listas diferentes por hardware.

Consequencias:

- `ContextPanel` recebe a aba ativa e mostra o catalogo somente para uma aba `screen` valida.
- Um clique adiciona o widget a tela ativa; selecao, arraste e configuracao por popup continuam no `ScreenEditor`.
- A lista dos cinco widgets e seus defaults fica centralizada e reutilizavel.
- O catalogo nao conhece resolucao, manifesto de hardware, PLC ou protocolo.
- Projetos existentes nao mudam de estrutura; schema `0.5.0`, Device Runtime `0.8.0`, Agent e LinkPad Protocol permanecem inalterados.

Data:

2026-07-16

## Decisao Arquitetural: Evolucao Apos o Primeiro Corte Ponta a Ponta

Decisao:

As proximas entregas devem ampliar capacidades sobre os contratos declarativos existentes, sem reintroduzir configuracao de projeto no Agent ou interfaces diferentes por widget/hardware. A ordem recomendada e: fechar validacoes Siemens reais, endurecer OPC UA, acrescentar browse/teste de ponto, adaptar Rockwell Logix e validar a arquitetura com um segundo hardware.

Contexto:

Em 2026-07-16 foram entregues, no mesmo corte, toolchain gerenciada, runtime multi-conectores, overlay portatil, controles declarativos, seletor canonico, Tags internas/retentivas, S7 nativo e OPC UA generico. O risco seguinte nao e falta de amplitude, mas evoluir varios eixos sem perder separacao, seguranca ou uma interface consistente.

Consequencias:

- OPC UA seguro mantem certificados e segredos no Agent; nunca no firmware.
- Browse preenche o mesmo `address` e exige uma versao minor nova do LinkPad Protocol, sem invalidar enderecos diretos.
- Rockwell Logix reutiliza target, sessao, pool e pontos do protocolo atual.
- Um segundo hardware fornece adaptadores de display, entrada e armazenamento, sem alterar widgets ou o seletor de dados.
- Teste de handshake e teste de ponto permanecem operacoes distintas para evitar escrita acidental.
- O estado consolidado e a ordem das evolucoes ficam em `docs/06-estado-atual-e-proximos-passos.md`.

Data:

2026-07-16

## Decisao Arquitetural: Canvas Profissional e Estado Transitorio de Edicao

Decisao:

O Studio `0.10.0` usa um controlador unico de edicao por workspace para selecao e historico de widgets. A geometria persistida continua em pixels logicos da tela; selecao, marquee, fantasma de arraste, zoom, grade, snap e pilhas de desfazer/refazer sao estados transitorios e nao entram no projeto. Nao existe estado separado de popup ou editor ativo: a selecao unica alimenta diretamente as propriedades do Contexto. Interacoes dentro do canvas e o arraste do catalogo usam Pointer Events internos; a entrega entre paineis nao depende do drag-and-drop HTML do WebView.

Contexto:

Selecao e arraste antes pertenciam apenas ao `ScreenEditor`, e o painel direito nao compartilhava a mesma referencia de widgets. A evolucao para multiplos hardwares exige que mover, redimensionar, alinhar e configurar usem coordenadas independentes da escala visual e nao criem implementacoes diferentes por device.

Alternativas consideradas:

- persistir selecao, zoom e historico no arquivo do projeto;
- implementar manipulacao com coordenadas CSS de cada hardware;
- adotar uma biblioteca externa de canvas antes de estabilizar o contrato de geometria;
- manter painel de Contexto e canvas com estados de selecao separados.

Consequencias:

- arraste, redimensionamento por oito alcas, selecao multipla, marquee, alinhamento, distribuicao, centralizacao, tamanho e ordem usam funcoes deterministicas em pixels logicos;
- a alteracao so e gravada no projeto ao concluir a manipulacao; o fantasma e a geometria intermediaria nao poluem o historico;
- `Shift`, setas, `Delete`, `Ctrl+A`, `Ctrl+D`, `Ctrl+Z` e `Ctrl+Y` operam sobre a mesma selecao exibida no Contexto;
- valores sem simulacao usam placeholders sem expor enderecos industriais no widget;
- `fontSize`, `color`, `backgroundColor` e `transparent` sao propriedades portateis do widget; cada renderer de hardware adapta a fonte logica aos recursos do display;
- o Device Runtime `0.9.0` implementa essas propriedades no M5StickC Plus2, sem biblioteca industrial e sem mudanca no LinkPad Protocol;
- o schema de projeto permanece `0.5.0`, pois `props` ja e extensivel; projetos anteriores recebem fallbacks visuais e nao exigem migracao estrutural;
- Agent e endpoints HTTP nao mudam.

Data:

2026-07-16

## Decisao Arquitetural: Inspector Contextual e Ferramentas Espaciais

Decisao:

O painel direito da tela funciona como inspector orientado pela selecao. Catalogo e camadas sao ferramentas temporarias acionadas por comandos compactos; auditoria ocupa a guia `Alertas` da secao inferior. A lista unica `Propriedades` usa grupos recolhiveis: `Conteudo` e `Visual` iniciam abertos, enquanto `Borda e espaco` e o grupo final `Posicao e exibicao` iniciam recolhidos. A barra do canvas conserva somente a identidade compacta da selecao. Alinhamento, distribuicao, centralizacao e igualacao de tamanho, ordem de camadas e agrupamento pertencem a menus expansiveis e mutuamente exclusivos da barra; abrir um recolhe o anterior. Copiar, recortar, colar, duplicar, bloquear/desbloquear e excluir pertencem ao menu de contexto do widget.

Contexto:

Catalogo, camadas, auditoria, geometria, alinhamento, ordem, grupo e area de transferencia ocupavam simultaneamente uma unica coluna. A falta de separacao entre resumo operacional e propriedades aumentava a carga visual, mas esconder propriedades atras de um segundo nivel tambem acrescentava cliques ao fluxo mais frequente. Bloquear o proprio menu de alinhamento ainda impedia fecha-lo quando a selecao era removida enquanto ele estava aberto.

Alternativas consideradas:

- manter todas as secoes recolhiveis na mesma coluna;
- criar abas permanentes para cada familia de ferramenta;
- esconder propriedades atras de lapis, duplo clique ou segundo nivel de navegacao;
- desabilitar o menu completo quando a selecao fosse insuficiente.

Consequencias:

- `Adicionar` e `Camadas` abrem drawers temporarios no Contexto; `Alertas` permanece acessivel pela secao inferior;
- selecao unica ou multipla devolve automaticamente o foco ao inspector;
- selecao unica mostra uma lista direta `Propriedade | Valor | Animacao`, sem guias ou clique adicional;
- geometria exata e visibilidade ficam nessa lista; identidade permanece compacta na barra superior e as acoes frequentes ficam no botao direito do widget;
- selecao multipla omite propriedades individuais; `Adicionar` e `Camadas` continuam abrindo drawers temporarios;
- alinhamento, distribuicao, igualacao de tamanho, ordem e agrupamento usam as mesmas funcoes deterministicas existentes, agora chamadas pela barra do canvas;
- o menu de contexto preserva a selecao multipla quando aberto sobre um membro selecionado e troca o alvo quando aberto sobre outro widget;
- cada comando espacial e desabilitado individualmente conforme exige um, dois ou tres widgets, mas o menu pode sempre ser aberto e fechado;
- nenhuma propriedade, schema, runtime, endpoint ou contrato Device-Agent muda.

Data:

2026-07-17

## Decisao Arquitetural: Bootstrap Visual Anterior ao React

Decisao:

O Studio mostra um bootstrap visual estatico no HTML inicial desde que o WebView carrega o documento ate a primeira montagem React. A janela Tauri usa a mesma cor de fundo. O indicador e indeterminado e nao possui duracao minima.

Contexto:

No fluxo desktop de desenvolvimento, a janela nativa podia aparecer antes de Vite, CSS e React concluirem o carregamento, deixando uma area vazia ate `Novo projeto`, `Carregar projeto` e `Recentes` serem renderizados. Uma tela implementada somente como componente React surgiria tarde demais para cobrir esse intervalo.

Alternativas consideradas:

- aceitar a janela vazia como caracteristica do modo de desenvolvimento;
- adicionar um componente React com atraso minimo;
- criar uma segunda janela nativa exclusiva para splash;
- renderizar HTML/CSS critico antes do bundle principal.

Consequencias:

- `index.html` contem somente a marca e os estilos criticos necessarios para `Abrindo Studio...`;
- `main.tsx` remove a camada assim que `App` foi montado, sem prolongar artificialmente a abertura;
- o fundo configurado em `tauri.conf.json` evita claridade antes do primeiro documento;
- o bootstrap nao carrega projeto, toolchain, Agent ou PLC e nao representa porcentagem ficticia;
- schema de projeto, Device Runtime, Agent e LinkPad Protocol permanecem inalterados.

Data:

2026-07-20

## Decisao Arquitetural: Acao Unificada de Alteracao de Valor

Decisao:

O Studio `0.16.0` e o schema `0.9.0` representam escrita, incremento, decremento e inversao pela acao unica `changeValue`, com `operation: set | add | subtract | toggle`. O Device Runtime `0.12.0` executa operacoes relativas a partir do valor atual com qualidade `good`; para pontos externos, envia ao Agent apenas o valor final pelo endpoint `/lpp/v1/write` existente.

Contexto:

Expor `Escrever valor`, `Inverter bit`, `Somar` e `Subtrair` como acoes independentes aumentaria o catalogo e repetiria selecao de Tag, limites e validacoes. O integrador entende todas como variacoes da mesma intencao: alterar um valor.

Alternativas consideradas:

- manter `writeTag` e `toggleTag` e acrescentar `addTag`/`subtractTag`;
- criar um endpoint atomico de operacoes no Agent e em cada driver;
- permitir operacoes relativas sobre Tags apenas gravaveis, sem garantir valor atual.

Consequencias:

- o editor oferece operacoes conforme o tipo: booleano define/inverte, numero define/soma/subtrai e string define;
- `set` requer escrita; `add`, `subtract` e `toggle` exigem `readWrite` e cache atual `good`;
- `operand` e obrigatorio exceto em `toggle`; `min`/`max` validam o resultado calculado;
- `writeTag` migra para `changeValue/set` e `toggleTag` para `changeValue/toggle`, preservando ordem, vinculo e limites;
- projetos `0.8.0` recebem backup antes de avancar para `0.9.0`;
- Agent `0.3.0` e LinkPad Protocol `0.1.0` nao mudam;
- a leitura-modificacao-escrita local nao e atomica diante de outros escritores do mesmo ponto; uma operacao atomica futura exigira novo contrato e suporte explicito dos drivers.

Data:

2026-07-20

## Decisao Arquitetural: Painel Inferior de Ferramentas da Tela

Decisao:

O Studio `0.17.0` possui uma secao inferior recolhivel e extensivel por guias no editor de telas. `Controles` incorpora diretamente sua tabela compacta e `Alertas` concentra a auditoria visual antes exibida no Contexto. O antigo resumo fixo e o modal principal de Controles sao removidos; modais pontuais, como `Nova acao`, continuam permitidos.

Contexto:

O resumo permanente ocupava espaco sem permitir edicao e exigia abrir outro workspace para visualizar todas as configuracoes. Ao mesmo tempo, o editor precisara receber outras ferramentas horizontais que nao cabem naturalmente no painel direito de propriedades.

Alternativas consideradas:

- manter o resumo e o modal principal;
- colocar a tabela de Controles no painel direito de Contexto;
- criar uma area inferior exclusiva e acoplada somente a Controles.

Consequencias:

- `ScreenBottomPanel` recebe guias declarativas com ID, rotulo, icone, contador e conteudo;
- clicar numa guia expande a area; um comando independente a recolhe;
- o painel ocupa a ultima linha do editor, fica colado ao rodape quando recolhido e cresce para cima, reduzindo a area rolavel do canvas;
- tabela, edicao e ordenacao de Controles permanecem no mesmo componente e contrato;
- a guia `Alertas` reutiliza a auditoria calculada e o controller de selecao, sem persistir seus resultados;
- expansao e guia ativa sao estados transitorios e nao entram no projeto;
- futuras ferramentas de tela usam novas guias, sem duplicar layout por hardware;
- schema `0.9.0`, Device Runtime `0.12.0`, Agent e LinkPad Protocol permanecem inalterados.

Data:

2026-07-20

## Decisao Arquitetural: Isolamento de Tags no Runtime

Decisao:

No Studio `0.17.1`, somente Tags globais alcançadas por um `DataBinding` de widget ou controle sao materializadas no artefato embarcado. No Device Runtime `0.12.1`, saude agregada do perfil e apenas diagnostica: `add`, `subtract` e `toggle` exigem sessao ativa e qualidade `good` exclusivamente na Tag-alvo. Falhas de transporte, parse ou sessao invalidam a qualidade dos pontos antes de nova operacao relativa.

Contexto:

O gerador incorporava todas as Tags globais do projeto, inclusive as que nao tinham consumidor. Alem disso, uma unica leitura invalida tornava `tagsGood` falso para o perfil inteiro e bloqueava a inversao de outro ponto que havia sido lido corretamente. Na bancada S7, um endereco invalido e nao utilizado em `DB1.DBD4` impediu `toggle` sobre `DB2.DBX2.0`, embora este permanecesse com qualidade `good`.

Alternativas consideradas:

- exigir que o integrador removesse ou corrigisse toda Tag declarada antes de usar qualquer controle;
- manter todas as Tags no firmware e usar apenas a saude agregada do lote;
- ignorar a saude agregada sem invalidar valores antigos em falhas de transporte;
- podar consumidores ausentes e autorizar cada operacao pela qualidade individual do alvo.

Consequencias:

- Tags sem uso continuam editaveis e persistidas no projeto, mas nao geram polling, memoria ou trafego no device;
- uma resposta `partial` conserva o valor anterior para exibicao, mas atualiza a qualidade de cada item independentemente;
- uma Tag `offline` ou `unknown` bloqueia apenas a operacao relativa que depende dela;
- perda de leitura/sessao nao permite calculo silencioso sobre cache anteriormente `good`;
- saude agregada continua disponivel para estado diagnostico do perfil;
- schema `0.9.0`, Agent `0.3.0` e LinkPad Protocol `0.1.0` permanecem inalterados.

Data:

2026-07-21

## Registro de Decisao

Para decisoes arquiteturais relevantes, registre no documento de arquitetura aplicavel:

```text
Decisao:
Contexto:
Alternativas consideradas:
Consequencias:
Data:
```

## Mudancas Incompativeis

Mudancas incompativeis devem:

- Alterar versao major do contrato.
- Descrever migracao.
- Manter endpoint ou campo legado quando viavel.
- Explicar impacto no Studio, Agente e Runtime.
