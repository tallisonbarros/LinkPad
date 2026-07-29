# Roadmap MVP do LinkPad Studio

## Fase 1 - Fundacao

- Documentacao inicial.
- Schema de projeto.
- Catalogo M5StickC Plus2.
- Modelo de tags.
- LinkPad Protocol HTTP/JSON.
- Decisao LinkPad Protocol orientado a requisicoes documentada.
- Shell inicial Windows via Tauri + React/TypeScript.
- Modal de inicializacao.
- Novo projeto, carregar projeto e recentes.
- Workspace com menu superior, arvore, painel contextual, workbench e guias inferiores.

## Ajuste Obrigatorio da Fundacao

- Persistencia real de projeto via Tauri concluida na fundacao inicial.
- Selecao de pasta e carregamento de projeto via dialogos nativos Tauri concluidos na fundacao inicial.
- Build `.exe` e instaladores Windows validados com Rust/Cargo instalado.

Pendencia:

- Substituir cache de recentes em armazenamento local por arquivo de configuracao do Studio quando a camada de preferencias do app for criada.

## Fase 2 - Editor Basico

- Criar projeto.
- Escolher hardware.
- Configurar endpoint do Agente.
- Criar comunicacoes de simulacao, Siemens S7 nativo e OPC UA generico; Rockwell Logix permanece a proxima familia.
- Criar tags.
- Vincular tags a perfil e endereco industrial.
- Criar telas simples.
- Inserir widgets de texto e valor de tag.

Status: concluida para `sim` no Studio `0.2.0`, para `siemens-s7` no Studio `0.3.0`, para varios perfis simultaneos no Studio/runtime `0.4.0` e para `opcua` no Studio `0.9.0`/Agent `0.3.0`. Rockwell, Modbus e PROFINET permanecem visiveis e desabilitados ate os respectivos drivers existirem no Agent.

## Fase 3 - Simulador

- Simular tela M5.
- Simular tags.
- Simular estados offline/online.
- Simular botoes.
- Simular criacao, expiracao e recuperacao de sessao.

Status: parcial. Preview visual, valores manuais e canvas profissional concluidos; cenarios HTTP, botoes e falhas ainda pendentes.

No Studio `0.10.0`, a edicao visual inclui drag-and-drop, resize, selecao multipla, marquee, alinhamento, zoom, grade/snap, atalhos e historico. Estilo de fonte/fundo tambem e reproduzido no Device Runtime `0.9.0`. Isso conclui as ferramentas basicas de composicao, mas nao substitui a simulacao operacional de eventos e falhas.

No Studio `0.11.0` a `0.14.0`, o editor acrescenta camadas, grupos, bloqueio, copiar/colar, guias inteligentes, grade configuravel, medidor, barra, estilo comum e auditoria visual. O schema chega a `0.7.0` e o Device Runtime a `0.10.0`. A composicao visual do MVP fica fechada para uso pratico; simulacao de eventos/falhas e um segundo hardware continuam como provas arquiteturais seguintes.

No Studio `0.15.0`, o schema `0.8.0` admite varias acoes ordenadas no mesmo evento e a intencao portatil `powerOff`. O Device Runtime `0.11.0` libera A/B/Power com clique curto e long press mutuamente exclusivos, executa sequencias e desliga o M5 depois de persistir valores retentivos pendentes.

No Studio `0.16.0`, o schema `0.9.0` unifica escrita, soma, subtracao e inversao em `changeValue`. O Device Runtime `0.12.0` resolve operacoes relativas sobre valores `good` e mantem o LinkPad Protocol inalterado.

No Studio `0.17.0`, a area inferior do editor torna-se recolhivel e orientada por guias. Controles ocupa a primeira guia e deixa de abrir um modal principal; novas ferramentas de tela podem usar a mesma estrutura sem mudar projeto ou runtime.

No Studio `0.17.1`/Runtime `0.12.1`, o artefato embarcado contem somente Tags globais consumidas e operacoes relativas sao isoladas pela qualidade do ponto-alvo. Uma leitura invalida continua diagnosticavel, mas nao paralisa outras Tags saudaveis do mesmo PLC.

## Fase 4 - Geracao M5

- Gerar firmware Arduino ESP32.
- Criar sessao LinkPad Protocol a partir do firmware.
- Ler tags em lote pelo Agente.
- Escrever tags com `requestId`.
- Renderizar tela.
- Mostrar diagnostico basico.

Status: implementada no Studio `0.2.0` e ampliada no `0.4.0` para varias sessoes simultaneas. A toolchain gerenciada foi preparada e o runtime M5 multi-conectores foi compilado de verdade com sucesso, sem PlatformIO global. O fluxo M5 -> Agent -> S7 foi validado em bancada.

No Studio/runtime `0.5.0`, os estados permanentes de Wi-Fi e Agent passam a um overlay vetorial portatil, responsivo ao display e reproduzido no preview do editor.

No Studio `0.5.1`, a gravacao deixa de depender da digitacao manual de `COMx`: a porta e escolhida entre as conexoes seriais detectadas pelo Windows, com atualizacao para devices conectados durante a sessao.

No Studio/runtime `0.6.0`, controles fisicos passam a ser declarados pelo manifesto e configurados por tela. O M5 fornece apenas o primeiro adaptador A/B; a mesma estrutura aceita futuros botoes, teclas, encoders e eventos de outros hardwares.

No Studio/runtime `0.7.0`, widgets e ações usam o mesmo seletor canônico de dados. Desde o Studio `0.7.1`, o integrador escolhe um PLC configurado em `Comunicações` e informa o endereço, ou seleciona uma Tag global, sem variação de interface por widget ou hardware. O gerador deduplica esses vínculos antes de produzir os pontos embarcados.

No Studio `0.7.2`, o seletor `Selecionar tag` e a tela Tags globais usam o mesmo editor industrial compacto. Limites de escrita ficam junto do widget ou ação, e o gerador os agrega ao ponto técnico sem alterar o protocolo.

No Studio/runtime `0.8.0`, Tags globais internas funcionam como variáveis locais do device e podem ser retentivas em NVS. Criação e edição usam popup com origens Interna/Externa; o painel lateral de Tags foi removido. O template M5 foi compilado de verdade com `Preferences` e não envia Tags internas ao Agent.

## Fase 5 - Integracao Completa

```text
Studio -> firmware com descritores -> M5Stick -> LinkPad Protocol -> Agente -> driver -> PLC
```

Proximo marco:

1. fluxo M5StickC Plus2 com `sim`: validado;
2. implementar e habilitar `siemens-s7`: concluido em desenvolvimento;
3. teste efemero de handshake do conector pelo Studio: concluido, sem acesso a tag;
4. preparar DB nao otimizado/PUT-GET e validar leitura/escrita no S7-1200 real: fluxo e leitura validados em bancada;
5. repetir o marco com Rockwell Logix;
6. OPC UA generico por Node ID: concluido no Studio `0.9.0` e Agent `0.3.0`; certificados e browse permanecem como hardening posterior.

Marco adicional concluido: varios perfis habilitados no mesmo firmware, com sessao e roteamento de tags independentes por `protocolProfileId`.

Marco adicional concluido: navegacao e escrita por controles declarativos, sem funcoes A/B fixas no nucleo do runtime.

## Sequencia Recomendada Apos o Corte 0.17.1

1. validar OPC UA contra o S7-1200 fisico e concluir escrita/reconexao prolongadas na bancada Siemens;
2. acrescentar teste de ponto e browse OPC UA mantendo o seletor canonico;
3. implementar e habilitar Rockwell Logix no Agent/Studio;
4. adicionar um segundo hardware por manifesto para validar controles, overlay e retencao;
5. completar o simulador de eventos/qualidade;
6. fechar instalador Studio `0.17.1`, assinatura e testes de upgrade antes de OTA/frota.

Detalhamento, limites e gatilhos de versao ficam em `../../docs/06-estado-atual-e-proximos-passos.md`.

## Fora do MVP

- Profinet direto.
- Comunicacao industrial direta no device.
- Edicao vetorial, rotacao e componentes compostos avancados.
- Marketplace de widgets.
- Gerenciamento de frota.
