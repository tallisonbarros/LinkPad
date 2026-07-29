# LinkPad Studio App

Aplicativo Windows desktop do LinkPad Studio.

## Stack Oficial

- Tauri 2
- React
- TypeScript
- Vite como empacotador interno da UI

Ao abrir a janela desktop, um bootstrap visual estatico mostra `Abrindo Studio...` antes do carregamento do bundle React. Ele desaparece assim que a primeira montagem da aplicacao termina, sem tempo minimo artificial.

## Comandos

```powershell
npm install
.\run-dev.cmd
npm run build
npm run check
npm run test
```

Em um clone novo do monorepo, execute primeiro `setup-dev.cmd` na raiz. Ele usa `npm ci`, valida UI e backend Rust e prepara tambem o Agent.

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

O schema atual é `0.9.0`. Projetos `0.1.0` a `0.8.0` são migrados automaticamente; no primeiro salvamento, os arquivos anteriores são copiados para `.migration-backup/<versão>`.

O Studio `0.3.0` permite configurar Wi-Fi/Agent, selecionar `sim` ou `siemens-s7`, editar IP/rack/slot/timeout e montar enderecos de DB tipados. O Studio nao envia configuracao ao Agent: perfis e tags sao incorporados ao Device Runtime e enviados pelo hardware em sessoes efemeras.

O Studio `0.9.0` habilita o conector generico `opcua`, validado com servidor OPC UA real e tendo Siemens S7-1200 como primeiro alvo fisico ainda pendente. O integrador informa servidor e Node ID no mesmo seletor compartilhado por widgets, acoes e Tags globais. O MVP usa modo anonimo/None em laboratorio; a biblioteca OPC UA permanece somente no Agent.

Snapshot atual: Studio `0.17.1`, schema de projeto `0.9.0` e Device Runtime `0.12.1`. O hardware implementado e o M5StickC Plus2; os conectores habilitados sao `sim`, `siemens-s7` e `opcua`. Rockwell, Modbus e PROFINET permanecem visiveis apenas como evolucoes desabilitadas.

Ao editar uma tela, o painel direito oferece acessos compactos para `Adicionar` e `Camadas`. Com um unico widget selecionado, o Contexto se torna uma superficie unica de `Propriedades`: cada atributo ocupa a linha `Propriedade | Valor | Animacao`, e a terceira coluna permanece reservada e desabilitada ate o contrato futuro de animacoes. `Conteudo` e `Visual` iniciam abertos; `Borda e espaco` e `Posicao e exibicao` iniciam recolhidos, com geometria e visibilidade no final do painel. A barra de ferramentas mostra somente a identidade compacta da selecao. O botao direito sobre o widget concentra copiar, recortar, colar, duplicar, bloquear/desbloquear e excluir; `Alinhar` tambem concentra a igualacao de largura e altura. O display oferece drag-and-drop, redimensionamento, fantasma, selecao multipla, grupos, bloqueio, visibilidade, alinhamento, ordem, zoom, grade configuravel, guias inteligentes e historico. `Alinhar`, `Ordem` e `Grupo` sao intertravados: abrir um recolhe o anterior.

Na arvore esquerda, `Projeto` concentra tambem o resumo do Device/hardware. O botao direito em uma tela abre as acoes copiar, recortar, colar, duplicar e excluir, preservando IDs independentes nas copias. Nao existe uma area `Assets` enquanto o Studio nao oferecer importacao e consumo reais de imagens ou fontes; o campo existente continua preservado nos projetos por compatibilidade.

O Studio `0.7.0` padroniza a seleção de dados em um único diálogo. No Studio `0.7.1`, as abas visíveis são `PLC` e `Tags globais`; no `0.7.2`, o diálogo `Selecionar tag` torna-se compacto, reutiliza o mesmo editor industrial da tela Tags globais e deixa limites de escrita no widget ou ação. O gerador compila todas as origens para os mesmos pontos enviados pelo Device Runtime.

No Studio/runtime `0.8.0`, Tags globais podem ser internas ou externas. Tags internas possuem valor inicial, podem ser retentivas e funcionam no cache local do device sem PLC ou Agent; Tags externas continuam usando uma comunicação. A criação usa abas e a edição abre em popup por duplo clique.

No Studio `0.16.0`, controles usam uma unica acao visivel, `Alterar valor`. Conforme o tipo da Tag, ela permite definir, somar, subtrair ou inverter; operacoes relativas exigem acesso `readWrite` e valor atual valido no Device Runtime `0.12.0`. Projetos antigos com `writeTag`/`toggleTag` sao migrados automaticamente.

No Studio `0.17.0`, o editor da tela possui uma secao inferior recolhivel com guias. `Controles` hospeda diretamente a tabela de configuracao e `Alertas` concentra a auditoria visual com navegacao para o widget; o antigo resumo fixo, o modal principal de Controles e o drawer de alertas deixam de existir. A estrutura aceita novas ferramentas de tela sem alterar hardware, projeto ou runtime.

No Studio `0.17.1`/Runtime `0.12.1`, somente Tags globais realmente referenciadas por widgets ou controles entram no firmware. Leituras e operacoes relativas sao isoladas por ponto: uma Tag invalida pode sinalizar degradacao, mas nao bloqueia a escrita sobre outra Tag `good` do mesmo PLC.

Na interface, `Rede LinkPad` configura Wi-Fi e acesso ao Agente; `Comunicações` lista PLCs e simulações. Em `Comunicação com PLC`, `Testar conexão` cria uma sessão efêmera usando a configuração atual, valida o handshake pelo Agent e encerra a sessão. O teste não exige DB/tag e nunca lê ou escreve valores.

Em `Controles`, cada evento pode executar uma sequencia ordenada de acoes agrupadas por Navegacao, Interface, Dados e Dispositivo. A, B e Power oferecem clique curto e pressionar/segurar no M5StickC Plus2; `Desligar` e uma acao portatil executada somente quando o manifesto declara essa capacidade.

Nao use APIs de filesystem do navegador no produto.

## Pre-requisitos

Para rodar `run-dev.ps1` ou `npm run build`, a maquina precisa ter Rust/Cargo instalado, conforme os pre-requisitos oficiais do Tauri para Windows.

Se `rustc` ou `cargo` nao forem reconhecidos logo apos instalar o Rust, feche e abra novamente o PowerShell. Como alternativa temporaria:

```powershell
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
```

O usuario final nao precisa instalar PlatformIO, Python nem alterar o `PATH`. Na primeira compilacao ou gravacao, o Studio prepara automaticamente sua toolchain privada em `%LOCALAPPDATA%\LinkPadStudio\pio`. A mesma preparacao pode ser iniciada pelo botao `Preparar ambiente` na aba Build e requer internet apenas para baixar os componentes ainda ausentes.

A geracao de codigo e uma etapa interna de `Compilar` e `Gravar device`; ambas preparam a toolchain automaticamente quando necessario. O requisito Rust/Cargo acima vale somente para desenvolver e compilar o proprio Studio a partir deste repositorio, nao para usar o aplicativo instalado.

## Firmware M5

A aba Build executa:

```text
Validar projeto -> gerar projeto PlatformIO -> compilar -> gravar via porta COM
```

O codigo gerado fica em `generated/m5stickc-plus2/` dentro do projeto `.linkpad`. `Compilar` sempre gera o codigo e executa o build; `Gravar device` gera, compila e envia pela porta serial em uma unica acao. O Studio usa um staging interno de caminho curto, grava o ultimo log em `build/latest.log` e copia os binarios para `build/firmware/`.

## Saidas de Build

Depois de `npm run build`, os artefatos principais ficam em:

```text
src-tauri/target/release/linkpad-studio.exe
src-tauri/target/release/bundle/msi/
src-tauri/target/release/bundle/nsis/
```

## Proximos Passos

- validar OPC UA no S7-1200 fisico;
- acrescentar teste de ponto e browse sem alterar o seletor canonico;
- habilitar Rockwell somente depois do driver funcional no Agent;
- adicionar um segundo hardware por manifesto para validar display, entradas e armazenamento;
- completar o simulador de eventos/estados e reconstruir o instalador Studio `0.17.1` para release.

O plano compartilhado completo esta em `../docs/06-estado-atual-e-proximos-passos.md`.
