# UI Minima do Agente

## Dois Modos Claros

### Desenvolvimento

Executar somente:

```powershell
.\reset-dev.ps1  # somente se houver instancia instalada/antiga
.\run-dev.ps1
```

O core HTTP e a bandeja rodam no mesmo processo. O icone e azul e mostra `D`. O menu informa `MODO DESENVOLVIMENTO · API e bandeja juntas`.

`Encerrar Agent de desenvolvimento` fecha o icone, as APIs, sessoes e conexoes de forma limpa. As acoes do menu pertencem explicitamente ao menu Qt e permanecem disponiveis durante toda a execucao, inclusive depois da coleta de memoria do Python.

`run-dev.ps1` recusa iniciar enquanto detectar a bandeja instalada ou um servico LinkPad ativo. `reset-dev.ps1` pede elevacao, encerra tambem uma instancia `linkpad_agent.dev_main` que tenha ficado aberta, fecha bandejas instaladas e para o servico sem desinstalar o produto.

### Instalacao Windows

O servico e a bandeja sao processos independentes. O icone mostra `LP` e o menu informa `MODO SERVIÇO WINDOWS · bandeja independente`.

`Encerrar somente a bandeja` remove a interface, mas o gateway continua rodando no servico Windows.

## Instancia Unica

A partir de `0.1.1`, um lock por usuario impede duas bandejas simultaneas. Ao tentar abrir outra, o aplicativo informa que o icone ja esta em execucao e encerra a segunda instancia.

O instalador tambem encerra processos antigos da bandeja durante upgrade.

## Interacao

Clique esquerdo ou direito abre o menu. Isso mantem a acao de encerramento sempre acessivel.

Estados:

- azul `D`: modo desenvolvimento ativo;
- verde `LP`: servico pronto;
- amarelo `LP`: servico ativo com alerta de configuracao;
- vermelho: API correspondente indisponivel.

Zero sessoes e um estado normal.

## Menu

- modo atual;
- status e quantidade de sessoes;
- abrir configuracao;
- abrir pasta de logs;
- reiniciar servico Windows, somente no modo instalado;
- encerrar o modo atual com texto explicito.

## O Que Nao Pertence a UI

- cadastrar ou selecionar PLC;
- criar/importar tags;
- configurar polling do projeto;
- salvar perfil por cliente/planta;
- receber configuracao do Studio.
