import { getHardwareManifest } from "../../data/hardwareCatalog";
import type { LinkPadInputBinding, LinkPadProject, LinkPadScreen, LinkPadTag, ProtocolProfile, TagValue } from "./types";

export interface ValidationIssue {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export function validateProjectForBuild(project: LinkPadProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const enabledProfileIds = new Set(project.protocols.filter((profile) => profile.enabled).map((profile) => profile.id));
  const tagNames = new Set<string>();
  const hardware = getHardwareManifest(project.hardware.hardwareId);

  if (!project.network.ssid.trim()) {
    issues.push({ path: "network.ssid", message: "Informe a rede Wi-Fi do device.", severity: "error" });
  }
  if (!project.agent.host.trim()) {
    issues.push({ path: "agent.host", message: "Informe o host do LinkPad Agent.", severity: "error" });
  }
  if (project.protocols.length === 0) {
    issues.push({ path: "protocols", message: "Crie ao menos um conector.", severity: "error" });
  }
  const enabledProfiles = project.protocols.filter((profile) => profile.enabled);
  if (enabledProfiles.length === 0) {
    issues.push({ path: "protocols", message: "Habilite ao menos um conector.", severity: "error" });
  }
  if (enabledProfiles.some((profile) => !["sim", "siemens-s7"].includes(profile.driver))) {
    issues.push({ path: "protocols", message: "O firmware MVP suporta somente simulação e Siemens S7 nativo.", severity: "error" });
  }
  const profileIds = new Set<string>();
  for (const profile of project.protocols) {
    if (!profile.id.trim()) {
      issues.push({ path: "protocols", message: "Todo conector precisa de um identificador.", severity: "error" });
    } else if (profileIds.has(profile.id)) {
      issues.push({ path: `protocols.${profile.id}`, message: "Identificador de conector duplicado.", severity: "error" });
    }
    profileIds.add(profile.id);
    if (!profile.name.trim()) {
      issues.push({ path: `protocols.${profile.id}.name`, message: "Informe o nome do conector.", severity: "error" });
    }
  }
  for (const profile of enabledProfiles) {
    if (profile.driver === "siemens-s7") issues.push(...validateS7Profile(profile));
  }

  for (const tag of project.tags) {
    if (tagNames.has(tag.name)) {
      issues.push({ path: `tags.${tag.name}`, message: "Nome de tag duplicado.", severity: "error" });
    }
    tagNames.add(tag.name);
    issues.push(...validateTag(project, tag));
    if (tag.protocolProfileId && !enabledProfileIds.has(tag.protocolProfileId)) {
      issues.push({
        path: `tags.${tag.name}.protocolProfileId`,
        message: "A tag referencia um conector ausente ou desabilitado.",
        severity: "error"
      });
    }
  }

  const knownTags = new Map(project.tags.map((tag) => [tag.name, tag]));
  const knownScreenIds = new Set(project.screens.map((screen) => screen.id));
  const hardwareInputs = new Map(hardware.inputs.map((input) => [input.id, input]));
  for (const screen of project.screens) {
    for (const widget of screen.widgets) {
      if (widget.x < 0 || widget.y < 0 || widget.x + widget.width > screen.width || widget.y + widget.height > screen.height) {
        issues.push({ path: `screens.${screen.id}.${widget.id}`, message: "Widget fora dos limites da tela.", severity: "error" });
      }
      const referencedTag = typeof widget.props.tag === "string" ? widget.props.tag : "";
      if (referencedTag && !knownTags.has(referencedTag)) {
        issues.push({ path: `screens.${screen.id}.${widget.id}.tag`, message: "Widget referencia uma tag inexistente.", severity: "error" });
      }
      if (widget.type === "write_button" && referencedTag && knownTags.get(referencedTag)?.direction === "read") {
        issues.push({ path: `screens.${screen.id}.${widget.id}.tag`, message: "Botão de escrita referencia uma tag somente leitura.", severity: "error" });
      }
    }
    const bindingKeys = new Set<string>();
    for (const binding of screen.inputBindings) {
      const bindingPath = `screens.${screen.id}.inputBindings.${binding.inputId}.${binding.event}`;
      const bindingKey = `${binding.inputId}:${binding.event}`;
      if (bindingKeys.has(bindingKey)) {
        issues.push({ path: bindingPath, message: "O controle possui mais de uma ação para o mesmo evento.", severity: "error" });
      }
      bindingKeys.add(bindingKey);
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
      issues.push(...validateInputAction(binding, screen, knownScreenIds, knownTags, bindingPath));
    }
  }

  if (project.screens.length === 0) {
    issues.push({ path: "screens", message: "Crie ao menos uma tela.", severity: "error" });
  } else if (project.screens.every((screen) => screen.widgets.length === 0)) {
    issues.push({ path: "screens", message: "O firmware será gerado sem widgets.", severity: "warning" });
  }

  if (project.network.password) {
    issues.push({
      path: "network.password",
      message: "A senha Wi-Fi será incorporada ao firmware do MVP.",
      severity: "warning"
    });
  }
  if (project.agent.token) {
    issues.push({
      path: "agent.token",
      message: "O token do Agent será incorporado ao firmware.",
      severity: "warning"
    });
  }

  return issues;
}

function validateInputAction(
  binding: LinkPadInputBinding,
  screen: LinkPadScreen,
  knownScreenIds: Set<string>,
  knownTags: Map<string, LinkPadTag>,
  path: string
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
  if (action.type === "writeTag" || action.type === "toggleTag") {
    const tag = knownTags.get(action.tag);
    if (!tag) {
      issues.push({ path: `${path}.action.tag`, message: "A ação referencia uma tag inexistente.", severity: "error" });
      return issues;
    }
    if (tag.direction === "read") {
      issues.push({ path: `${path}.action.tag`, message: "A ação não pode escrever em uma tag somente leitura.", severity: "error" });
    }
    if (action.type === "toggleTag" && (tag.type !== "bool" || tag.direction !== "readWrite")) {
      issues.push({ path: `${path}.action.tag`, message: "Alternar exige uma tag booleana de leitura e escrita.", severity: "error" });
    }
    if (action.type === "writeTag" && !isCompatibleActionValue(action.value, tag)) {
      issues.push({ path: `${path}.action.value`, message: "O valor da ação não é compatível com o tipo ou limite da tag.", severity: "error" });
    }
    return issues;
  }
  issues.push({ path: `${path}.action`, message: `Tipo de ação não suportado: ${String((action as { type?: unknown }).type ?? "ausente")}.`, severity: "error" });
  return issues;
}

function isCompatibleActionValue(value: TagValue, tag: LinkPadTag) {
  if (tag.type === "bool") return typeof value === "boolean";
  if (tag.type === "string") return typeof value === "string";
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  if (tag.type === "int" && !Number.isInteger(value)) return false;
  if (tag.min !== undefined && value < tag.min) return false;
  if (tag.max !== undefined && value > tag.max) return false;
  return true;
}

export function validateTag(project: LinkPadProject, tag: LinkPadTag): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!tag.name.trim()) {
    issues.push({ path: "tag.name", message: "Informe o nome da tag.", severity: "error" });
  }
  if (tag.source === "agent" || tag.source === "simulated") {
    if (!tag.protocolProfileId) {
      issues.push({ path: `tags.${tag.name}.protocolProfileId`, message: "Selecione um conector.", severity: "error" });
    }
    if (!tag.address || Object.keys(tag.address).length === 0) {
      issues.push({ path: `tags.${tag.name}.address`, message: "Informe o endereço da tag.", severity: "error" });
    }
  }
  const profile = project.protocols.find((item) => item.id === tag.protocolProfileId);
  if (profile?.driver === "siemens-s7") {
    issues.push(...validateS7Address(tag));
  }
  if (tag.direction !== "read" && tag.type !== "bool") {
    if (tag.min === undefined || tag.max === undefined) {
      issues.push({ path: `tags.${tag.name}.range`, message: "Escritas numéricas exigem mínimo e máximo.", severity: "error" });
    } else if (tag.min >= tag.max) {
      issues.push({ path: `tags.${tag.name}.range`, message: "O mínimo deve ser menor que o máximo.", severity: "error" });
    }
  }
  return issues;
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
    issues.push({
      path: `protocols.${profile.id}.endpoint`,
      message: "Use um IPv4 privado no formato s7://192.168.0.10:102.",
      severity: "error"
    });
  }

  const ranges: Array<[string, number, number, number]> = [
    ["rack", Number(profile.options.rack ?? 0), 0, 7],
    ["slot", Number(profile.options.slot ?? 1), 0, 31],
    ["timeoutMs", Number(profile.options.timeoutMs ?? 2000), 100, 30000]
  ];
  for (const [name, value, minimum, maximum] of ranges) {
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      issues.push({
        path: `protocols.${profile.id}.options.${name}`,
        message: `${name} deve ser inteiro entre ${minimum} e ${maximum}.`,
        severity: "error"
      });
    }
  }
  return issues;
}

function validateS7Address(tag: LinkPadTag): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const address = tag.address ?? {};
  const prefix = `tags.${tag.name}.address`;
  const dataType = String(address.dataType ?? "").toUpperCase();
  const compatibility: Record<string, LinkPadTag["type"]> = {
    BOOL: "bool",
    INT: "int",
    DINT: "int",
    REAL: "float"
  };

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
  } else if (compatibility[dataType] !== tag.type) {
    issues.push({ path: `${prefix}.dataType`, message: `${dataType} não é compatível com tag ${tag.type}.`, severity: "error" });
  }
  if (dataType === "BOOL" && !isIntegerInRange(address.bitOffset, 0, 7)) {
    issues.push({ path: `${prefix}.bitOffset`, message: "Bit deve ser inteiro entre 0 e 7.", severity: "error" });
  }
  if (tag.type === "string") {
    issues.push({ path: `${prefix}.dataType`, message: "String ainda não é suportada pelo conector S7 MVP.", severity: "error" });
  }
  return issues;
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}
