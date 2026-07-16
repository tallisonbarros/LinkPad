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

## Proxima Validacao - S7-1200 Real

- preparar DB dedicado nao otimizado no TIA Portal;
- habilitar acesso PUT/GET;
- validar leitura e escrita ponta a ponta M5 -> Agent -> PLC;
- medir timeout, reconexao e estabilidade de polling;
- validar embalagem PyInstaller do driver antes do proximo instalador.

## Conector Siemens Posterior - OPC UA

- implementar `siemens-opcua` com a biblioteca escolhida;
- ler/escrever NodeIds e definir politica de certificados;
- manter S7 nativo e OPC UA como conectores independentes.

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
