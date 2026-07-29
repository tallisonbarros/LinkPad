# Changelog

## 0.17.1 - 2026-07-21

### Adicionado

- Menu de contexto nas telas da arvore com copiar, recortar, colar, duplicar e excluir; copias recebem IDs independentes e recortes sao movidos abaixo do destino escolhido.
- Menu de contexto nos widgets com copiar, recortar, colar, duplicar, bloquear/desbloquear e excluir, preservando a selecao multipla quando o alvo ja pertence a ela.
- Painel unico `Propriedades` para widgets, com atributos em linhas `Propriedade | Valor | Animacao`; a coluna de animacao fica reservada e desabilitada ate a definicao do contrato portatil.
- Bootstrap reproduzivel pela raiz com `setup-dev.cmd`, instalacao deterministica por `npm ci` e validacao conjunta de Agent, UI e backend Rust.

### Alterado

- X, Y, largura, altura e visibilidade passam para a grade de propriedades. A linha superior conserva somente a identidade compacta da selecao; o menu `Mais` e removido e a igualacao entre varios widgets passa para `Alinhar`.
- As antigas guias `Conteudo` e `Aparencia` deixam de existir; configuracoes funcionais e visuais passam a compor a mesma lista imediata de propriedades.
- As categorias de propriedades passam a ser recolhiveis. `Conteudo` e `Visual` iniciam abertos; `Borda e espaco` e `Posicao e exibicao` iniciam recolhidos, com o grupo de geometria no final do painel.

### Corrigido

- `package-lock.json` volta a ser aceito por `npm ci` em clones limpos, inclusive com o npm 11.16 do runner Node.js 24, e atualiza o PostCSS transitivo para a versao sem o alerta `GHSA-r28c-9q8g-f849`.
- Tags globais sem nenhum consumidor em widgets ou controles permanecem no projeto de engenharia, mas deixam de ser incorporadas e consultadas pelo firmware.
- Leituras parciais passam a atualizar a qualidade por ponto; uma Tag com erro nao bloqueia `Somar`, `Subtrair` ou `Inverter` sobre outra Tag `good` do mesmo PLC.
- Falhas de leitura, resposta invalida ou perda de sessao invalidam a qualidade dos pontos afetados antes de uma nova operacao relativa, evitando calculo sobre cache obsoleto.
- O seletor de Tag em `Alterar valor` deixa de bloquear tipos conforme a operacao anterior; a Tag passa a definir as operacoes disponiveis e escolhas incompatíveis retornam automaticamente para `Definir`.
- A aba Build remove a etapa manual `Gerar codigo`: `Compilar` passa a gerar e compilar, enquanto `Gravar device` sempre gera, compila e grava em uma unica acao protegida contra fontes obsoletos.

### Compatibilidade

- Studio passa a `0.17.1` e Device Runtime a `0.12.1`.
- Schema permanece `0.9.0`, Agent `0.3.0` e LinkPad Protocol `0.1.0`; nenhum projeto precisa de migracao estrutural.

## 0.17.0 - 2026-07-20

### Alterado

- O resumo fixo de Controles abaixo do display e o modal principal foram substituidos por uma secao inferior recolhivel dentro do editor da tela.
- A secao inferior passa a usar guias extensíveis; `Controles` e a primeira guia e exibe diretamente a tabela compacta de acoes.
- `Alertas` passa a ser a segunda guia da secao inferior, com contador de avisos e navegacao direta para o widget; o acesso anterior no Contexto foi removido.
- O contador de acoes fica no rotulo da guia e o comando `Nova acao` permanece contextual dentro do painel expandido.

### Corrigido

- O painel inferior fica ancorado ao rodape do editor: recolhido ocupa somente a barra de guias e, expandido, cresce para cima reduzindo a area rolavel do canvas, sem reservar uma caixa vazia abaixo.

### Compatibilidade

- A expansao e a guia ativa sao estados transitorios do Studio e nao entram no projeto.
- Schema permanece `0.9.0`, Device Runtime `0.12.0`, Agent `0.3.0` e LinkPad Protocol `0.1.0`.

## 0.16.0 - 2026-07-20

### Adicionado

- Acao unificada `changeValue` (`Alterar valor`) para definir, somar, subtrair ou inverter o valor de uma Tag.
- Selecao contextual de operacoes: booleanos permitem definir/inverter; numeros permitem definir/somar/subtrair; textos permitem definir.
- Configuracao compacta de operacao, operando e limites no modal e na linha ativa dos controles.

### Alterado

- As acoes legadas `writeTag` e `toggleTag` sao migradas automaticamente para `changeValue` com `operation: set` e `operation: toggle`.
- Operacoes relativas exigem acesso `readWrite` e valor atual com qualidade `good`; `min` e `max` validam o resultado calculado, nao o operando.
- O Device Runtime calcula operacoes relativas no cache local e envia ao Agent somente o valor final pelo `/lpp/v1/write` existente.

### Versoes e compatibilidade

- Schema passa a `0.9.0`, Studio a `0.16.0` e Device Runtime a `0.12.0`.
- Projetos `0.8.0` recebem backup e migracao automatica. Agent `0.3.0` e LinkPad Protocol `0.1.0` permanecem inalterados.
- A leitura-modificacao-escrita de uma operacao relativa nao e atomica em relacao a outros escritores do mesmo ponto.

## 0.15.0 - 2026-07-20

### Adicionado

- Eventos `press` e `longPress` para A, B e Power no manifesto/runtime M5, usando clique curto e inicio de retencao como gestos mutuamente exclusivos.
- Varias acoes ordenadas no mesmo evento, com inclusao, remocao e reordenacao no editor.
- Acao portatil `powerOff`, validada pela capacidade do hardware e pela permissao `deviceActions` de cada entrada; no M5, somente Power a oferece e a persistencia retentiva e forçada antes do desligamento.

### Alterado

- O painel direito passa a usar comandos compactos para `Adicionar`, `Camadas` e `Alertas`, abrindo essas ferramentas somente quando solicitadas.
- A selecao ativa recebe um inspector compacto com geometria e acoes frequentes; tamanho e area de transferencia ficam em `Mais acoes`.
- Alinhamento, distribuicao e centralizacao saem do painel direito e passam ao menu expansivel `Alinhar` na barra de ferramentas do canvas.
- Ordem de camadas e agrupamento saem do painel direito e passam aos menus expansiveis `Ordem` e `Grupo` na barra do canvas.
- A selecao unica divide o Contexto em resumo superior e propriedades inferiores com `Conteudo` e `Aparencia`; nenhum lapis, duplo clique ou modo intermediario e necessario.
- Posicao e dimensoes permanecem somente no resumo/canvas, enquanto borda e espacamento ficam recolhidos na secao inferior.
- A janela desktop passa a exibir `Abrindo Studio...` desde o HTML inicial ate a primeira montagem React, com fundo nativo consistente e sem atraso artificial.
- `Device` deixa de ser uma area independente e passa a compor uma secao compacta da pagina `Projeto`; o atalho superior separado tambem e removido.
- `Assets` sai da arvore enquanto nao existe um fluxo funcional de importacao; o campo legado permanece no schema apenas para compatibilidade.
- O modal de controles passa a usar uma grade compacta com cabecalho unico e agrupamento visual por controle/evento; `Nova acao` abre um modal exclusivo, enquanto configuracoes existentes sao editadas somente na linha ativa e a posicao vertical define a ordem.

### Corrigido

- O menu `Alinhar` permanece expansivel sem selecao; apenas os comandos internos sao desabilitados, evitando que o menu fique aberto sem poder ser fechado.
- `Alinhar`, `Ordem` e `Grupo` passam a formar um conjunto intertravado: expandir um menu recolhe automaticamente o anterior.
- O duplo clique em um widget seleciona somente esse item e restaura suas propriedades no Contexto, fechando Catalogo, Camadas ou Alertas que estejam abertos.

### Versoes e compatibilidade

- Schema passa a `0.8.0` para formalizar varias acoes por evento e `powerOff`; projetos `0.7.0` recebem backup e migracao automatica sem perda dos bindings existentes.
- Device Runtime passa a `0.11.0`; Agent `0.3.0` e LinkPad Protocol `0.1.0` permanecem inalterados.

## 0.14.0 - 2026-07-16

### Adicionado

- Auditoria contextual de qualidade visual por tela, com avisos de vinculo ausente, intervalo invalido, corte, estouro de texto e contraste.
- Marcacao opcional dos widgets com alerta diretamente no canvas e navegacao do diagnostico para o item afetado.

### Corrigido

- Duplo clique volta a abrir as propriedades sem ser cancelado pelo inicio do gesto de arraste.
- Movimento e resize sempre finalizam no `pointerup`, mesmo fora do canvas ou quando o WebView perde a captura do ponteiro.
- Arraste do catalogo passa a usar Pointer Events internos e entrega direta ao canvas, eliminando a operacao HTML recusada pelo WebView2.
- Informacoes de tela passam a um rodape discreto do Contexto; o bloco redundante `Guia ativa` foi removido.

### Compatibilidade

- Schema permanece `0.7.0`, Device Runtime permanece `0.10.0` e LinkPad Protocol permanece `0.1.0`.
- A auditoria e estado de engenharia calculado e nao e gravada no projeto nem enviada ao hardware.

## 0.13.0 - 2026-07-16

### Adicionado

- Widgets portateis `gauge` e `progress_bar`, ambos usando o seletor canonico e aceitando valores `int`/`float`.
- Estilo comum com alinhamento horizontal/vertical, padding, borda, cor de borda e arredondamento.
- Intervalo visual minimo/maximo e exibicao opcional do valor em medidores.

### Alterado

- Schema de projeto passa a `0.7.0` e normaliza os defaults visuais compartilhados.
- Device Runtime passa a `0.10.0` e renderiza os sete widgets e o estilo comum no M5StickC Plus2.

### Validacao

- Template M5 compilado de verdade com a toolchain PlatformIO gerenciada.

## 0.12.0 - 2026-07-16

### Adicionado

- Snap inteligente em bordas e centros de outros widgets e do display durante movimento e redimensionamento.
- Guias visuais com cores distintas para referencias do display e de widgets.
- Grade configuravel em `1`, `2`, `4`, `5`, `8` ou `10` pixels logicos.

### Compatibilidade

- Schema permanece `0.6.0` e Device Runtime permanece `0.9.0`; grade, snap e guias continuam sendo estado transitorio do editor.

## 0.11.0 - 2026-07-16

### Adicionado

- Painel de camadas com selecao, visibilidade, bloqueio e ordem visual.
- Agrupar/desagrupar, copiar, recortar, colar, duplicar, bloquear/desbloquear e ocultar/mostrar.
- Selecao e manipulacao atomica de grupos; `Alt` permite isolar um membro.

### Alterado

- Schema de projeto passa a `0.6.0` para persistir `editor.locked` e `editor.groupId`.
- Metadados de engenharia sao removidos pelo compilador e nunca entram no Device Runtime.

### Compatibilidade

- Projetos `0.1.0` a `0.5.0` recebem migracao automatica; grupos orfaos sao descartados.
- Device Runtime permanece `0.9.0`, Agent e LinkPad Protocol permanecem inalterados.

## 0.10.0 - 2026-07-16

### Adicionado

- Drag-and-drop do catalogo para uma posicao exata da tela e feedback de destino.
- Arraste por Pointer Events com fantasma da posicao original e commit somente ao concluir.
- Redimensionamento por oito alcas com tamanho minimo, limites da tela, snap e proporcao opcional com `Shift`.
- Selecao multipla por `Shift` ou marquee, com movimento e exclusao em grupo.
- Ferramentas recolhiveis no Contexto para geometria, alinhamento, distribuicao, centralizacao, tamanho e ordem.
- Zoom, ajuste ao espaco, grade, snap, movimentos por setas e atalhos de selecao, duplicacao, exclusao, configuracao, desfazer/refazer.
- Historico de ate 100 operacoes de widgets, compartilhado entre canvas, popup e Contexto.
- Tamanho de fonte, cor de texto, fundo colorido e fundo transparente como propriedades portateis do widget.

### Alterado

- Widget de valor sem simulacao mostra placeholder tipado (`###`, `##.##`, `Texto` ou `ON/OFF`) em vez do endereco industrial.
- O controlador de widgets passa a pertencer ao workspace, mantendo uma unica selecao para o canvas e o painel direito.
- Device Runtime passa a `0.9.0` e adapta o tamanho logico da fonte aos recursos do renderer M5.

### Compatibilidade

- Schema de projeto permanece `0.5.0`; selecao, zoom, grade e historico nao sao persistidos.
- Projetos anteriores usam fallbacks visuais quando as novas propriedades nao existem.
- Agent e LinkPad Protocol permanecem inalterados.

### Validacao

- Build TypeScript/Vite, 26 testes Vitest e 19 testes Rust aprovados.
- Template M5 compilado de verdade com a toolchain PlatformIO gerenciada.

## 0.9.1 - 2026-07-16

### Alterado

- O catálogo de widgets sai da barra horizontal do editor e passa para o painel direito `Contexto`.
- A seção `Widgets` aparece somente quando uma tela está ativa e adiciona itens diretamente nessa tela.
- O item atual do projeto ou a tela aberta recebem indicação visual de seleção no menu esquerdo.
- Tipos, nomes e valores iniciais dos widgets passam a ser definidos por um catálogo/fábrica compartilhado.

### Compatibilidade

- Schema de projeto permanece `0.5.0`, Device Runtime permanece `0.8.0` e LinkPad Protocol permanece `0.1.0`.
- Projetos existentes não exigem migração estrutural; somente `studioVersion` é normalizado para `0.9.1`.
- Agent, firmware gerado e os cinco tipos de widget não mudam de contrato.

## 0.9.0 - 2026-07-16

### Adicionado

- Comunicacao generica `OPC UA`, validada com servidor real e preparada para a primeira bancada fisica Siemens S7-1200/1500.
- Endpoint `opc.tcp://IPv4:4840`, timeouts e modo anonimo/None para laboratorio.
- Editor compartilhado de Node ID para endereco direto e Tag global externa.
- Suporte a Node ID por indice `ns=` e URI estavel `nsu=`.
- Validacao de endpoint privado, seguranca, auth, timeouts e formato do Node ID.
- Testes de compilacao do descritor OPC UA para o Device Runtime.

### Compatibilidade

- Placeholder desabilitado `siemens-opcua` e normalizado para o driver generico `opcua`.
- Schema de projeto permanece `0.5.0`, Device Runtime permanece `0.8.0` e LinkPad Protocol permanece `0.1.0`.
- Studio passa a `0.9.0`; certificados e busca online permanecem posteriores.

### Validacao e proximos passos

- Descritor OPC UA compilado pelo gerador e firmware M5 recompilado com a toolchain gerenciada.
- Agent validado contra servidor OPC UA real em leitura/escrita e no executavel empacotado.
- OPC UA no S7-1200 fisico, certificados e browse permanecem como proximas entregas.

## 0.8.0 - 2026-07-16

### Adicionado

- Tags globais internas com `initialValue`, sem PLC, comunicação ou chamada ao Agent.
- Atributo `Retentiva` exclusivo de Tags internas, persistido em NVS pelo template ESP32.
- Inicialização local com qualidade `good` e escrita de Tags internas mesmo com Wi-Fi/Agent offline.
- Validação local de tipo, direção e limites antes de atualizar uma Tag interna.

### Alterado

- `Nova tag` abre um popup com as abas `Interna` e `Externa`.
- O painel lateral de Tags globais é removido; duplo clique abre `Configurar Tag global`.
- A lista de Tags passa a mostrar origem, referência e quantidade de usos.
- Schema do projeto passa a `0.5.0`; Studio e Device Runtime passam a `0.8.0`.

### Retenção

- Valores retentivos usam o ID estável da Tag e ficam isolados por `projectId`.
- Escritas próximas são consolidadas por 500 ms para reduzir desgaste da flash.
- Valor armazenado incompatível com tipo/faixa é descartado e substituído por `initialValue`.

### Migração e compatibilidade

- Projetos `0.4.0` recebem backup em `.migration-backup/0.4.0` e são migrados automaticamente.
- Tags internas antigas removem perfil/endereço e recebem valor inicial compatível; `retentive` assume `false` quando ausente.
- LinkPad Protocol permanece `0.1.0` e o Agent não muda, pois Tags internas nunca são enviadas ao gateway.

## 0.7.2 - 2026-07-16

### Alterado

- O diálogo de dados passa a usar apenas o título `Selecionar tag` e layout compacto de `520px`.
- PLC, tipo e endereço passam a ocupar linhas curtas; Siemens usa diretamente `BOOL`, `INT`, `DINT` ou `REAL` e deriva o tipo LinkPad.
- Atualização fica recolhida fora do fluxo principal; `Valor de teste` aparece somente quando a comunicação escolhida é a simulação.
- A tela Tags globais remove qualidade e formulários industriais duplicados, reutilizando `ConnectorAddressEditor`.
- Limites mínimo/máximo deixam o apontamento e passam para o widget ou ação que executa a escrita.
- Limites antigos salvos no `DataBinding` ou na Tag global são elevados ao consumidor e removidos da origem durante a normalização compatível.
- O painel lateral de propriedades dos widgets é substituído pelo popup `Configurar widget`, aberto com duplo clique no item do display.
- O display passa a usar toda a largura disponível no editor de telas.

### Corrigido

- O botão ativo `Usar` volta a receber a cor de ação principal no rodapé do seletor, permanecendo visualmente distinto do estado desabilitado.

### Compatibilidade

- Schema permanece `0.4.0`, Device Runtime permanece `0.7.0` e LinkPad Protocol permanece `0.1.0`.
- O firmware continua recebendo `min` e `max` no ponto técnico; apenas sua origem de engenharia mudou.

## 0.7.1 - 2026-07-16

### Alterado

- `Comunicação` passa a se chamar `Rede LinkPad` e concentra Wi-Fi e acesso ao Agente LinkPad.
- `Conectores` passa a se chamar `Comunicações` e apresenta PLCs do projeto em uma lista direta.
- A criação de uma comunicação começa em `Adicionar PLC`, seguida da escolha do tipo disponível.
- Simulação fica separada dos PLCs físicos como ambiente de desenvolvimento.
- O formulário principal usa `Comunicação com PLC`, `Tipo de comunicação` e `IP do PLC`; rack, slot, timeout e ativação ficam em configurações avançadas.
- O seletor canônico e as Tags globais passam a usar o termo `PLC` no lugar de `Conector`.
- Tipos futuros permanecem visíveis e desabilitados, sem catálogo de cards ou descrições permanentes.

### Compatibilidade

- Schema do projeto permanece `0.4.0` e Device Runtime permanece `0.7.0`.
- `ProtocolProfile`, drivers, sessões e endpoints permanecem nomes internos; LinkPad Protocol e Agent não mudam.

## 0.7.0 - 2026-07-16

### Adicionado

- Contrato canônico `DataBinding` para endereço direto por conector ou referência a Tag global.
- `DataBindingField` compartilhado por widgets e ações, com abas `Conector` e `Tags globais`.
- Editores de endereço orientados pelo conector, incluindo formulário tipado Siemens S7.
- IDs estáveis para Tags globais e seleção filtrada por tipo/permissão.
- Compilação e deduplicação de endereços diretos em pontos técnicos do runtime.
- Rótulo legível separado do identificador técnico nos widgets embarcados.

### Alterado

- Schema do projeto passa a `0.4.0`; Studio e Device Runtime passam a `0.7.0`.
- `widget.props.tag` e referências industriais das ações passam a usar `DataBinding` no projeto editável.
- A lista de Tags passa a ser apresentada como `Tags globais` e deixa de ser obrigatória para endereçamento simples.
- Conectores não podem ser removidos enquanto forem utilizados por Tag global ou vínculo direto.

### Migração

- Projetos `0.1.0`, `0.2.0` e `0.3.0` são migrados automaticamente para `0.4.0`.
- Tags existentes recebem IDs determinísticos; widgets e ações por nome tornam-se referências globais.
- Projetos `0.3.0` recebem backup em `.migration-backup/0.3.0` no primeiro salvamento.

### Compatibilidade

- LinkPad Protocol permanece `0.1.0`; Agent e endpoints HTTP não mudam.
- Projetos gerados continuam enviando pontos com `id`, `type`, `address`, `min` e `max`.
- Instaladores não foram reconstruídos nesta iteração de desenvolvimento.

## 0.6.0 - 2026-07-16

### Adicionado

- Contrato `inputBindings` por tela, ligando controles e eventos normalizados a ações declarativas.
- Manifesto estruturado de entradas de hardware com identificador lógico, rótulo, tipo, eventos e disponibilidade para configuração.
- Editor `Controles desta tela`, com resumo abaixo do display e modal alimentado pelo catálogo do hardware.
- Ações de navegação, escrita de valor, alternância booleana e acionamento de widget interativo.
- `LinkPadInputAdapter` no template M5, isolando `M5.BtnA` e `M5.BtnB` do motor genérico de ações.
- Validação de controles reservados/ausentes, eventos incompatíveis, referências e valores de escrita.
- Backup de projetos `0.2.0` em `.migration-backup/0.2.0` antes do primeiro salvamento migrado.

### Alterado

- Schema do projeto passa a `0.3.0`; Studio e Device Runtime passam a `0.6.0`.
- O botão B deixa de executar implicitamente o primeiro widget de escrita; toda ação física passa a ser declarada na tela.
- Novas telas usam as dimensões do manifesto do hardware, removendo o valor fixo `240 x 135` do shell.
- Power permanece visível no catálogo do M5, mas reservado até o adaptador oferecer eventos seguros.

### Migração

- Projetos `0.1.0` e `0.2.0` são migrados automaticamente para `0.3.0`.
- O comportamento anterior é preservado como `primary/press -> próxima tela` e `secondary/press -> acionar primeiro write_button`, quando esse widget existe.

### Compatibilidade

- LinkPad Protocol permanece `0.1.0` e o Agent não exige alteração.
- Escritas continuam sem repetição automática após falha.
- Instaladores não foram reconstruídos nesta iteração de desenvolvimento.

## 0.5.1 - 2026-07-16

### Adicionado

- Descoberta nativa de portas seriais pelo backend Tauri, com identificacao USB quando fornecida pelo sistema operacional.
- Lista suspensa de portas detectadas e acao de atualizacao para hot-plug do device.
- Ordenacao numerica de portas Windows (`COM2` antes de `COM10`) e testes unitarios do enumerador.
- Excecao de versionamento para manter `src/features/build` no Git sem liberar diretorios de artefatos `build/`.

### Alterado

- A porta serial deixa de aceitar texto livre na aba Build.
- Uma porta salva mas desconectada permanece visivel como diagnostico, porem a gravacao fica bloqueada ate a selecao de uma porta detectada.
- Quando o projeto ainda nao possui porta e somente uma esta disponivel, o Studio a seleciona automaticamente.

### Compatibilidade

- `build.serialPort` permanece uma string e o schema de projeto continua `0.2.0`.
- LinkPad Protocol e Agent nao foram alterados.
- Device Runtime permanece `0.5.0`; somente o LinkPad Studio passa a `0.5.1`.
- Instaladores nao foram reconstruidos nesta iteracao de desenvolvimento.

## 0.5.0 - 2026-07-16

### Adicionado

- Contrato `hardware.statusOverlay` com posicao, estilo e lista de indicadores por hardware.
- Marca d'agua vetorial e colorida para Wi-Fi e Agent, persistente em todas as telas.
- Renderer responsivo que calcula geometria pela menor dimensao do display e suporta os quatro cantos.
- Preview do Studio com o mesmo overlay nao interativo do runtime.
- Normalizacao automatica de projetos anteriores sem `statusOverlay`.

### Alterado

- Removida a faixa textual `WiFi/Agent/S/T` do firmware.
- Detalhes de sessoes e qualidade de tags continuam internos e deixam de ocupar a tela principal.
- O icone do Agent representa exclusivamente disponibilidade HTTP, sem ficar offline por erro de PLC/tag.

### Compatibilidade

- Schema de projeto permanece `0.2.0` e LinkPad Protocol permanece `0.1.0`.
- Agent `0.2.0` nao exige alteracao.
- Instaladores nao foram reconstruidos nesta iteracao de desenvolvimento.

## 0.4.0 - 2026-07-15

### Adicionado

- CRUD de perfis na tela Conectores, com selecao, nome, driver, endpoint, habilitacao e teste independentes.
- Protecao contra exclusao de perfil ainda referenciado por tags.
- Tags exibem e selecionam o perfil pelo nome e driver, preservando `protocolProfileId` como vinculo canonico.
- Perfil default alterado de simulacao para S7 deixa de conservar o nome enganoso `Simulacao principal`.
- Runtime M5 com uma sessao LinkPad Protocol por perfil habilitado.
- Leituras agrupadas por perfil e escritas roteadas para a sessao da tag.
- Retry, expiracao e recuperacao independentes por perfil, sem invalidar outras sessoes.
- Diagnostico embarcado separado para Wi-Fi, Agent, sessoes abertas e saude das tags.
- Teste de projeto com dois conectores ativos e compilacao real do template ESP32 multi-conectores.

### Compatibilidade

- Schema de projeto permanece `0.2.0` e LinkPad Protocol permanece `0.1.0`.
- Projetos `0.2.0`/Studio `0.3.0` sao normalizados sem migracao estrutural; `studioVersion` passa a `0.4.0`.
- O Agent `0.2.0` nao exige alteracao, pois ja aceita varias sessoes simultaneas.
- Instaladores nao foram reconstruidos nesta iteracao de desenvolvimento.

## 0.3.0 - 2026-07-15

### Adicionado

- Conector selecionavel `siemens-s7` ao lado de `sim`.
- Editor de target S7 com IPv4 privado/TCP 102, rack, slot e timeout.
- Editor de tag S7 estruturado por DB, byte, bit e tipo `BOOL`, `INT`, `DINT` ou `REAL`.
- Defaults de endereco ao trocar o perfil e validacao de compatibilidade entre tipo LinkPad e tipo S7.
- Runtime gerado `0.3.0`, mantendo descritores genericos no device.
- Runtime diferencia HTTP 200 parcial de sucesso, preserva o ultimo valor valido e nao aceita escrita sem `status: written`.
- Testes de validacao para target privado, IP publico e conflito de tipo.
- Botao `Testar conexao` no perfil, usando sessao temporaria e sem ler/escrever tags.
- Resultado de handshake com endpoint e latencia, incluindo mensagens de erro do Agent.
- Cliente HTTP `reqwest` para POST/DELETE do diagnostico, executado fora da thread da interface.

### Compatibilidade

- Schema de projeto permanece `0.2.0`.
- LinkPad Protocol permanece `0.1.0` e preserva `value`/`valor`.
- Projetos de simulacao existentes continuam normalizados e editaveis.
- O instalador nao foi reconstruido nesta iteracao de desenvolvimento.

### Limitacoes

- Um perfil habilitado por firmware.
- S7 MVP limitado a area DB e tipos basicos.
- Teste final com PLC S7-1200 real ainda pendente.

## 0.2.0 - 2026-07-15

### Adicionado

- Schema de projeto `0.2.0` com rede, protocolos e build.
- Migracao automatica de projetos `0.1.0` com backup no primeiro salvamento.
- Catalogo de conectores com `sim` funcional e drivers industriais planejados.
- Configuracao Wi-Fi/Agent e diagnostico de status/capabilities.
- CRUD e validacao de tags.
- Editor basico de telas com cinco widgets.
- Validacao, geracao deterministica, build e gravacao PlatformIO para M5StickC Plus2.
- Toolchain PlatformIO gerenciada pelo Studio, com Python portatil, downloads verificados e nenhuma dependencia de `pio` no `PATH`.
- Preparacao automatica no primeiro build, progresso visivel e acao explicita `Preparar ambiente`.
- Staging de build em caminho compacto e copia dos binarios finais para o projeto.
- Versoes fixadas da plataforma ESP32, M5Unified e ArduinoJson.
- Compilacao real do runtime M5 validada com a toolchain gerenciada.
- Compilacao e gravacao em tarefa de backend separada, mantendo a interface responsiva.
- Progresso de build/upload e diagnostico incremental exibidos na aba Build.
- Capability Tauri minima para a janela principal escutar e remover listeners dos eventos de progresso.
- Testes TypeScript e Rust para migracao, validacao e geracao.

### Compatibilidade

- LinkPad Protocol permanece em `0.1.0`.
- `value` continua canonico e o runtime aceita `valor` como fallback de leitura.
- O Agent permanece independente e nao recebe configuracao do Studio.

### Limitacoes

- Nesta versao historica, apenas o driver `sim` era habilitado; `siemens-s7` foi liberado no Studio `0.3.0`.
- Um perfil habilitado por firmware no runtime MVP.
- A primeira preparacao da toolchain requer acesso a internet.
- Gravacao e comunicacao ponta a ponta ainda dependem de validacao com o M5Stick fisico.
