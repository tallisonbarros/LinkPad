import { Cable, Check, Cpu, Database, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ConnectorAddressEditor } from "../../components/data-binding/ConnectorAddressEditor";
import { defaultAddressFor } from "../../data/connectorCatalog";
import { compatibleValueTypes } from "../../domain/project/dataBindings";
import { validateTag } from "../../domain/project/validation";
import type { LinkPadProject, LinkPadTag, LinkPadValueType, TagValue } from "../../types/project";

interface TagEditorDialogProps {
  mode: "create" | "edit";
  project: LinkPadProject;
  referenceCount: number;
  tag: LinkPadTag;
  onClose: () => void;
  onRemove?: () => void;
  onSave: (tag: LinkPadTag) => void;
}

const allTypes: LinkPadValueType[] = ["bool", "int", "float", "string"];

export function createInternalTagDraft(project: LinkPadProject): LinkPadTag {
  let index = project.tags.length + 1;
  while (project.tags.some((tag) => tag.name === `Tag${index}`)) index += 1;
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
  return {
    id: `global-tag-${suffix}`,
    name: `Tag${index}`,
    type: "float",
    direction: "readWrite",
    source: "internal",
    unit: "",
    format: "0.0",
    initialValue: 0,
    retentive: false,
    quality: "good"
  };
}

export function TagEditorDialog({ mode, project, referenceCount, tag, onClose, onRemove, onSave }: TagEditorDialogProps) {
  const [draft, setDraft] = useState<LinkPadTag>(() => cloneTag(tag));
  const source = draft.source === "internal" ? "internal" : "external";
  const assignedProfile = project.protocols.find((item) => item.id === draft.protocolProfileId);
  const profile = assignedProfile
    ?? project.protocols.find((item) => item.enabled)
    ?? project.protocols[0];
  const usesNativeType = profile?.driver === "siemens-s7";
  const usesAgentSimulation = profile?.driver === "sim";
  const compatibleTypes = compatibleValueTypes(profile?.driver ?? "sim", allTypes);
  const messages = useMemo(() => {
    const validation = validateTag(project, draft).map((issue) => issue.message);
    if (project.tags.some((item) => item.id !== draft.id && item.name.trim().toLocaleLowerCase() === draft.name.trim().toLocaleLowerCase())) {
      validation.push("Já existe uma Tag global com este nome.");
    }
    if (source === "external" && !assignedProfile?.enabled) validation.push("Selecione uma comunicação ativa.");
    return [...new Set(validation)];
  }, [assignedProfile?.enabled, draft, project, source]);

  function update(patch: Partial<LinkPadTag>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function selectSource(nextSource: "internal" | "external") {
    if (nextSource === source) return;
    if (nextSource === "internal") {
      setDraft((current) => toInternalTag(current));
      return;
    }
    const nextProfile = project.protocols.find((item) => item.enabled) ?? project.protocols[0];
    setDraft((current) => toExternalTag(current, project, nextProfile?.id));
  }

  function updateType(type: LinkPadValueType) {
    if (source === "internal") {
      update({ type, initialValue: defaultTagValue(type) });
      return;
    }
    update({
      type,
      simulationValue: defaultTagValue(type),
      address: defaultAddressFor(profile?.driver ?? "sim", { name: draft.name, type })
    });
  }

  function updateProfile(profileId: string) {
    const nextProfile = project.protocols.find((item) => item.id === profileId);
    if (!nextProfile) return;
    const nextTypes = compatibleValueTypes(nextProfile.driver, allTypes);
    const type = nextTypes.includes(draft.type) ? draft.type : nextTypes[0] ?? draft.type;
    const existingIndex = project.tags.findIndex((item) => item.id === draft.id);
    const addressIndex = existingIndex >= 0 ? existingIndex : project.tags.length;
    update({
      source: "agent",
      protocolProfileId: profileId,
      type,
      address: defaultAddressFor(nextProfile.driver, { name: draft.name, type }, addressIndex),
      pollMs: draft.pollMs ?? project.agent.pollMs,
      simulationValue: defaultTagValue(type),
      quality: "unknown"
    });
  }

  function updateAddress(address: Record<string, string | number | boolean>, type?: LinkPadValueType) {
    update({
      address,
      ...(type && type !== draft.type ? { type, simulationValue: defaultTagValue(type) } : {})
    });
  }

  function save() {
    if (messages.length > 0) return;
    onSave(source === "internal" ? toInternalTag(draft) : cleanExternalTag(draft));
  }

  return (
    <div className="editor-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section aria-labelledby="tag-editor-heading" aria-modal="true" className="editor-modal tag-editor-dialog" role="dialog">
        <header>
          <div>
            <strong id="tag-editor-heading">{mode === "create" ? "Nova Tag global" : "Configurar Tag global"}</strong>
            <small>{mode === "create" ? "Escolha onde o valor será mantido" : draft.name}</small>
          </div>
          <button aria-label="Fechar configuração da Tag" type="button" onClick={onClose}><X size={18} /></button>
        </header>

        <div className="editor-modal-form tag-dialog-form">
          <div aria-label="Origem da Tag global" className="tag-source-tabs" role="tablist">
            <button aria-selected={source === "internal"} className={source === "internal" ? "active" : ""} role="tab" type="button" onClick={() => selectSource("internal")}><Cpu size={17} /> Interna</button>
            <button aria-selected={source === "external"} className={source === "external" ? "active" : ""} role="tab" type="button" onClick={() => selectSource("external")}><Cable size={17} /> Externa</button>
          </div>

          {source === "internal" ? (
            <>
              <div className="two-columns">
                <label>Nome<input value={draft.name} onChange={(event) => update({ name: event.target.value })} /></label>
                <label>Tipo<select value={draft.type} onChange={(event) => updateType(event.target.value as LinkPadValueType)}>{allTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
              </div>
              <div className="two-columns">
                <label>Acesso<select value={draft.direction === "read" ? "read" : "readWrite"} onChange={(event) => update({ direction: event.target.value as "read" | "readWrite" })}><option value="readWrite">Leitura e escrita</option><option value="read">Somente leitura</option></select></label>
                <label>Unidade<input value={draft.unit ?? ""} onChange={(event) => update({ unit: event.target.value })} /></label>
              </div>
              <InitialValueField tag={draft} onChange={(initialValue) => update({ initialValue })} />
              <label className="checkbox-label retentive-option">
                <input checked={draft.retentive === true} type="checkbox" onChange={(event) => update({ retentive: event.target.checked })} />
                <span><strong>Retentiva</strong><small>Mantém o último valor após reiniciar o device.</small></span>
              </label>
              <div className="tag-source-note"><Database size={17} /><span>Esta Tag fica na memória do LinkPad e não usa PLC nem Agente.</span></div>
            </>
          ) : (
            <>
              <div className="two-columns">
                <label>Nome<input value={draft.name} onChange={(event) => update({ name: event.target.value })} /></label>
                <label>Direção<select value={draft.direction} onChange={(event) => update({ direction: event.target.value as LinkPadTag["direction"] })}><option value="read">Leitura</option><option value="write">Escrita</option><option value="readWrite">Leitura e escrita</option></select></label>
              </div>
              <div className={`tag-external-primary ${usesNativeType ? "single" : ""}`}>
                <label>Comunicação<select value={profile?.id ?? ""} onChange={(event) => updateProfile(event.target.value)}>{project.protocols.map((item) => <option disabled={!item.enabled} key={item.id} value={item.id}>{item.name}{item.enabled ? "" : " (pausada)"}</option>)}</select></label>
                {!usesNativeType && <label>Tipo<select value={draft.type} onChange={(event) => updateType(event.target.value as LinkPadValueType)}>{compatibleTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>}
              </div>
              {profile ? (
                <ConnectorAddressEditor acceptedTypes={allTypes} driver={profile.driver} type={draft.type} value={draft.address ?? {}} onChange={updateAddress} />
              ) : (
                <div className="data-binding-empty"><Cable size={22} /><strong>Nenhuma comunicação disponível</strong></div>
              )}
              <details className="advanced-settings tag-advanced-settings">
                <summary>Detalhes adicionais</summary>
                <div>
                  <div className="two-columns">
                    <label>Unidade<input value={draft.unit ?? ""} onChange={(event) => update({ unit: event.target.value })} /></label>
                    <label>Atualização (ms)<input min={100} type="number" value={draft.pollMs ?? project.agent.pollMs} onChange={(event) => update({ pollMs: Number(event.target.value) })} /></label>
                  </div>
                  {usesAgentSimulation && <SimulationValueField tag={draft} onChange={(simulationValue) => update({ simulationValue })} />}
                </div>
              </details>
            </>
          )}

          {messages.length > 0 && <div className="inline-issues">{messages.map((message) => <p key={message}>{message}</p>)}</div>}
        </div>

        <footer>
          <div>
            {mode === "edit" && onRemove && (
              <button className="danger-action" disabled={referenceCount > 0} title={referenceCount > 0 ? `Esta Tag possui ${referenceCount} vínculo(s).` : "Excluir Tag global"} type="button" onClick={onRemove}><Trash2 size={16} /> Excluir</button>
            )}
            {mode === "edit" && referenceCount > 0 && <small>Usada em {referenceCount} local(is)</small>}
          </div>
          <div className="modal-footer-actions">
            <button type="button" onClick={onClose}>Cancelar</button>
            <button className="primary-action compact" disabled={messages.length > 0} type="button" onClick={save}><Check size={16} /> {mode === "create" ? "Criar" : "Salvar"}</button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function InitialValueField({ tag, onChange }: { tag: LinkPadTag; onChange: (value: TagValue) => void }) {
  if (tag.type === "bool") {
    return <label>Valor inicial<select value={String(tag.initialValue ?? false)} onChange={(event) => onChange(event.target.value === "true")}><option value="false">false</option><option value="true">true</option></select></label>;
  }
  return <label>Valor inicial<input value={String(tag.initialValue ?? "")} onChange={(event) => onChange(tag.type === "string" ? event.target.value : Number(event.target.value))} /></label>;
}

function SimulationValueField({ tag, onChange }: { tag: LinkPadTag; onChange: (value: TagValue) => void }) {
  if (tag.type === "bool") {
    return <label>Valor de teste<select value={String(tag.simulationValue ?? false)} onChange={(event) => onChange(event.target.value === "true")}><option value="false">false</option><option value="true">true</option></select></label>;
  }
  return <label>Valor de teste<input value={String(tag.simulationValue ?? "")} onChange={(event) => onChange(tag.type === "string" ? event.target.value : Number(event.target.value))} /></label>;
}

function toInternalTag(tag: LinkPadTag): LinkPadTag {
  const { protocolProfileId: _profile, address: _address, agentTag: _agentTag, pollMs: _poll, simulationValue, ...local } = tag;
  return {
    ...local,
    source: "internal",
    direction: tag.direction === "read" ? "read" : "readWrite",
    initialValue: compatibleTagValue(tag.initialValue ?? simulationValue, tag.type),
    retentive: tag.retentive === true,
    quality: "good"
  };
}

function toExternalTag(tag: LinkPadTag, project: LinkPadProject, profileId?: string): LinkPadTag {
  const { initialValue: _initialValue, retentive: _retentive, ...external } = tag;
  const profile = project.protocols.find((item) => item.id === profileId);
  const existingIndex = project.tags.findIndex((item) => item.id === tag.id);
  const addressIndex = existingIndex >= 0 ? existingIndex : project.tags.length;
  return {
    ...external,
    source: "agent",
    direction: tag.direction === "read" ? "read" : "readWrite",
    protocolProfileId: profile?.id,
    address: defaultAddressFor(profile?.driver ?? "sim", { name: tag.name, type: tag.type }, addressIndex),
    pollMs: tag.pollMs ?? project.agent.pollMs,
    simulationValue: defaultTagValue(tag.type),
    quality: "unknown"
  };
}

function cleanExternalTag(tag: LinkPadTag): LinkPadTag {
  const { initialValue: _initialValue, retentive: _retentive, ...external } = tag;
  return { ...external, source: "agent", quality: "unknown" };
}

function defaultTagValue(type: LinkPadValueType): TagValue {
  if (type === "bool") return false;
  if (type === "string") return "";
  return 0;
}

function compatibleTagValue(value: unknown, type: LinkPadValueType): TagValue {
  if (type === "bool") return typeof value === "boolean" ? value : false;
  if (type === "string") return typeof value === "string" ? value : "";
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return type === "int" ? Math.trunc(value) : value;
}

function cloneTag(tag: LinkPadTag): LinkPadTag {
  return { ...tag, address: tag.address ? { ...tag.address } : undefined };
}
