import { Cable, Check, Database, Pencil, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ConnectorAddressEditor, s7Types } from "./ConnectorAddressEditor";
import {
  addressSummary,
  compatibleGlobalTags,
  compatibleValueTypes,
  createDefaultConnectorBinding,
  dataBindingSummary,
  defaultValueForType,
  type DataBindingAccess
} from "../../domain/project/dataBindings";
import { defaultAddressFor, getConnectorManifest } from "../../data/connectorCatalog";
import type {
  ConnectorDataBinding,
  LinkPadDataBinding,
  LinkPadProject,
  LinkPadValueType,
  TagValue
} from "../../types/project";

interface DataBindingFieldProps {
  access: DataBindingAccess;
  acceptedTypes?: LinkPadValueType[];
  compact?: boolean;
  includePolling?: boolean;
  label: string;
  project: LinkPadProject;
  value?: LinkPadDataBinding;
  onChange: (binding: LinkPadDataBinding) => void;
}

const allTypes: LinkPadValueType[] = ["bool", "int", "float", "string"];

export function DataBindingField({
  access,
  acceptedTypes = allTypes,
  compact = false,
  includePolling = access !== "write",
  label,
  project,
  value,
  onChange
}: DataBindingFieldProps) {
  const compatibleTags = useMemo(
    () => compatibleGlobalTags(project, access, acceptedTypes),
    [access, acceptedTypes, project]
  );
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"connector" | "global-tag">("connector");
  const [connectorDraft, setConnectorDraft] = useState<ConnectorDataBinding>(() => createDefaultConnectorBinding(project, acceptedTypes));
  const [globalTagId, setGlobalTagId] = useState(compatibleTags[0]?.id ?? "");

  function openSelector() {
    if (value?.kind === "connector") {
      setConnectorDraft(cloneBinding(value));
      setTab("connector");
    } else {
      setConnectorDraft(createDefaultConnectorBinding(project, acceptedTypes));
      setTab(value?.kind === "global-tag" ? "global-tag" : "connector");
    }
    setGlobalTagId(value?.kind === "global-tag" ? value.tagId : compatibleTags[0]?.id ?? "");
    setOpen(true);
  }

  function applySelection() {
    if (tab === "connector") onChange(connectorDraft);
    else onChange({ kind: "global-tag", tagId: globalTagId });
    setOpen(false);
  }

  const selectedGlobalTag = project.tags.find((tag) => tag.id === globalTagId);
  const selectionValid = tab === "connector"
    ? connectorBindingIsComplete(project, connectorDraft, includePolling)
    : compatibleTags.some((tag) => tag.id === globalTagId);

  return (
    <>
      <div className={`data-binding-field${compact ? " compact" : ""}`}>
        <button type="button" onClick={openSelector}>
          {!compact && <span className="data-binding-context">{label}</span>}
          <span className="data-binding-summary">
            {value?.kind === "global-tag" ? <Database size={16} /> : <Cable size={16} />}
            <strong>{dataBindingSummary(project, value)}</strong>
          </span>
          <Pencil size={15} />
        </button>
      </div>

      {open && (
        <div className="data-binding-backdrop" role="presentation">
          <section aria-labelledby="data-binding-heading" aria-modal="true" className="data-binding-dialog" role="dialog">
            <header>
              <strong id="data-binding-heading">Selecionar tag</strong>
              <button aria-label="Fechar seletor de dados" type="button" onClick={() => setOpen(false)}><X size={18} /></button>
            </header>

            <div className="data-binding-tabs" role="tablist" aria-label="Tipo de origem do dado">
              <button aria-selected={tab === "connector"} className={tab === "connector" ? "active" : ""} role="tab" type="button" onClick={() => setTab("connector")}><Cable size={17} /> PLC</button>
              <button aria-selected={tab === "global-tag"} className={tab === "global-tag" ? "active" : ""} role="tab" type="button" onClick={() => setTab("global-tag")}><Database size={17} /> Tags globais</button>
            </div>

            <div className="data-binding-content">
              {tab === "connector" ? (
                <ConnectorBindingEditor
                  acceptedTypes={acceptedTypes}
                  binding={connectorDraft}
                  includePolling={includePolling}
                  project={project}
                  onChange={setConnectorDraft}
                />
              ) : (
                <div className="global-tag-picker">
                  {compatibleTags.length === 0 ? (
                    <div className="data-binding-empty">
                      <Database size={24} />
                      <strong>Nenhuma Tag global compatível</strong>
                      <span>Crie uma Tag global compatível ou use a aba PLC.</span>
                    </div>
                  ) : (
                    <>
                      <label>Tag global<select value={globalTagId} onChange={(event) => setGlobalTagId(event.target.value)}>{compatibleTags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label>
                      {selectedGlobalTag && (
                        <div className="global-tag-inline-summary">
                          {project.protocols.find((profile) => profile.id === selectedGlobalTag.protocolProfileId)?.name ?? "PLC ausente"} · {selectedGlobalTag.protocolProfileId && selectedGlobalTag.address ? addressSummary(project, {
                            kind: "connector",
                            protocolProfileId: selectedGlobalTag.protocolProfileId,
                            type: selectedGlobalTag.type,
                            address: selectedGlobalTag.address,
                            pollMs: selectedGlobalTag.pollMs ?? project.agent.pollMs
                          }) : "Endereço ausente"} · {selectedGlobalTag.type} · {directionLabel(selectedGlobalTag.direction)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <footer>
              <button type="button" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="primary-action compact" disabled={!selectionValid} type="button" onClick={applySelection}><Check size={16} /> Usar</button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

function ConnectorBindingEditor({ acceptedTypes, binding, includePolling, project, onChange }: {
  acceptedTypes: LinkPadValueType[];
  binding: ConnectorDataBinding;
  includePolling: boolean;
  project: LinkPadProject;
  onChange: (binding: ConnectorDataBinding) => void;
}) {
  const profile = project.protocols.find((item) => item.id === binding.protocolProfileId)
    ?? project.protocols.find((item) => item.enabled)
    ?? project.protocols[0];
  const types = compatibleValueTypes(profile?.driver ?? "sim", acceptedTypes);
  const usesNativeType = profile?.driver === "siemens-s7";
  const usesSimulation = profile?.driver === "sim";

  function update(patch: Partial<ConnectorDataBinding>) {
    onChange({ ...binding, ...patch });
  }

  function updateProfile(profileId: string) {
    const nextProfile = project.protocols.find((item) => item.id === profileId);
    if (!nextProfile) return;
    const nextTypes = compatibleValueTypes(nextProfile.driver, acceptedTypes);
    const type = nextTypes.includes(binding.type) ? binding.type : nextTypes[0] ?? binding.type;
    onChange({
      ...binding,
      protocolProfileId: profileId,
      type,
      address: defaultAddressFor(nextProfile.driver, { name: "PontoDireto", type }),
      simulationValue: defaultValueForType(type)
    });
  }

  function updateType(type: LinkPadValueType) {
    onChange({
      ...binding,
      type,
      address: defaultAddressFor(profile?.driver ?? "sim", { name: "PontoDireto", type }),
      simulationValue: defaultValueForType(type),
      ...(type === "bool" || type === "string" ? { min: undefined, max: undefined } : {})
    });
  }

  return (
    <div className="connector-binding-editor">
      <div className={`data-binding-primary-row ${usesNativeType ? "single" : ""}`}>
        <label>PLC<select value={profile?.id ?? ""} onChange={(event) => updateProfile(event.target.value)}>{project.protocols.map((item) => <option disabled={!item.enabled} key={item.id} value={item.id}>{item.name}{item.enabled ? "" : " (pausado)"}</option>)}</select></label>
        {!usesNativeType && <label>Tipo<select value={binding.type} onChange={(event) => updateType(event.target.value as LinkPadValueType)}>{types.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>}
      </div>

      <ConnectorAddressEditor
        acceptedTypes={acceptedTypes}
        driver={profile?.driver ?? "sim"}
        type={binding.type}
        value={binding.address}
        onChange={(address, type) => onChange({
          ...binding,
          address,
          ...(type && type !== binding.type ? { type, simulationValue: defaultValueForType(type) } : {})
        })}
      />

      {includePolling && (
        <details className="data-binding-options">
          <summary>{usesSimulation ? "Atualização e valor de teste" : "Atualização"}</summary>
          <div className={usesSimulation ? "two-columns" : "data-binding-single-option"}>
            <label>Atualização (ms)<input min={100} type="number" value={binding.pollMs} onChange={(event) => update({ pollMs: Number(event.target.value) })} /></label>
            {usesSimulation && <TestValueField binding={binding} onChange={(simulationValue) => update({ simulationValue })} />}
          </div>
        </details>
      )}
    </div>
  );
}

function TestValueField({ binding, onChange }: { binding: ConnectorDataBinding; onChange: (value: TagValue) => void }) {
  if (binding.type === "bool") {
    return <label>Valor de teste<select value={String(binding.simulationValue ?? false)} onChange={(event) => onChange(event.target.value === "true")}><option value="true">true</option><option value="false">false</option></select></label>;
  }
  return <label>Valor de teste<input value={String(binding.simulationValue ?? "")} onChange={(event) => onChange(binding.type === "string" ? event.target.value : Number(event.target.value))} /></label>;
}

function connectorBindingIsComplete(project: LinkPadProject, binding: ConnectorDataBinding, includePolling: boolean) {
  const profile = project.protocols.find((item) => item.id === binding.protocolProfileId);
  if (!profile?.enabled || !binding.type || !binding.address || Object.keys(binding.address).length === 0) return false;
  if (!compatibleValueTypes(profile.driver, [binding.type]).includes(binding.type)) return false;
  if (includePolling && (!Number.isInteger(binding.pollMs) || binding.pollMs < 100)) return false;
  if (profile.driver === "siemens-s7") {
    if (Number(binding.address.dbNumber) < 1 || Number(binding.address.byteOffset) < 0 || !binding.address.dataType) return false;
    if (binding.address.dataType === "BOOL" && (Number(binding.address.bitOffset) < 0 || Number(binding.address.bitOffset) > 7)) return false;
    if (!s7Types(binding.type).includes(String(binding.address.dataType))) return false;
  } else if (!String(binding.address[getConnectorManifest(profile.driver).addressField] ?? "").trim()) return false;
  return true;
}

function directionLabel(direction: "read" | "write" | "readWrite") {
  if (direction === "read") return "Leitura";
  if (direction === "write") return "Escrita";
  return "Leitura e escrita";
}

function cloneBinding(binding: ConnectorDataBinding): ConnectorDataBinding {
  return { ...binding, address: { ...binding.address } };
}
