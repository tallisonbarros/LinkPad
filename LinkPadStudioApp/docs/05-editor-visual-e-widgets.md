# Editor Visual e Widgets

## Objetivo

Definir o editor drag-and-drop do Studio e a biblioteca inicial de widgets.

## Editor

O editor deve permitir:

- Criar telas.
- Posicionar widgets.
- Ajustar propriedades.
- Vincular widgets a conectores ou Tags globais pelo seletor canônico.
- Simular estados.
- Validar limites do hardware.

## Catalogo de Widgets

- Texto estatico.
- Valor de tag.
- Indicador booleano.
- Indicador de status.
- Botao de escrita.
- Medidor (`gauge`).
- Barra de progresso.

Planejados:

- Campo numerico de entrada.
- Icone de Wi-Fi/rede.
- Icone de agente/PLC.
- Icone de bateria.
- Lista de logs basica.

## Implementacao 0.2.0

O editor atual implementa:

- texto estatico;
- valor de tag;
- indicador booleano;
- indicador de status;
- botao de escrita;
- selecao e edicao de propriedades;
- posicionamento por arraste ou coordenadas;
- tamanho, visibilidade, cor e vinculo com tag;
- preview com `simulationValue`.

Medidor e barra foram acrescentados no Studio `0.13.0`/Runtime `0.10.0`. Campo numerico de entrada, icones especializados e logs permanecem no roadmap. A validação de build bloqueia widgets fora da tela, vínculos ausentes/inválidos, faixas visuais inválidas e escritas incompatíveis.

Os sete widgets implementados sao: texto estatico, valor de tag, indicador booleano, indicador de status, botao de escrita, medidor e barra de progresso. Wi-Fi e Agent aparecem pelo overlay permanente do hardware, nao como widgets arrastaveis.

## Implementação 0.7.0: seleção de dados

Widgets de leitura e escrita usam `DataBindingField`, um componente único do Studio. O painel do widget mostra apenas um resumo e o botão de seleção. Ao abrir, o mesmo diálogo apresenta as abas `PLC` e `Tags globais`. `PLC` é o nome de interface para o perfil de protocolo escolhido; simulações também aparecem nessa lista com identificação explícita.

O widget não possui formulário de Siemens, simulação ou qualquer outro protocolo. Ele declara somente o rótulo do campo, o acesso necessário e os tipos aceitos. Editores de endereço são registrados pelo catálogo de conectores e, por isso, ficam automaticamente disponíveis para todos os widgets e hardwares.

O mesmo componente é usado pela ação `changeValue` configurada em `Controles desta tela`. Operacao, operando e limites continuam fora do seletor. Nesse fluxo, a escolha da Tag aceita qualquer tipo gravavel e nao e filtrada pela operacao anterior: depois da selecao, o Studio preserva a operacao quando ela continuar compativel ou retorna automaticamente para `Definir`, normalizando operando e limites conforme o novo tipo.

No Studio `0.7.2`, o diálogo usa apenas o título `Selecionar tag`, campos de `32px` e largura máxima de `520px`. Siemens mostra diretamente `BOOL`, `INT`, `DINT` ou `REAL`; área fixa `DB` e o tipo LinkPad derivado não ocupam campos próprios. A atualização fica recolhida. `Valor de teste` aparece somente para a comunicação de simulação e alimenta o preview do Studio sem escrever em PLC.

Mínimo e máximo são configuração do consumidor de escrita, não do apontamento. O `write_button` edita `props.min`/`props.max` junto do valor; uma ação `changeValue` edita seus limites no painel da ação. Operacoes booleanas e string não exibem faixa numérica.

No Studio `0.7.2`, widgets deixaram de manter um formulario lateral permanente: um clique selecionava o item e o duplo clique abria `Configurar widget` como popup. Na evolucao atual, o Contexto possui uma unica superficie identificada como `Propriedades`, sem abas `Conteudo`/`Aparencia`, lapis, popup ou modo intermediario. Cada atributo ocupa uma linha `Propriedade | Valor | Animacao`; a ultima coluna e uma extensao visual reservada e desabilitada, sem persistencia no schema ate o contrato de animacoes ser definido. As categorias sao recolhiveis: `Conteudo` e `Visual` iniciam abertas, enquanto `Borda e espaco` e `Posicao e exibicao` iniciam recolhidas. Texto, vinculo, valor, faixa e estilo sao aplicados imediatamente ao preview.

X, Y, largura, altura e visibilidade passam a ser propriedades do widget e seguem a mesma grade dos demais atributos, agrupadas em `Posicao e exibicao` no final do painel. Quando o widget esta bloqueado, posicao e tamanho ficam desabilitados; visibilidade continua editavel para permitir recuperar um item oculto por `Camadas`. A barra superior conserva somente a identidade compacta; acoes de edicao ficam no menu de contexto do widget e igualacao entre varios itens pertence a `Alinhar`.

## Implementação 0.9.1: catálogo contextual

O catálogo dos cinco widgets implementados fica no painel direito `Contexto` e aparece somente quando a aba ativa representa uma tela. A barra horizontal acima do display foi removida. Um clique em `Texto`, `Valor`, `Booleano`, `Status` ou `Escrita` inclui o item na tela ativa; o novo item é selecionado automaticamente no preview.

`WIDGET_CATALOG` concentra a lista visível, enquanto `createWidgetFromCatalog` concentra dimensões, posição e propriedades iniciais. O painel contextual não conhece M5Stick, resolução, conector ou protocolo. Por isso, novos hardwares reutilizam o mesmo catálogo e novos tipos de widget devem entrar por esse registro compartilhado, mantendo o editor responsável apenas por renderização, arraste e propriedades.

Cada tela na arvore esquerda possui menu de contexto pelo botao direito com `Copiar`, `Recortar`, `Colar`, `Duplicar` e `Excluir`. A colagem de uma copia cria uma tela independente abaixo do destino; a colagem de um recorte move a tela original para essa posicao. A tela recortada recebe indicacao visual enquanto aguarda destino. O menu fecha por clique externo, rolagem, perda de foco ou `Esc`, e se reposiciona para permanecer dentro da janela.

Ao sair da tela para Projeto, Rede LinkPad, Comunicações, Tags globais, Build ou Diagnóstico, a seção desaparece do Contexto. O menu esquerdo continua dedicado à navegação e identifica visualmente a área ou tela ativa. Device/hardware pertence à página Projeto e Assets não é exibido sem uma função operacional.

## Implementacao 0.10.0: canvas profissional

O catalogo continua no Contexto, mas cada item tambem pode ser arrastado e solto na posicao exata do display. A manipulacao interna usa Pointer Events e coordenadas logicas da tela, independentes do zoom e da resolucao fisica do monitor.

O arraste do catalogo usa Pointer Events internos, sem `DataTransfer` ou drag-and-drop HTML. Depois de 4 px de movimento, um fantasma acompanha o cursor e o catalogo publica a posicao dentro da propria janela. Ao soltar sobre o display, o canvas cria o widget naquela coordenada. Isso evita a operacao nativa recusada pelo WebView2 e mantem o clique simples como atalho independente.

O canvas oferece:

- arraste individual ou em grupo, mostrando o widget em movimento e um fantasma na origem;
- redimensionamento por oito alcas, com tamanho minimo por tipo e limites do display;
- `Shift` durante resize para preservar proporcao;
- selecao multipla com `Shift` e selecao retangular em area vazia;
- grade de 4 px e snap opcionais;
- zoom entre 50% e 200% ou ajuste automatico ao espaco;
- desfazer/refazer de ate 100 operacoes de widgets;
- atalhos `Ctrl+A`, `Ctrl+D`, `Ctrl+Z`, `Ctrl+Y`, `Delete`, `Escape` e setas; `Shift+seta` move 5 px;
- propriedades funcionais e visuais imediatas na secao inferior do Contexto para selecao unica.

O painel direito usa a mesma selecao e apresenta somente o inspector `Propriedades` para selecao unica. Seus atributos usam linhas compactas com nome, editor do valor e uma terceira coluna reservada para animacao futura. `Conteudo` e `Visual` formam os grupos prioritarios e iniciam abertos; `Borda e espaco` inicia recolhido e `Posicao e exibicao`, tambem recolhido, encerra o painel. A barra superior conserva apenas a identidade compacta da selecao. Copiar, recortar, colar, duplicar, bloquear/desbloquear e excluir ficam no menu de contexto aberto pelo botao direito sobre o widget.

Alinhamento, distribuicao, centralizacao e igualacao de largura/altura pertencem ao menu expansivel `Alinhar` na barra do canvas, ao lado de Grade, Snap, Guias e Revisao. O menu pode sempre ser aberto ou fechado, inclusive sem selecao. Cada operacao que exige um, dois ou tres itens e desabilitada individualmente ate que a selecao seja suficiente; o ultimo widget selecionado e a referencia de alinhamento e tamanho.

`Ordem` e `Grupo` usam o mesmo padrao expansivel na barra. `Ordem` traz para frente, avanca, recua ou envia para tras os widgets editaveis selecionados. `Grupo` agrupa dois ou mais itens editaveis ou desagrupa a selecao que ja pertence a um grupo. Os tres menus sao intertravados: expandir `Alinhar`, `Ordem` ou `Grupo` recolhe qualquer outro que esteja aberto. Eles permanecem abríveis sem selecao e somente os comandos internos sao desabilitados. A lista `Camadas` continua no Contexto para localizar, selecionar, ocultar e bloquear itens; ela nao duplica as operacoes de ordem.

Selecao, zoom, grade, snap, marquee, fantasma e historico sao estado de engenharia transitorio. Somente a lista final de widgets e persistida no projeto, e uma manipulacao continua gera um unico commit ao ser concluida.

O preview de `tag_value` usa o valor simulado quando disponivel. Sem valor, mostra `###`, `##.##`, `Texto` ou `ON/OFF` conforme o tipo; nunca usa o endereco industrial como conteudo visual do widget.

## Implementacao 0.11.0: camadas, grupos e area de transferencia

O comando `Camadas` no topo do Contexto abre temporariamente a lista em ordem visual. Cada linha seleciona o widget e permite alternar visibilidade ou bloqueio. Ao selecionar um item, o drawer fecha e o painel retorna diretamente para `Propriedades`; posicao, tamanho e visibilidade ficam no proprio inspector, enquanto a linha superior mostra somente a identidade compacta. Itens bloqueados continuam selecionaveis para diagnostico e podem ser desbloqueados pelo botao direito, mas nao podem ser movidos, redimensionados ou excluidos.

`Ctrl+C`, `Ctrl+X` e `Ctrl+V` e os comandos equivalentes do menu de contexto usam uma area de transferencia interna do Studio; copias recebem novos IDs e permanecem dentro do display. O botao direito preserva toda a selecao multipla quando acionado sobre um de seus membros; sobre outro widget, seleciona o novo alvo ou grupo. `Ctrl+G` agrupa a selecao e `Ctrl+Shift+G` desagrupa. Um clique em qualquer membro seleciona o grupo inteiro; `Alt+clique` isola o membro. O grupo nao muda a ordem das camadas nem cria container no runtime.

`editor.locked` e `editor.groupId` pertencem ao schema `0.6.0`, mas o gerador remove `editor` antes de produzir o firmware. `visible` continua funcional e e interpretado pelo renderer.

## Implementacao 0.12.0: precisao e guias

A grade pode usar `1`, `2`, `4`, `5`, `8` ou `10` pixels logicos. Com snap ativo, movimento e redimensionamento procuram a referencia mais proxima entre bordas e centros dos outros widgets e do display. A linha azul indica referencia do display; a laranja indica outro widget.

Grade, tamanho, snap e guias nao sao persistidos. O gesto grava somente a geometria final, mantendo o projeto independente do monitor e das preferencias do integrador.

## Implementacao 0.13.0: sistema portatil de widgets

`gauge` e `progress_bar` reutilizam `DataBindingField`, aceitam `int`/`float` de endereco direto ou Tag global e guardam `min`, `max` e `showValue` no proprio consumidor. A faixa e visual e nao substitui escala, tipo ou limite de escrita industrial.

Todos os sete tipos usam a mesma secao inferior de propriedades e o mesmo conjunto de configuracoes: fonte, cor, fundo/transparencia, alinhamento horizontal/vertical, padding, espessura/cor da borda e arredondamento. O schema `0.7.0` normaliza defaults; o runtime M5 `0.10.0` adapta esse contrato ao M5Unified.

## Implementacao 0.14.0: auditoria visual

`Alertas` na secao inferior calcula problemas de vinculo ausente, intervalo invalido, altura insuficiente, texto possivelmente truncado e baixo contraste. Clicar em um alerta seleciona o widget sem fechar a guia, permitindo revisar varios itens em sequencia. O botao `Revisao` alterna os marcadores no canvas.

A auditoria nao e persistida, nao bloqueia automaticamente o build e nao e enviada ao hardware. Erros contratuais continuam na validacao de build; a auditoria orienta ajustes de composicao que dependem do contexto visual.

O primeiro clique seleciona o widget e alimenta imediatamente o painel `Propriedades`. O duplo clique funciona como retorno explicito ao inspector: seleciona somente o widget acionado e fecha qualquer drawer concorrente de Catalogo ou Camadas, mesmo quando o item ja estava selecionado. A guia inferior ativa permanece independente. Durante movimento ou resize, o elemento de origem tenta capturar o ponteiro e um listener global atua como fallback. Soltar fora do canvas, perder a captura ou tirar o foco da janela conclui ou cancela o gesto sem deixar o editor preso em estado de manipulacao.

Tela, resolucao e quantidade de widgets aparecem em um rodape compacto do Contexto. O bloco `Guia ativa` nao faz parte da tela, pois a aba ativa ja e indicada pela navegacao e pelas guias do workspace.

Catalogo e camadas nao disputam espaco permanente com as propriedades. A barra superior do Contexto oferece `Adicionar` e `Camadas`, cada qual abrindo um drawer temporario. Alertas e seu contador ficam na secao inferior, onde a largura horizontal favorece a leitura da auditoria. Sem selecao, o painel orienta o integrador a selecionar ou adicionar. Com selecao unica, `Propriedades` assume automaticamente a area principal; com selecao multipla, o menu de contexto atua sobre todo o conjunto e o Contexto orienta escolher um unico item para editar atributos.

## Estilo portatil dos widgets no runtime 0.10.0

Os sete widgets compartilham estas propriedades visuais em `props`:

```json
{
  "fontSize": 8,
  "color": "#ffffff",
  "transparent": true,
  "backgroundColor": "#232528",
  "textAlign": "left",
  "verticalAlign": "middle",
  "padding": 2,
  "borderWidth": 0,
  "borderColor": "#ffffff",
  "borderRadius": 0
}
```

`fontSize` usa pixels logicos do display e aceita 6 a 32. O preview escala esse valor junto com o hardware. O renderer M5 converte para a escala inteira mais proxima da fonte nativa; outros hardwares devem adaptar o mesmo valor aos recursos de sua biblioteca grafica. `backgroundColor` so e pintado quando `transparent` e `false`.

Projetos anteriores continuam validos: texto, valor, booleano e status assumem fundo transparente; o botao de escrita assume fundo opaco. Cor, fonte e fundo invalidos bloqueiam o build. Nao ha dependencia de conector, Agent ou protocolo nessas propriedades.

## Controles da Tela

No Studio `0.17.0`, o editor possui uma secao inferior recolhivel e orientada por guias. `Controles` e a primeira guia e mostra diretamente a grade compacta com cabecalho unico `Controle | Evento | Acao | Configuracao`. O resumo fixo abaixo do display e o modal principal de Controles foram removidos. Cada `inputBinding` ocupa uma linha; celulas repetidas sao substituidas por continuidade visual, deixando todas as configuracoes visiveis sem cartoes ou cabecalhos intermediarios.

`ScreenBottomPanel` recebe uma lista declarativa de guias com ID, rotulo, icone, contador e conteudo. `Controles` apresenta a quantidade de acoes configuradas e `Alertas`, a quantidade de avisos da auditoria. O editor reserva para ele somente a ultima linha da grade vertical: recolhido, ocupa apenas a barra de guias colada ao rodape; expandido, cresce para cima e reduz a area rolavel do canvas. Clicar numa guia expande a secao e o comando lateral a recolhe. Expansao e guia ativa sao estados transitorios da sessao: nao entram no projeto, firmware ou manifesto de hardware. Novas ferramentas de tela devem ocupar outra guia dessa mesma estrutura, sem duplicar um painel por hardware.

Dentro da guia, `Nova acao` abre um modal exclusivo e progressivo com Controle, Evento, Acao e somente a configuracao exigida pela escolha. Controle filtra eventos pelo manifesto; controle e capacidades filtram as acoes. Ao confirmar, o Studio localiza automaticamente o ramo `inputId/event`: cria o grupo quando necessario e, quando ele ja existe, acrescenta a acao ao final da sequencia.

Na grade, a linha fica em modo de edicao somente quando acionada. Controle, evento, acao e configuracao podem ser ajustados na propria linha e exigem confirmacao ou cancelamento explicitos. Comandos de editar, subir, descer e excluir aparecem de forma discreta na linha ativa ou sob o ponteiro. Existe apenas a contagem global de acoes; contagens por controle/evento, caixas para valores estaticos e titulos repetidos nao fazem parte da interface.

Cada evento aceita uma sequencia ordenada. `Adicionar acao` usa quatro categorias:

- Navegacao: proxima, anterior ou tela especifica;
- Interface: acionar widget interativo;
- Dados: `Alterar valor`, com operacoes oferecidas conforme tipo e acesso da Tag;
- Dispositivo: desligar, somente quando o hardware oferece `powerOff` e a entrada ativa inclui essa acao em `deviceActions`.

Fora do modo de edicao, a linha apresenta texto compacto e um resumo da configuracao: tela destino, widget, Tag, operacao/operando ou dispositivo. `Alterar valor` permite expandir operacao, operando e limites somente na linha em edicao. A Tag e escolhida primeiro entre todos os tipos gravaveis; a operacao acompanha o tipo e a direcao resultantes. Booleanos oferecem `Definir` e `Inverter estado`; numericos oferecem `Definir`, `Somar ao valor atual` e `Subtrair do valor atual`; strings oferecem `Definir`. Ao trocar de tipo, uma operacao incompatível volta para `Definir`; ao manter um tipo compativel, a operacao atual e preservada. A posicao vertical dentro do evento e a ordem de execucao, portanto nao existe coluna numerica de ordem. Subir e descer reorganizam apenas as acoes do ramo atual. Varias entradas consecutivas com o mesmo `inputId/event` representam a sequencia na ordem salva; o modelo nao cria um formato paralelo `actions[]`.

No M5StickC Plus2, A, B e Power oferecem `Pressionar` e `Pressionar e segurar`, mas somente o manifesto de Power autoriza `Desligar`; essa categoria nem aparece ao adicionar acoes em A ou B. O gesto curto e o longo sao mutuamente exclusivos no adaptador. A acao `Desligar` deve ficar por ultimo porque a execucao fisica impede qualquer acao posterior; a validacao emite aviso quando a ordem estiver incorreta. A configuracao pertence a `screen.inputBindings`, nao a coordenadas do display nem a APIs do M5.

`screenControlCatalog.ts` concentra rotulos e icones dos eventos, categorias e escolhas de acao. O icone da entrada deriva de `kind` e das capacidades declaradas, nunca de uma comparacao fixa com IDs do M5. Essa separacao permite que teclados, encoders e touch reutilizem a mesma grade agrupada. Modal de criacao, linha em edicao e expansao de detalhes sao estados apenas visuais e nao alteram o projeto ate a confirmacao.

## Overlay Permanente do Runtime

No Studio `0.5.0`, o preview mostra a mesma marca d'agua de Wi-Fi e Agent gerada no firmware. Ela nao pertence a `screen.widgets`, nao pode ser selecionada/arrastada e aparece em todas as telas conforme `hardware.statusOverlay`.

Essa separacao evita duplicar widgets de diagnostico em cada tela e permite adaptar posicao e escala pelo manifesto de futuros hardwares.

## Propriedades Comuns

Todo widget deve ter:

```json
{
  "id": "widget-id",
  "type": "tag_value",
  "x": 0,
  "y": 0,
  "width": 80,
  "height": 24,
  "visible": true
}
```

## Vínculo com dados

Widgets que consomem dados devem aceitar um `DataBinding`:

- endereço direto com `protocolProfileId`, `type`, `address`, `pollMs` e simulação; ou
- referência por `tagId` a uma Tag global;
- `format`
- `unit`
- `offlineText`
- `qualityBehavior`

O runtime compilado ainda recebe uma propriedade técnica `tag` para localizar o cache, mas ela é gerada e não pertence ao schema editável do widget `0.4.0`.

## Validacao

O Studio deve impedir:

- Widget fora da tela.
- Texto que nao cabe sem estrategia de fallback.
- Widget touch em hardware sem touch sem interacao alternativa.
- Escrita em Tag global somente leitura.
- Vínculo direto incompleto, com conector desabilitado ou tipo incompatível.
- Tag industrial sem perfil de protocolo ou endereco valido.
- Controle inexistente, reservado ou evento nao oferecido pelo manifesto.
- Acao de desligar sem `capabilities.powerOff` ou em entrada que nao a autorize por `deviceActions`.
- Acao posterior ao desligamento no mesmo evento gera aviso de ordem.
- Acao ligada a tela, widget ou tag inexistente.
- Operacao incompatível com o tipo; soma/subtracao/inversao em Tag sem acesso `readWrite`.
- Operando ausente ou de tipo incorreto e faixa numerica com `min > max`.

## Proximos Passos do Editor

- campo numerico de entrada reutilizando `DataBindingField`;
- feedback visual configuravel de qualidade, stale e falha de escrita;
- simulacao de controles e eventos da tela;
- ampliar a auditoria para fontes customizadas e capacidades touch do hardware;
- suporte a touch/foco condicionado pelas capacidades do hardware;
- teste de ponto e browse como ajuda do editor compartilhado, nunca dentro de um widget especifico.

Todo novo widget deve declarar acesso e tipos aceitos, usar a grade compartilhada `Propriedade | Valor | Animacao` do Contexto e funcionar com PLC/endereco direto ou Tag global sem UI propria de protocolo. A coluna de animacao permanece apenas reservada ate existir contrato portatil de propriedades animadas para Studio, projeto e runtimes.
