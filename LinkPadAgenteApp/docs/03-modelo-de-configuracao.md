# Modelo de Configuracao do Agente

## Objetivo

Definir a configuracao operacional minima do LinkPad Agente. PLC, tags, projeto e enderecos industriais chegam do Device Runtime e nao pertencem a este arquivo.

## Local e Criacao Automatica

O arquivo e criado no primeiro startup:

```text
%ProgramData%\LinkPad\Agent\config.json
```

Para desenvolvimento ou diagnostico, `LINKPAD_AGENT_CONFIG` pode apontar para outro arquivo. Diretorios ausentes sao criados automaticamente.

O launcher `run-dev.ps1` usa `.dev\config.json` e `.dev\logs` dentro do projeto. Assim, testes locais nao modificam a configuracao da instalacao Windows.

## Schema Implementado 0.3.0

```json
{
  "schemaVersion": "0.3.0",
  "product": "LinkPad Agent",
  "server": {
    "bind": "0.0.0.0",
    "port": 8008
  },
  "management": {
    "bind": "127.0.0.1",
    "port": 8009
  },
  "limits": {
    "maxSessions": 100,
    "sessionTtlSeconds": 300,
    "idleConnectionTtlSeconds": 120,
    "readRps": 50,
    "writeRps": 10,
    "dedupWindowMs": 500,
    "maxPendingRequests": 200,
    "writeConfirmTimeoutMs": 3000
  },
  "security": {
    "token": "",
    "deviceWhitelist": [],
    "allowedTargetNetworks": ["private"],
    "allowedDrivers": ["sim", "siemens-s7"]
  },
  "logging": {
    "level": "INFO",
    "retentionDays": 14,
    "maxFileMb": 10
  },
  "legacy": {
    "enabled": false,
    "defaultTarget": null
  }
}
```

Campos desconhecidos sao rejeitados para evitar erro silencioso de configuracao.

## Aplicado na Versao 0.2.0

- bind e portas publica/local;
- TTL e quantidade maxima de sessoes;
- TTL de conexoes ociosas;
- limites globais de leitura e escrita;
- janela de deduplicacao de escrita;
- limite de requisicoes pendentes;
- token, whitelist de devices e drivers;
- redes privadas RFC1918 ou CIDRs explicitos para drivers de rede;
- nivel e rotacao por tamanho dos logs.

`writeConfirmTimeoutMs`, `legacy.enabled` e `legacy.defaultTarget` continuam reservados. `allowedTargetNetworks` e aplicado antes da conexao do primeiro driver de rede.

## Migracao 0.2.0 -> 0.3.0

No startup, o Agent cria `.migration-backup/config-0.2.0.json` e atualiza o arquivo. O whitelist default anterior `['sim']` passa a incluir `siemens-s7`; whitelists personalizados sao preservados. O default antigo `['private', 'same-subnet']` passa a `['private']`, pois liberacao de rede agora deve ser RFC1918 ou CIDR explicito.

## Defaults e Seguranca

A instalacao funciona sem cadastro local. Como o token vazio desabilita autenticacao, a bandeja mostra um aviso ate que ele seja definido. O target S7 ainda precisa vir do hardware e deve pertencer a uma rede liberada.

`private` significa somente `10.0.0.0/8`, `172.16.0.0/12` e `192.168.0.0/16`. Redes adicionais devem ser informadas como CIDR, por exemplo `192.0.2.0/24`; loopback, link-local, multicast, reservado e IPv6 continuam bloqueados.

## O Que Nao Existe

- `plc.ip` ou `plc.driver` global;
- tags persistidas;
- perfis por cliente ou planta;
- polling configurado na UI;
- configuracao recebida diretamente do Studio.

## Segredos Recebidos

Um target pode conter `auth`. O pool calcula sua chave com o descritor completo, mas diagnosticos mostram apenas um hash curto e nunca retornam `auth`. O segredo permanece somente em memoria durante a sessao/conexao.
