# Modelo de Projeto LinkPad

## Objetivo

Definir a estrutura de um projeto salvo pelo LinkPad Studio.

## Estrutura Conceitual

```text
MeuProjeto.linkpad/
  project.json
  hardware.json
  network.json
  agent.json
  protocols.json
  tags.json
  screens.json
  build.json
  assets/
    fonts/
    images/
  generated/
  build/
```

As pastas e o campo `assets` permanecem reservados no schema para compatibilidade. A interface atual nao exibe uma area Assets porque ainda nao existe importacao, validacao ou conversao funcional de imagens e fontes; essa estrutura nao deve ser removida em migracoes de projetos existentes.

## project.json

Campos minimos:

```json
{
  "schemaVersion": "0.9.0",
  "projectId": "uuid",
  "name": "Meu Projeto",
  "description": "",
  "createdAt": "2026-06-16T00:00:00Z",
  "updatedAt": "2026-06-16T00:00:00Z"
}
```

## hardware.json

Referencia o hardware alvo:

```json
{
  "hardwareId": "m5stickc-plus2",
  "runtime": "arduino-esp32",
  "orientation": "landscape",
  "statusOverlay": {
    "enabled": true,
    "placement": "top-right",
    "style": "watermark",
    "indicators": ["wifi", "agent"]
  }
}
```

## agent.json

Define somente como o runtime encontra um Agente compativel. Nao representa pareamento nem configuracao persistente no Agente:

```json
{
  "mode": "http",
  "host": "192.168.168.25",
  "port": 8008,
  "timeoutMs": 1200,
  "pollMs": 1000,
  "token": "",
  "protocolVersion": "0.1.0"
}
```

## network.json

Define a rede usada pelo device:

```json
{
  "mode": "wifi",
  "ssid": "RedeIndustrial",
  "password": ""
}
```

No MVP, a senha e incorporada ao firmware. O Studio exibe aviso de seguranca e o log de build nao deve imprimir esse valor.

## protocols.json

Contem os perfis declarativos que o runtime enviara ao Agente ao criar sessoes.

Exemplo Siemens S7 nativo implementado:

```json
{
  "profiles": [
    {
      "id": "siemens-s7-main",
      "name": "S7 principal",
      "driver": "siemens-s7",
      "endpoint": "s7://192.168.0.10:102",
      "enabled": true,
      "options": {
        "rack": 0,
        "slot": 1,
        "timeoutMs": 2000
      }
    }
  ]
}
```

Exemplo OPC UA implementado:

```json
{
  "profiles": [{
    "id": "opc-main",
    "name": "PLC OPC UA",
    "driver": "opcua",
    "endpoint": "opc.tcp://192.168.0.10:4840",
    "enabled": true,
    "options": {
      "securityPolicy": "None",
      "securityMode": "None",
      "sessionTimeoutMs": 30000,
      "requestTimeoutMs": 2000
    },
    "auth": {"mode": "anonymous"}
  }]
}
```

Exemplo Rockwell Logix:

```json
{
  "profiles": [
    {
      "id": "rockwell-main",
      "driver": "rockwell-logix",
      "endpoint": "192.168.0.20",
      "options": {
        "path": "1,0",
        "timeoutMs": 2000
      }
    }
  ]
}
```

Credenciais opcionais podem existir em `auth`, mas devem ser tratadas como segredo, nunca registradas em logs e somente transmitidas quando a politica de seguranca permitir.

No OPC UA `0.3.0`, `auth` aceita somente `{ "mode": "anonymous" }`. Senha, certificado e chave privada nao podem ser incorporados ao projeto/firmware; o modelo seguro futuro devera manter esses segredos no Agent.

## tags.json

Lista as Tags globais opcionais do projeto. Tags externas possuem `protocolProfileId` e endereço declarativo; Tags internas possuem `initialValue`, podem usar `retentive` e não referenciam comunicação. Widgets também podem salvar endereços diretamente em `DataBinding`, sem criar uma Tag global. O contrato completo fica em `06-modelo-de-tags.md`.

## screens.json

Lista telas, widgets, propriedades visuais e vinculos de entrada. Cada `inputBinding` associa um controle logico oferecido pelo manifesto, um evento suportado e uma acao declarativa. Desde o schema `0.8.0`, varias entradas consecutivas podem repetir `inputId/event`; no schema `0.9.0`, alteracoes de dados usam a acao unificada `changeValue`. O runtime executa as acoes na ordem do array:

```json
{
  "screens": [
    {
      "id": "screen-main",
      "name": "Principal",
      "width": 240,
      "height": 135,
      "widgets": [],
      "inputBindings": [
        {
          "inputId": "primary",
          "event": "press",
          "action": {
            "type": "navigate",
            "target": "next"
          }
        },
        {
          "inputId": "primary",
          "event": "press",
          "action": {
            "type": "changeValue",
            "binding": {"kind": "global-tag", "tagId": "contador"},
            "operation": "add",
            "operand": 1,
            "min": 0,
            "max": 100
          }
        }
      ]
    }
  ]
}
```

Acoes: `navigate`, `changeValue`, `activateWidget` e `powerOff`. Referencias a tela usam `screenId`; `changeValue` carrega o mesmo `DataBinding` canonico usado pelos widgets e declara `operation: set | add | subtract | toggle`. `operand` e obrigatorio para `set`, `add` e `subtract`; `min`/`max` opcionais limitam o resultado. Operacoes relativas exigem leitura e escrita, enquanto `set` aceita uma origem gravavel. `powerOff` nao possui detalhes de M5 e so e valido quando o manifesto do hardware anuncia essa capacidade. Em uso normal deve ser a ultima acao do evento.

Na arvore do projeto, o menu de contexto de cada tela oferece copiar, recortar, colar, duplicar e excluir. Copiar ou duplicar cria novos IDs para tela, widgets e grupos; referencias `activateWidget` internas e navegacao da tela para ela mesma sao remapeadas para a copia. Recortar e colar move a tela original para logo abaixo do destino, sem duplicar IDs. O projeto nunca permite excluir sua ultima tela. Excluir uma tela nao escolhe silenciosamente outro destino para acoes `navigate`: referencias externas ficam diagnosticaveis pela validacao e devem ser revisadas pelo integrador.

Exemplo de widget com endereço direto:

```json
{
  "id": "speed-value",
  "type": "tag_value",
  "props": {
    "binding": {
      "kind": "connector",
      "protocolProfileId": "siemens-s7-main",
      "type": "float",
      "address": {"area": "DB", "dbNumber": 10, "byteOffset": 4, "dataType": "REAL"},
      "pollMs": 500,
      "simulationValue": 12.5
    }
  }
}
```

O mesmo `DataBinding` direto transporta OPC UA sem criar um tipo novo de widget:

```json
{
  "kind": "connector",
  "protocolProfileId": "opc-main",
  "type": "float",
  "address": {"nodeId": "nsu=urn:factory:line1;s=Motor.Speed"},
  "pollMs": 1000
}
```

## build.json

Configuracao local de build/deploy:

```json
{
  "serialPort": "COM5",
  "baudRate": 115200
}
```

`serialPort` continua persistido como string para manter compatibilidade e reproduzir a ultima escolha local. No Studio `0.5.1`, o valor e selecionado a partir das portas detectadas pelo sistema operacional; nao ha digitacao livre. Se a porta salva estiver desconectada, ela e exibida como indisponivel e a gravacao fica bloqueada ate o usuario atualizar e escolher uma porta presente.

## Compatibilidade

Todo projeto deve conter `schemaVersion`. O Studio deve implementar migracoes quando mudar o schema.

Migracao prevista:

- `0.1.0`: projeto com Agente apontando para um PLC global configurado externamente.
- `0.2.0`: projeto com `protocols.json` e descritores enviados pelo Device Runtime.
- `0.3.0`: entradas estruturadas no catalogo e `inputBindings` declarativos por tela.
- `0.4.0`: `DataBinding` canônico em widgets/ações e Tags globais com IDs estáveis.
- `0.5.0`: Tags globais internas com valor inicial e retenção opcional no device.
- `0.6.0`: metadados de engenharia `editor.locked` e `editor.groupId` por widget.
- `0.7.0`: estilo visual comum normalizado e tipos `gauge`/`progress_bar`.
- `0.8.0`: sequencias ordenadas por evento e acao portatil `powerOff`.
- `0.9.0`: acao unificada `changeValue` com operacoes tipadas e migracao de `writeTag`/`toggleTag`.

## Implementação 0.9.0 / Studio 0.17.1

Comandos Tauri atuais:

- escolher pasta nativa;
- criar diretorio `.linkpad`;
- gravar todos os arquivos do schema `0.9.0`, incluindo rede, protocolos, Tags globais internas/externas, vínculos de dados, controles, widgets e build;
- carregar projeto do disco;
- gerar o runtime M5;
- compilar e gravar via PlatformIO gerenciado pelo Studio, sem dependencia de instalacao global.

Ao abrir um projeto `0.1.0`, o Studio:

1. cria um perfil `sim-main`;
2. converte `agentTag` em `address.key`;
3. preserva tags, telas e assets;
4. preenche rede e build com valores padrao;
5. grava backup em `.migration-backup/0.1.0` no primeiro salvamento.

O Studio `0.5.1` manteve `schemaVersion` em `0.2.0`: varios perfis, a associacao `protocolProfileId`, enderecos, extensoes compativeis de hardware e a configuracao de porta serial permaneceram compativeis. Projetos sem `hardware.statusOverlay` receberam o default do catalogo.

O Studio `0.6.0` migra projetos `0.1.0` e `0.2.0` para `0.3.0`. Antes do primeiro salvamento de um projeto `0.2.0`, os arquivos existentes sao copiados para `.migration-backup/0.2.0`. A normalizacao preserva `inputBindings` existentes; quando ausentes, converte o comportamento legado em `primary/press -> next` e, se houver `write_button`, `secondary/press -> activateWidget`.

O Studio `0.7.0` migra `0.1.0`, `0.2.0` e `0.3.0` para `0.4.0`. Tags antigas recebem IDs determinísticos; referências por nome em widgets e ações passam a usar `DataBinding.kind = global-tag`. Projetos `0.3.0` recebem backup em `.migration-backup/0.3.0` antes do primeiro salvamento.

O Studio `0.7.1` mantém o mesmo schema e apresenta `protocols` como PLCs e simulações na tela `Comunicações`. `ProtocolProfile`, `driver`, `endpoint` e `protocolProfileId` continuam sendo nomes do contrato persistido; a mudança é de linguagem e hierarquia da interface.

O Studio `0.7.2` mantém `DataBinding` focado no apontamento. Widgets de escrita podem declarar `props.min`/`props.max`, e ações `writeTag` podem declarar `min`/`max`; campos equivalentes encontrados em bindings ou Tags globais antigos são movidos ao consumidor durante a normalização.

O Studio `0.8.0` migra projetos `0.4.0` para `0.5.0` e cria backup em `.migration-backup/0.4.0`. Tags `source: internal` removem perfil/endereço, recebem `initialValue` compatível com o tipo e `retentive: false` quando o atributo estiver ausente. Tags externas permanecem associadas à comunicação existente.

O Studio `0.9.0` preserva o schema `0.5.0`, habilita o driver `opcua` e normaliza o placeholder desabilitado `siemens-opcua` para o identificador genérico. O modo inicial é anônimo/None e não aceita credenciais incorporadas ao firmware.

O Studio `0.10.0` preserva o schema `0.5.0`. O mapa aberto `widget.props` pode declarar `fontSize`, `color`, `backgroundColor` e `transparent`; ausencias recebem fallbacks compativeis. Selecao, zoom, grade, snap, marquee e historico pertencem apenas a sessao de edicao e nao sao serializados. Geometria continua salva em pixels logicos de `screen.width`/`screen.height`.

O Studio `0.11.0` migra projetos `0.5.0` para `0.6.0`. Cada widget recebe `editor.locked: false`; `groupId` e opcional e somente grupos com pelo menos dois membros sao preservados. O primeiro salvamento cria backup em `.migration-backup/0.5.0`. O objeto `editor` e removido na geracao de firmware.

O Studio `0.12.0` preserva o schema `0.6.0`: grade, tamanho da grade, guias e snap inteligente sao preferencias/estado da sessao, e somente as coordenadas finais sao salvas.

O Studio `0.13.0` migra projetos `0.6.0` para `0.7.0`, cria backup em `.migration-backup/0.6.0` e normaliza `fontSize`, cores, transparencia, alinhamentos, padding, borda e arredondamento. Os tipos `gauge` e `progress_bar` guardam `min`, `max` e `showValue` em `props`. O Studio `0.14.0` preserva o schema porque a auditoria visual nao e serializada.

O Studio `0.15.0` migra projetos `0.7.0` para `0.8.0` e cria backup em `.migration-backup/0.7.0`. Bindings existentes permanecem unitarios e na mesma ordem; o novo schema apenas passa a admitir repeticao do par `inputId/event` e o tipo `powerOff`.

O Studio `0.16.0` migra projetos `0.8.0` para `0.9.0` e cria backup em `.migration-backup/0.8.0`. `writeTag` vira `changeValue` com `operation: set` e seu `value` vira `operand`; `toggleTag` vira `changeValue` com `operation: toggle`. Ordem, `DataBinding` e limites existentes sao preservados.

O Studio `0.17.1` preserva o schema `0.9.0`. A lista completa de Tags globais continua persistida no projeto; a poda de Tags sem consumidores ocorre exclusivamente durante a geracao do runtime e nao modifica arquivos de engenharia.

Varios itens de `profiles` podem permanecer habilitados. O runtime cria uma sessao independente para cada um e cada Tag externa deve referenciar exatamente um perfil habilitado. Tags internas não referenciam perfil. Identificadores de perfil precisam ser unicos no projeto.

Observacao:

Projetos recentes ainda podem usar armazenamento local da janela como cache de conveniencia. Isso nao deve substituir os arquivos reais do projeto e nao deve ser usado para contratos de persistencia.

## Evolucoes Previstas do Schema

- Browse nao deve alterar `DataBinding`: ele apenas preenche `protocolProfileId`, `type` e `address` existentes.
- Novo hardware que respeite manifesto, entradas e overlay atuais nao exige mudar o schema de projeto.
- Um backend de retencao diferente de NVS nao altera a Tag interna; a implementacao pertence ao template do hardware.
- Segredos OPC UA protegidos nao serao gravados em `protocols.json`; o projeto devera referenciar uma politica/identidade mantida localmente pelo Agent quando esse contrato existir.
- Novos campos persistidos exigem incremento de `schemaVersion`, migracao, backup e atualizacao dos tipos TypeScript/Rust.
