# Changelog do LinkPad Agente

Todas as mudancas relevantes deste produto serao registradas neste arquivo.

## 0.2.0 - 2026-07-15

### Corrigido

- Acoes da bandeja, incluindo `Encerrar Agent de desenvolvimento`, nao desaparecem mais depois da coleta de memoria do Python.
- `reset-dev.ps1` tambem encerra uma instancia do Agent executada por `linkpad_agent.dev_main`.

### Adicionado

- Driver `siemens-s7` com acesso DB para `BOOL`, `INT`, `DINT` e `REAL`.
- Target `s7://IPv4:102` com rack, slot e timeout declarados pelo device.
- Politica de rede para IPv4 privado RFC1918 e CIDRs explicitamente permitidos.
- I/O S7 executado fora da thread HTTP e serializado por conexao.
- Reconexao unica de leitura e confirmacao de escrita sem repeticao automatica.
- Erros por ponto com `quality`, codigo e indicador `retryable`.
- Migracao automatica da configuracao `0.2.0` para `0.3.0`, com backup.
- Preparacao automatica de `python-snap7 3.0.0` pelo launcher de desenvolvimento.
- Conexoes para targets diferentes deixam de manter locks globais durante espera de rede.
- Uma tentativa lenta de criar sessao nao bloqueia consultas a sessoes existentes.
- Falha de handshake do driver passa a responder JSON normalizado, como `503 target_offline`.

### Compatibilidade

- LinkPad Protocol permanece `0.1.0`, incluindo `value` e `valor`.
- O driver `sim` e projetos existentes continuam suportados.
- Instaladores nao foram reconstruidos nesta etapa de desenvolvimento.

## 0.1.1 - 2026-07-15

### Corrigido

- Impedida a abertura de varias instancias da bandeja para o mesmo usuario.
- Encerramento agora oculta o icone antes de finalizar o processo.
- Upgrade do instalador encerra bandejas antigas e atualiza um servico existente.

### Adicionado

- `run-dev.ps1` inicia core e bandeja juntos em um unico processo de desenvolvimento.
- Icone azul `D` e textos diferentes para modo desenvolvimento e modo servico.
- Clique esquerdo no icone tambem abre o menu.
- Acao explicita `Encerrar Agent de desenvolvimento`, que encerra API e bandeja.
- Dados de desenvolvimento isolados em `.dev`.
- `reset-dev.ps1` para encerrar bandejas antigas e parar temporariamente o servico antes de desenvolver.

## 0.1.0 - 2026-07-15

### Adicionado

- Primeira implementacao do LinkPad Protocol `0.1.0`.
- Endpoints de status, capacidades, sessoes, leitura e escrita.
- Sessoes efemeras com TTL e pool de conexoes equivalentes.
- Driver `sim` com valores em memoria.
- Compatibilidade de resposta com `value` e `valor`.
- Deduplicacao de escrita por device e `requestId`.
- Token HTTP, whitelist de devices e whitelist de drivers.
- API de gerenciamento restrita ao loopback.
- Servico Windows e aplicativo independente de bandeja.
- Build PyInstaller e instalador Inno Setup.
- Suite inicial de testes de contrato e runtime.

### Limitacoes conhecidas

- Siemens OPC UA e Rockwell Logix ainda nao estao implementados.
- A politica de redes de destino sera aplicada quando entrar o primeiro driver de rede.
- TLS, certificados por device, UI detalhada e adaptador legado permanecem pendentes.
