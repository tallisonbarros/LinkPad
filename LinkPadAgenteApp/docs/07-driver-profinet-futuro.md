# Driver Profinet Futuro

## Objetivo

Registrar direcao para PROFINET IO sem confundir essa capacidade com o driver Siemens OPC UA.

## Posicionamento

PROFINET IO nao deve ser implementado diretamente no M5Stick como padrao.

No produto, PROFINET IO deve ficar no LinkPad Agente ou em gateway/hardware especializado.

O driver `siemens-opcua` acessa variaveis de CPUs Siemens por OPC UA e nao transforma o Agente em IO Controller ou IO Device PROFINET.

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
