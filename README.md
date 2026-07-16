# LinkPad

O LinkPad e uma plataforma para criar interfaces portateis de operacao industrial e conectar hardwares vestiveis a PLCs por meio de um gateway Windows.

O fluxo principal e:

```text
LinkPad Studio -> Device Runtime -> LinkPad Protocol HTTP/JSON -> LinkPad Agent -> PLC
```

## Componentes

- `LinkPadStudioApp`: editor de projetos, telas, conectores, tags e firmware.
- `LinkPadAgenteApp`: gateway Windows orientado a requisicoes, com drivers industriais.
- `docs`: governanca, contratos arquiteturais e versionamento compartilhado.

As pastas locais `App Exemplo M5Stick` e `App Exemplo Agente LinkPad` permanecem como referencias historicas no ambiente de desenvolvimento, mas nao sao versionadas nem publicadas.

Studio e Agent sao produtos independentes. O Studio incorpora descritores declarativos no firmware; o hardware envia esses descritores ao Agent pelo LinkPad Protocol. Nao existe pareamento nem implantacao direta de configuracao entre Studio e Agent.

## Desenvolvimento

Studio:

```powershell
cd .\LinkPadStudioApp
.\run-dev.ps1
```

Agent:

```powershell
cd .\LinkPadAgenteApp
.\run-dev.ps1
```

Os READMEs de cada produto descrevem dependencias, testes e empacotamento:

- [LinkPad Studio](LinkPadStudioApp/README.md)
- [LinkPad Agent](LinkPadAgenteApp/README.md)

## Colaboracao

O repositorio e preparado para trabalho simultaneo de humanos e agentes de IA. A entrada canonica para agentes e [AGENTS.md](AGENTS.md); o guia humano e [CONTRIBUTING.md](CONTRIBUTING.md).

Uma tarefa pode ser expressa pelo resultado, por exemplo:

> Integre suporte ao hardware M5Stack CoreS3.

O agente deve isolar a entrega em uma branch, verificar trabalho simultaneo, localizar os contratos afetados, atualizar codigo e documentacao, executar as validacoes e preparar um Pull Request. O fluxo completo esta em [Fluxo de colaboracao](docs/05-fluxo-colaboracao.md).

## Seguranca do repositorio

Projetos `*.linkpad`, configuracoes `.dev`, ambientes virtuais, dependencias, builds, instaladores e logs sao locais e nao entram no Git. Esses arquivos podem conter senha Wi-Fi, token do Agent, enderecos de PLC ou outros dados da planta.

Antes de publicar qualquer mudanca, revise:

```powershell
git status --short
git diff --cached --check
```

O processo de branches, commits, tags e publicacao esta em [Repositorio Git e releases](docs/04-repositorio-git.md).

## Documentacao obrigatoria

Comece por [AGENTS.md](AGENTS.md) e pelos documentos em `docs`. Mudancas de comportamento, contrato, build ou arquitetura devem atualizar a documentacao correspondente na mesma entrega.
