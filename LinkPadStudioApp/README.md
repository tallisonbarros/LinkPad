# LinkPad Studio App

Aplicativo Windows desktop do LinkPad Studio.

## Stack Oficial

- Tauri 2
- React
- TypeScript
- Vite como empacotador interno da UI

## Comandos

```powershell
npm install
.\run-dev.ps1
npm run build
npm run check
npm run test
```

## Significado Dos Comandos

- `run-dev.ps1`: valida o ambiente e abre Tauri + Vite como uma unica sessao de desenvolvimento.
- `npm run build`: gera o aplicativo Windows via Tauri.
- `npm run check`: valida apenas a UI React/TypeScript.
- `npm run test`: executa testes de schema, migracao e validacao.

O launcher impede duas sessoes simultaneas e falha claramente se a porta 5173 estiver ocupada.

Validar o ambiente sem abrir o Studio:

```powershell
.\run-dev.ps1 -CheckOnly
```

Executar apenas a UI no navegador, quando necessario para desenvolvimento visual:

```powershell
.\run-dev.ps1 -UiOnly
```

A partir do Prompt de Comando (`cmd.exe`), pode-se usar diretamente:

```bat
run-dev.cmd
```

Fechar a janela do Studio encerra o Tauri e o Vite. `Ctrl+C` no terminal tambem encerra a sessao.

Os comandos `ui:dev` e `ui:build` existem apenas para uso interno do Tauri. Eles nao representam um modo de entrega web do produto.

## Arquivos de Projeto

O Studio usa comandos nativos Tauri para:

- selecionar pasta;
- carregar `project.json`;
- criar/salvar a estrutura `.linkpad`;
- gravar `project.json`, `hardware.json`, `network.json`, `agent.json`, `protocols.json`, `tags.json`, `screens.json` e `build.json`.

O schema atual e `0.2.0`. Projetos `0.1.0` sao migrados automaticamente; no primeiro salvamento, os arquivos anteriores sao copiados para `.migration-backup/0.1.0`.

O Studio `0.3.0` permite configurar Wi-Fi/Agent, selecionar `sim` ou `siemens-s7`, editar IP/rack/slot/timeout e montar enderecos de DB tipados. O Studio nao envia configuracao ao Agent: perfis e tags sao incorporados ao Device Runtime e enviados pelo hardware em sessoes efemeras.

Na tela Conectores, `Testar conexao` cria uma sessao efemera usando o perfil atual, valida o handshake pelo Agent e encerra a sessao. O teste nao exige DB/tag e nunca le ou escreve valores.

Nao use APIs de filesystem do navegador no produto.

## Pre-requisitos

Para rodar `run-dev.ps1` ou `npm run build`, a maquina precisa ter Rust/Cargo instalado, conforme os pre-requisitos oficiais do Tauri para Windows.

Se `rustc` ou `cargo` nao forem reconhecidos logo apos instalar o Rust, feche e abra novamente o PowerShell. Como alternativa temporaria:

```powershell
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
```

O usuario final nao precisa instalar PlatformIO, Python nem alterar o `PATH`. Na primeira compilacao ou gravacao, o Studio prepara automaticamente sua toolchain privada em `%LOCALAPPDATA%\LinkPadStudio\pio`. A mesma preparacao pode ser iniciada pelo botao `Preparar ambiente` na aba Build e requer internet apenas para baixar os componentes ainda ausentes.

A geracao do codigo fonte continua disponivel sem preparar a toolchain. O requisito Rust/Cargo acima vale somente para desenvolver e compilar o proprio Studio a partir deste repositorio, nao para usar o aplicativo instalado.

## Firmware M5

A aba Build executa:

```text
Validar projeto -> gerar projeto PlatformIO -> compilar -> gravar via porta COM
```

O codigo gerado fica em `generated/m5stickc-plus2/` dentro do projeto `.linkpad`. O Studio compila em um staging interno de caminho curto, grava o ultimo log em `build/latest.log` e copia os binarios para `build/firmware/`.

## Saidas de Build

Depois de `npm run build`, os artefatos principais ficam em:

```text
src-tauri/target/release/linkpad-studio.exe
src-tauri/target/release/bundle/msi/
src-tauri/target/release/bundle/nsis/
```
