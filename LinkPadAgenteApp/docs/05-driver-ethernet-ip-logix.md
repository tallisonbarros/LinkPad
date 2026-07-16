# Driver Ethernet/IP Logix

## Objetivo

Definir o driver Rockwell Logix via EtherNet/IP para o modelo orientado a sessoes.

## Referencia

O exemplo atual validou `pycomm3` e `LogixDriver` com sucesso.

Essa base deve ser preservada e adaptada para receber `target` do Device Runtime em vez de configuracao global.

## Descritor de Destino

Campos esperados:

```json
{
  "driver": "rockwell-logix",
  "endpoint": "192.168.0.10",
  "options": {
    "path": "1,0",
    "timeoutMs": 2000
  }
}
```

## Endereco de Ponto

```json
{
  "tag": "DG01Amp"
}
```

## Operacoes

O driver deve suportar:

- Conectar.
- Desconectar.
- Ler uma tag.
- Ler lote de tags.
- Escrever tag.
- Listar tags internamente quando possivel, como base para um futuro endpoint `browse`.
- Obter tipo de tag.
- Produzir chave de conexao para reutilizacao no pool.

## Validacao de Escrita

Quando tipo da tag for conhecido, validar:

- BOOL.
- inteiros.
- REAL/LREAL.
- STRING.
- arrays quando suportados.

## Limitacoes MVP

- Foco em explicit messaging/tag access.
- Nao implementar I/O implicit messaging no MVP.
- Nao assumir comportamento real-time.

## Diagnostico

Expor:

- estado da conexao.
- tentativas de reconexao.
- ultima falha.
- RPS leitura/escrita.
- tag cache refresh.
- sessoes e conexoes compartilhadas que usam o target.
