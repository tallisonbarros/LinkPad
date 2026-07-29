import { defaultAddressFor, getConnectorManifest } from "../../data/connectorCatalog";
import type {
  ConnectorDataBinding,
  ConnectorDriver,
  LinkPadDataBinding,
  LinkPadProject,
  LinkPadScreen,
  LinkPadTag,
  LinkPadValueType,
  TagValue
} from "./types";

export type DataBindingAccess = "read" | "write" | "readWrite";

const allValueTypes: LinkPadValueType[] = ["bool", "int", "float", "string"];

export function isDataBinding(value: unknown): value is LinkPadDataBinding {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LinkPadDataBinding>;
  if (candidate.kind === "global-tag") return typeof candidate.tagId === "string";
  if (candidate.kind !== "connector") return false;
  const connector = candidate as Partial<ConnectorDataBinding>;
  return typeof connector.protocolProfileId === "string"
    && allValueTypes.includes(connector.type as LinkPadValueType)
    && !!connector.address
    && typeof connector.address === "object";
}

export function bindingFrom(value: unknown): LinkPadDataBinding | undefined {
  return isDataBinding(value) ? value : undefined;
}

export function globalTagForBinding(project: LinkPadProject, binding?: LinkPadDataBinding) {
  if (binding?.kind !== "global-tag") return undefined;
  return project.tags.find((tag) => tag.id === binding.tagId);
}

export function valueTypeForBinding(project: LinkPadProject, binding?: LinkPadDataBinding) {
  if (!binding) return undefined;
  return binding.kind === "connector" ? binding.type : globalTagForBinding(project, binding)?.type;
}

export function simulationValueForBinding(project: LinkPadProject, binding?: LinkPadDataBinding) {
  if (!binding) return undefined;
  if (binding.kind === "connector") return binding.simulationValue;
  const tag = globalTagForBinding(project, binding);
  return tag?.source === "internal" ? tag.initialValue : tag?.simulationValue;
}

export function writeLimitsForBinding(project: LinkPadProject, binding?: LinkPadDataBinding) {
  if (!binding) return {};
  if (binding.kind === "connector") return { min: binding.min, max: binding.max };
  const tag = globalTagForBinding(project, binding);
  return { min: tag?.min, max: tag?.max };
}

export function defaultValueForType(type?: LinkPadValueType): TagValue {
  if (type === "bool") return true;
  if (type === "string") return "";
  return 0;
}

export function compatibleValueTypes(driver: ConnectorDriver, acceptedTypes = allValueTypes) {
  return acceptedTypes.filter((type) => driver !== "siemens-s7" || type !== "string");
}

export function tagSupportsAccess(tag: LinkPadTag, access: DataBindingAccess) {
  if (access === "read") return tag.direction !== "write";
  if (access === "write") return tag.direction !== "read";
  return tag.direction === "readWrite";
}

export function compatibleGlobalTags(
  project: LinkPadProject,
  access: DataBindingAccess,
  acceptedTypes: LinkPadValueType[] = allValueTypes
) {
  return project.tags.filter((tag) => tagSupportsAccess(tag, access) && acceptedTypes.includes(tag.type));
}

export function createDefaultConnectorBinding(
  project: LinkPadProject,
  acceptedTypes: LinkPadValueType[] = allValueTypes
): ConnectorDataBinding {
  const profile = project.protocols.find((item) => item.enabled) ?? project.protocols[0];
  const allowedTypes = compatibleValueTypes(profile?.driver ?? "sim", acceptedTypes);
  const type = allowedTypes[0] ?? "float";
  return {
    kind: "connector",
    protocolProfileId: profile?.id ?? "",
    type,
    address: defaultAddressFor(profile?.driver ?? "sim", { name: "PontoDireto", type }),
    pollMs: project.agent.pollMs,
    simulationValue: defaultValueForType(type)
  };
}

export function addressSummary(project: LinkPadProject, binding: ConnectorDataBinding) {
  const profile = project.protocols.find((item) => item.id === binding.protocolProfileId);
  if (profile?.driver === "siemens-s7") {
    const db = Number(binding.address.dbNumber ?? 0);
    const byte = Number(binding.address.byteOffset ?? 0);
    const dataType = String(binding.address.dataType ?? binding.type).toUpperCase();
    if (dataType === "BOOL") return `DB${db}.DBX${byte}.${Number(binding.address.bitOffset ?? 0)}`;
    if (dataType === "INT") return `DB${db}.DBW${byte}`;
    return `DB${db}.DBD${byte}`;
  }
  const manifest = getConnectorManifest(profile?.driver ?? "sim");
  return String(binding.address[manifest.addressField] ?? "Endereço pendente");
}

export function dataBindingSummary(project: LinkPadProject, binding?: LinkPadDataBinding) {
  if (!binding) return "Nenhum dado selecionado";
  if (binding.kind === "global-tag") {
    return globalTagForBinding(project, binding)?.name ?? "Tag global ausente";
  }
  const profile = project.protocols.find((item) => item.id === binding.protocolProfileId);
  return `${profile?.name ?? "PLC ausente"} · ${addressSummary(project, binding)} · ${binding.type}`;
}

export function mapScreenDataBindings(
  screens: LinkPadScreen[],
  mapper: (binding: LinkPadDataBinding) => LinkPadDataBinding
) {
  return screens.map((screen) => ({
    ...screen,
    widgets: screen.widgets.map((widget) => {
      const binding = bindingFrom(widget.props.binding);
      return binding ? { ...widget, props: { ...widget.props, binding: mapper(binding) } } : widget;
    }),
    inputBindings: screen.inputBindings.map((inputBinding) => {
      const action = inputBinding.action;
      if (action.type !== "changeValue") return inputBinding;
      return { ...inputBinding, action: { ...action, binding: mapper(action.binding) } };
    })
  }));
}

export function resetDirectBindingsForDriver(
  screens: LinkPadScreen[],
  profileId: string,
  driver: ConnectorDriver
) {
  let index = 0;
  return mapScreenDataBindings(screens, (binding) => {
    if (binding.kind !== "connector" || binding.protocolProfileId !== profileId) return binding;
    const nextIndex = index++;
    return {
      ...binding,
      address: defaultAddressFor(driver, { name: `PontoDireto${nextIndex + 1}`, type: binding.type }, nextIndex)
    };
  });
}

export function countGlobalTagBindings(project: LinkPadProject, tagId: string) {
  let count = 0;
  mapScreenDataBindings(project.screens, (binding) => {
    if (binding.kind === "global-tag" && binding.tagId === tagId) count += 1;
    return binding;
  });
  return count;
}

export function countProfileBindings(project: LinkPadProject, profileId: string) {
  let count = project.tags.filter((tag) => tag.protocolProfileId === profileId).length;
  mapScreenDataBindings(project.screens, (binding) => {
    if (binding.kind === "connector" && binding.protocolProfileId === profileId) count += 1;
    return binding;
  });
  return count;
}
