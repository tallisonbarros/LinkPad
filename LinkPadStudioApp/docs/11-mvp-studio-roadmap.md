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
- Criar perfis Siemens OPC UA, Rockwell Logix e simulador.
- Criar tags.
- Vincular tags a perfil e endereco industrial.
- Criar telas simples.
- Inserir widgets de texto e valor de tag.

Status: concluida para `sim` no Studio `0.2.0`, para `siemens-s7` no Studio `0.3.0` e para varios perfis simultaneos no Studio/runtime `0.4.0`. OPC UA, Rockwell, Modbus e PROFINET permanecem visiveis e desabilitados ate os respectivos drivers existirem no Agent.

## Fase 3 - Simulador

- Simular tela M5.
- Simular tags.
- Simular estados offline/online.
- Simular botoes.
- Simular criacao, expiracao e recuperacao de sessao.

Status: parcial. Preview visual e valores manuais concluidos; cenarios HTTP, botoes e falhas ainda pendentes.

## Fase 4 - Geracao M5

- Gerar firmware Arduino ESP32.
- Criar sessao LinkPad Protocol a partir do firmware.
- Ler tags em lote pelo Agente.
- Escrever tags com `requestId`.
- Renderizar tela.
- Mostrar diagnostico basico.

Status: implementada no Studio `0.2.0` e ampliada no `0.4.0` para varias sessoes simultaneas. A toolchain gerenciada foi preparada e o runtime M5 multi-conectores foi compilado de verdade com sucesso, sem PlatformIO global. O fluxo M5 -> Agent -> S7 foi validado em bancada.

No Studio/runtime `0.5.0`, os estados permanentes de Wi-Fi e Agent passam a um overlay vetorial portatil, responsivo ao display e reproduzido no preview do editor.

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
6. avaliar OPC UA como segundo conector Siemens.

Marco adicional concluido: varios perfis habilitados no mesmo firmware, com sessao e roteamento de tags independentes por `protocolProfileId`.

## Fora do MVP

- Profinet direto.
- Comunicacao industrial direta no device.
- Editor visual avancado.
- Marketplace de widgets.
- Gerenciamento de frota.
