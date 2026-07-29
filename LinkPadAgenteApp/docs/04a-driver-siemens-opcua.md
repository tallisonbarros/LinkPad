# Driver OPC UA

## Estado

Implementado no LinkPad Agent `0.3.0` com identificador generico:

```text
opcua
```

Siemens S7-1200/S7-1500 e o primeiro alvo de validacao, mas o driver nao depende de TIA Portal, DB S7 ou nomes Siemens. O placeholder antigo `siemens-opcua` e normalizado pelo Studio para `opcua` ao abrir o projeto; o Agent aceita somente o identificador canonico.

## Biblioteca

O driver usa `asyncua 2.0.1`, fixado no `pyproject.toml`. A biblioteca e assincrona, portanto a sessao OPC UA participa diretamente do loop do Agent sem worker thread. O pacote PyInstaller inclui os metadados e a licenca LGPL-3.0-or-later da dependencia.

## Descritor de Destino MVP

```json
{
  "driver": "opcua",
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

Regras implementadas:

- IPv4 literal em rede liberada pelo Agent;
- porta TCP 4840;
- usuario e senha proibidos na URL;
- `SecurityPolicy None` e `SecurityMode None`;
- autenticacao anonima;
- timeout de sessao entre 1 s e 1 h;
- timeout de requisicao entre 100 ms e 30 s;
- campos desconhecidos rejeitados.

Esse modo serve para validacao em rede isolada. Nao e configuracao de producao.

## Endereco de Ponto

```json
{
  "nodeId": "ns=3;s=Motor.Speed"
}
```

Tambem e aceita a forma estavel por URI:

```json
{
  "nodeId": "nsu=urn:factory:line1;s=Motor.Speed"
}
```

Quando `nsu=` e usado, o driver consulta o namespace array da sessao e resolve o indice atual antes da operacao. O MVP aceita valores escalares OPC UA `Boolean`, inteiros assinados/sem sinal, `Float`, `Double` e `String`. Arrays, estruturas, DateTime e ExtensionObject retornam `unsupported_type` ou `unsupported_value`.

## Leitura

O driver le o `DataValue` completo:

- `Value` vira `value` e o alias `valor` no LinkPad Protocol;
- StatusCode Good vira qualidade `good`;
- StatusCode Uncertain preserva o valor e vira `uncertain`;
- StatusCode Bad vira erro por ponto;
- `SourceTimestamp` e preferido; `ServerTimestamp` e fallback.

Uma falha de transporte em leitura provoca uma unica reconexao com um novo cliente. A operacao e repetida somente depois da nova sessao. Node ID inexistente, tipo incompativel e permissao negada nao provocam reconexao.

## Escrita

Antes de escrever, o driver consulta e armazena em cache efemero o `VariantType` do Node ID. O tipo LinkPad declarado e validado contra o tipo real, incluindo faixa de inteiros e valores numericos finitos.

Depois de `write_value`, o Node ID e relido. O sucesso so e devolvido com o valor confirmado. Falha de transporte ou de confirmacao retorna:

```text
write_confirmation_failed
quality: uncertain
retryable: false
```

A escrita nunca e repetida automaticamente.

## Pool e Concorrencia

A chave do pool inclui driver, endpoint, options e auth completos sem expor o descritor em diagnosticos. Sessoes equivalentes reutilizam um `OpcUaConnection`. O MVP serializa operacoes por conexao com `asyncio.Lock`; NodeIds resolvidos e tipos ficam apenas na memoria daquela conexao.

## Capacidade Publicada

`GET /lpp/v1/capabilities` anuncia endpoint `opc.tcp`, porta 4840, opcoes, seguranca anonima/None, campo `nodeId` e tipos escalares suportados.

## Configuracao do PLC Siemens

No TIA Portal ainda e necessario:

- confirmar CPU, firmware e licenca OPC UA;
- habilitar o servidor;
- expor uma interface/variaveis OPC UA;
- permitir leitura e escrita conforme o teste;
- usar o Node ID publicado pelo servidor.

Essas configuracoes pertencem ao PLC e nao ao Agent Windows.

### Validacao de bancada pendente

O driver ja passou por leitura/escrita automatizada contra servidor OPC UA real e por abertura de sessao no executavel empacotado. Ainda deve ser validado no S7-1200 fisico com registro de:

- CPU, firmware e licenca;
- endpoint e namespace array;
- Node IDs de cada tipo testado;
- permissoes de leitura/escrita;
- comportamento em reinicio do PLC/Agent e perda de rede;
- polling prolongado e escrita confirmada.

## Evolucao Segura

Antes de uso de producao devem ser implementados:

- certificado de aplicacao gerado e protegido no Agent;
- trust store e pinagem do certificado do servidor;
- `Basic256Sha256` com `SignAndEncrypt`;
- segredo de usuario no Windows Credential Manager, quando necessario;
- transporte Device-Agent adequado antes de aceitar auth sensivel.

Chave privada ou senha OPC UA nunca deve ser incorporada ao firmware.

## Browse Futuro

Busca online nao faz parte do LinkPad Protocol `0.1.0`. Uma entrega futura devera acrescentar endpoint paginado de browse, dados de namespace, tipo e permissao e elevar a versao do protocolo. Node ID direto continua valido mesmo depois dessa evolucao.

Ordem recomendada: primeiro validar Node ID direto no PLC real; depois implementar certificados/trust store; por fim acrescentar browse. Assim, descoberta online nao mascara falhas basicas de sessao, seguranca ou permissao.

## Fora do Escopo

- OPC DA/DCOM;
- OPC UA PubSub;
- subscriptions no MVP;
- historico, eventos, metodos e alarmes;
- PROFINET IO;
- arrays e estruturas.
