export type HardwareId = "m5stickc-plus2";

export type RuntimeStatusIndicator = "wifi" | "agent";
export type RuntimeStatusOverlayPlacement = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface RuntimeStatusOverlayConfig {
  enabled: boolean;
  placement: RuntimeStatusOverlayPlacement;
  style: "watermark";
  indicators: RuntimeStatusIndicator[];
}

export type HardwareInputKind = "button" | "encoder" | "key" | "touch";
export type HardwareInputEvent = "press" | "longPress" | "doublePress" | "rotateLeft" | "rotateRight";
export type HardwareDeviceAction = "powerOff";

export interface HardwareInputManifest {
  id: string;
  label: string;
  kind: HardwareInputKind;
  events: HardwareInputEvent[];
  deviceActions: HardwareDeviceAction[];
  configurable: boolean;
  description?: string;
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
  inputs: HardwareInputManifest[];
  network: string[];
  storage: string[];
  capabilities: {
    battery: boolean;
    buzzer: boolean;
    imu: boolean;
    powerOff: boolean;
  };
}

export type ConnectorDriver =
  | "sim"
  | "siemens-s7"
  | "opcua"
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
export type LinkPadValueType = "bool" | "int" | "float" | "string";

export interface ConnectorDataBinding {
  kind: "connector";
  protocolProfileId: string;
  type: LinkPadValueType;
  address: Record<string, string | number | boolean>;
  pollMs: number;
  simulationValue?: TagValue;
  /** Compatibilidade com projetos 0.4.0 anteriores ao Studio 0.7.2. */
  min?: number;
  /** Compatibilidade com projetos 0.4.0 anteriores ao Studio 0.7.2. */
  max?: number;
}

export interface GlobalTagDataBinding {
  kind: "global-tag";
  tagId: string;
}

export type LinkPadDataBinding = ConnectorDataBinding | GlobalTagDataBinding;

export type LinkPadChangeOperation = "set" | "add" | "subtract" | "toggle";

export type LinkPadAction =
  | { type: "navigate"; target: "next" | "previous" | "screen"; screenId?: string }
  | { type: "changeValue"; binding: LinkPadDataBinding; operation: LinkPadChangeOperation; operand?: TagValue; min?: number; max?: number }
  | { type: "activateWidget"; widgetId: string }
  | { type: "powerOff" };

export interface LinkPadInputBinding {
  inputId: string;
  event: HardwareInputEvent;
  action: LinkPadAction;
}

export interface LinkPadTag {
  id: string;
  name: string;
  type: LinkPadValueType;
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
  initialValue?: TagValue;
  retentive?: boolean;
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
  inputBindings: LinkPadInputBinding[];
}

export interface LinkPadWidget {
  id: string;
  type:
    | "static_text"
    | "tag_value"
    | "status_indicator"
    | "boolean_indicator"
    | "gauge"
    | "progress_bar"
    | "write_button";
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  props: Record<string, unknown>;
  editor?: {
    locked: boolean;
    groupId?: string;
  };
}

export interface LinkPadProject {
  schemaVersion: "0.9.0";
  studioVersion: "0.17.1";
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

export type LinkPadActionV8 =
  | Exclude<LinkPadAction, { type: "changeValue" }>
  | { type: "writeTag"; binding: LinkPadDataBinding; value: TagValue; min?: number; max?: number }
  | { type: "toggleTag"; binding: LinkPadDataBinding };

export type LinkPadScreenV8 = Omit<LinkPadScreen, "inputBindings"> & {
  inputBindings: Array<Omit<LinkPadInputBinding, "action"> & { action: LinkPadActionV8 }>;
};

export type LinkPadProjectV8 = Omit<LinkPadProject, "schemaVersion" | "studioVersion" | "screens"> & {
  schemaVersion: "0.8.0";
  studioVersion: string;
  screens: LinkPadScreenV8[];
};

export type LinkPadProjectV7 = Omit<LinkPadProject, "schemaVersion" | "studioVersion"> & {
  schemaVersion: "0.7.0";
  studioVersion: string;
};

export type LinkPadProjectV6 = Omit<LinkPadProject, "schemaVersion" | "studioVersion"> & {
  schemaVersion: "0.6.0";
  studioVersion: string;
};

export type LinkPadProjectV5 = Omit<LinkPadProject, "schemaVersion" | "studioVersion"> & {
  schemaVersion: "0.5.0";
  studioVersion: string;
};

export type LinkPadProjectV4 = Omit<LinkPadProject, "schemaVersion" | "studioVersion" | "tags"> & {
  schemaVersion: "0.4.0";
  studioVersion: string;
  tags: Array<Omit<LinkPadTag, "initialValue" | "retentive"> & {
    initialValue?: TagValue;
    retentive?: boolean;
  }>;
};

export type LegacyLinkPadAction =
  | { type: "navigate"; target: "next" | "previous" | "screen"; screenId?: string }
  | { type: "writeTag"; tag: string; value: TagValue }
  | { type: "toggleTag"; tag: string }
  | { type: "activateWidget"; widgetId: string };

export interface LinkPadInputBindingV3 {
  inputId: string;
  event: HardwareInputEvent;
  action: LegacyLinkPadAction | LinkPadAction;
}

export type LinkPadScreenV3 = Omit<LinkPadScreen, "widgets" | "inputBindings"> & {
  widgets: LinkPadWidget[];
  inputBindings: LinkPadInputBindingV3[];
};

export type LinkPadProjectV3 = Omit<LinkPadProject, "schemaVersion" | "studioVersion" | "tags" | "screens"> & {
  schemaVersion: "0.3.0";
  studioVersion: string;
  tags: Array<Omit<LinkPadTag, "id"> & { id?: string }>;
  screens: LinkPadScreenV3[];
};

export type LinkPadScreenV2 = Omit<LinkPadScreenV3, "inputBindings"> & {
  inputBindings?: LinkPadInputBindingV3[];
};

export type LinkPadProjectV2 = Omit<LinkPadProject, "schemaVersion" | "studioVersion" | "tags" | "screens"> & {
  schemaVersion: "0.2.0";
  studioVersion: string;
  tags: Array<Omit<LinkPadTag, "id"> & { id?: string }>;
  screens: LinkPadScreenV2[];
};

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
  tags?: Array<Omit<LinkPadTag, "id" | "protocolProfileId" | "address"> & { id?: string }>;
  screens?: LinkPadScreenV2[];
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
  | "communication"
  | "connectors"
  | "tags"
  | "screen"
  | "build"
  | "diagnostics";

export interface WorkspaceTab {
  id: string;
  title: string;
  kind: WorkspaceTabKind;
  refId?: string;
  dirty?: boolean;
}
