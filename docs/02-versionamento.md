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
  "schemaVersion": "0.2.0",
  "studioVersion": "0.5.0"
}
```

`0.2.0` introduz `network.json`, `protocols.json`, `build.json`, perfis declarativos de protocolo, enderecos industriais por tag e geracao de runtime. O Studio `0.2.0` migra projetos `0.1.0` automaticamente e cria uma copia dos arquivos anteriores em `.migration-backup/0.1.0` no primeiro salvamento.

O Studio `0.3.0` e o Agent `0.2.0` acrescentam o conector `siemens-s7`. O Studio e o Device Runtime `0.4.0` habilitam varios perfis simultaneos, mantendo uma sessao por `protocolProfileId`. O schema de projeto continua `0.2.0` e o LinkPad Protocol continua `0.1.0`, pois listas de perfis, `driver`, `endpoint`, `options`, `protocolProfileId`, `type` e `address` ja eram declarativos.

O Studio e o Device Runtime `0.5.0` acrescentam o overlay portatil de status Wi-Fi/Agent ao descritor do hardware. A extensao e compativel e nao altera o schema do projeto nem o LinkPad Protocol.

O schema de configuracao local do Agent passa a `0.3.0`. Configuracoes `0.2.0` sao migradas automaticamente, com backup, para liberar `siemens-s7` quando ainda usam o whitelist default anterior.

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
