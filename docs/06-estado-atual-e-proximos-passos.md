# Estado Atual e Proximos Passos

## Objetivo

Consolidar o estado funcional do LinkPad ao fim do ciclo de desenvolvimento de 2026-07-20 e separar claramente capacidades entregues, validacoes realizadas, limites conhecidos e aberturas de evolucao.

Este documento e um indice executivo. Os contratos detalhados continuam nos documentos canonicos de Studio, Runtime, Agent, tags e LinkPad Protocol.

## Versoes Atuais

| Componente | Versao | Observacao |
| --- | --- | --- |
| LinkPad Studio | `0.17.1` | Canvas profissional, controles sequenciais e painel inferior por guias |
| Schema de projeto | `0.9.0` | Tags, DataBinding, controles multiacao e acao unificada `changeValue` |
| Device Runtime | `0.12.1` | Runtime M5 com sete widgets, multi-conectores e qualidade isolada por ponto |
| LinkPad Agent | `0.3.0` | Drivers `sim`, `siemens-s7` e `opcua` |
| Configuracao local do Agent | `0.4.0` | Whitelist default inclui os tres drivers entregues |
| LinkPad Protocol | `0.1.0` | Sessoes, leitura/escrita em lote e compatibilidade `value`/`valor` |
| Hardware implementado | `m5stickc-plus2` | Arduino ESP32, display 240x135, A/B/Power e NVS |

## Capacidades Entregues no Studio

- aplicativo desktop Tauri/React com persistencia real de projetos `.linkpad`;
- bootstrap visual `Abrindo Studio...` anterior ao React, removido na primeira montagem sem atraso artificial;
- migracao automatica dos schemas `0.1.0` a `0.8.0`, com backup antes do primeiro salvamento;
- linguagem orientada ao integrador: `Rede LinkPad`, `Comunicacoes`, PLCs e Tags globais;
- arvore simplificada: Projeto concentra o resumo do Device/hardware e Assets permanece oculto ate existir um fluxo real de importacao e uso;
- menu de contexto nas telas da arvore para copiar, recortar, colar, duplicar e excluir, com remapeamento seguro de IDs e referencias internas;
- varios PLCs/simulacoes habilitados no mesmo projeto;
- teste efemero do Agent e teste de handshake de cada comunicacao sem exigir tag/DB;
- seletor canonico `Selecionar tag`, reutilizado por widgets, controles e Tags globais;
- catalogo e camadas acessados sob demanda no painel direito; auditoria visual concentrada na guia inferior `Alertas`;
- drag-and-drop do catalogo para a posicao escolhida, arraste com fantasma e redimensionamento por oito alcas;
- selecao multipla por `Shift` ou marquee; posicao, tamanho e visibilidade no inspector, alinhamento/distribuicao/igualacao, ordem e grupo na barra do canvas, e operacoes da selecao no menu de contexto do widget;
- camadas, grupos, bloqueio, visibilidade e copiar/recortar/colar com atalhos;
- zoom, ajuste ao espaco, grade configuravel, snap e guias inteligentes por borda/centro;
- auditoria visual de vinculo, intervalo, corte, estouro e contraste, com navegacao para o widget;
- preview de valor por placeholder tipado, sem expor endereco completo no display;
- endereco direto por PLC ou referencia por ID estavel a uma Tag global;
- editor compartilhado de enderecos para simulacao, Siemens S7 e OPC UA;
- Tags globais `Interna` e `Externa`, com `Retentiva` como atributo exclusivo da interna;
- poda embarcada de Tags globais sem consumidores, preservando o catalogo completo no projeto;
- selecao unica com painel dedicado `Propriedades` em linhas `nome | valor | animacao`; `Conteudo`/`Visual` iniciam abertos e `Borda e espaco`/`Posicao e exibicao` recolhidos, com geometria no final; a barra superior conserva a identidade compacta e Tags globais continuam em popup por duplo clique;
- controles derivados do manifesto em grade compacta agrupada por entrada/evento, criacao em modal exclusivo, edicao na linha e ordem definida pela posicao vertical;
- secao inferior recolhivel e extensivel por guias, com a tabela de Controles e a auditoria de Alertas incorporadas;
- acao compacta `Alterar valor`, em que a Tag e escolhida sem bloqueio pela operacao anterior e passa a oferecer definir/inverter para booleanos ou definir/somar/subtrair para numeros;
- descoberta nativa e selecao por lista das portas seriais conectadas;
- PlatformIO/Python gerenciados pelo Studio, sem instalacao manual ou dependencia de `PATH`;
- compilacao e gravacao fora da thread da UI, com barra de progresso e log incremental; `Compilar` gera e compila, enquanto `Gravar device` gera, compila e grava em uma unica acao;
- geracao deterministica de firmware e validacao real do template ESP32.

## Capacidades Entregues no Device Runtime

- Wi-Fi e comunicacao HTTP/JSON com o Agent;
- uma sessao efemera independente por perfil habilitado;
- leitura em lote agrupada por perfil e escrita roteada para a sessao correta;
- recuperacao independente de sessoes expiradas ou perdidas;
- preservacao do ultimo valor valido em resposta parcial;
- escrita sem repeticao automatica quando o resultado e ambiguo;
- sete widgets: texto, valor, booleano, status, botao de escrita, medidor e barra de progresso;
- fonte, cores, fundo, alinhamentos, padding, borda e arredondamento interpretados pelo renderer do hardware;
- motor de acoes sequenciais por evento: navegacao, alteracao de valor, acionamento de widget e desligamento;
- operacoes relativas sobre Tags `readWrite`, condicionadas a valor atual com qualidade `good`, com limites aplicados ao resultado;
- isolamento de falhas por ponto: uma Tag invalida nao bloqueia operacoes sobre outra Tag saudavel do mesmo perfil;
- adaptador M5 com clique curto e pressionar/segurar independentes para A, B e Power, com `powerOff` autorizado somente na entrada Power pelo manifesto;
- overlay vetorial de Wi-Fi e Agent como marca d'agua responsiva ao display;
- Tags internas operando offline e retencao NVS opcional no template ESP32;
- compilacao de `DataBinding` direto/global em pontos tecnicos deduplicados.

O runtime nao inclui bibliotecas industriais. S7, OPC UA e futuros protocolos continuam exclusivamente no Agent.

## Capacidades Entregues no Agent

- API LinkPad Protocol publica e API local de diagnostico;
- sessoes efemeras, TTL e pool de conexoes equivalentes;
- token, whitelist de devices/drivers, politica IPv4/CIDR e limites globais;
- deduplicacao de escrita por `deviceId`/`requestId`;
- driver `sim` com memoria efemera;
- driver `siemens-s7` com DB absoluto, `BOOL`, `INT`, `DINT` e `REAL`;
- driver `opcua` generico com Node ID `ns=`/`nsu=`, escalares, qualidade e timestamp;
- reconexao unica de leitura nos drivers de rede;
- escrita S7/OPC UA confirmada por releitura e nunca repetida automaticamente;
- execucao em console, servico Windows e bandeja independente;
- launcher de desenvolvimento unificado e instalador `0.3.0` reconstruido.

## Validacoes Realizadas

- fluxo M5 -> Agent -> driver `sim` validado;
- fluxo M5 -> Agent -> Siemens S7 nativo com leitura real validado em bancada;
- teste de conexao do Studio ate o S7 real validado;
- OPC UA validado automaticamente com servidor real `asyncua`, incluindo leitura e escrita pelo LinkPad Protocol;
- executavel empacotado do Agent validado ao abrir e fechar sessao OPC UA;
- firmware M5 compilado com a toolchain gerenciada;
- schema `0.9.0` e runtime `0.12.1`, incluindo `set`, `add`, `subtract`, `toggle`, poda de Tags sem consumidores e isolamento de qualidade, compilados no template M5 real;
- suites Python, TypeScript e Rust executadas no fechamento do ciclo.

Ainda nao foi registrada validacao OPC UA contra o S7-1200 fisico, nem uma campanha prolongada de escrita, reconexao e carga nos PLCs reais.

## Limites Atuais

- somente M5StickC Plus2 possui catalogo, template e adaptadores completos;
- o preview do Studio ainda nao e um simulador de protocolo/eventos completo;
- OPC UA usa modo anonimo, `SecurityPolicy None`, `SecurityMode None` e porta 4840;
- browse/importacao online de tags nao existe;
- Rockwell Logix, Modbus e PROFINET aparecem como evolucoes, mas nao sao drivers ativos;
- S7 nativo esta limitado a DB nao otimizado e quatro tipos basicos;
- simulacao visual de eventos de controle ainda nao executa as sequencias dentro do Studio;
- retencao e uma capacidade arquitetural do runtime, mas o unico backend implementado e NVS/Preferences no ESP32;
- Studio `0.17.1` ainda precisa de uma rodada de instalador/release completa; o instalador Agent `0.3.0` ja foi reconstruido;
- binarios ainda nao possuem assinatura digital e o transporte Device-Agent ainda nao usa TLS.

## Proximos Marcos Recomendados

### 1. Fechar a bancada Siemens

- validar OPC UA no S7-1200 fisico com Node IDs publicados pelo TIA Portal;
- validar escrita real tanto em S7 nativo quanto em OPC UA;
- medir reconexao, polling prolongado, perda de rede e reinicio do Agent/PLC;
- registrar matriz de CPU, firmware, licenca e configuracao TIA usada.

### 2. Tornar OPC UA apropriado para producao

- certificado de aplicacao e trust store protegidos no Agent;
- validacao/pinagem do certificado do servidor;
- `Basic256Sha256` com `SignAndEncrypt`;
- credenciais no Windows Credential Manager quando necessarias;
- nenhum segredo industrial incorporado ao firmware.

Seguranca OPC UA cabe no target/options existente, mas o armazenamento local de certificados/segredos exigira novo schema de configuracao do Agent e migracao documentada.

### 3. Adicionar browse e teste de ponto

- teste explicito de leitura/escrita de uma tag na engenharia, separado do teste de handshake;
- browse paginado OPC UA com namespace, Node ID, tipo e permissao;
- pesquisa de tags Logix quando o driver Rockwell existir;
- preenchimento do mesmo `address` usado atualmente, sem criar uma terceira origem de dados.

Browse exige novos endpoints e uma versao minor nova do LinkPad Protocol. O Node ID/endereco direto deve continuar valido sem browse.

### 4. Implementar Rockwell Logix

- adaptar o `pycomm3` validado no prototipo ao modelo de target/sessao;
- suportar CompactLogix/ControlLogix, leitura, escrita, tipos e connection pool;
- validar com PLC Rockwell real;
- manter `rockwell-logix` desabilitado no Studio ate o Agent anunciar a capacidade.

O driver cabe no LinkPad Protocol atual e nao exige biblioteca no device.

### 5. Validar a arquitetura com um segundo hardware

- adicionar um hardware por manifesto, preferencialmente com display/entradas diferentes;
- implementar adaptadores de display, entrada e armazenamento local;
- comprovar que overlay, controles, DataBinding e Tags retentivas nao dependem do M5Stick;
- tratar widgets/capacidades especificos como entregas posteriores e separadas.

### 6. Evoluir simulacao, UX e robustez

- simulacao de botoes, sessoes, qualidade e estados offline no Studio;
- cache/deduplicacao de leitura e limites por device/sessao/target no Agent;
- auditoria de escrita, TLS e identidade por device;
- teste de carga, upgrade e instalacao em VM limpa;
- OTA, deploy por rede e gerenciamento de frota somente depois da bancada local estar estabilizada.

## Regras Para Evolucao

- nao reintroduzir PLC/tags persistidos no Agent;
- nao criar pareamento Studio-Agent;
- nao colocar bibliotecas industriais no device como caminho padrao;
- manter um unico seletor de dados e editores de endereco compartilhados;
- manter Tags retentivas como Tags internas com atributo, nunca como terceira origem;
- habilitar um conector no Studio somente quando o Agent funcional o anunciar;
- atualizar contratos, versoes, migracoes, changelogs e testes na mesma entrega.
