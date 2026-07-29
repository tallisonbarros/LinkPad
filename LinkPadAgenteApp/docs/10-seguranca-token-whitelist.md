# Seguranca: Device, Token e Destinos

## Objetivo

Definir seguranca minima para um Agente orientado a requisicoes autodescritivas.

Como o Device Runtime informa driver e endpoint, o Agente deve impedir que a API se torne um proxy industrial aberto.

## Token

Quando configurado, todo endpoint LinkPad Protocol deve exigir:

```text
X-LINKPAD-TOKEN
```

Sem token ou token incorreto:

```text
401 Unauthorized
```

`X-LYNK-TOKEN` permanece apenas no adaptador legado.

## Politica de Device

O Agente pode restringir `deviceId` ou origem de rede. Device nao autorizado recebe `403`.

Essa autenticacao ocorre entre Device Runtime e Agente. Nao existe pareamento Studio-Agente.

Na versao `0.1.0`, `deviceWhitelist` vazia permite qualquer `deviceId`; quando preenchida, a comparacao e exata.

## Politica de Destino

Antes de abrir uma sessao, validar:

- driver permitido;
- endpoint bem formado;
- porta permitida para o driver;
- IP dentro de rede industrial autorizada;
- bloqueio de loopback, metadata/cloud e destinos publicos quando nao autorizados;
- quantidade de sessoes e conexoes por device;
- politica de operacoes de escrita.

Defaults devem priorizar redes privadas RFC1918. Redes adicionais exigem CIDR explicito.

### Estado em 0.3.0

Estao implementadas as validacoes de driver permitido, formato do target, limite de sessoes, IPv4 literal, porta do driver e `allowedTargetNetworks`. O alias `private` libera apenas RFC1918; uma entrada CIDR libera a rede correspondente.

O Agent bloqueia IPv6, loopback, link-local, multicast, unspecified e enderecos reservados mesmo quando uma regra for ampla. O `siemens-s7` limita adicionalmente a porta TCP 102 e rejeita `auth` no MVP.

O driver `opcua` limita o MVP a TCP 4840, autenticacao anonima, `SecurityPolicy None` e `SecurityMode None`. O Studio mostra aviso de laboratorio. Certificados e segredos protegidos precisam permanecer no Agent e ainda nao sao aceitos por essa versao.

## Segredos Industriais

Descritores podem conter `auth` quando OPC UA ou outro protocolo exigir.

Regras:

- nunca registrar `auth` em logs;
- nunca retornar segredo em diagnosticos;
- manter somente em memoria;
- limpar ao encerrar sessao/conexao;
- nao usar segredo na chave de conexao exibida;
- rejeitar credenciais se o transporte Device-Agent nao atender a politica minima.

## Escritas

- `requestId` obrigatorio.
- Deduplicacao por device e `requestId`.
- Validacao de tipo e faixa.
- Rate limit separado de leitura.
- Registro de auditoria sem valor secreto.

## Limitacao MVP

Token, restricao de destino e segmentacao de rede nao substituem TLS, certificados por device e politicas industriais adequadas.

Enviar credenciais industriais pelo HTTP local sem TLS e uma limitacao explicita. Projetos com `auth` devem gerar alerta no Studio ate existir transporte seguro.

O default `token: ""` deixa a autenticacao publica desabilitada para facilitar o primeiro startup. A API local informa `public_api_authentication_disabled` e a bandeja fica amarela. Instalacoes em rede devem definir um token antes de uso real.

## Futuro

Ordem recomendada:

1. OPC UA com certificado de aplicacao, trust store e pinagem do servidor;
2. `Basic256Sha256`/`SignAndEncrypt` e credenciais no Windows Credential Manager;
3. TLS da API Device-Agent e identidade por device;
4. autorizacao de escrita por projeto/device/target;
5. auditoria exportavel e rotacao de credenciais;
6. manifestos de projeto assinados quando houver provisionamento/frota.

Certificados OPC UA e certificados Device-Agent sao identidades diferentes e nao devem compartilhar automaticamente a mesma chave. Toda configuracao secreta permanece local ao Agent; o firmware recebe apenas referencia/politica quando esse contrato for definido.
