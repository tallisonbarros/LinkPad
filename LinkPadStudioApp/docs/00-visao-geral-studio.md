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

O primeiro hardware suportado sera a familia M5, com foco inicial no M5StickC Plus2 usado no exemplo.

O primeiro fluxo funcional sera:

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
