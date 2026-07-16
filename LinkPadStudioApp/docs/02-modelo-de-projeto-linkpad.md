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

## project.json

Campos minimos:

```json
{
  "schemaVersion": "0.2.0",
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

## tags.json

Lista as tags usadas pelo projeto. Cada tag industrial referencia um `protocolProfileId` e contem um endereco declarativo. O schema completo fica em `06-modelo-de-tags.md`.

## screens.json

Lista telas, widgets, propriedades visuais e eventos.

## build.json

Configuracao local de build/deploy:

```json
{
  "serialPort": "COM5",
  "baudRate": 115200
}
```

## Compatibilidade

Todo projeto deve conter `schemaVersion`. O Studio deve implementar migracoes quando mudar o schema.

Migracao prevista:

- `0.1.0`: projeto com Agente apontando para um PLC global configurado externamente.
- `0.2.0`: projeto com `protocols.json` e descritores enviados pelo Device Runtime.

## Implementacao 0.2.0 / Studio 0.5.0

Comandos Tauri atuais:

- escolher pasta nativa;
- criar diretorio `.linkpad`;
- gravar todos os arquivos do schema `0.2.0`, incluindo rede, protocolos e build;
- carregar projeto do disco;
- gerar o runtime M5;
- compilar e gravar via PlatformIO gerenciado pelo Studio, sem dependencia de instalacao global.

Ao abrir um projeto `0.1.0`, o Studio:

1. cria um perfil `sim-main`;
2. converte `agentTag` em `address.key`;
3. preserva tags, telas e assets;
4. preenche rede e build com valores padrao;
5. grava backup em `.migration-backup/0.1.0` no primeiro salvamento.

O Studio `0.5.0` nao altera `schemaVersion`: varios perfis, a associacao `protocolProfileId`, enderecos e extensoes compativeis de hardware permanecem no schema `0.2.0`. Ao abrir ou salvar, `studioVersion` e normalizada para `0.5.0` e projetos sem `hardware.statusOverlay` recebem o default do catalogo.

Varios itens de `profiles` podem permanecer habilitados. O runtime cria uma sessao independente para cada um e cada tag deve referenciar exatamente um perfil habilitado. Identificadores de perfil precisam ser unicos no projeto.

Observacao:

Projetos recentes ainda podem usar armazenamento local da janela como cache de conveniencia. Isso nao deve substituir os arquivos reais do projeto e nao deve ser usado para contratos de persistencia.
