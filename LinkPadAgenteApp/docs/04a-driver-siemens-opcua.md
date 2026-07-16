# Driver Siemens OPC UA

## Objetivo

Definir o futuro driver OPC UA do LinkPad Agente para acesso a dados de CPUs Siemens S7-1200 e S7-1500 com servidor OPC UA habilitado. O primeiro driver industrial implementado foi `siemens-s7`; OPC UA permanece uma opcao distinta e planejada.

Este driver nao e PROFINET IO. Ele usa OPC UA para leitura, escrita e descoberta de variaveis expostas pelo PLC.

## Identificador

```text
siemens-opcua
```

## Descritor de Destino

```json
{
  "driver": "siemens-opcua",
  "endpoint": "opc.tcp://192.168.0.10:4840",
  "options": {
    "securityPolicy": "None",
    "securityMode": "None",
    "sessionTimeoutMs": 30000,
    "requestTimeoutMs": 2000
  },
  "auth": {
    "mode": "anonymous"
  }
}
```

Modos de autenticacao previstos:

- `anonymous`;
- `username`;
- certificado, depois da definicao do ciclo de certificados.

## Endereco de Ponto

```json
{
  "nodeId": "ns=3;s=Motor.Speed"
}
```

O MVP usa `nodeId` explicito. Browse pode ajudar o Studio durante engenharia no futuro, mas nao cria dependencia direta Studio-Agente.

## Operacoes MVP

- Conectar e desconectar.
- Validar endpoint.
- Ler um ou varios NodeIds.
- Escrever um ou varios NodeIds.
- Obter tipo e status code quando disponivel.
- Normalizar qualidade.
- Reconectar e reutilizar sessao OPC UA.

Browse fica preparado no driver como capacidade futura, mas nao faz parte dos endpoints LinkPad Protocol `0.1.0`.

## Configuracao Necessaria no PLC

Plug and play no Agente nao elimina a engenharia do PLC. No TIA Portal ainda pode ser necessario:

- habilitar o servidor OPC UA;
- expor variaveis/interfaces OPC UA;
- definir permissoes de leitura/escrita;
- configurar usuario, certificados e politica de seguranca;
- validar licenca e limites da CPU/firmware.

Essas configuracoes pertencem ao PLC, nao ao Agente Windows.

## Seguranca

- Credenciais recebidas em `auth` ficam somente em memoria.
- Credenciais nunca entram em logs ou diagnosticos.
- `securityPolicy=None` deve gerar aviso e pode ser bloqueado por politica do Agente.
- Certificados e trust stores exigem decisao especifica antes da implementacao de modo seguro por certificado.

## Fora do Escopo Inicial

- PROFINET IO Controller ou IO Device.
- IRT/RT ciclico.
- GSDML.
- Alarmes PROFINET.
- OPC UA PubSub.
