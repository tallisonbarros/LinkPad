# Driver Siemens S7 Nativo

## Estado

Implementado no LinkPad Agent `0.2.0` com identificador:

```text
siemens-s7
```

O driver usa `python-snap7 3.0.0`. Como a API publicada e sincrona, cada operacao e executada fora da thread do servidor HTTP e serializada por um `asyncio.Lock` pertencente a conexao compartilhada.

## Target

```json
{
  "driver": "siemens-s7",
  "endpoint": "s7://192.168.0.10:102",
  "options": {
    "rack": 0,
    "slot": 1,
    "timeoutMs": 2000
  }
}
```

Regras do MVP:

- IPv4 literal; hostname e IPv6 nao sao aceitos;
- somente redes privadas RFC1918 ou CIDRs liberados explicitamente no Agent;
- loopback, link-local, multicast, reservado e destino publico sao bloqueados;
- somente TCP 102;
- `rack` entre 0 e 7, default 0;
- `slot` entre 0 e 31, default 1;
- `timeoutMs` entre 100 e 30000, default 2000;
- `auth` nao e aceito nesta versao.

## Endereco DB

REAL em `DB100.DBD0`:

```json
{
  "area": "DB",
  "dbNumber": 100,
  "byteOffset": 0,
  "dataType": "REAL"
}
```

BOOL em `DB100.DBX4.0`:

```json
{
  "area": "DB",
  "dbNumber": 100,
  "byteOffset": 4,
  "bitOffset": 0,
  "dataType": "BOOL"
}
```

Tipos suportados:

| Tipo S7 | Bytes | Tipo LinkPad |
| --- | ---: | --- |
| `BOOL` | 1, com bit 0..7 | `bool` |
| `INT` | 2 | `int` |
| `DINT` | 4 | `int` |
| `REAL` | 4 | `float` |

Os valores multibyte usam ordem de bytes big-endian do S7. O driver rejeita area diferente de DB, campos desconhecidos, conflito de tipo e valor fora da faixa.

## Preparacao do S7-1200

Para esta primeira bancada, criar um DB dedicado com acesso nao otimizado e offsets absolutos estaveis. Na protecao da CPU, permitir acesso PUT/GET por parceiro remoto. A rede, CPU, permissoes de escrita e seguranca de maquina continuam sendo responsabilidade da engenharia do PLC.

Parametros iniciais mais comuns para S7-1200:

```text
rack = 0
slot = 1
porta = 102
```

## Validacao Real

O handshake do Studio e a leitura ponta a ponta `M5 -> Agent -> S7-1200` foram validados em bancada com DB absoluto. Permanecem como fechamento de engenharia:

- validar escrita confirmada no PLC real com intertravamentos seguros;
- testar perda/retorno de rede e reinicio do PLC/Agent;
- medir estabilidade de polling prolongado e concorrencia com varios devices;
- registrar modelo/firmware da CPU e configuracao TIA usada;
- repetir o teste com os quatro tipos suportados.

## Falhas e Escritas

- A leitura que perde transporte recria o cliente e tenta novamente uma unica vez.
- Toda conexao executa apenas uma operacao S7 por vez.
- A escrita e seguida por leitura de confirmacao.
- Uma falha depois do envio pode significar que o PLC recebeu a escrita. Por isso o driver nao repete a escrita e retorna `write_confirmation_failed`, qualidade `uncertain` e `retryable: false`.
- PLC inacessivel durante leitura retorna `target_offline`, qualidade `offline` e `retryable: true`.

## Fora do Primeiro Corte

- areas I, Q, M, T e C;
- `STRING`, `WSTRING`, `DATE` e estruturas;
- enderecamento simbolico e browse;
- transporte S7 protegido;
- PLC real redundante ou conexao roteada;
- importacao de tags do TIA Portal.

Importacao/browse futuro deve preencher o mesmo endereco absoluto usado hoje e nao tornar o Agent dependente de um projeto TIA persistido.
