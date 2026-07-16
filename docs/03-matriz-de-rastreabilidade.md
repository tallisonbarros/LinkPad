# Matriz de Rastreabilidade

## Objetivo

Mapear requisitos principais aos documentos responsaveis.

| Requisito | Documento responsavel |
| --- | --- |
| Studio cria projetos industriais | `LinkPadStudioApp/docs/00-visao-geral-studio.md` |
| Separacao Studio, Runtime e Agente | `LinkPadStudioApp/docs/01-arquitetura-studio.md`, `LinkPadAgenteApp/docs/01-arquitetura-agente.md` |
| Device comunica via LinkPad Protocol HTTP/JSON | `LinkPadStudioApp/docs/07-integracao-com-agent-http.md`, `LinkPadAgenteApp/docs/02-api-http-device-agent.md` |
| Studio e Agente operam sem pareamento | `docs/01-contratos-de-mudanca.md`, `LinkPadStudioApp/docs/01-arquitetura-studio.md`, `LinkPadAgenteApp/docs/01-arquitetura-agente.md` |
| Device envia descritor industrial | `LinkPadStudioApp/docs/02-modelo-de-projeto-linkpad.md`, `LinkPadStudioApp/docs/07-integracao-com-agent-http.md`, `LinkPadAgenteApp/docs/02-api-http-device-agent.md` |
| Primeiro hardware M5Stick | `LinkPadStudioApp/docs/03-catalogo-de-hardwares.md` |
| Editor drag-and-drop | `LinkPadStudioApp/docs/05-editor-visual-e-widgets.md` |
| Tags industriais | `LinkPadStudioApp/docs/06-modelo-de-tags.md`, `LinkPadAgenteApp/docs/08-gerenciamento-de-tags.md` |
| Firmware gerado | `LinkPadStudioApp/docs/08-geracao-de-firmware.md` |
| Simulador | `LinkPadStudioApp/docs/09-simulador-studio.md`, `LinkPadAgenteApp/docs/12-modo-simulador.md` |
| Agent como gateway industrial | `LinkPadAgenteApp/docs/00-visao-geral-agente.md` |
| Siemens S7 nativo inicial | `LinkPadAgenteApp/docs/04b-driver-siemens-s7-nativo.md`, `LinkPadStudioApp/docs/06-modelo-de-tags.md` |
| Teste efemero de handshake do conector | `docs/01-contratos-de-mudanca.md`, `LinkPadStudioApp/docs/07-integracao-com-agent-http.md`, `LinkPadAgenteApp/docs/02-api-http-device-agent.md` |
| Siemens OPC UA futuro | `LinkPadAgenteApp/docs/04a-driver-siemens-opcua.md` |
| Rockwell Logix validado | `LinkPadAgenteApp/docs/05-driver-ethernet-ip-logix.md` |
| Modbus futuro/proximo | `LinkPadAgenteApp/docs/06-driver-modbus.md` |
| Profinet futuro | `LinkPadAgenteApp/docs/07-driver-profinet-futuro.md` |
| Seguranca de device, token e destinos | `LinkPadAgenteApp/docs/10-seguranca-token-whitelist.md` |
| Deploy como servico Windows | `LinkPadAgenteApp/docs/14-servico-windows-deploy.md` |
| Colaboracao simultanea de humanos e agentes | `AGENTS.md`, `docs/05-fluxo-colaboracao.md`, `CONTRIBUTING.md` |

## Regra de Uso

Antes de alterar um requisito, encontre sua linha nesta matriz e atualize o documento responsavel.
