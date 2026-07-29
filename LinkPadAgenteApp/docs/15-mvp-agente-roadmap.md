# Roadmap MVP do LinkPad Agente

## Entregue em 0.1.0

### Contrato e Core

- LinkPad Protocol `0.1.0` documentado e implementado;
- status e capacidades dinamicas;
- criar, fechar e expirar sessoes;
- connection pool por descritor equivalente;
- leitura e escrita em lote;
- `requestId` e deduplicacao de escrita;
- driver `sim`;
- token, whitelist de devices/drivers e limites globais;
- testes de contrato.

### Operacao Windows

- modo console/headless;
- servico Windows nativo;
- bandeja PySide6 independente;
- logs rotativos em ProgramData;
- build PyInstaller;
- instalador Inno Setup e regra de firewall para a porta padrao.

## Entregue em 0.2.0 - Siemens S7 Nativo

- `siemens-s7` com `python-snap7 3.0.0`;
- IPv4 privado/CIDR, porta 102, rack, slot e timeout;
- enderecos DB e tipos `BOOL`, `INT`, `DINT`, `REAL`;
- serializacao por conexao e I/O fora da thread HTTP;
- reconexao unica de leitura;
- escrita sem repeticao automatica e com confirmacao;
- testes com cliente S7 falso para codec e falhas.
- isolamento de conexoes lentas com lock por target e teste de regressao de concorrencia.
- erros de handshake normalizados para diagnostico do Studio.

## Validacao S7-1200 Real e Fechamento de Bancada

Concluido:

- DB absoluto/PUT-GET preparado para a bancada;
- handshake do Studio ate o PLC;
- leitura ponta a ponta M5 -> Agent -> S7-1200.

Pendente para fechamento:

- validar escrita confirmada no PLC real;
- medir timeout, reconexao e estabilidade de polling prolongado;
- repetir os quatro tipos e varios perfis/devices;
- registrar CPU, firmware e configuracao TIA da matriz validada.

## Entregue em 0.3.0 - OPC UA Generico

- `opcua` com `asyncua 2.0.1` e sessao reutilizada no pool;
- Node ID `ns=`/`nsu=`, tipos escalares, qualidade e timestamp;
- reconexao unica de leitura e escrita confirmada sem repeticao;
- integracao automatizada LinkPad Protocol -> servidor OPC UA real;
- Studio e firmware por descritores, sem biblioteca OPC no device;
- build PyInstaller e smoke test do executavel concluidos.

Permanecem posteriores: certificados/trust store, credenciais protegidas, `SignAndEncrypt` e browse online.

## Proxima Validacao - OPC UA no S7-1200

- habilitar/licenciar o servidor OPC UA e publicar interface no TIA Portal;
- registrar endpoint, namespace e Node IDs;
- validar leitura/escrita e qualidade real;
- testar reinicio, certificado futuro e perda de rede;
- comparar estabilidade/operacao com o S7 nativo sem tratar um como substituto do outro.

## Entrega Seguinte - Rockwell Logix

- adaptar `pycomm3`/`LogixDriver` do prototipo;
- receber endpoint/path pelo target;
- ler e escrever tags;
- validar tipos basicos;
- reutilizar conexoes Logix.

## Robustez Pendente

- cache/deduplicacao de leituras;
- rate limit por device, sessao e target;
- fila de escrita para drivers que precisarem serializacao;
- timeout de confirmacao aplicado por driver;
- auditoria e logs operacionais mais completos;
- TLS e identidade por device;
- testes de carga, falha e upgrade do instalador.

## Ordem Recomendada

1. fechar as duas bancadas Siemens;
2. implementar seguranca OPC UA de producao;
3. criar teste de ponto e browse versionado;
4. entregar Rockwell Logix no novo Agent;
5. evoluir cache, limites, auditoria e TLS;
6. validar instalador/upgrade e assinatura antes de distribuicao ampla.

O snapshot compartilhado fica em `../../docs/06-estado-atual-e-proximos-passos.md`.

## Compatibilidade Legada Pendente

- adaptador opcional `/status`, `/read_tag`, `/read_tags`, `/write_tag`;
- `legacy.defaultTarget` apenas para runtimes antigos.

O alias `valor` ja esta implementado no LinkPad Protocol.

## Fora do MVP

- PROFINET IO completo;
- OPC UA PubSub;
- cluster de agentes;
- cloud/frota;
- configuracao de PLC/projeto pela UI do Agente;
- pareamento Studio-Agente.
