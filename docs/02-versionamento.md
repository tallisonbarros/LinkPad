# Versionamento

## Objetivo

Definir versionamento para projeto, contratos, runtime, agente e documentacao.

## Versoes Principais

O projeto deve versionar separadamente:

- LinkPad Studio.
- LinkPad Agente.
- Device Runtime.
- LinkPad Protocol.
- Contrato HTTP legado Device-Agent enquanto houver runtimes antigos.
- Schema de projeto LinkPad.
- Catalogo de hardware.

## SemVer

Use SemVer como base:

```text
MAJOR.MINOR.PATCH
```

- `MAJOR`: quebra compatibilidade.
- `MINOR`: adiciona funcionalidade compativel.
- `PATCH`: correcao compativel.

## Versao do LinkPad Protocol

O contrato orientado a requisicoes deve ter versao propria.

Versao inicial:

```text
linkpad-protocol: 0.1.0
```

O contrato legado permanece identificado como:

```text
legacy-device-agent-api: 0.1.0
```

Enquanto estiver em `0.x`, ainda pode evoluir rapidamente, mas mudancas devem ser documentadas.

## Versao do Projeto LinkPad

Todo arquivo `project.json` deve conter:

```json
{
  "schemaVersion": "0.9.0",
  "studioVersion": "0.17.1"
}
```

Snapshot atual:

| Artefato | Versao |
| --- | --- |
| Studio | `0.17.1` |
| Projeto | `0.9.0` |
| Device Runtime | `0.12.1` |
| Agent | `0.3.0` |
| Configuracao do Agent | `0.4.0` |
| LinkPad Protocol | `0.1.0` |

`0.2.0` introduz `network.json`, `protocols.json`, `build.json`, perfis declarativos de protocolo, enderecos industriais por tag e geracao de runtime. O Studio `0.2.0` migra projetos `0.1.0` automaticamente e cria uma copia dos arquivos anteriores em `.migration-backup/0.1.0` no primeiro salvamento.

O Studio `0.3.0` e o Agent `0.2.0` acrescentam o conector `siemens-s7`. O Studio e o Device Runtime `0.4.0` habilitam varios perfis simultaneos, mantendo uma sessao por `protocolProfileId`. O schema de projeto continua `0.2.0` e o LinkPad Protocol continua `0.1.0`, pois listas de perfis, `driver`, `endpoint`, `options`, `protocolProfileId`, `type` e `address` ja eram declarativos.

O Studio e o Device Runtime `0.5.0` acrescentam o overlay portatil de status Wi-Fi/Agent ao descritor do hardware. A extensao e compativel e nao altera o schema do projeto nem o LinkPad Protocol.

O Studio `0.5.1` substitui a digitacao livre da porta serial pela descoberta nativa das portas conectadas. A correcao e compativel: `build.serialPort` continua sendo uma string, o schema permanece `0.2.0` e o Device Runtime permanece `0.5.0`.

O Studio e o Device Runtime `0.6.0` introduzem o schema de projeto `0.3.0`. Cada tela passa a declarar `inputBindings`, associando entradas lógicas do manifesto de hardware a ações independentes do device. Projetos `0.1.0` e `0.2.0` são migrados automaticamente; o LinkPad Protocol permanece `0.1.0` e o Agent não muda.

O Studio e o Device Runtime `0.7.0` introduzem o schema de projeto `0.4.0`. Consumidores de dados passam a salvar `DataBinding`, apontando diretamente para um conector/endereço ou para uma Tag global identificada por ID estável. Projetos `0.1.0`, `0.2.0` e `0.3.0` são migrados automaticamente; LinkPad Protocol `0.1.0` e Agent permanecem inalterados.

O Studio `0.7.1` reorganiza a linguagem da interface em `Rede LinkPad`, `Comunicações`, `PLC` e `Tags globais`. O schema permanece `0.4.0` e o Device Runtime permanece `0.7.0`, pois `ProtocolProfile`, drivers, endpoints e sessões continuam sendo o contrato interno existente.

O Studio `0.7.2` compacta o seletor `Selecionar tag`, centraliza o editor industrial e move limites de escrita para widgets e ações. O schema continua `0.4.0`: `min`/`max` são opcionais em propriedades de widgets e ações, e valores legados no vínculo são normalizados sem alterar o LinkPad Protocol ou o Device Runtime.

O Studio e o Device Runtime `0.8.0` introduzem o schema `0.5.0`. Tags globais internas declaram `initialValue` e o atributo opcional `retentive`; não possuem comunicação nem endereço industrial. O runtime mantém esses valores localmente e usa NVS no ESP32 quando a Tag é retentiva. Projetos `0.4.0` recebem backup e migração automática. LinkPad Protocol `0.1.0` e Agent permanecem inalterados.

O schema de configuracao local do Agent passou a `0.3.0` para liberar `siemens-s7` no whitelist default. No Agent `0.3.0`, a configuracao passa a `0.4.0` e inclui `opcua` somente quando a lista anterior ainda era o default; whitelists personalizados sao preservados.

O Studio `0.9.0` e o Agent `0.3.0` habilitam o driver generico `opcua`, validado com servidor OPC UA real e preparado para a primeira bancada fisica Siemens S7-1200. O schema de projeto permanece `0.5.0`, o Device Runtime permanece `0.8.0` e o LinkPad Protocol permanece `0.1.0`: target, options, auth, `nodeId`, qualidade, timestamp, leitura e escrita ja cabem nos contratos declarativos existentes. A configuracao local do Agent passa a `0.4.0` para incluir `opcua` no whitelist default.

O Studio `0.9.1` move o catalogo de widgets para o painel direito de Contexto da tela ativa e centraliza a criacao dos cinco tipos existentes. E uma evolucao compativel de interface: o schema de projeto permanece `0.5.0`, o Device Runtime permanece `0.8.0` e Agent/LinkPad Protocol nao mudam.

O Studio `0.10.0` entrega o canvas profissional com drag-and-drop entre paineis, manipulacao por Pointer Events, redimensionamento, selecao multipla, ferramentas de alinhamento, zoom, grade/snap, atalhos e historico. O Device Runtime passa a `0.9.0` para interpretar tamanho de fonte, cor e transparencia/fundo dos widgets no M5. O schema permanece `0.5.0`: essas propriedades ficam no mapa extensivel `props`, com fallbacks para projetos antigos. Agent e LinkPad Protocol permanecem inalterados.

O Studio `0.11.0` introduz o schema `0.6.0`: `widget.editor` persiste bloqueio e grupo somente para engenharia. O gerador remove esse objeto do runtime. O Studio `0.12.0` preserva o schema e acrescenta guias, snap inteligente e grade configuravel como estado transitorio.

O Studio `0.13.0` introduz o schema `0.7.0` e o Device Runtime `0.10.0`. O contrato visual comum ganha alinhamentos, padding, borda e arredondamento; `gauge` e `progress_bar` entram no catalogo e no renderer M5. O Studio `0.14.0` preserva essas versoes e acrescenta somente auditoria visual calculada. Agent `0.3.0` e LinkPad Protocol `0.1.0` permanecem inalterados em toda a sequencia.

O Studio `0.15.0` consolida o inspector orientado pela selecao, menus do canvas, bootstrap visual e arvore simplificada, e introduz controles com varias acoes ordenadas por evento. O schema passa a `0.8.0` para liberar bindings repetidos do mesmo `inputId/event` e a acao `powerOff`; projetos `0.7.0` recebem backup e migracao sem reescrita das acoes existentes. O Device Runtime `0.11.0` executa todas as correspondencias em ordem, diferencia clique curto de `longPress`, le A/B/Power e implementa desligamento no adaptador M5. Agent e LinkPad Protocol permanecem inalterados.

O Studio `0.16.0` introduz `changeValue` e o schema `0.9.0`. Acoes `writeTag`/`toggleTag` do schema `0.8.0` recebem backup e migracao automatica para `set`/`toggle`. O Device Runtime `0.12.0` acrescenta `add` e `subtract` sobre valores atuais `good`, preservando o Agent `0.3.0` e o LinkPad Protocol `0.1.0`.

O Studio `0.17.0` substitui o resumo/modal principal de Controles por um painel inferior recolhivel e extensivel por guias. E uma evolucao de interface sem campo persistido: schema permanece `0.9.0`, Device Runtime `0.12.0`, Agent `0.3.0` e LinkPad Protocol `0.1.0`.

O Studio `0.17.1` e o Device Runtime `0.12.1` corrigem isolamento de pontos: Tags globais sem consumidores nao entram no firmware, respostas parciais atualizam qualidade por Tag e operacoes relativas dependem somente da sessao e do ponto-alvo `good`. E uma correcao compativel; schema `0.9.0`, Agent `0.3.0` e LinkPad Protocol `0.1.0` permanecem inalterados.

Evolucoes que exigem versao nova:

- browse online: nova versao minor do LinkPad Protocol e documentacao nos dois lados;
- armazenamento local de certificados/segredos OPC UA: novo schema de configuracao do Agent;
- novo campo estrutural persistido em projeto: novo schema de projeto e migracao;
- novo hardware que apenas implementa o manifesto atual: nova versao de catalogo/template, sem obrigar mudanca do LinkPad Protocol;
- novo driver que usa target/address atuais, como Rockwell Logix: nova versao do Agent/Studio, sem mudanca obrigatoria do protocolo.

## Versao do Runtime

O firmware gerado deve expor:

- `runtimeVersion`
- `hardwareId`
- `projectId`
- `linkPadProtocolVersion`

Isso permite diagnostico pelo agente ou pelo Studio.

## Politica de Compatibilidade

O Studio deve conseguir abrir projetos das versoes recentes anteriores.

O Agente deve manter compatibilidade com runtime anterior por pelo menos uma versao minor quando possivel. O adaptador legado pode exigir `legacy.defaultTarget`, mas isso nao faz parte do caminho normal do novo Agente.

## Changelog

Cada produto com release deve manter seu changelog:

- `LinkPadStudioApp/CHANGELOG.md`
- `LinkPadAgenteApp/CHANGELOG.md`

Os changelogs dos dois produtos ficam em `LinkPadAgenteApp/CHANGELOG.md` e `LinkPadStudioApp/CHANGELOG.md`.
