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

## M5StickC Plus2

No M5StickC Plus2, o runtime inicial deve mapear:

- Botao A: selecionar/confirmar ou navegar conforme tela.
- Botao B: decremento/navegacao.
- Power: incremento/navegacao.
- Long press: menu/configuracao.

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
- botao A para trocar de tela e botao B para executar a primeira escrita da tela.

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
