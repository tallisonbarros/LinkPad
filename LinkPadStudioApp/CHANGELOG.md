# Changelog

## 0.6.0 - 2026-07-16

### Adicionado

- Contrato `inputBindings` por tela, ligando controles e eventos normalizados a ações declarativas.
- Manifesto estruturado de entradas de hardware com identificador lógico, rótulo, tipo, eventos e disponibilidade para configuração.
- Editor `Controles desta tela`, com resumo abaixo do display e modal alimentado pelo catálogo do hardware.
- Ações de navegação, escrita de valor, alternância booleana e acionamento de widget interativo.
- `LinkPadInputAdapter` no template M5, isolando `M5.BtnA` e `M5.BtnB` do motor genérico de ações.
- Validação de controles reservados/ausentes, eventos incompatíveis, referências e valores de escrita.
- Backup de projetos `0.2.0` em `.migration-backup/0.2.0` antes do primeiro salvamento migrado.

### Alterado

- Schema do projeto passa a `0.3.0`; Studio e Device Runtime passam a `0.6.0`.
- O botão B deixa de executar implicitamente o primeiro widget de escrita; toda ação física passa a ser declarada na tela.
- Novas telas usam as dimensões do manifesto do hardware, removendo o valor fixo `240 x 135` do shell.
- Power permanece visível no catálogo do M5, mas reservado até o adaptador oferecer eventos seguros.

### Migração

- Projetos `0.1.0` e `0.2.0` são migrados automaticamente para `0.3.0`.
- O comportamento anterior é preservado como `primary/press -> próxima tela` e `secondary/press -> acionar primeiro write_button`, quando esse widget existe.

### Compatibilidade

- LinkPad Protocol permanece `0.1.0` e o Agent não exige alteração.
- Escritas continuam sem repetição automática após falha.
- Instaladores não foram reconstruídos nesta iteração de desenvolvimento.

## 0.5.1 - 2026-07-16

### Adicionado

- Descoberta nativa de portas seriais pelo backend Tauri, com identificacao USB quando fornecida pelo sistema operacional.
- Lista suspensa de portas detectadas e acao de atualizacao para hot-plug do device.
- Ordenacao numerica de portas Windows (`COM2` antes de `COM10`) e testes unitarios do enumerador.
- Excecao de versionamento para manter `src/features/build` no Git sem liberar diretorios de artefatos `build/`.

### Alterado

- A porta serial deixa de aceitar texto livre na aba Build.
- Uma porta salva mas desconectada permanece visivel como diagnostico, porem a gravacao fica bloqueada ate a selecao de uma porta detectada.
- Quando o projeto ainda nao possui porta e somente uma esta disponivel, o Studio a seleciona automaticamente.

### Compatibilidade

- `build.serialPort` permanece uma string e o schema de projeto continua `0.2.0`.
- LinkPad Protocol e Agent nao foram alterados.
- Device Runtime permanece `0.5.0`; somente o LinkPad Studio passa a `0.5.1`.
- Instaladores nao foram reconstruidos nesta iteracao de desenvolvimento.

## 0.5.0 - 2026-07-16

### Adicionado

- Contrato `hardware.statusOverlay` com posicao, estilo e lista de indicadores por hardware.
- Marca d'agua vetorial e colorida para Wi-Fi e Agent, persistente em todas as telas.
- Renderer responsivo que calcula geometria pela menor dimensao do display e suporta os quatro cantos.
- Preview do Studio com o mesmo overlay nao interativo do runtime.
- Normalizacao automatica de projetos anteriores sem `statusOverlay`.

### Alterado

- Removida a faixa textual `WiFi/Agent/S/T` do firmware.
- Detalhes de sessoes e qualidade de tags continuam internos e deixam de ocupar a tela principal.
- O icone do Agent representa exclusivamente disponibilidade HTTP, sem ficar offline por erro de PLC/tag.

### Compatibilidade

- Schema de projeto permanece `0.2.0` e LinkPad Protocol permanece `0.1.0`.
- Agent `0.2.0` nao exige alteracao.
- Instaladores nao foram reconstruidos nesta iteracao de desenvolvimento.

## 0.4.0 - 2026-07-15

### Adicionado

- CRUD de perfis na tela Conectores, com selecao, nome, driver, endpoint, habilitacao e teste independentes.
- Protecao contra exclusao de perfil ainda referenciado por tags.
- Tags exibem e selecionam o perfil pelo nome e driver, preservando `protocolProfileId` como vinculo canonico.
- Perfil default alterado de simulacao para S7 deixa de conservar o nome enganoso `Simulacao principal`.
- Runtime M5 com uma sessao LinkPad Protocol por perfil habilitado.
- Leituras agrupadas por perfil e escritas roteadas para a sessao da tag.
- Retry, expiracao e recuperacao independentes por perfil, sem invalidar outras sessoes.
- Diagnostico embarcado separado para Wi-Fi, Agent, sessoes abertas e saude das tags.
- Teste de projeto com dois conectores ativos e compilacao real do template ESP32 multi-conectores.

### Compatibilidade

- Schema de projeto permanece `0.2.0` e LinkPad Protocol permanece `0.1.0`.
- Projetos `0.2.0`/Studio `0.3.0` sao normalizados sem migracao estrutural; `studioVersion` passa a `0.4.0`.
- O Agent `0.2.0` nao exige alteracao, pois ja aceita varias sessoes simultaneas.
- Instaladores nao foram reconstruidos nesta iteracao de desenvolvimento.

## 0.3.0 - 2026-07-15

### Adicionado

- Conector selecionavel `siemens-s7` ao lado de `sim`.
- Editor de target S7 com IPv4 privado/TCP 102, rack, slot e timeout.
- Editor de tag S7 estruturado por DB, byte, bit e tipo `BOOL`, `INT`, `DINT` ou `REAL`.
- Defaults de endereco ao trocar o perfil e validacao de compatibilidade entre tipo LinkPad e tipo S7.
- Runtime gerado `0.3.0`, mantendo descritores genericos no device.
- Runtime diferencia HTTP 200 parcial de sucesso, preserva o ultimo valor valido e nao aceita escrita sem `status: written`.
- Testes de validacao para target privado, IP publico e conflito de tipo.
- Botao `Testar conexao` no perfil, usando sessao temporaria e sem ler/escrever tags.
- Resultado de handshake com endpoint e latencia, incluindo mensagens de erro do Agent.
- Cliente HTTP `reqwest` para POST/DELETE do diagnostico, executado fora da thread da interface.

### Compatibilidade

- Schema de projeto permanece `0.2.0`.
- LinkPad Protocol permanece `0.1.0` e preserva `value`/`valor`.
- Projetos de simulacao existentes continuam normalizados e editaveis.
- O instalador nao foi reconstruido nesta iteracao de desenvolvimento.

### Limitacoes

- Um perfil habilitado por firmware.
- S7 MVP limitado a area DB e tipos basicos.
- Teste final com PLC S7-1200 real ainda pendente.

## 0.2.0 - 2026-07-15

### Adicionado

- Schema de projeto `0.2.0` com rede, protocolos e build.
- Migracao automatica de projetos `0.1.0` com backup no primeiro salvamento.
- Catalogo de conectores com `sim` funcional e drivers industriais planejados.
- Configuracao Wi-Fi/Agent e diagnostico de status/capabilities.
- CRUD e validacao de tags.
- Editor basico de telas com cinco widgets.
- Validacao, geracao deterministica, build e gravacao PlatformIO para M5StickC Plus2.
- Toolchain PlatformIO gerenciada pelo Studio, com Python portatil, downloads verificados e nenhuma dependencia de `pio` no `PATH`.
- Preparacao automatica no primeiro build, progresso visivel e acao explicita `Preparar ambiente`.
- Staging de build em caminho compacto e copia dos binarios finais para o projeto.
- Versoes fixadas da plataforma ESP32, M5Unified e ArduinoJson.
- Compilacao real do runtime M5 validada com a toolchain gerenciada.
- Compilacao e gravacao em tarefa de backend separada, mantendo a interface responsiva.
- Progresso de build/upload e diagnostico incremental exibidos na aba Build.
- Capability Tauri minima para a janela principal escutar e remover listeners dos eventos de progresso.
- Testes TypeScript e Rust para migracao, validacao e geracao.

### Compatibilidade

- LinkPad Protocol permanece em `0.1.0`.
- `value` continua canonico e o runtime aceita `valor` como fallback de leitura.
- O Agent permanece independente e nao recebe configuracao do Studio.

### Limitacoes

- Nesta versao historica, apenas o driver `sim` era habilitado; `siemens-s7` foi liberado no Studio `0.3.0`.
- Um perfil habilitado por firmware no runtime MVP.
- A primeira preparacao da toolchain requer acesso a internet.
- Gravacao e comunicacao ponta a ponta ainda dependem de validacao com o M5Stick fisico.
