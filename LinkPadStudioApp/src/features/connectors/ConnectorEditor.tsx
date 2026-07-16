import { useEffect, useMemo, useState } from "react";
import { Cable, CheckCircle2, Clock3, LoaderCircle, Plus, PlugZap, Trash2, XCircle } from "lucide-react";
import {
  connectorCatalog,
  defaultAddressFor,
  defaultEndpointFor,
  getConnectorManifest
} from "../../data/connectorCatalog";
import {
  testConnectorConnection,
  type ConnectorConnectionDiagnostic
} from "../../services/agentService";
import type { ConnectorDriver, LinkPadProject, ProtocolProfile } from "../../types/project";

interface ConnectorEditorProps {
  project: LinkPadProject;
  onSetProject: (project: LinkPadProject) => void;
}

type ConnectionTestState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; result: ConnectorConnectionDiagnostic }
  | { kind: "error"; message: string };

function createProfileId() {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
  return `connector-${suffix}`;
}

function generatedProfileName(driver: ConnectorDriver, sequence: number) {
  const base = getConnectorManifest(driver).name;
  return sequence === 1 ? `${base} principal` : `${base} ${sequence}`;
}

function isGeneratedProfileName(name: string, driver: ConnectorDriver) {
  const escaped = getConnectorManifest(driver).name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}(?: principal| \\d+)?$`, "i").test(name.trim());
}

export function ConnectorEditor({ project, onSetProject }: ConnectorEditorProps) {
  const [selectedProfileId, setSelectedProfileId] = useState(project.protocols[0]?.id ?? "");
  const [testState, setTestState] = useState<ConnectionTestState>({ kind: "idle" });
  const activeProfile = project.protocols.find((profile) => profile.id === selectedProfileId) ?? project.protocols[0];
  const activeManifest = getConnectorManifest(activeProfile?.driver ?? "sim");
  const referencedTags = useMemo(
    () => project.tags.filter((tag) => tag.protocolProfileId === activeProfile?.id).length,
    [activeProfile?.id, project.tags]
  );

  useEffect(() => {
    if (project.protocols.length > 0 && !project.protocols.some((profile) => profile.id === selectedProfileId)) {
      setSelectedProfileId(project.protocols[0].id);
      setTestState({ kind: "idle" });
    }
  }, [project.protocols, selectedProfileId]);

  function selectProfile(profileId: string) {
    setSelectedProfileId(profileId);
    setTestState({ kind: "idle" });
  }

  function updateProfile(patch: Partial<ProtocolProfile>) {
    if (!activeProfile) return;
    setTestState({ kind: "idle" });
    onSetProject({
      ...project,
      protocols: project.protocols.map((profile) => profile.id === activeProfile.id ? { ...profile, ...patch } : profile),
      updatedAt: new Date().toISOString()
    });
  }

  function addProfile() {
    const driver: ConnectorDriver = "sim";
    const id = createProfileId();
    const sequence = project.protocols.filter((profile) => profile.driver === driver).length + 1;
    const profile: ProtocolProfile = {
      id,
      name: generatedProfileName(driver, sequence),
      driver,
      endpoint: `${defaultEndpointFor(driver, project.projectId)}/${id}`,
      enabled: true,
      options: { ...getConnectorManifest(driver).defaultOptions }
    };
    onSetProject({
      ...project,
      protocols: [...project.protocols, profile],
      updatedAt: new Date().toISOString()
    });
    setSelectedProfileId(id);
    setTestState({ kind: "idle" });
  }

  function removeProfile() {
    if (!activeProfile || project.protocols.length === 1 || referencedTags > 0) return;
    const remaining = project.protocols.filter((profile) => profile.id !== activeProfile.id);
    onSetProject({
      ...project,
      protocols: remaining,
      updatedAt: new Date().toISOString()
    });
    setSelectedProfileId(remaining[0]?.id ?? "");
    setTestState({ kind: "idle" });
  }

  function updateDriver(driver: ConnectorDriver) {
    if (!activeProfile) return;
    const manifest = getConnectorManifest(driver);
    if (!manifest.available) return;
    const sequence = project.protocols.filter((profile) => profile.driver === driver && profile.id !== activeProfile.id).length + 1;
    const shouldRename = isGeneratedProfileName(activeProfile.name, activeProfile.driver);
    const endpoint = driver === "sim"
      ? `${defaultEndpointFor(driver, project.projectId)}/${activeProfile.id}`
      : defaultEndpointFor(driver, project.projectId);
    setTestState({ kind: "idle" });
    onSetProject({
      ...project,
      protocols: project.protocols.map((profile) => profile.id === activeProfile.id
        ? {
            ...profile,
            name: shouldRename ? generatedProfileName(driver, sequence) : profile.name,
            driver,
            endpoint,
            options: { ...manifest.defaultOptions }
          }
        : profile),
      tags: project.tags.map((tag, index) => tag.protocolProfileId === activeProfile.id
        ? { ...tag, address: defaultAddressFor(driver, tag, index) }
        : tag),
      updatedAt: new Date().toISOString()
    });
  }

  function updateOption(name: string, value: number) {
    updateProfile({ options: { ...activeProfile?.options, [name]: value } });
  }

  async function handleConnectionTest() {
    if (!activeProfile) return;
    setTestState({ kind: "loading" });
    try {
      const result = await testConnectorConnection({
        agent: project.agent,
        projectId: project.projectId,
        profile: activeProfile
      });
      setTestState({ kind: "success", result });
    } catch (error) {
      setTestState({ kind: "error", message: String(error) });
    }
  }

  return (
    <main className="workbench">
      <section className="editor-surface">
        <div className="editor-header">
          <div><Cable size={21} /><h2>Conectores</h2></div>
          <span>{project.protocols.filter((profile) => profile.enabled).length} ativo(s) · uma sessão por perfil no device</span>
        </div>

        <div className="connector-layout">
          <div className="connector-main-column">
            <section className="profile-list-panel">
              <div className="profile-list-header">
                <div><strong>Perfis do projeto</strong><small>As tags escolhem qual perfil utilizar.</small></div>
                <button type="button" onClick={addProfile}><Plus size={16} /> Novo conector</button>
              </div>
              <div className="profile-list">
                {project.protocols.map((profile) => {
                  const manifest = getConnectorManifest(profile.driver);
                  const tagCount = project.tags.filter((tag) => tag.protocolProfileId === profile.id).length;
                  return (
                    <button
                      className={`profile-card ${profile.id === activeProfile?.id ? "selected" : ""}`}
                      key={profile.id}
                      type="button"
                      onClick={() => selectProfile(profile.id)}
                    >
                      <span><strong>{profile.name}</strong><small>{manifest.name}</small></span>
                      <span className={profile.enabled ? "profile-state enabled" : "profile-state"}>{profile.enabled ? "Ativo" : "Desabilitado"}</span>
                      <small>{tagCount} tag(s)</small>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="connector-catalog">
              {connectorCatalog.map((connector) => (
                <article className={connector.available ? "available" : "planned"} key={connector.id}>
                  <div>
                    <strong>{connector.name}</strong>
                    {connector.available ? <CheckCircle2 size={17} /> : <Clock3 size={17} />}
                  </div>
                  <p>{connector.description}</p>
                  <small>{connector.available ? "Disponível no MVP" : "Planejado — depende do driver no Agent"}</small>
                </article>
              ))}
            </div>
          </div>

          {activeProfile && (
            <aside className="profile-editor">
              <div className="aside-title">
                <h3>Perfil selecionado</h3>
                <button
                  title={referencedTags > 0 ? "Reassocie as tags antes de excluir." : project.protocols.length === 1 ? "O projeto precisa manter um conector." : "Excluir conector"}
                  type="button"
                  disabled={project.protocols.length === 1 || referencedTags > 0}
                  onClick={removeProfile}
                ><Trash2 size={16} /></button>
              </div>
              <label>
                Nome
                <input value={activeProfile.name} onChange={(event) => updateProfile({ name: event.target.value })} />
              </label>
              <label>
                Protocolo
                <select value={activeProfile.driver} onChange={(event) => updateDriver(event.target.value as ConnectorDriver)}>
                  {connectorCatalog.filter((connector) => connector.available).map((connector) => (
                    <option value={connector.id} key={connector.id}>{connector.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Endpoint
                <input placeholder={activeManifest.endpointExample} value={activeProfile.endpoint} onChange={(event) => updateProfile({ endpoint: event.target.value })} />
              </label>
              {activeProfile.driver === "siemens-s7" && (
                <>
                  <div className="two-columns">
                    <label>
                      Rack
                      <input type="number" min={0} max={7} value={Number(activeProfile.options.rack ?? 0)} onChange={(event) => updateOption("rack", Number(event.target.value))} />
                    </label>
                    <label>
                      Slot
                      <input type="number" min={0} max={31} value={Number(activeProfile.options.slot ?? 1)} onChange={(event) => updateOption("slot", Number(event.target.value))} />
                    </label>
                  </div>
                  <label>
                    Timeout (ms)
                    <input type="number" min={100} max={30000} step={100} value={Number(activeProfile.options.timeoutMs ?? 2000)} onChange={(event) => updateOption("timeoutMs", Number(event.target.value))} />
                  </label>
                </>
              )}
              <label className="checkbox-label">
                <input type="checkbox" checked={activeProfile.enabled} onChange={(event) => updateProfile({ enabled: event.target.checked })} />
                Perfil habilitado
              </label>
              <p>O device abrirá uma sessão independente para este perfil. O Agent continua sem configuração prévia de PLC.</p>
              <div className="connector-test-block">
                <button className="primary-action compact" type="button" disabled={testState.kind === "loading"} onClick={handleConnectionTest}>
                  {testState.kind === "loading" ? <LoaderCircle className="spin" size={17} /> : <PlugZap size={17} />}
                  Testar conexão
                </button>
                <small>Valida este perfil pelo Agent e o handshake do protocolo. Nenhuma tag é lida ou escrita.</small>
                {testState.kind === "success" && (
                  <div className="test-result success">
                    <CheckCircle2 size={18} />
                    <span>
                      {activeProfile.driver === "sim" ? "Conector acessível" : "PLC acessível"} · {testState.result.endpoint} · {testState.result.latencyMs} ms
                      {!testState.result.sessionClosed && <small>Sessão temporária aguardando limpeza pelo Agent.</small>}
                    </span>
                  </div>
                )}
                {testState.kind === "error" && (
                  <div className="test-result error"><XCircle size={18} /> {testState.message}</div>
                )}
              </div>
            </aside>
          )}
        </div>
      </section>
    </main>
  );
}
