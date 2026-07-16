import type { ConnectorDriver, LinkPadTag } from "../types/project";

export interface ConnectorManifest {
  id: ConnectorDriver;
  name: string;
  description: string;
  endpointExample: string;
  addressField: string;
  addressExample: string;
  available: boolean;
  defaultOptions: Record<string, string | number | boolean>;
}

export const connectorCatalog: ConnectorManifest[] = [
  {
    id: "sim",
    name: "Simulação",
    description: "Memória efêmera do LinkPad Agent para desenvolver sem PLC.",
    endpointExample: "memory://linha-1",
    addressField: "key",
    addressExample: "Motor.Speed",
    available: true,
    defaultOptions: {}
  },
  {
    id: "siemens-s7",
    name: "Siemens S7 nativo",
    description: "S7-1200/1500 por comunicação S7 nativa via TCP 102 no LinkPad Agent.",
    endpointExample: "s7://192.168.0.10:102",
    addressField: "dbNumber",
    addressExample: "DB100.DBD0",
    available: true,
    defaultOptions: { rack: 0, slot: 1, timeoutMs: 2000 }
  },
  {
    id: "siemens-opcua",
    name: "Siemens OPC UA",
    description: "S7-1200/1500 por OPC UA, quando o driver estiver disponível no Agent.",
    endpointExample: "opc.tcp://192.168.0.10:4840",
    addressField: "nodeId",
    addressExample: "ns=3;s=Motor.Speed",
    available: false,
    defaultOptions: {}
  },
  {
    id: "rockwell-logix",
    name: "Rockwell Logix",
    description: "ControlLogix/CompactLogix por EtherNet/IP usando o driver do Agent.",
    endpointExample: "192.168.0.20/1",
    addressField: "tag",
    addressExample: "MotorSpeed",
    available: false,
    defaultOptions: {}
  },
  {
    id: "modbus-tcp",
    name: "Modbus TCP",
    description: "Registradores Modbus TCP por um futuro driver do Agent.",
    endpointExample: "tcp://192.168.0.30:502",
    addressField: "register",
    addressExample: "40001",
    available: false,
    defaultOptions: {}
  },
  {
    id: "profinet-io",
    name: "PROFINET IO",
    description: "Integração PROFINET futura; não é protocolo direto no device.",
    endpointExample: "profinet://station-name",
    addressField: "symbol",
    addressExample: "Motor.Speed",
    available: false,
    defaultOptions: {}
  }
];

export function getConnectorManifest(driver: ConnectorDriver) {
  return connectorCatalog.find((connector) => connector.id === driver) ?? connectorCatalog[0];
}

export function defaultEndpointFor(driver: ConnectorDriver, projectId: string) {
  if (driver === "sim") return `memory://${projectId}`;
  return getConnectorManifest(driver).endpointExample;
}

export function defaultS7DataType(type: LinkPadTag["type"]) {
  if (type === "bool") return "BOOL";
  if (type === "int") return "DINT";
  if (type === "float") return "REAL";
  return "";
}

export function defaultAddressFor(
  driver: ConnectorDriver,
  tag: Pick<LinkPadTag, "name" | "type">,
  index = 0
): Record<string, string | number | boolean> {
  if (driver === "siemens-s7") {
    const dataType = defaultS7DataType(tag.type);
    return {
      area: "DB",
      dbNumber: 1,
      byteOffset: index * 4,
      ...(dataType === "BOOL" ? { bitOffset: 0 } : {}),
      dataType
    };
  }
  return { [getConnectorManifest(driver).addressField]: tag.name };
}
