import type {
  LinkPadDataBinding,
  LinkPadInputBinding,
  LinkPadProject,
  LinkPadProjectV1,
  LinkPadProjectV2,
  LinkPadProjectV3,
  LinkPadProjectV4,
  LinkPadProjectV5,
  LinkPadProjectV6,
  LinkPadProjectV7,
  LinkPadProjectV8,
  LinkPadScreen,
  LinkPadScreenV2,
  LinkPadScreenV3,
  LinkPadTag,
  LinkPadWidget,
  ProtocolProfile
} from "./types";
import { isDataBinding } from "./dataBindings";
import { createDefaultStatusOverlay, normalizeStatusOverlay } from "../runtime/statusOverlay";

export const CURRENT_PROJECT_SCHEMA = "0.9.0" as const;
export const CURRENT_STUDIO_VERSION = "0.17.1" as const;

export function createDefaultSimProfile(projectId: string): ProtocolProfile {
  return {
    id: "sim-main",
    name: "Simulador LinkPad",
    driver: "sim",
    endpoint: `memory://${projectId}`,
    enabled: true,
    options: {}
  };
}

export function migrateProject(candidate: unknown): LinkPadProject {
  if (!candidate || typeof candidate !== "object") {
    throw new Error("Arquivo de projeto inválido.");
  }

  const schemaVersion = (candidate as { schemaVersion?: unknown }).schemaVersion;
  if (schemaVersion === CURRENT_PROJECT_SCHEMA) {
    return normalizeCurrentProject(candidate as LinkPadProject);
  }
  if (schemaVersion === "0.8.0") {
    return migrateV8ToV9(candidate as LinkPadProjectV8);
  }
  if (schemaVersion === "0.7.0") {
    return migrateV8ToV9(migrateV7ToV8(candidate as LinkPadProjectV7));
  }
  if (schemaVersion === "0.6.0") {
    return migrateV8ToV9(migrateV7ToV8(migrateV6ToV7(candidate as LinkPadProjectV6)));
  }
  if (schemaVersion === "0.5.0") {
    return migrateV8ToV9(migrateV7ToV8(migrateV6ToV7(migrateV5ToV6(candidate as LinkPadProjectV5))));
  }
  if (schemaVersion === "0.4.0") {
    return migrateV8ToV9(migrateV7ToV8(migrateV6ToV7(migrateV5ToV6(migrateV4ToV5(candidate as LinkPadProjectV4)))));
  }
  if (schemaVersion === "0.3.0") {
    return migrateV8ToV9(migrateV7ToV8(migrateV6ToV7(migrateV5ToV6(migrateV4ToV5(migrateV3ToV4(candidate as LinkPadProjectV3))))));
  }
  if (schemaVersion === "0.2.0") {
    return migrateV8ToV9(migrateV7ToV8(migrateV6ToV7(migrateV5ToV6(migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(candidate as LinkPadProjectV2)))))));
  }
  if (schemaVersion === "0.1.0") {
    return migrateV8ToV9(migrateV7ToV8(migrateV6ToV7(migrateV5ToV6(migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(candidate as LinkPadProjectV1))))))));
  }
  throw new Error(`Versão de projeto não suportada: ${String(schemaVersion ?? "ausente")}.`);
}

export function migrateV1ToV2(project: LinkPadProjectV1): LinkPadProjectV2 {
  if (!project.projectId || !project.name || !project.hardware || !project.agent) {
    throw new Error("O projeto 0.1.0 não possui os campos obrigatórios.");
  }

  const now = new Date().toISOString();
  const simProfile = createDefaultSimProfile(project.projectId);
  const tags: LinkPadProjectV2["tags"] = (project.tags ?? []).map((tag) => ({
    ...tag,
    source: tag.source ?? "agent",
    protocolProfileId: simProfile.id,
    address: { key: tag.agentTag || tag.name },
    quality: tag.quality ?? "unknown"
  }));

  return {
    schemaVersion: "0.2.0",
    studioVersion: "0.2.0",
    projectId: project.projectId,
    name: project.name,
    description: project.description ?? "",
    folderPath: project.folderPath ?? "",
    createdAt: project.createdAt ?? now,
    updatedAt: now,
    hardware: {
      ...project.hardware,
      statusOverlay: normalizeStatusOverlay(project.hardware.statusOverlay)
    },
    network: {
      mode: "wifi",
      ssid: "",
      password: ""
    },
    agent: {
      ...project.agent,
      protocolVersion: "0.1.0"
    },
    protocols: [simProfile],
    tags,
    screens: project.screens ?? [],
    assets: project.assets ?? { fonts: [], images: [] },
    build: {
      serialPort: "",
      baudRate: 115200
    }
  };
}

export function createDefaultInputBindings(screen: LinkPadScreenV2): LinkPadInputBinding[] {
  const bindings: LinkPadInputBinding[] = [{
    inputId: "primary",
    event: "press",
    action: { type: "navigate", target: "next" }
  }];
  const firstWriteWidget = screen.widgets.find((widget) => widget.type === "write_button");
  if (firstWriteWidget) {
    bindings.push({
      inputId: "secondary",
      event: "press",
      action: { type: "activateWidget", widgetId: firstWriteWidget.id }
    });
  }
  return bindings;
}

export function migrateV2ToV3(project: LinkPadProjectV2): LinkPadProjectV3 {
  return {
    ...project,
    schemaVersion: "0.3.0",
    studioVersion: "0.6.0",
    screens: (project.screens ?? []).map((screen) => ({
      ...screen,
      inputBindings: Array.isArray(screen.inputBindings)
        ? screen.inputBindings
        : createDefaultInputBindings(screen)
    }))
  };
}

export function migrateV3ToV4(project: LinkPadProjectV3): LinkPadProjectV4 {
  const legacyTags = normalizeGlobalTagIds(project.tags ?? []);
  const tags = stripLegacyTagLimits(legacyTags);
  return {
    ...project,
    schemaVersion: "0.4.0",
    studioVersion: "0.7.0",
    tags,
    screens: (project.screens ?? []).map((screen) => migrateScreenBindings(screen, legacyTags, true))
  } as LinkPadProjectV4;
}

export function migrateV4ToV5(project: LinkPadProjectV4): LinkPadProjectV5 {
  return {
    ...project,
    schemaVersion: "0.5.0",
    studioVersion: "0.8.0",
    tags: project.tags.map((tag) => normalizeTagRuntimeFields(tag as LinkPadTag))
  } as LinkPadProjectV5;
}

export function migrateV5ToV6(project: LinkPadProjectV5): LinkPadProjectV6 {
  const normalized = normalizeCurrentProject({
    ...project,
    schemaVersion: CURRENT_PROJECT_SCHEMA
  } as LinkPadProject);
  return {
    ...normalized,
    schemaVersion: "0.6.0",
    studioVersion: "0.11.0"
  } as LinkPadProjectV6;
}

export function migrateV6ToV7(project: LinkPadProjectV6): LinkPadProjectV7 {
  const normalized = normalizeCurrentProject({
    ...project,
    schemaVersion: CURRENT_PROJECT_SCHEMA
  } as LinkPadProject);
  return {
    ...normalized,
    schemaVersion: "0.7.0",
    studioVersion: "0.14.0"
  } as LinkPadProjectV7;
}

export function migrateV7ToV8(project: LinkPadProjectV7): LinkPadProjectV8 {
  const normalized = normalizeCurrentProject({
    ...project,
    schemaVersion: CURRENT_PROJECT_SCHEMA
  } as unknown as LinkPadProject);
  return {
    ...normalized,
    schemaVersion: "0.8.0",
    studioVersion: "0.15.0"
  } as unknown as LinkPadProjectV8;
}

export function migrateV8ToV9(project: LinkPadProjectV8): LinkPadProject {
  return normalizeCurrentProject({
    ...project,
    schemaVersion: CURRENT_PROJECT_SCHEMA
  } as unknown as LinkPadProject);
}

function normalizeCurrentProject(project: LinkPadProject): LinkPadProject {
  if (!project.projectId || !project.name || !project.hardware || !project.agent) {
    throw new Error("O projeto não possui os campos obrigatórios.");
  }

  const protocols = project.protocols?.length > 0
    ? project.protocols.map(normalizeProtocolProfile)
    : [createDefaultSimProfile(project.projectId)];
  const legacyTags = normalizeGlobalTagIds(project.tags ?? []);
  const elevateLegacyLimits = versionBefore(project.studioVersion, "0.7.2");
  const tagsWithoutLimits = elevateLegacyLimits ? stripLegacyTagLimits(legacyTags) : legacyTags;
  const tags = tagsWithoutLimits.map(normalizeTagRuntimeFields);

  return {
    ...project,
    schemaVersion: CURRENT_PROJECT_SCHEMA,
    studioVersion: CURRENT_STUDIO_VERSION,
    hardware: {
      ...project.hardware,
      statusOverlay: normalizeStatusOverlay(project.hardware.statusOverlay ?? createDefaultStatusOverlay())
    },
    network: project.network ?? { mode: "wifi", ssid: "", password: "" },
    agent: {
      ...project.agent,
      protocolVersion: "0.1.0"
    },
    protocols,
    tags,
    screens: (project.screens ?? []).map((screen) => migrateScreenBindings(
      screen as LinkPadScreenV3,
      legacyTags,
      elevateLegacyLimits
    )),
    assets: project.assets ?? { fonts: [], images: [] },
    build: project.build ?? { serialPort: "", baudRate: 115200 }
  };
}

function normalizeProtocolProfile(profile: ProtocolProfile): ProtocolProfile {
  const legacyDriver = (profile as unknown as { driver: string }).driver;
  if (legacyDriver === "siemens-opcua") {
    return {
      ...profile,
      driver: "opcua",
      name: /^PLC Siemens OPC UA$/i.test(profile.name.trim()) ? "PLC OPC UA" : profile.name,
      options: {
        securityPolicy: "None",
        securityMode: "None",
        sessionTimeoutMs: 30000,
        requestTimeoutMs: 2000,
        ...profile.options
      },
      auth: { mode: "anonymous" }
    };
  }
  if (profile.driver === "siemens-s7" && ["Simulação principal", "Simulador LinkPad"].includes(profile.name)) {
    return { ...profile, name: "PLC Siemens S7 nativo" };
  }
  return profile;
}

function normalizeTagRuntimeFields(tag: LinkPadTag): LinkPadTag {
  if (tag.source !== "internal") {
    return {
      ...tag,
      initialValue: undefined,
      retentive: undefined
    };
  }
  const {
    protocolProfileId: _protocolProfileId,
    address: _address,
    agentTag: _agentTag,
    pollMs: _pollMs,
    simulationValue,
    ...local
  } = tag;
  return {
    ...local,
    direction: tag.direction === "read" ? "read" : "readWrite",
    initialValue: compatibleInitialValue(tag.initialValue ?? simulationValue, tag.type),
    retentive: tag.retentive === true,
    quality: "good"
  };
}

function compatibleInitialValue(value: unknown, type: LinkPadTag["type"]) {
  if (type === "bool") return typeof value === "boolean" ? value : false;
  if (type === "string") return typeof value === "string" ? value : "";
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return type === "int" ? Math.trunc(value) : value;
}

function versionBefore(version: string | undefined, target: string) {
  const parts = (version ?? "0.0.0").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const targetParts = target.split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < 3; index += 1) {
    if ((parts[index] ?? 0) !== (targetParts[index] ?? 0)) return (parts[index] ?? 0) < (targetParts[index] ?? 0);
  }
  return false;
}

function normalizeGlobalTagIds(tags: Array<Omit<LinkPadTag, "id"> & { id?: string }>): LinkPadTag[] {
  const used = new Set<string>();
  return tags.map((tag, index) => {
    const requested = tag.id?.trim() || globalTagId(tag.name, index);
    let id = requested;
    let suffix = 2;
    while (used.has(id)) id = `${requested}-${suffix++}`;
    used.add(id);
    return { ...tag, id } as LinkPadTag;
  });
}

function stripLegacyTagLimits(tags: LinkPadTag[]) {
  return tags.map((tag) => {
    const { min: _legacyMin, max: _legacyMax, ...current } = tag;
    return current as LinkPadTag;
  });
}

function globalTagId(name: string, index: number) {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `global-tag-${slug || index + 1}`;
}

function migrateScreenBindings(screen: LinkPadScreenV3, tags: LinkPadTag[], useGlobalLegacyLimits: boolean): LinkPadScreen {
  return {
    ...screen,
    widgets: normalizeWidgetGroups(screen.widgets.map((widget) => {
      let nextWidget = widget;
      if (!isDataBinding(widget.props.binding)) {
        const legacyTag = typeof widget.props.tag === "string" ? widget.props.tag : "";
        if (legacyTag) {
          const { tag: _legacyTag, ...props } = widget.props;
          nextWidget = { ...widget, props: { ...props, binding: globalBindingForName(legacyTag, tags) } };
        }
      }
      nextWidget = {
        ...nextWidget,
        editor: normalizeWidgetEditor(nextWidget.editor),
        props: normalizeWidgetProps(nextWidget)
      };
      if (nextWidget.type !== "write_button") return nextWidget;
      const binding = isDataBinding(nextWidget.props.binding) ? nextWidget.props.binding : undefined;
      if (!binding) return nextWidget;
      const normalized = moveLegacyBindingLimits(binding, tags, useGlobalLegacyLimits);
      return {
        ...nextWidget,
        props: {
          ...nextWidget.props,
          binding: normalized.binding,
          min: typeof nextWidget.props.min === "number" ? nextWidget.props.min : normalized.min,
          max: typeof nextWidget.props.max === "number" ? nextWidget.props.max : normalized.max
        }
      };
    })),
    inputBindings: (screen.inputBindings ?? []).map((inputBinding) => {
      const action = inputBinding.action;
      if (action.type !== "changeValue" && action.type !== "writeTag" && action.type !== "toggleTag") {
        return inputBinding as LinkPadInputBinding;
      }
      const binding = "binding" in action && isDataBinding(action.binding)
        ? action.binding
        : globalBindingForName("tag" in action && typeof action.tag === "string" ? action.tag : "", tags);
      if (action.type === "changeValue") {
        const normalized = moveLegacyBindingLimits(binding, tags, useGlobalLegacyLimits);
        return {
          ...inputBinding,
          action: {
            ...action,
            binding: normalized.binding,
            operation: ["set", "add", "subtract", "toggle"].includes(action.operation) ? action.operation : "set",
            min: typeof action.min === "number" ? action.min : normalized.min,
            max: typeof action.max === "number" ? action.max : normalized.max
          }
        } as LinkPadInputBinding;
      }
      if (action.type === "writeTag") {
        const normalized = moveLegacyBindingLimits(binding, tags, useGlobalLegacyLimits);
        return {
          ...inputBinding,
          action: {
            type: "changeValue",
            binding: normalized.binding,
            operation: "set",
            operand: action.value,
            min: "min" in action && typeof action.min === "number" ? action.min : normalized.min,
            max: "max" in action && typeof action.max === "number" ? action.max : normalized.max
          }
        } as LinkPadInputBinding;
      }
      return {
        ...inputBinding,
        action: { type: "changeValue", binding, operation: "toggle" }
      } as LinkPadInputBinding;
    })
  };
}

function normalizeWidgetEditor(editor: LinkPadWidget["editor"]): NonNullable<LinkPadWidget["editor"]> {
  const groupId = typeof editor?.groupId === "string" ? editor.groupId.trim() : "";
  return {
    locked: editor?.locked === true,
    ...(groupId ? { groupId } : {})
  };
}

function normalizeWidgetProps(widget: LinkPadWidget): Record<string, unknown> {
  const writeButton = widget.type === "write_button";
  const color = validColor(widget.props.color, widget.type === "status_indicator" ? "#42c879" : writeButton ? "#ff7a21" : "#ffffff");
  return {
    ...widget.props,
    fontSize: validNumber(widget.props.fontSize, 8, 6, 32),
    color,
    backgroundColor: validColor(widget.props.backgroundColor, writeButton ? "#41210f" : "#232528"),
    transparent: typeof widget.props.transparent === "boolean" ? widget.props.transparent : !writeButton,
    textAlign: ["left", "center", "right"].includes(String(widget.props.textAlign)) ? widget.props.textAlign : "left",
    verticalAlign: ["top", "middle", "bottom"].includes(String(widget.props.verticalAlign)) ? widget.props.verticalAlign : "middle",
    padding: validNumber(widget.props.padding, writeButton ? 4 : 2, 0, 20),
    borderWidth: validNumber(widget.props.borderWidth, writeButton ? 1 : 0, 0, 8),
    borderColor: validColor(widget.props.borderColor, color),
    borderRadius: validNumber(widget.props.borderRadius, writeButton ? 3 : 0, 0, 20),
    ...(widget.type === "gauge" || widget.type === "progress_bar" ? {
      min: validNumber(widget.props.min, 0),
      max: validNumber(widget.props.max, 100),
      showValue: typeof widget.props.showValue === "boolean" ? widget.props.showValue : true
    } : {})
  };
}

function validColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function validNumber(value: unknown, fallback: number, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function normalizeWidgetGroups(widgets: LinkPadWidget[]) {
  const counts = new Map<string, number>();
  for (const widget of widgets) {
    const groupId = widget.editor?.groupId;
    if (groupId) counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
  }
  return widgets.map((widget) => widget.editor?.groupId && (counts.get(widget.editor.groupId) ?? 0) < 2
    ? { ...widget, editor: { ...widgetEditorMetaWithoutGroup(widget) } }
    : widget);
}

function widgetEditorMetaWithoutGroup(widget: LinkPadWidget): NonNullable<LinkPadWidget["editor"]> {
  return { locked: widget.editor?.locked === true };
}

function moveLegacyBindingLimits(binding: LinkPadDataBinding, tags: LinkPadTag[], useGlobalLegacyLimits: boolean) {
  if (binding.kind === "connector") {
    const { min, max, ...current } = binding;
    return { binding: current as LinkPadDataBinding, min, max };
  }
  const tag = useGlobalLegacyLimits ? tags.find((item) => item.id === binding.tagId) : undefined;
  return { binding, min: tag?.min, max: tag?.max };
}

function globalBindingForName(name: string, tags: LinkPadTag[]): LinkPadDataBinding {
  return {
    kind: "global-tag",
    tagId: tags.find((tag) => tag.name === name)?.id ?? `missing:${name}`
  };
}
