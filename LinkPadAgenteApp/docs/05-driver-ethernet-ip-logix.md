# Driver Ethernet/IP Logix

## Objetivo

Definir o driver Rockwell Logix via EtherNet/IP para o modelo orientado a sessoes.

## Referencia

O exemplo atual validou `pycomm3` e `LogixDriver` com sucesso.

Essa base deve ser preservada e adaptada para receber `target` do Device Runtime em vez de configuracao global.

Estado atual: o driver ainda nao existe no novo Agent `0.3.0` e permanece desabilitado no Studio `0.9.0`. A validacao do prototipo comprova a biblioteca/caminho industrial, mas nao comprova sessoes, politica de destino, erros normalizados ou empacotamento do produto novo.

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

## Plano de Implementacao

1. portar somente a camada `pycomm3` para a interface `IndustrialDriver`;
2. validar IPv4 privado, path/slot, timeout e schema de tag;
3. implementar leitura/escrita e tipos basicos sem configuracao global;
4. confirmar escrita sem retry ambiguo;
5. cobrir connection pool, falhas e capabilities;
6. incluir no PyInstaller e testar com PLC Rockwell real;
7. somente entao marcar `rockwell-logix` como disponivel no Studio.

Browse/listagem de tags pode vir depois da operacao direta por nome e devera usar o futuro contrato paginado comum tambem ao OPC UA.
