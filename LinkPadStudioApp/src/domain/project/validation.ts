import { getConnectorManifest } from "../../data/connectorCatalog";
import { getHardwareManifest, inputSupportsDeviceAction } from "../../data/hardwareCatalog";
import { bindingFrom, globalTagForBinding, tagSupportsAccess, valueTypeForBinding, type DataBindingAccess } from "./dataBindings";
import type {
  LinkPadDataBinding,
  LinkPadInputBinding,
  LinkPadProject,
  LinkPadScreen,
  LinkPadTag,
  LinkPadValueType,
  ProtocolProfile
} from "./types";

export interface ValidationIssue {
  path: string;
  message: string;
  severity: "error" | "warning";
}

const allValueTypes: LinkPadValueType[] = ["bool", "int", "float", "string"];

export function validateProjectForBuild(project: LinkPadProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const enabledProfileIds = new Set(project.protocols.filter((profile) => profile.enabled).map((profile) => profile.id));
  const tagNames = new Set<string>();
  const tagIds = new Set<string>();
  const hardware = getHardwareManifest(project.hardware.hardwareId);

  if (!project.network.ssid.trim()) {
    issues.push({ path: "network.ssid", message: "Informe a rede Wi-Fi do device.", severity: "error" });
  }
  if (!project.agent.host.trim()) {
    issues.push({ path: "agent.host", message: "Informe o endereço do Agente LinkPad em Rede LinkPad.", severity: "error" });
  }
  if (project.protocols.length === 0) {
    issues.push({ path: "protocols", message: "Adicione ao menos um PLC ou simulador em Comunicações.", severity: "error" });
  }
  const enabledProfiles = project.protocols.filter((profile) => profile.enabled);
  if (enabledProfiles.length === 0) {
    issues.push({ path: "protocols", message: "Ative ao menos uma comunicação com PLC ou simulador.", severity: "error" });
  }
  if (enabledProfiles.some((profile) => !["sim", "siemens-s7", "opcua"].includes(profile.driver))) {
    issues.push({ path: "protocols", message: "O firmware MVP suporta simulação, Siemens S7 nativo e OPC UA.", severity: "error" });
  }
  const profileIds = new Set<string>();
  for (const profile of project.protocols) {
    if (!profile.id.trim()) {
      issues.push({ path: "protocols", message: "Toda comunicação precisa de um identificador interno.", severity: "error" });
    } else if (profileIds.has(profile.id)) {
      issues.push({ path: `protocols.${profile.id}`, message: "Identificador de comunicação duplicado.", severity: "error" });
    }
    profileIds.add(profile.id);
    if (!profile.name.trim()) {
      issues.push({ path: `protocols.${profile.id}.name`, message: "Informe o nome do PLC ou simulador.", severity: "error" });
    }
  }
  for (const profile of enabledProfiles) {
    if (profile.driver === "siemens-s7") issues.push(...validateS7Profile(profile));
    if (profile.driver === "opcua") issues.push(...validateOpcUaProfile(profile));
  }

  for (const tag of project.tags) {
    if (!tag.id.trim()) {
      issues.push({ path: `tags.${tag.name}.id`, message: "A Tag global precisa de um identificador.", severity: "error" });
    } else if (tagIds.has(tag.id)) {
      issues.push({ path: `tags.${tag.name}.id`, message: "Identificador de Tag global duplicado.", severity: "error" });
    }
    tagIds.add(tag.id);
    if (tagNames.has(tag.name)) {
      issues.push({ path: `tags.${tag.name}`, message: "Nome de Tag global duplicado.", severity: "error" });
    }
    tagNames.add(tag.name);
    issues.push(...validateTag(project, tag));
    if (tag.protocolProfileId && !enabledProfileIds.has(tag.protocolProfileId)) {
      issues.push({
        path: `tags.${tag.name}.protocolProfileId`,
        message: "A Tag global referencia um PLC ou simulador ausente ou pausado.",
        severity: "error"
      });
    }
  }

  const knownScreenIds = new Set(project.screens.map((screen) => screen.id));
  const hardwareInputs = new Map(hardware.inputs.map((input) => [input.id, input]));
  for (const screen of project.screens) {
    for (const widget of screen.widgets) {
      const widgetPath = `screens.${screen.id}.${widget.id}`;
      if (widget.x < 0 || widget.y < 0 || widget.x + widget.width > screen.width || widget.y + widget.height > screen.height) {
        issues.push({ path: widgetPath, message: "Widget fora dos limites da tela.", severity: "error" });
      }
      const fontSize = widget.props.fontSize;
      if (fontSize !== undefined && (typeof fontSize !== "number" || !Number.isFinite(fontSize) || fontSize < 6 || fontSize > 32)) {
        issues.push({ path: `${widgetPath}.fontSize`, message: "Tamanho de fonte deve ficar entre 6 e 32 px logicos.", severity: "error" });
      }
      for (const colorProperty of ["color", "backgroundColor", "borderColor"] as const) {
        const color = widget.props[colorProperty];
        if (color !== undefined && (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color))) {
          issues.push({ path: `${widgetPath}.${colorProperty}`, message: "Cor do widget deve usar o formato hexadecimal #RRGGBB.", severity: "error" });
        }
      }
      for (const [property, minimum, maximum] of [
        ["padding", 0, 20],
        ["borderWidth", 0, 8],
        ["borderRadius", 0, 20]
      ] as const) {
        const value = widget.props[property];
        if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum)) {
          issues.push({ path: `${widgetPath}.${property}`, message: `${property} deve ficar entre ${minimum} e ${maximum} px lógicos.`, severity: "error" });
        }
      }
      if (widget.props.textAlign !== undefined && !["left", "center", "right"].includes(String(widget.props.textAlign))) {
        issues.push({ path: `${widgetPath}.textAlign`, message: "Alinhamento horizontal inválido.", severity: "error" });
      }
      if (widget.props.verticalAlign !== undefined && !["top", "middle", "bottom"].includes(String(widget.props.verticalAlign))) {
        issues.push({ path: `${widgetPath}.verticalAlign`, message: "Alinhamento vertical inválido.", severity: "error" });
      }
      const binding = bindingFrom(widget.props.binding);
      if (widget.type === "tag_value") {
        issues.push(...validateDataBinding(project, binding, `${widgetPath}.binding`, "read", allValueTypes));
      } else if (widget.type === "boolean_indicator") {
        issues.push(...validateDataBinding(project, binding, `${widgetPath}.binding`, "read", ["bool"]));
      } else if (widget.type === "gauge" || widget.type === "progress_bar") {
        issues.push(...validateDataBinding(project, binding, `${widgetPath}.binding`, "read", ["int", "float"]));
        const minimum = numericProperty(widget.props.min);
        const maximum = numericProperty(widget.props.max);
        if (minimum === undefined || maximum === undefined || minimum >= maximum) {
          issues.push({ path: `${widgetPath}.range`, message: "O intervalo visual exige mínimo menor que máximo.", severity: "error" });
        }
      } else if (widget.type === "write_button") {
        issues.push(...validateDataBinding(project, binding, `${widgetPath}.binding`, "write", allValueTypes));
        const minimum = numericProperty(widget.props.min);
        const maximum = numericProperty(widget.props.max);
        issues.push(...validateWriteLimits(project, binding, minimum, maximum, `${widgetPath}.limits`));
        if (binding && !isCompatibleBindingValue(project, widget.props.value, binding, minimum, maximum)) {
          issues.push({ path: `${widgetPath}.value`, message: "O valor do botão não é compatível com o dado selecionado.", severity: "error" });
        }
      }
    }
    for (const [bindingIndex, binding] of screen.inputBindings.entries()) {
      const bindingPath = `screens.${screen.id}.inputBindings.${binding.inputId}.${binding.event}.${bindingIndex}`;
      const input = hardwareInputs.get(binding.inputId);
      if (!input) {
        issues.push({ path: bindingPath, message: "O controle não existe no hardware selecionado.", severity: "error" });
        continue;
      }
      if (!input.configurable) {
        issues.push({ path: bindingPath, message: "O controle está reservado pelo hardware/runtime.", severity: "error" });
      } else if (!input.events.includes(binding.event)) {
        issues.push({ path: bindingPath, message: "O evento não é suportado por este controle.", severity: "error" });
      }
      issues.push(...validateInputAction(
        project,
        binding,
        screen,
        knownScreenIds,
        bindingPath,
        inputSupportsDeviceAction(hardware, input, "powerOff")
      ));
      if (binding.action.type === "powerOff" && screen.inputBindings.slice(bindingIndex + 1).some((candidate) => candidate.inputId === binding.inputId && candidate.event === binding.event)) {
        issues.push({ path: bindingPath, message: "Desligar deve ser a última ação deste evento; ações posteriores não serão executadas.", severity: "warning" });
      }
    }
  }

  issues.push(...validateDirectBindingConflicts(project));

  if (project.screens.length === 0) {
    issues.push({ path: "screens", message: "Crie ao menos uma tela.", severity: "error" });
  } else if (project.screens.every((screen) => screen.widgets.length === 0)) {
    issues.push({ path: "screens", message: "O firmware será gerado sem widgets.", severity: "warning" });
  }

  if (project.network.password) {
    issues.push({ path: "network.password", message: "A senha Wi-Fi será incorporada ao firmware do MVP.", severity: "warning" });
  }
  if (project.agent.token) {
    issues.push({ path: "agent.token", message: "O token do Agente LinkPad será incorporado ao firmware.", severity: "warning" });
  }

  return issues;
}

function validateInputAction(
  project: LinkPadProject,
  binding: LinkPadInputBinding,
  screen: LinkPadScreen,
  knownScreenIds: Set<string>,
  path: string,
  powerOffAllowed: boolean
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const action = binding.action;
  if (action.type === "navigate") {
    if (!(["next", "previous", "screen"] as const).includes(action.target)) {
      issues.push({ path: `${path}.action`, message: "Destino de navegação inválido.", severity: "error" });
    } else if (action.target === "screen" && (!action.screenId || !knownScreenIds.has(action.screenId))) {
      issues.push({ path: `${path}.action.screenId`, message: "A ação referencia uma tela inexistente.", severity: "error" });
    }
    return issues;
  }
  if (action.type === "activateWidget") {
    const widget = screen.widgets.find((item) => item.id === action.widgetId);
    if (!widget || widget.type !== "write_button") {
      issues.push({ path: `${path}.action.widgetId`, message: "Selecione um widget de escrita existente nesta tela.", severity: "error" });
    }
    return issues;
  }
  if (action.type === "changeValue") {
    const valueType = valueTypeForBinding(project, action.binding);
    const operationTypes = {
      set: allValueTypes,
      add: ["int", "float"],
      subtract: ["int", "float"],
      toggle: ["bool"]
    } satisfies Record<typeof action.operation, LinkPadValueType[]>;
    if (!(["set", "add", "subtract", "toggle"] as const).includes(action.operation)) {
      issues.push({ path: `${path}.action.operation`, message: "Selecione uma operação válida para alterar o valor.", severity: "error" });
      return issues;
    }
    const access = action.operation === "set" ? "write" : "readWrite";
    issues.push(...validateDataBinding(project, action.binding, `${path}.action.binding`, access, operationTypes[action.operation]));
    if (valueType === "int" || valueType === "float") {
      issues.push(...validateWriteLimits(project, action.binding, action.min, action.max, `${path}.action.limits`));
    }
    if (action.operation !== "toggle") {
      const minimum = action.operation === "set" ? action.min : undefined;
      const maximum = action.operation === "set" ? action.max : undefined;
      if (!isCompatibleBindingValue(project, action.operand, action.binding, minimum, maximum)) {
        issues.push({ path: `${path}.action.operand`, message: "O valor da operação não é compatível com o dado selecionado.", severity: "error" });
      }
    }
    return issues;
  }
  if (action.type === "powerOff") {
    if (!powerOffAllowed) {
      issues.push({ path: `${path}.action`, message: "A ação Desligar não é permitida neste controle pelo manifesto do hardware.", severity: "error" });
    }
    return issues;
  }
  issues.push({ path: `${path}.action`, message: `Tipo de ação não suportado: ${String((action as { type?: unknown }).type ?? "ausente")}.`, severity: "error" });
  return issues;
}

export function validateDataBinding(
  project: LinkPadProject,
  binding: LinkPadDataBinding | undefined,
  path: string,
  access: DataBindingAccess,
  acceptedTypes: LinkPadValueType[]
): ValidationIssue[] {
  if (!binding) return [{ path, message: "Selecione o dado utilizado.", severity: "error" }];
  if (binding.kind === "global-tag") {
    const tag = globalTagForBinding(project, binding);
    if (!tag) return [{ path, message: "A Tag global selecionada não existe.", severity: "error" }];
    const issues: ValidationIssue[] = [];
    if (!tagSupportsAccess(tag, access)) {
      issues.push({ path, message: access === "read" ? "A Tag global não permite leitura." : "A Tag global não permite esta escrita.", severity: "error" });
    }
    if (!acceptedTypes.includes(tag.type)) {
      issues.push({ path, message: `O tipo ${tag.type} não é aceito neste uso.`, severity: "error" });
    }
    return issues;
  }

  const issues: ValidationIssue[] = [];
  const profile = project.protocols.find((item) => item.id === binding.protocolProfileId);
  if (!profile || !profile.enabled) {
    issues.push({ path: `${path}.protocolProfileId`, message: "Selecione um PLC ou simulador ativo.", severity: "error" });
    return issues;
  }
  if (!acceptedTypes.includes(binding.type)) {
    issues.push({ path: `${path}.type`, message: `O tipo ${binding.type} não é aceito neste uso.`, severity: "error" });
  }
  if (!binding.address || Object.keys(binding.address).length === 0) {
    issues.push({ path: `${path}.address`, message: "Informe o endereço do dado.", severity: "error" });
  } else if (profile.driver === "siemens-s7") {
    issues.push(...validateS7Descriptor(binding.address, binding.type, `${path}.address`));
  } else if (profile.driver === "opcua") {
    issues.push(...validateOpcUaDescriptor(binding.address, `${path}.address`));
  } else {
    const field = getConnectorManifest(profile.driver).addressField;
    if (!String(binding.address[field] ?? "").trim()) {
      issues.push({ path: `${path}.address.${field}`, message: "Informe o endereço do dado.", severity: "error" });
    }
  }
  if (access !== "write" && (!Number.isInteger(binding.pollMs) || binding.pollMs < 100)) {
    issues.push({ path: `${path}.pollMs`, message: "A atualização deve ser um inteiro a partir de 100 ms.", severity: "error" });
  }
  return issues;
}

function validateWriteLimits(
  project: LinkPadProject,
  binding: LinkPadDataBinding | undefined,
  minimum: number | undefined,
  maximum: number | undefined,
  path: string
): ValidationIssue[] {
  const type = valueTypeForBinding(project, binding);
  if (type !== "int" && type !== "float") return [];
  if (minimum === undefined || maximum === undefined) {
    return [{ path, message: "Configure mínimo e máximo no widget ou na ação de escrita.", severity: "error" }];
  }
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum >= maximum) {
    return [{ path, message: "O mínimo de escrita deve ser menor que o máximo.", severity: "error" }];
  }
  return [];
}

function isCompatibleBindingValue(
  project: LinkPadProject,
  value: unknown,
  binding: LinkPadDataBinding,
  minimum?: number,
  maximum?: number
) {
  const type = valueTypeForBinding(project, binding);
  return isCompatibleValue(value, type, minimum, maximum);
}

function isCompatibleValue(value: unknown, type?: LinkPadValueType, minimum?: number, maximum?: number) {
  if (type === "bool") return typeof value === "boolean";
  if (type === "string") return typeof value === "string";
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  if (type === "int" && !Number.isInteger(value)) return false;
  if (minimum !== undefined && value < minimum) return false;
  if (maximum !== undefined && value > maximum) return false;
  return type === "int" || type === "float";
}

export function validateTag(project: LinkPadProject, tag: LinkPadTag): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!tag.name.trim()) {
    issues.push({ path: "tag.name", message: "Informe o nome da Tag global.", severity: "error" });
  }
  if (tag.source === "agent" || tag.source === "simulated") {
    if (!tag.protocolProfileId) {
      issues.push({ path: `tags.${tag.name}.protocolProfileId`, message: "Selecione um PLC ou simulador.", severity: "error" });
    }
    if (!tag.address || Object.keys(tag.address).length === 0) {
      issues.push({ path: `tags.${tag.name}.address`, message: "Informe o endereço da Tag global.", severity: "error" });
    }
  }
  if (tag.source === "internal") {
    if (!isCompatibleValue(tag.initialValue, tag.type)) {
      issues.push({ path: `tags.${tag.name}.initialValue`, message: "Informe um valor inicial compatível com o tipo da Tag interna.", severity: "error" });
    }
    if (tag.direction === "write") {
      issues.push({ path: `tags.${tag.name}.direction`, message: "Tag interna deve permitir leitura.", severity: "error" });
    }
    if (tag.protocolProfileId || (tag.address && Object.keys(tag.address).length > 0)) {
      issues.push({ path: `tags.${tag.name}.source`, message: "Tag interna não pode possuir comunicação ou endereço industrial.", severity: "error" });
    }
  } else if (tag.retentive === true) {
    issues.push({ path: `tags.${tag.name}.retentive`, message: "Retentiva é um atributo exclusivo de Tag interna.", severity: "error" });
  }
  const profile = project.protocols.find((item) => item.id === tag.protocolProfileId);
  if (profile?.driver === "siemens-s7") {
    issues.push(...validateS7Descriptor(tag.address ?? {}, tag.type, `tags.${tag.name}.address`));
  } else if (profile?.driver === "opcua") {
    issues.push(...validateOpcUaDescriptor(tag.address ?? {}, `tags.${tag.name}.address`));
  }
  return issues;
}

function numericProperty(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function validateS7Profile(profile: ProtocolProfile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const endpoint = /^s7:\/\/(\d{1,3}(?:\.\d{1,3}){3})(?::(\d+))?\/?$/i.exec(profile.endpoint.trim());
  const octets = endpoint?.[1].split(".").map(Number) ?? [];
  const validIpv4 = octets.length === 4 && octets.every((octet) => octet >= 0 && octet <= 255);
  const isPrivate = validIpv4 && (
    octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168)
  );
  if (!endpoint || !isPrivate || (endpoint[2] !== undefined && endpoint[2] !== "102")) {
    issues.push({ path: `protocols.${profile.id}.endpoint`, message: "Use um IPv4 privado no formato s7://192.168.0.10:102.", severity: "error" });
  }

  const ranges: Array<[string, number, number, number]> = [
    ["rack", Number(profile.options.rack ?? 0), 0, 7],
    ["slot", Number(profile.options.slot ?? 1), 0, 31],
    ["timeoutMs", Number(profile.options.timeoutMs ?? 2000), 100, 30000]
  ];
  for (const [name, value, minimum, maximum] of ranges) {
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      issues.push({ path: `protocols.${profile.id}.options.${name}`, message: `${name} deve ser inteiro entre ${minimum} e ${maximum}.`, severity: "error" });
    }
  }
  return issues;
}

function validateOpcUaProfile(profile: ProtocolProfile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const endpoint = /^opc\.tcp:\/\/(\d{1,3}(?:\.\d{1,3}){3})(?::(\d+))?(?:\/[^?#]*)?$/i.exec(profile.endpoint.trim());
  const octets = endpoint?.[1].split(".").map(Number) ?? [];
  const validIpv4 = octets.length === 4 && octets.every((octet) => octet >= 0 && octet <= 255);
  const isPrivate = validIpv4 && (
    octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168)
  );
  if (!endpoint || !isPrivate || (endpoint[2] !== undefined && endpoint[2] !== "4840")) {
    issues.push({ path: `protocols.${profile.id}.endpoint`, message: "Use um IPv4 privado no formato opc.tcp://192.168.0.10:4840.", severity: "error" });
  }
  const securityPolicy = String(profile.options.securityPolicy ?? "None");
  const securityMode = String(profile.options.securityMode ?? "None");
  if (!["none", "nosecurity"].includes(securityPolicy.toLowerCase()) || securityMode.toLowerCase() !== "none") {
    issues.push({ path: `protocols.${profile.id}.options.security`, message: "O MVP aceita somente SecurityPolicy None e SecurityMode None.", severity: "error" });
  } else {
    issues.push({ path: `protocols.${profile.id}.options.security`, message: "OPC UA sem criptografia deve ser usado somente em rede de laboratório isolada.", severity: "warning" });
  }
  if (profile.auth && (Object.keys(profile.auth).some((key) => key !== "mode") || String(profile.auth.mode ?? "anonymous").toLowerCase() !== "anonymous")) {
    issues.push({ path: `protocols.${profile.id}.auth`, message: "O MVP aceita somente autenticação OPC UA anônima.", severity: "error" });
  }
  const ranges: Array<[string, number, number, number]> = [
    ["sessionTimeoutMs", Number(profile.options.sessionTimeoutMs ?? 30000), 1000, 3_600_000],
    ["requestTimeoutMs", Number(profile.options.requestTimeoutMs ?? 2000), 100, 30000]
  ];
  for (const [name, value, minimum, maximum] of ranges) {
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      issues.push({ path: `protocols.${profile.id}.options.${name}`, message: `${name} deve ser inteiro entre ${minimum} e ${maximum}.`, severity: "error" });
    }
  }
  return issues;
}

function validateOpcUaDescriptor(
  address: Record<string, string | number | boolean>,
  prefix: string
): ValidationIssue[] {
  const nodeId = typeof address.nodeId === "string" ? address.nodeId.trim() : "";
  const nodeIdPattern = /^(?:(?:ns=\d+|nsu=.+);)?(?:i=\d+|s=.+|g=[0-9a-f-]{36}|b=[A-Za-z0-9+/=]+)$/i;
  if (!nodeId || nodeId.length > 1024 || !nodeIdPattern.test(nodeId)) {
    return [{ path: `${prefix}.nodeId`, message: "Informe um Node ID OPC UA válido, como ns=3;s=Motor.Speed.", severity: "error" }];
  }
  if (Object.keys(address).some((field) => field !== "nodeId")) {
    return [{ path: prefix, message: "O endereço OPC UA deve conter somente nodeId.", severity: "error" }];
  }
  return [];
}

function validateS7Descriptor(
  address: Record<string, string | number | boolean>,
  type: LinkPadValueType,
  prefix: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const dataType = String(address.dataType ?? "").toUpperCase();
  const compatibility: Record<string, LinkPadValueType> = { BOOL: "bool", INT: "int", DINT: "int", REAL: "float" };

  if (address.area !== "DB") {
    issues.push({ path: `${prefix}.area`, message: "O MVP S7 aceita somente a área DB.", severity: "error" });
  }
  if (!isIntegerInRange(address.dbNumber, 1, 65535)) {
    issues.push({ path: `${prefix}.dbNumber`, message: "DB deve ser inteiro entre 1 e 65535.", severity: "error" });
  }
  if (!isIntegerInRange(address.byteOffset, 0, 2_147_483_647)) {
    issues.push({ path: `${prefix}.byteOffset`, message: "Byte deve ser um inteiro não negativo.", severity: "error" });
  }
  if (!(dataType in compatibility)) {
    issues.push({ path: `${prefix}.dataType`, message: "Selecione BOOL, INT, DINT ou REAL.", severity: "error" });
  } else if (compatibility[dataType] !== type) {
    issues.push({ path: `${prefix}.dataType`, message: `${dataType} não é compatível com ${type}.`, severity: "error" });
  }
  if (dataType === "BOOL" && !isIntegerInRange(address.bitOffset, 0, 7)) {
    issues.push({ path: `${prefix}.bitOffset`, message: "Bit deve ser inteiro entre 0 e 7.", severity: "error" });
  }
  if (type === "string") {
    issues.push({ path: `${prefix}.dataType`, message: "String ainda não é suportada pela comunicação Siemens S7 do MVP.", severity: "error" });
  }
  return issues;
}

function validateDirectBindingConflicts(project: LinkPadProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, { type: LinkPadValueType; path: string }>();
  const visit = (binding: LinkPadDataBinding | undefined, path: string) => {
    if (binding?.kind !== "connector") return;
    const key = `${binding.protocolProfileId}:${stableAddress(binding.address)}`;
    const previous = seen.get(key);
    if (previous && previous.type !== binding.type) {
      issues.push({ path, message: `O mesmo endereço foi declarado como ${previous.type} e ${binding.type}.`, severity: "error" });
    } else if (!previous) seen.set(key, { type: binding.type, path });
  };
  for (const screen of project.screens) {
    for (const widget of screen.widgets) visit(bindingFrom(widget.props.binding), `screens.${screen.id}.${widget.id}.binding`);
    for (const inputBinding of screen.inputBindings) {
      const action = inputBinding.action;
      if (action.type === "changeValue") {
        visit(action.binding, `screens.${screen.id}.inputBindings.${inputBinding.inputId}.${inputBinding.event}.binding`);
      }
    }
  }
  return issues;
}

function stableAddress(address: Record<string, string | number | boolean>) {
  return Object.keys(address).sort().map((key) => `${key}=${String(address[key])}`).join("&");
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}
