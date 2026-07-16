# Runtime Device

## Objetivo

Definir o firmware/runtime que o Studio gera para cada hardware.

## Responsabilidades

O Device Runtime deve:

- Inicializar hardware.
- Conectar rede.
- Comunicar com qualquer LinkPad Agente compativel via LinkPad Protocol HTTP/JSON.
- Consultar capacidades e versao do Agente.
- Criar e renovar sessoes efemeras enviando descritores de protocolo.
- Ler e escrever enderecos industriais declarativos.
- Manter cache local.
- Renderizar telas.
- Tratar botoes/touch.
- Mostrar estados de comunicacao.
- Persistir configuracoes locais quando permitido.

## Arquitetura Conceitual

```text
Device Runtime
  Hardware Abstraction
  Network Manager
  LinkPad Protocol Client
  Protocol Descriptor Store
  Tag Cache
  Screen Renderer
  Input Manager
  Event Engine
  Local Settings
  Diagnostics
```

## Estados Minimos

- `booting`
- `network_connecting`
- `agent_offline`
- `agent_online`
- `session_opening`
- `target_pending`
- `target_online`
- `tag_stale`
- `write_pending`
- `write_failed`

## Entradas e Acoes

O runtime recebe eventos normalizados do adaptador do hardware. O `Input Manager` nao conhece telas ou tags; ele apenas fornece `inputId` e `event`. O `Event Engine` consulta `inputBindings` da tela corrente e executa a acao declarada.

Acoes implementadas no runtime `0.6.0`:

- `navigate`: proxima tela, tela anterior ou `screenId` especifico;
- `writeTag`: escreve um valor fixo usando a sessao da tag;
- `toggleTag`: inverte uma tag booleana `readWrite` a partir do ultimo valor conhecido;
- `activateWidget`: executa um `write_button` especifico da tela.

Falhas de escrita entram em `write_failed` e nunca geram repeticao automatica. Controles/eventos ausentes sao ignorados pelo runtime e bloqueados pela validacao do Studio.

## M5StickC Plus2

No M5StickC Plus2, o adaptador `LinkPadInputAdapter` mapeia:

- Botao A: `primary/press`.
- Botao B: `secondary/press`.
- Power: reservado, sem evento configuravel nesta versao.

O significado de A/B e definido por cada tela. Long press, duplo clique e outros eventos permanecem previstos no contrato, mas so aparecem quando o adaptador e o manifesto do hardware os oferecerem.

## Runtime MVP Implementado

O template `m5stickc-plus2` implementa:

- conexao Wi-Fi;
- consulta de `/lpp/v1/status` e `/lpp/v1/capabilities`;
- criacao e recuperacao de uma sessao para cada perfil habilitado;
- leitura em lote agrupada por `protocolProfileId`;
- escrita acionada por `write_button`, com `requestId` novo por intencao;
- invalidacao e recriacao de sessao apos `404` ou `410`;
- tratamento de `status: partial` e erros por ponto sem apagar o ultimo valor valido;
- escrita considerada concluida somente quando o item retorna `status: written`;
- backoff simples para rede/Agent indisponivel;
- renderizacao de texto, valor, booleano, status e botao;
- adaptador fisico A/B e motor declarativo de acoes por tela.

Limitacoes do MVP:

- conectores liberados no Studio: `sim` e `siemens-s7`;
- sem menu local de edicao de rede;
- sem OTA;
- confirmacao visual de escrita ainda simplificada.

## Regra Importante

O runtime nao implementa S7, OPC UA, EtherNet/IP, PROFINET IO ou Modbus. Ele apenas serializa descritores declarativos e fala LinkPad Protocol com o Agente. A liberacao de `siemens-s7` nao adiciona biblioteca industrial ao M5.

Se o Agente reiniciar ou uma sessao expirar, o runtime deve recriar somente a sessao correspondente usando o perfil incorporado ao firmware. As demais sessoes continuam operando.

HTTP 200 nao implica sucesso industrial do lote. O runtime usa `status`/`quality` de cada ponto: leitura parcial entra em `tag_stale`, e escrita `uncertain` entra em `write_failed` sem gerar repeticao automatica.

O runtime `0.5.0` remove a faixa textual `WiFi/Agent/S/T`. Cada tela recebe uma marca d'agua com dois icones vetoriais: Wi-Fi e Agent em verde quando disponiveis e vermelho quando indisponiveis. Sessoes e saude de tags continuam no estado interno, mas nao ocupam a interface principal.

O overlay e uma camada do `Screen Renderer`, nao um widget salvo em cada tela. Ele usa o descritor `hardware.statusOverlay`, escala pela dimensao do display e e renderizado depois dos widgets. Assim, novas familias de hardware podem reutilizar o mesmo contrato e fornecer apenas o adaptador grafico do seu template.

No runtime `0.6.0`, o mesmo principio se aplica a entrada: `LinkPadRuntime` nao chama `M5.BtnA` ou `M5.BtnB`. Apenas `LinkPadInputAdapter.h` conhece M5Unified; novos templates substituem esse adaptador e mantem o motor de acoes.
