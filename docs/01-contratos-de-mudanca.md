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
- OPC UA continua planejado como outro conector Siemens; esta decisao nao o remove do catalogo.
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
