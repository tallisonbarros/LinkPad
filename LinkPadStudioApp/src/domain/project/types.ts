export type HardwareId = "m5stickc-plus2";

export type RuntimeStatusIndicator = "wifi" | "agent";
export type RuntimeStatusOverlayPlacement = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface RuntimeStatusOverlayConfig {
  enabled: boolean;
  placement: RuntimeStatusOverlayPlacement;
  style: "watermark";
  indicators: RuntimeStatusIndicator[];
}

export interface HardwareManifest {
  id: HardwareId;
  name: string;
  family: string;
  runtime: string;
  display: {
    width: number;
    height: number;
    touch: boolean;
    color: boolean;
    statusOverlay: RuntimeStatusOverlayConfig;
  };
  inputs: string[];
  network: string[];
  storage: string[];
  capabilities: {
    battery: boolean;
    buzzer: boolean;
    imu: boolean;
  };
}

export type ConnectorDriver =
  | "sim"
  | "siemens-s7"
  | "siemens-opcua"
  | "rockwell-logix"
  | "modbus-tcp"
  | "profinet-io";

export interface ProtocolProfile {
  id: string;
  name: string;
  driver: ConnectorDriver;
  endpoint: string;
  enabled: boolean;
  options: Record<string, string | number | boolean>;
  auth?: Record<string, string>;
}

export type TagValue = string | number | boolean;

export interface LinkPadTag {
  name: string;
  type: "bool" | "int" | "float" | "string";
  direction: "read" | "write" | "readWrite";
  source: "agent" | "internal" | "system" | "simulated";
  protocolProfileId?: string;
  address?: Record<string, string | number | boolean>;
  agentTag?: string;
  unit?: string;
  pollMs?: number;
  format?: string;
  min?: number;
  max?: number;
  scale?: number;
  offset?: number;
  simulationValue?: TagValue;
  write?: {
    mode: "immediate" | "debounced";
    debounceMs: number;
    confirm: boolean;
  };
  quality: "good" | "bad" | "stale" | "offline" | "unknown";
}

export interface LinkPadScreen {
  id: string;
  name: string;
  width: number;
  height: number;
  widgets: LinkPadWidget[];
}

export interface LinkPadWidget {
  id: string;
  type:
    | "static_text"
    | "tag_value"
    | "status_indicator"
    | "boolean_indicator"
    | "write_button";
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  props: Record<string, string | number | boolean>;
}

export interface LinkPadProject {
  schemaVersion: "0.2.0";
  studioVersion: "0.5.1";
  projectId: string;
  name: string;
  description: string;
  folderPath: string;
  createdAt: string;
  updatedAt: string;
  hardware: {
    hardwareId: HardwareId;
    runtime: string;
    orientation: "landscape" | "portrait";
    statusOverlay: RuntimeStatusOverlayConfig;
  };
  network: {
    mode: "wifi";
    ssid: string;
    password: string;
  };
  agent: {
    mode: "http";
    host: string;
    port: number;
    timeoutMs: number;
    pollMs: number;
    token: string;
    protocolVersion: "0.1.0";
  };
  protocols: ProtocolProfile[];
  tags: LinkPadTag[];
  screens: LinkPadScreen[];
  assets: {
    fonts: string[];
    images: string[];
  };
  build: {
    serialPort: string;
    baudRate: number;
  };
}

export interface LinkPadProjectV1 {
  schemaVersion: "0.1.0";
  studioVersion: string;
  projectId: string;
  name: string;
  description?: string;
  folderPath?: string;
  createdAt?: string;
  updatedAt?: string;
  hardware: Omit<LinkPadProject["hardware"], "statusOverlay"> & {
    statusOverlay?: RuntimeStatusOverlayConfig;
  };
  agent: Omit<LinkPadProject["agent"], "protocolVersion">;
  tags?: Array<Omit<LinkPadTag, "protocolProfileId" | "address">>;
  screens?: LinkPadScreen[];
  assets?: LinkPadProject["assets"];
}

export interface RecentProject {
  projectId: string;
  name: string;
  folderPath: string;
  hardwareId: HardwareId;
  openedAt: string;
  snapshot: LinkPadProject;
}

export type WorkspaceTabKind =
  | "overview"
  | "device"
  | "communication"
  | "connectors"
  | "tags"
  | "screen"
  | "assets"
  | "build"
  | "diagnostics";

export interface WorkspaceTab {
  id: string;
  title: string;
  kind: WorkspaceTabKind;
  refId?: string;
  dirty?: boolean;
}
