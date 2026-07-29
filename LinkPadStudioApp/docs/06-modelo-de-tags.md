# Modelo de Dados e Tags Globais no Studio

## Objetivo

Definir como widgets, ações e futuros consumidores selecionam dados industriais sem depender de um hardware específico e sem exigir a criação prévia de uma tag.

## Seletor Canônico

O Studio `0.7.0` possui um único seletor de dados compartilhado. No Studio `0.7.1`, sua linguagem é orientada ao integrador. No `0.7.2`, o diálogo compacto usa somente o título `Selecionar tag`. Nenhum widget, ação, Tag global ou hardware deve criar seu próprio editor industrial.

A interface apresenta duas abas:

- `PLC`: seleciona uma comunicação configurada e edita o endereço conforme o protocolo já associado ao PLC ou simulador.
- `Tags globais`: seleciona uma referência reutilizável do projeto.

O consumidor declara somente:

- rótulo do campo;
- acesso necessário: `read`, `write` ou `readWrite`;
- tipos aceitos: `bool`, `int`, `float` ou `string`.

O componente compartilhado filtra Tags globais incompatíveis e configura o formulário do tipo de comunicação. Assim, o mesmo fluxo atende widgets, botões, ações de controles, gráficos e regras futuras em qualquer hardware.

No formulário Siemens, o integrador escolhe diretamente `BOOL`, `INT`, `DINT` ou `REAL`; o Studio deriva `bool`, `int` ou `float`. A atualização fica em detalhes opcionais. O campo `Valor de teste` é exclusivo da comunicação de simulação e alimenta o preview do Studio; ele não representa uma escrita no PLC. Mínimo e máximo nunca são editados dentro do apontamento.

## DataBinding

O `DataBinding` foi introduzido no schema `0.4.0` e permanece no schema atual `0.9.0` como um objeto salvo no consumidor.

No Studio `0.13.0`, `gauge` e `progress_bar` declaram acesso de leitura e aceitam apenas `int`/`float`. A faixa `min`/`max` desses widgets e visual e permanece no consumidor; ela nao altera a Tag, o endereco industrial nem limites de escrita.

Endereço direto Siemens S7:

```json
{
  "kind": "connector",
  "protocolProfileId": "siemens-s7-main",
  "type": "float",
  "address": {
    "area": "DB",
    "dbNumber": 100,
    "byteOffset": 0,
    "dataType": "REAL"
  },
  "pollMs": 500,
  "simulationValue": 12.4
}
```

Referência a uma Tag global:

```json
{
  "kind": "global-tag",
  "tagId": "global-tag-motor-speed"
}
```

O vínculo global usa `tagId`, nunca o nome visível. Renomear uma Tag global não quebra widgets ou ações.

## Tags Globais internas e externas

O Studio `0.8.0` cria e edita Tags globais em popup. `Nova tag` abre as abas `Interna` e `Externa`; um clique seleciona uma linha e o duplo clique abre `Configurar Tag global`. A lista não reserva painel lateral.

- `Interna`: valor mantido no próprio Device Runtime, sem PLC, comunicação ou Agent.
- `Externa`: valor acessado por uma comunicação configurada, incluindo PLC real ou o driver de simulação do Agent.

`Retentiva` é somente um atributo da Tag interna, não uma terceira origem. Tags retentivas restauram o último valor depois de reiniciar; Tags internas não retentivas voltam para `initialValue`.

Tag interna:

```json
{
  "id": "global-tag-contador",
  "name": "Contador",
  "type": "int",
  "direction": "readWrite",
  "source": "internal",
  "initialValue": 0,
  "retentive": true,
  "quality": "good"
}
```

Tag externa:

```json
{
  "id": "global-tag-motor-speed",
  "name": "MotorSpeed",
  "type": "float",
  "direction": "readWrite",
  "source": "agent",
  "protocolProfileId": "rockwell-main",
  "address": {
    "tag": "DG01Amp"
  },
  "unit": "A",
  "pollMs": 1000,
  "format": "0.0",
  "simulationValue": 12.4,
  "quality": "unknown"
}
```

Tags globais são opcionais. Elas são recomendadas quando o mesmo ponto participa de várias telas, ações, alarmes, cálculos ou políticas centralizadas de escrita.

Campos:

- `id`: identificador único e estável da Tag global.
- `name`: nome único e editável apresentado ao integrador.
- `type`: `bool`, `int`, `float` ou `string`.
- `direction`: `read`, `write` ou `readWrite`.
- `source`: `internal` para memória do device e `agent` para comunicação externa; `system` e `simulated` permanecem reservados/legados.
- `protocolProfileId`: comunicação utilizada apenas pela Tag externa.
- `address`: descritor declarativo da Tag externa interpretado pelo driver do Agent.
- `unit`, `format`, `scale` e `offset`: metadados de engenharia/apresentação.
- `pollMs`: ciclo desejado de leitura da Tag externa.
- `min` e `max`: campos legados aceitos para migração; novos limites pertencem ao widget ou ação de escrita.
- `initialValue`: valor aplicado à Tag interna no primeiro boot ou quando não há retenção válida.
- `retentive`: atributo booleano exclusivo da Tag interna; persiste o último valor no armazenamento local do hardware.
- `simulationValue`: valor de teste/preview de Tags externas, especialmente da comunicação `sim`.
- `quality`: estado inicial/de preview persistido (`good`, `bad`, `stale`, `offline` ou `unknown`). Em runtime, respostas do Agent tambem podem produzir `uncertain` sem alterar o schema editavel da Tag.
- `write`: política opcional de escrita.
- `agentTag`: alias legado de projetos `0.1.0`; não deve ser criado novamente.

## Endereços por Conector

O editor do endereço pertence ao registro do conector, não ao widget.

Siemens S7 nativo:

```json
{
  "area": "DB",
  "dbNumber": 100,
  "byteOffset": 0,
  "dataType": "REAL"
}
```

Para `BOOL`, existe também `bitOffset` entre 0 e 7. O MVP permite `BOOL -> bool`, `INT/DINT -> int` e `REAL -> float`.

Simulação:

```json
{"key": "Motor.Speed"}
```

OPC UA implementado:

```json
{"nodeId": "ns=3;s=Motor.Speed"}
```

Rockwell Logix futuro:

```json
{"tag": "DG01Amp"}
```

Busca online será uma capacidade opcional do conector e preencherá o mesmo `address`; ela não cria outro tipo de vínculo.

O Studio `0.9.0` aceita `nodeId` por índice (`ns=3;s=Motor.Speed`) ou namespace URI (`nsu=urn:factory:line1;s=Motor.Speed`). O driver do Agent consulta o VariantType real e valida contra o tipo lógico LinkPad. O endereço continua idêntico em Tag global e binding direto.

## Compilação para o Runtime

O projeto persiste `DataBinding`, mas o runtime continua trabalhando com pontos. Durante a geração:

1. referências a Tags globais são resolvidas pelo ID estável;
2. bindings diretos são convertidos em pontos internos;
3. perfil, tipo e endereço iguais são deduplicados;
4. usos de leitura e escrita são combinados em `readWrite` quando necessário;
5. o menor `pollMs` solicitado é usado no ponto compartilhado;
6. limites dos consumidores de escrita são agregados usando o maior mínimo e o menor máximo;
7. uma Tag global sem qualquer consumidor permanece disponivel no projeto de engenharia, mas nao e materializada no firmware nem consultada pelo Agent;
7. widgets recebem um identificador técnico para cache e um rótulo legível para renderização.
8. Tags internas permanecem como pontos locais, sem perfil/endereço, e nunca entram em lote HTTP.

Para pontos externos, o Device Runtime envia ao Agent somente `id`, `address`, `type` e, na escrita, `value`, `min` e `max`. Tags internas são inicializadas no cache local com qualidade `good`; escritas locais respeitam tipo, direção e limites, mas não usam o LinkPad Protocol. O Agent não recebe nem persiste Tags internas.

No template ESP32, a retenção usa NVS e a chave lógica é o ID estável da Tag dentro do `projectId`. Escritas são consolidadas em uma janela de 500 ms para proteger a flash. Valor armazenado incompatível com tipo/faixa é descartado e substituído por `initialValue`.

## Validação

O build bloqueia:

- `DataBinding` ausente em consumidor que exige dado;
- Tag global inexistente ou incompatível com leitura/escrita;
- conector ausente ou desabilitado;
- endereço vazio ou inválido para o driver;
- tipo incompatível com o consumidor ou com o tipo S7;
- widget ou ação de escrita numérica sem `min`/`max` ou com faixa invertida;
- mesmo perfil/endereço declarado com tipos conflitantes;
- Tags globais com nome ou ID duplicado;
- exclusão de Tag global ou conector ainda referenciado.
- Tag interna sem valor inicial compatível ou configurada como somente escrita.
- Tag interna contendo comunicação/endereço depois da normalização.
- atributo `retentive` em Tag externa depois da normalização.

## Migração

Projetos `0.1.0` a `0.8.0` são migrados para `0.9.0`.

- Tags existentes recebem IDs determinísticos e tornam-se Tags globais.
- `widget.props.tag` vira `widget.props.binding.kind = global-tag`.
- ações legadas `writeTag` e `toggleTag` passam a carregar o mesmo `DataBinding`.
- projetos `0.3.0` recebem backup em `.migration-backup/0.3.0` antes do primeiro salvamento.
- limites legados de bindings ou Tags globais são movidos para widgets e ações de escrita existentes no Studio `0.7.2`.

Até o Studio `0.7.2`, projetos no schema `0.4.0` eram normalizados no carregamento para elevar limites legados aos consumidores.

No Studio `0.8.0`, Tags `source: internal` existentes recebem `initialValue` a partir do valor anterior de preview quando necessário, removem `protocolProfileId`/`address` e assumem `retentive: false` quando o atributo não existir. O primeiro salvamento cria `.migration-backup/0.4.0`.

No Studio `0.16.0`, ações `writeTag` e `toggleTag` do schema `0.8.0` são migradas para `changeValue`. Operações relativas (`add`, `subtract`, `toggle`) exigem uma Tag `readWrite`; `set` exige escrita. Limites pertencem à ação e são aplicados ao resultado calculado. Na selecao de dados, toda Tag gravavel e elegivel independentemente da operacao que estava ativa. Depois do apontamento, o tipo e a direcao da Tag determinam as operacoes disponiveis; uma escolha anterior incompatível e normalizada para `set` com operando e limites coerentes.

LinkPad Protocol permanece `0.1.0`; não existe migração no Agent.

## Aberturas de Evolucao

### Teste de ponto

O editor podera abrir uma sessao efemera e executar leitura — ou escrita explicitamente confirmada — do endereco atual. Esse fluxo deve ser separado de `Testar conexao`, mostrar o payload efetivo e nunca gravar uma Tag no Agent.

### Browse e pesquisa

OPC UA e Rockwell poderao pesquisar pontos online. O resultado deve preencher o mesmo `DataBinding`/`address`, mantendo as duas abas atuais `PLC` e `Tags globais`. Nao deve surgir uma origem adicional chamada browse, importada ou online.

### Portabilidade da retencao

`retentive` ja e independente de hardware no schema. Hoje o backend concreto e NVS/Preferences no ESP32. Cada novo runtime deve declarar e testar seu armazenamento local; hardware sem persistencia deve bloquear ou avisar sobre o atributo, sem transformar a Tag em externa.

### Metadados futuros

Alarmes, historico, expressao, escala centralizada e permissao de escrita podem ampliar Tags globais quando houver consumidores reais. Cada campo persistido exige decisao de schema/migracao; propriedades puramente visuais continuam no widget.
