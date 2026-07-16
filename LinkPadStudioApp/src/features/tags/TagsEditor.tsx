import { useEffect, useMemo, useState } from "react";
import { Plus, Tags, Trash2 } from "lucide-react";
import {
  defaultAddressFor,
  defaultS7DataType,
  getConnectorManifest
} from "../../data/connectorCatalog";
import { validateTag } from "../../domain/project/validation";
import type { LinkPadProject, LinkPadTag, TagValue } from "../../types/project";

interface TagsEditorProps {
  project: LinkPadProject;
  onSetProject: (project: LinkPadProject) => void;
}

function uniqueTagName(project: LinkPadProject) {
  let index = project.tags.length + 1;
  while (project.tags.some((tag) => tag.name === `Tag${index}`)) index += 1;
  return `Tag${index}`;
}

function defaultValue(type: LinkPadTag["type"]): TagValue {
  if (type === "bool") return false;
  if (type === "string") return "";
  return 0;
}

function s7DataTypes(type: LinkPadTag["type"]) {
  if (type === "bool") return ["BOOL"];
  if (type === "int") return ["INT", "DINT"];
  if (type === "float") return ["REAL"];
  return [];
}

export function TagsEditor({ project, onSetProject }: TagsEditorProps) {
  const [selectedName, setSelectedName] = useState(project.tags[0]?.name ?? "");
  const selectedTag = project.tags.find((tag) => tag.name === selectedName);
  const selectedProfile = project.protocols.find((profile) => profile.id === selectedTag?.protocolProfileId)
    ?? project.protocols.find((profile) => profile.enabled)
    ?? project.protocols[0];
  const connector = getConnectorManifest(selectedProfile?.driver ?? "sim");
  const issues = useMemo(() => selectedTag ? validateTag(project, selectedTag) : [], [project, selectedTag]);

  useEffect(() => {
    if (project.tags.length > 0 && !project.tags.some((tag) => tag.name === selectedName)) {
      setSelectedName(project.tags[0].name);
    }
  }, [project.tags, selectedName]);

  function setTags(tags: LinkPadTag[]) {
    onSetProject({ ...project, tags, updatedAt: new Date().toISOString() });
  }

  function createTag() {
    const name = uniqueTagName(project);
    const profile = project.protocols.find((item) => item.enabled) ?? project.protocols[0];
    const tag: LinkPadTag = {
      name,
      type: "float",
      direction: "read",
      source: "agent",
      protocolProfileId: profile?.id,
      address: defaultAddressFor(profile?.driver ?? "sim", { name, type: "float" }, project.tags.length),
      unit: "",
      pollMs: project.agent.pollMs,
      format: "0.0",
      simulationValue: 0,
      quality: "unknown"
    };
    setTags([...project.tags, tag]);
    setSelectedName(name);
  }

  function updateTag(patch: Partial<LinkPadTag>) {
    if (!selectedTag) return;
    const oldName = selectedTag.name;
    const nextName = patch.name ?? oldName;
    const screens = nextName === oldName ? project.screens : project.screens.map((screen) => ({
      ...screen,
      widgets: screen.widgets.map((widget) => widget.props.tag === oldName
        ? { ...widget, props: { ...widget.props, tag: nextName } }
        : widget)
    }));
    onSetProject({
      ...project,
      tags: project.tags.map((tag) => tag.name === oldName ? { ...tag, ...patch } : tag),
      screens,
      updatedAt: new Date().toISOString()
    });
    setSelectedName(nextName);
  }

  function updateType(type: LinkPadTag["type"]) {
    let address = selectedTag?.address;
    if (selectedProfile?.driver === "siemens-s7") {
      const dataType = defaultS7DataType(type);
      address = { ...address, dataType };
      if (dataType === "BOOL") address.bitOffset = Number(address.bitOffset ?? 0);
      else delete address.bitOffset;
    }
    updateTag({ type, simulationValue: defaultValue(type), address });
  }

  function updateAddress(value: string) {
    updateTag({ address: { [connector.addressField]: value } });
  }

  function updateS7Address(patch: Record<string, string | number>) {
    if (!selectedTag) return;
    const address = { ...selectedTag.address, ...patch };
    if (address.dataType !== "BOOL") delete address.bitOffset;
    else if (address.bitOffset === undefined) address.bitOffset = 0;
    updateTag({ address });
  }

  function updateProtocolProfile(profileId: string) {
    if (!selectedTag) return;
    const profile = project.protocols.find((item) => item.id === profileId);
    if (!profile) return;
    const index = project.tags.findIndex((tag) => tag.name === selectedTag.name);
    updateTag({
      protocolProfileId: profileId,
      address: defaultAddressFor(profile.driver, selectedTag, Math.max(index, 0))
    });
  }

  function removeSelected() {
    if (!selectedTag) return;
    const next = project.tags.filter((tag) => tag.name !== selectedTag.name);
    setTags(next);
    setSelectedName(next[0]?.name ?? "");
  }

  return (
    <main className="workbench">
      <section className="editor-surface">
        <div className="editor-header">
          <div><Tags size={21} /><h2>Tags</h2></div>
          <span>{project.tags.length} configurada(s)</span>
        </div>
        <div className="toolbar-row">
          <button type="button" disabled={!project.protocols.some((profile) => profile.enabled)} onClick={createTag}><Plus size={16} /> Nova tag</button>
        </div>

        <div className="tag-layout">
          <div className="data-table tag-table">
            <div className="table-head">
              <span>Nome</span><span>Tipo</span><span>Direção</span><span>Conector</span><span>Qualidade</span>
            </div>
            {project.tags.length === 0 ? (
              <div className="table-empty">Crie a primeira tag para começar.</div>
            ) : project.tags.map((tag) => (
              <button className={`table-row ${tag.name === selectedName ? "selected" : ""}`} key={tag.name} type="button" onClick={() => setSelectedName(tag.name)}>
                <span>{tag.name}</span><span>{tag.type}</span><span>{tag.direction}</span><span>{project.protocols.find((profile) => profile.id === tag.protocolProfileId)?.name ?? "-"}</span><span>{tag.quality}</span>
              </button>
            ))}
          </div>

          {selectedTag && (
            <aside className="tag-editor">
              <div className="aside-title"><h3>Propriedades</h3><button title="Excluir tag" type="button" onClick={removeSelected}><Trash2 size={16} /></button></div>
              <label>Nome<input value={selectedTag.name} onChange={(event) => updateTag({ name: event.target.value })} /></label>
              <label>Tipo<select value={selectedTag.type} onChange={(event) => updateType(event.target.value as LinkPadTag["type"])}><option value="bool">bool</option><option value="int">int</option><option value="float">float</option><option value="string">string</option></select></label>
              <label>Direção<select value={selectedTag.direction} onChange={(event) => updateTag({ direction: event.target.value as LinkPadTag["direction"] })}><option value="read">Leitura</option><option value="write">Escrita</option><option value="readWrite">Leitura e escrita</option></select></label>
              <label>Conector<select value={selectedTag.protocolProfileId ?? ""} onChange={(event) => updateProtocolProfile(event.target.value)}>{project.protocols.map((profile) => <option value={profile.id} disabled={!profile.enabled} key={profile.id}>{profile.name} · {getConnectorManifest(profile.driver).name}{profile.enabled ? "" : " (desabilitado)"}</option>)}</select></label>
              {selectedProfile?.driver === "siemens-s7" ? (
                <div className="s7-address-editor">
                  <label>Área<select value="DB" disabled><option value="DB">DB</option></select></label>
                  <div className="two-columns">
                    <label>DB<input type="number" min={1} max={65535} value={Number(selectedTag.address?.dbNumber ?? 1)} onChange={(event) => updateS7Address({ dbNumber: Number(event.target.value) })} /></label>
                    <label>Byte<input type="number" min={0} value={Number(selectedTag.address?.byteOffset ?? 0)} onChange={(event) => updateS7Address({ byteOffset: Number(event.target.value) })} /></label>
                  </div>
                  <div className="two-columns">
                    <label>
                      Tipo S7
                      <select value={String(selectedTag.address?.dataType ?? defaultS7DataType(selectedTag.type))} disabled={s7DataTypes(selectedTag.type).length === 0} onChange={(event) => updateS7Address({ dataType: event.target.value })}>
                        {s7DataTypes(selectedTag.type).length === 0
                          ? <option value="">string não suportada</option>
                          : s7DataTypes(selectedTag.type).map((type) => <option value={type} key={type}>{type}</option>)}
                      </select>
                    </label>
                    {selectedTag.address?.dataType === "BOOL" && (
                      <label>Bit<input type="number" min={0} max={7} value={Number(selectedTag.address?.bitOffset ?? 0)} onChange={(event) => updateS7Address({ bitOffset: Number(event.target.value) })} /></label>
                    )}
                  </div>
                </div>
              ) : (
                <label>Endereço ({connector.addressField})<input placeholder={connector.addressExample} value={String(selectedTag.address?.[connector.addressField] ?? "")} onChange={(event) => updateAddress(event.target.value)} /></label>
              )}
              <div className="two-columns">
                <label>Unidade<input value={selectedTag.unit ?? ""} onChange={(event) => updateTag({ unit: event.target.value })} /></label>
                <label>Poll (ms)<input type="number" min={100} value={selectedTag.pollMs ?? project.agent.pollMs} onChange={(event) => updateTag({ pollMs: Number(event.target.value) })} /></label>
              </div>
              <label>Valor de simulação<input value={String(selectedTag.simulationValue ?? "")} onChange={(event) => updateTag({ simulationValue: selectedTag.type === "bool" ? event.target.value === "true" : selectedTag.type === "string" ? event.target.value : Number(event.target.value) })} /></label>
              {selectedTag.direction !== "read" && selectedTag.type !== "bool" && (
                <div className="two-columns"><label>Mínimo<input type="number" value={selectedTag.min ?? ""} onChange={(event) => updateTag({ min: event.target.value === "" ? undefined : Number(event.target.value) })} /></label><label>Máximo<input type="number" value={selectedTag.max ?? ""} onChange={(event) => updateTag({ max: event.target.value === "" ? undefined : Number(event.target.value) })} /></label></div>
              )}
              {issues.length > 0 && <div className="inline-issues">{issues.map((issue) => <p key={`${issue.path}-${issue.message}`}>{issue.message}</p>)}</div>}
            </aside>
          )}
        </div>
      </section>
    </main>
  );
}
