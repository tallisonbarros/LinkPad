# Driver Profinet Futuro

## Objetivo

Registrar direcao para PROFINET IO sem confundir essa capacidade com o driver Siemens OPC UA.

## Posicionamento

PROFINET IO nao deve ser implementado diretamente no M5Stick como padrao.

No produto, PROFINET IO deve ficar no LinkPad Agente ou em gateway/hardware especializado.

O driver generico `opcua` acessa variaveis de servidores OPC UA, inclusive CPUs Siemens, e nao transforma o Agente em IO Controller ou IO Device PROFINET.

## Riscos

- Ciclo de IO.
- GSDML.
- Descoberta e nome de device.
- Timing.
- Certificacao.
- Compatibilidade com Siemens e outros fabricantes.

## Caminhos Possiveis

- Usar biblioteca comercial/certificada.
- Integrar gateway industrial.
- Suportar S7/TCP como funcionalidade separada, sem chamar de Profinet IO.
- Implementar apenas leitura/escrita nao-real-time quando tecnicamente adequado.

## Regra

Qualquer decisao sobre PROFINET IO deve ser registrada antes de implementacao e deve definir explicitamente o papel do Agente: IO Controller, IO Device ou apenas Supervisor/diagnostico.

Estado atual: nao implementado e desabilitado no Studio. S7 nativo e OPC UA cobrem os acessos nao-ciclicos do MVP sem serem chamados de PROFINET IO.

Esta evolucao so deve avancar depois de definir requisito de ciclo, papel do Agent, suporte a GSDML, tecnologia/licenciamento e necessidade de certificacao. Ate la, nao criar um driver parcial com nome `profinet-io` para simples leitura S7/TCP.
