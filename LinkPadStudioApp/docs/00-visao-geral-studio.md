# Visao Geral do LinkPad Studio

## Objetivo

O LinkPad Studio e um ambiente de engenharia para criar aplicacoes industriais embarcadas em devices como M5Stick, M5Stack e futuros hardwares.

O produto alvo e um aplicativo Windows desktop.

O Studio deve permitir:

- Escolher um hardware de catalogo.
- Configurar o endereco HTTP de qualquer LinkPad Agente compativel.
- Criar varios perfis declarativos de protocolo industrial que serao incorporados ao runtime.
- Criar tags industriais.
- Montar telas em editor visual.
- Simular telas e tags.
- Gerar firmware/runtime.
- Fazer build e deploy no device.

## Escopo Inicial

O primeiro hardware suportado e o M5StickC Plus2. O catalogo, o template Arduino ESP32, o adaptador A/B, o overlay e a retencao NVS estao implementados para esse modelo.

O fluxo funcional atual e:

```text
Studio -> projeto com protocolos -> firmware M5 -> LinkPad Protocol -> LinkPad Agente -> driver -> PLC
```

## O Que o Studio Nao Deve Fazer no MVP

- Comunicar diretamente com PLC em producao.
- Implementar bibliotecas ou execucao de drivers industriais dentro do editor.
- Parear, provisionar ou implantar configuracao diretamente em um Agente.
- Gerar firmware monolitico sem contratos.
- Depender exclusivamente de um unico modelo M5.

## Produtos Relacionados

- LinkPad Device Runtime: firmware gerado pelo Studio para rodar no hardware.
- LinkPad Agente: executor independente do LinkPad Protocol para drivers industriais.

## Stack Inicial

O Studio usa Tauri como runtime desktop Windows.

A UI e implementada em React/TypeScript e empacotada dentro da janela Tauri. Vite e usado apenas como ferramenta interna de desenvolvimento/build da interface, nao como modo de entrega web do produto.

## Principios de Produto

- Interface amigavel e moderna.
- Orientado a industria.
- Robusto em falhas de rede.
- Fluido para edicao visual.
- Escalavel para novos hardwares.
- Independente da instalacao e configuracao local do Agente.
- Multi-conectores por projeto, com tags vinculadas explicitamente a cada perfil.
- Intuitivo para usuarios de ambientes como TIA Portal, FactoryTalk View e similares.

## Estado Atual 0.17.1

- `Rede LinkPad` configura Wi-Fi, Agent, token e diagnostico HTTP;
- a abertura desktop mostra um bootstrap visual antes do React, evitando janela vazia enquanto a interface e carregada;
- a arvore usa `Projeto` como entrada unica para dados gerais e Device/hardware, e nao exibe `Assets` sem uma funcao operacional;
- `Comunicacoes` gerencia simulacoes e varios PLCs por projeto;
- `sim`, Siemens S7 nativo e OPC UA estao habilitados;
- widgets, controles e Tags globais usam o mesmo seletor de dados;
- o painel direito usa um inspector orientado pela selecao e abre catalogo e camadas somente quando solicitados; a auditoria visual ocupa a guia `Alertas` da secao inferior;
- o canvas permite drag-and-drop, fantasma, redimensionamento, selecao multipla, grupos, camadas, bloqueio, copiar/colar e menus expansiveis intertravados de alinhamento, ordem e grupo, alem de zoom, grade configuravel, guias inteligentes, atalhos e historico;
- os sete widgets atuais incluem medidor e barra de progresso e aceitam estilo portatil comum de fonte, fundo, alinhamento, padding, borda e arredondamento;
- a auditoria visual calcula alertas de vinculo, intervalo, corte, largura e contraste sem contaminar o projeto/runtime;
- Tags globais podem ser internas ou externas, e Tags internas podem ser retentivas;
- somente Tags globais com consumidor entram no firmware; falhas de leitura ficam isoladas por ponto;
- controles sao declarados por tela a partir do manifesto do hardware;
- cada evento de controle aceita acoes ordenadas; A, B e Power oferecem clique curto/segurar e o runtime M5 implementa desligamento por acao portatil;
- dados usam uma acao `Alterar valor`, com definir, somar, subtrair ou inverter conforme o tipo/acesso da Tag;
- a secao inferior recolhivel usa guias e incorpora a tabela completa de Controles sem abrir um modal principal;
- firmware e compilado/gravado por uma toolchain privada com progresso e porta serial detectada.

## Aberturas de Evolucao

- segundo hardware para validar a abstracao alem do M5Stick;
- simulacao de eventos, falhas, sessoes e qualidade;
- browse/teste de ponto para OPC UA e, depois, Rockwell;
- biblioteca de widgets de entrada, imagem e tendencia;
- OTA e deploy por rede depois da estabilizacao da bancada.

As prioridades e os gatilhos de versionamento estao em `../../docs/06-estado-atual-e-proximos-passos.md`.
