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

## Estado Atual

O corte atual combina Studio `0.17.1`, schema `0.9.0`, Device Runtime `0.12.1`, Agent `0.3.0` e LinkPad Protocol `0.1.0`. Estao ativos os drivers `sim`, `siemens-s7` e `opcua`; o M5StickC Plus2 ja opera com varias comunicacoes, controles declarativos com sequencias de acoes, alteracao de valores por definir/somar/subtrair/inverter, isolamento de qualidade por ponto, clique curto/segurar, desligamento, Tags internas/retentivas, overlay portatil e firmware compilado pela toolchain gerenciada. O editor possui camadas, grupos, copiar/colar, guias inteligentes, sete widgets portateis, auditoria visual e painel inferior recolhivel por guias.

O retrato completo das entregas, validacoes reais, limites e proximos marcos esta em [Estado atual e proximos passos](docs/06-estado-atual-e-proximos-passos.md).

## Primeiro Clone

Requer Windows com Git, Python 3.11+, Node.js 24 e Rust/Cargo com os pre-requisitos do Tauri instalados. Depois de clonar:

```bat
git clone https://github.com/tallisonbarros/LinkPad.git
cd LinkPad
setup-dev.cmd
```

`setup-dev.cmd` cria o ambiente Python local do Agent, instala as dependencias Windows e de teste, executa `npm ci` no Studio e valida Agent, UI e backend Rust. Dependencias, ambientes e artefatos permanecem locais e ignorados pelo Git.

## Desenvolvimento

Studio:

```powershell
cd .\LinkPadStudioApp
.\run-dev.cmd
```

Agent:

```powershell
cd .\LinkPadAgenteApp
.\run-dev.cmd
```

Os READMEs de cada produto descrevem dependencias, testes e empacotamento:

- [LinkPad Studio](LinkPadStudioApp/README.md)
- [LinkPad Agent](LinkPadAgenteApp/README.md)

## Colaboracao

O repositorio e preparado para trabalho sequencial ou simultaneo de humanos e agentes de IA. A entrada canonica para agentes e [AGENTS.md](AGENTS.md); o guia humano e [CONTRIBUTING.md](CONTRIBUTING.md).

Uma tarefa pode ser expressa pelo resultado, por exemplo:

> Integre suporte ao hardware M5Stack CoreS3.

O agente deve localizar os contratos afetados, preservar mudancas existentes, atualizar codigo e documentacao e executar as validacoes. Branch e Pull Request sao usados quando houver publicacao ou trabalho paralelo; no fluxo local sequencial, nao sao uma etapa obrigatoria a cada pequena iteracao. O fluxo completo esta em [Fluxo de colaboracao](docs/05-fluxo-colaboracao.md).

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
