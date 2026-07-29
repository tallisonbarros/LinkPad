# Arquitetura do LinkPad Agente

## Camadas

```text
LinkPad Agente
  LinkPad Protocol API
  Security and Target Policy
  Session Manager
  Request Manager
  Connection Pool
  Driver Registry
  Industrial Drivers
  State Monitor
  Diagnostics
  Minimal Config Store
  Minimal UI / Headless Runner
  Service Manager
```

## Implementacao 0.3.0

O codigo esta em `src/linkpad_agent` e separa:

- `api`: API publica e API local;
- `protocol`: modelos e erros do contrato;
- `runtime`: coordenacao, limites, metricas e deduplicacao;
- `sessions`: sessoes efemeras e connection pool;
- `drivers`: interface, registry, `sim`, `siemens-s7` e `opcua`;
- `security`: politica de device, driver, IPv4 e redes/CIDRs;
- `host`, `service_main` e `tray_main`: execucao Windows.

Cache de leitura e health check generico permanecem futuros. O S7 ja possui lock por conexao, reconexao unica de leitura e confirmacao de escrita.

O OPC UA tambem possui lock por conexao, cache efemero de NodeIds/VariantTypes, resolucao `nsu=`, reconexao unica de leitura e confirmacao de escrita. Esses caches nunca constituem configuracao de projeto.

## Fluxo de Requisicao

```text
Device envia target -> Security valida -> Session Manager cria sessao
Device envia pontos -> Request Manager protege -> Driver Registry seleciona driver
Connection Pool reutiliza conexao -> Driver executa -> API normaliza resposta
```

## Separacao

LinkPad Protocol API:

- Recebe HTTP.
- Valida schema e versao.
- Normaliza payload e respostas.
- Traduz erros para HTTP.

Security and Target Policy:

- Valida token/device.
- Impede acesso a destinos proibidos.
- Restringe drivers e redes quando configurado.
- Remove segredos de logs e diagnosticos.

Session Manager:

- Cria sessoes efemeras por device/projeto/target.
- Aplica TTL.
- Recupera de reinicio por recriacao solicitada pelo device.
- Nao persiste configuracao de projeto.

Request Manager:

- Aplica cache e deduplicacao.
- Aplica rate limit.
- Controla fila de escrita.
- Produz metricas por sessao, device, target e driver.

Connection Pool:

- Calcula uma chave segura para descritores equivalentes.
- Reutiliza conexoes S7 e OPC UA; Logix permanece futuro.
- Delega ao driver sua estrategia segura de reconexao.
- Fecha conexoes ociosas.

O lock global do pool protege apenas seus mapas em memoria. A abertura e o fechamento de rede ocorrem fora dele; um lock por target evita conexoes duplicadas para o mesmo descritor sem impedir que PLCs diferentes conectem em paralelo. O Session Manager tambem reserva capacidade antes da conexao e nao mantem o lock de sessoes enquanto aguarda a rede.

Driver Registry:

- Seleciona driver pelo campo `target.driver`.
- Expoe capacidades e schemas de endereco.
- Nao conhece telas, widgets ou projetos.

## Estado Operacional

O Agente nao possui um unico PLC conectado. Deve observar:

- servidor rodando;
- drivers disponiveis;
- sessoes ativas;
- conexoes em pool;
- conexoes por driver/target;
- leituras e escritas;
- RPS e bloqueios;
- fila de escrita;
- ultima falha por sessao/conexao.

## Independencia do Studio

O Agente nao recebe configuracao do Studio. O Studio pode estar em outra maquina, outra rede ou nem estar em execucao.

O contrato comum e o firmware gerado: ele leva os descritores e os envia ao Agente.

## UI e Headless

O Agente deve poder rodar:

- Com UI minima de operacao.
- Headless.
- Como servico Windows.

A UI nao deve reintroduzir cadastro manual de PLC, tags ou perfis como fluxo normal.

## Fronteiras Para Evolucao

- certificados, trust store e credenciais OPC UA ficam em armazenamento local protegido do Agent e exigem schema/migracao proprios;
- browse e teste de ponto reutilizam sessao/driver, mas nao criam lista persistente de tags;
- Rockwell, Modbus e futuros drivers implementam a mesma interface e so aparecem em capabilities quando funcionais;
- subscriptions exigem contrato LinkPad Protocol novo; nao podem vazar objetos `asyncua` para o Device Runtime;
- cache, fila e limites granulares permanecem no core e nao alteram descritores do Studio;
- cluster/cloud/frota nao entram antes de identidade, TLS, auditoria e operacao local estarem estabilizados.
