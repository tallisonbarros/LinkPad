import { useEffect, useMemo, useState } from "react";
import {
  Cable,
  Check,
  CheckCircle2,
  Cpu,
  FlaskConical,
  LoaderCircle,
  Plus,
  PlugZap,
  Trash2,
  X,
  XCircle
} from "lucide-react";
import {
  connectorCatalog,
  defaultAddressFor,
  defaultEndpointFor,
  getConnectorManifest
} from "../../data/connectorCatalog";
import { countProfileBindings, resetDirectBindingsForDriver } from "../../domain/project/dataBindings";
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

const availablePlcDrivers = connectorCatalog.filter((connector) => connector.id !== "sim" && connector.available);

function createProfileId() {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
  return `connector-${suffix}`;
}

function generatedProfileName(driver: ConnectorDriver, sequence: number) {
  if (driver === "sim") return sequence === 1 ? "Simulador LinkPad" : `Simulador LinkPad ${sequence}`;
  const base = getConnectorManifest(driver).name;
  return sequence === 1 ? `PLC ${base}` : `PLC ${base} ${sequence}`;
}

function isGeneratedProfileName(name: string, driver: ConnectorDriver) {
  const escaped = getConnectorManifest(driver).name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (driver === "sim") return /^(?:Simulação principal|Simulação \d+|Simulador LinkPad(?: \d+)?)$/i.test(name.trim());
  if (driver === "siemens-s7" && /^Siemens S7 principal$/i.test(name.trim())) return true;
  return new RegExp(`^(?:${escaped}(?: principal| \\d+)?|PLC ${escaped}(?: \\d+)?)$`, "i").test(name.trim());
}

function endpointLabel(driver: ConnectorDriver) {
  if (driver === "sim") return "Identificador";
  if (driver === "siemens-s7") return "IP do PLC";
  if (driver === "opcua") return "Servidor OPC UA";
  if (driver === "rockwell-logix") return "IP ou rota do PLC";
  if (driver === "modbus-tcp") return "IP do equipamento";
  return "Nome da estação";
}

function endpointInputValue(profile: ProtocolProfile) {
  if (profile.driver === "sim") return profile.endpoint.replace(/^memory:\/\//i, "");
  if (profile.driver === "siemens-s7") return profile.endpoint.replace(/^s7:\/\//i, "").replace(/:102$/i, "");
  if (profile.driver === "opcua") return profile.endpoint.replace(/^opc\.tcp:\/\//i, "").replace(/:4840\/?$/i, "");
  return profile.endpoint;
}

function endpointFromInput(driver: ConnectorDriver, value: string) {
  const clean = value.trim();
  if (driver === "sim") return `memory://${clean.replace(/^memory:\/\//i, "")}`;
  if (driver === "siemens-s7") {
    const host = clean.replace(/^s7:\/\//i, "").replace(/:102$/i, "");
    return `s7://${host}:102`;
  }
  if (driver === "opcua") {
    const host = clean.replace(/^opc\.tcp:\/\//i, "").replace(/:4840\/?$/i, "");
    return `opc.tcp://${host}:4840`;
  }
  return clean;
}

export function ConnectorEditor({ project, onSetProject }: ConnectorEditorProps) {
  const [selectedProfileId, setSelectedProfileId] = useState(project.protocols[0]?.id ?? "");
  const [testState, setTestState] = useState<ConnectionTestState>({ kind: "idle" });
  const [addPlcOpen, setAddPlcOpen] = useState(false);
  const [newPlcDriver, setNewPlcDriver] = useState<ConnectorDriver>(availablePlcDrivers[0]?.id ?? "siemens-s7");
  const activeProfile = project.protocols.find((profile) => profile.id === selectedProfileId) ?? project.protocols[0];
  const activeManifest = getConnectorManifest(activeProfile?.driver ?? "sim");
  const referenceCount = useMemo(
    () => activeProfile ? countProfileBindings(project, activeProfile.id) : 0,
    [activeProfile, project]
  );
  const plcProfiles = project.protocols.filter((profile) => profile.driver !== "sim");
  const simulationProfiles = project.protocols.filter((profile) => profile.driver === "sim");

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

  function addProfile(driver: ConnectorDriver) {
    const id = createProfileId();
    const sequence = project.protocols.filter((profile) => profile.driver === driver).length + 1;
    const endpoint = driver === "sim"
      ? `${defaultEndpointFor(driver, project.projectId)}/${id}`
      : defaultEndpointFor(driver, project.projectId);
    const profile: ProtocolProfile = {
      id,
      name: generatedProfileName(driver, sequence),
      driver,
      endpoint,
      enabled: true,
      options: { ...getConnectorManifest(driver).defaultOptions },
      ...(driver === "opcua" ? { auth: { mode: "anonymous" } } : {})
    };
    onSetProject({
      ...project,
      protocols: [...project.protocols, profile],
      updatedAt: new Date().toISOString()
    });
    setSelectedProfileId(id);
    setTestState({ kind: "idle" });
    setAddPlcOpen(false);
  }

  function removeProfile() {
    if (!activeProfile || project.protocols.length === 1 || referenceCount > 0) return;
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
    if (!activeProfile || activeProfile.driver === "sim") return;
    const manifest = getConnectorManifest(driver);
    if (!manifest.available || driver === "sim") return;
    const sequence = project.protocols.filter((profile) => profile.driver === driver && profile.id !== activeProfile.id).length + 1;
    const shouldRename = isGeneratedProfileName(activeProfile.name, activeProfile.driver);
    setTestState({ kind: "idle" });
    onSetProject({
      ...project,
      protocols: project.protocols.map((profile) => profile.id === activeProfile.id
        ? {
            ...profile,
            name: shouldRename ? generatedProfileName(driver, sequence) : profile.name,
            driver,
            endpoint: defaultEndpointFor(driver, project.projectId),
            options: { ...manifest.defaultOptions },
            auth: driver === "opcua" ? { mode: "anonymous" } : undefined
          }
        : profile),
      tags: project.tags.map((tag, index) => tag.protocolProfileId === activeProfile.id
        ? { ...tag, address: defaultAddressFor(driver, tag, index) }
        : tag),
      screens: resetDirectBindingsForDriver(project.screens, activeProfile.id, driver),
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

  const deleteTitle = referenceCount > 0
    ? "Esta comunicação está sendo usada por pontos do projeto."
    : project.protocols.length === 1
      ? "O projeto precisa manter ao menos um PLC ou simulador."
      : activeProfile?.driver === "sim" ? "Excluir simulação" : "Excluir PLC";

  return (
    <main className="workbench">
      <section className="editor-surface">
        <div className="editor-header">
          <div><Cable size={21} /><h2>Comunicações</h2></div>
          <span>{plcProfiles.length} PLC(s) no projeto</span>
        </div>

        <div className="connector-layout communication-layout">
          <section className="communication-list-panel">
            <div className="communication-section-heading">
              <div><strong>PLCs do projeto</strong><small>Controladores acessados pelo Agente LinkPad.</small></div>
              <button type="button" onClick={() => setAddPlcOpen(true)}><Plus size={16} /> Adicionar PLC</button>
            </div>

            <div className="communication-list">
              {plcProfiles.length === 0 ? (
                <div className="communication-empty"><Cpu size={22} /><span>Nenhum PLC adicionado.</span></div>
              ) : plcProfiles.map((profile) => (
                <CommunicationRow
                  active={profile.id === activeProfile?.id}
                  key={profile.id}
                  profile={profile}
                  onSelect={() => selectProfile(profile.id)}
                />
              ))}
            </div>

            <div className="communication-section-heading simulation-heading">
              <div><strong>Simulação</strong><small>Dados de desenvolvimento sem PLC físico.</small></div>
              {simulationProfiles.length === 0 && <button type="button" onClick={() => addProfile("sim")}><Plus size={16} /> Adicionar</button>}
            </div>
            <div className="communication-list">
              {simulationProfiles.map((profile) => (
                <CommunicationRow
                  active={profile.id === activeProfile?.id}
                  key={profile.id}
                  profile={profile}
                  onSelect={() => selectProfile(profile.id)}
                />
              ))}
            </div>
          </section>

          {activeProfile && (
            <aside className="profile-editor communication-editor">
              <div className="aside-title">
                <div>
                  {activeProfile.driver === "sim" ? <FlaskConical size={18} /> : <Cpu size={18} />}
                  <h3>{activeProfile.driver === "sim" ? "Simulação LinkPad" : "Comunicação com PLC"}</h3>
                </div>
                <button
                  title={deleteTitle}
                  type="button"
                  disabled={project.protocols.length === 1 || referenceCount > 0}
                  onClick={removeProfile}
                ><Trash2 size={16} /></button>
              </div>

              <label>
                Nome
                <input value={activeProfile.name} onChange={(event) => updateProfile({ name: event.target.value })} />
              </label>

              {activeProfile.driver === "sim" ? (
                <label>Tipo de comunicação<input readOnly value={activeManifest.name} /></label>
              ) : (
                <label>
                  Tipo de comunicação
                  <select value={activeProfile.driver} onChange={(event) => updateDriver(event.target.value as ConnectorDriver)}>
                    {connectorCatalog.filter((connector) => connector.id !== "sim").map((connector) => (
                      <option disabled={!connector.available} value={connector.id} key={connector.id}>
                        {connector.name}{connector.available ? "" : " — Em breve"}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label>
                {endpointLabel(activeProfile.driver)}
                <input
                  placeholder={["siemens-s7", "opcua"].includes(activeProfile.driver) ? "192.168.0.10" : activeManifest.endpointExample}
                  value={endpointInputValue(activeProfile)}
                  onChange={(event) => updateProfile({ endpoint: endpointFromInput(activeProfile.driver, event.target.value) })}
                />
              </label>

              <details className="advanced-settings">
                <summary>Configurações avançadas</summary>
                <div>
                  {activeProfile.driver === "siemens-s7" && (
                    <>
                      <div className="two-columns">
                        <label>Rack<input type="number" min={0} max={7} value={Number(activeProfile.options.rack ?? 0)} onChange={(event) => updateOption("rack", Number(event.target.value))} /></label>
                        <label>Slot<input type="number" min={0} max={31} value={Number(activeProfile.options.slot ?? 1)} onChange={(event) => updateOption("slot", Number(event.target.value))} /></label>
                      </div>
                      <label>Timeout (ms)<input type="number" min={100} max={30000} step={100} value={Number(activeProfile.options.timeoutMs ?? 2000)} onChange={(event) => updateOption("timeoutMs", Number(event.target.value))} /></label>
                    </>
                  )}
                  {activeProfile.driver === "opcua" && (
                    <>
                      <label>Segurança<input readOnly value="Anônimo · sem segurança (laboratório)" /></label>
                      <div className="two-columns">
                        <label>Timeout da sessão (ms)<input type="number" min={1000} max={3600000} step={1000} value={Number(activeProfile.options.sessionTimeoutMs ?? 30000)} onChange={(event) => updateOption("sessionTimeoutMs", Number(event.target.value))} /></label>
                        <label>Timeout da requisição (ms)<input type="number" min={100} max={30000} step={100} value={Number(activeProfile.options.requestTimeoutMs ?? 2000)} onChange={(event) => updateOption("requestTimeoutMs", Number(event.target.value))} /></label>
                      </div>
                      <small className="security-warning">SecurityPolicy None deve ser usada apenas durante a validação em rede isolada.</small>
                    </>
                  )}
                  <label className="checkbox-label">
                    <input type="checkbox" checked={activeProfile.enabled} onChange={(event) => updateProfile({ enabled: event.target.checked })} />
                    Usar esta comunicação no projeto
                  </label>
                </div>
              </details>

              <div className="connector-test-block">
                <button className="primary-action compact" type="button" disabled={testState.kind === "loading"} onClick={handleConnectionTest}>
                  {testState.kind === "loading" ? <LoaderCircle className="spin" size={17} /> : <PlugZap size={17} />}
                  Testar conexão
                </button>
                {testState.kind === "success" && (
                  <div className="test-result success">
                    <CheckCircle2 size={18} />
                    {activeProfile.driver === "sim" ? "Simulação disponível" : "PLC acessível"} · {testState.result.latencyMs} ms
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

      {addPlcOpen && (
        <div className="data-binding-backdrop" role="presentation">
          <section aria-labelledby="add-plc-heading" aria-modal="true" className="data-binding-dialog add-plc-dialog" role="dialog">
            <header>
              <div><Cpu size={20} /><span><strong id="add-plc-heading">Adicionar PLC</strong><small>Escolha como o Agente LinkPad se comunicará com ele.</small></span></div>
              <button aria-label="Fechar" type="button" onClick={() => setAddPlcOpen(false)}><X size={18} /></button>
            </header>
            <div className="communication-type-list" role="radiogroup" aria-label="Tipo de comunicação">
              {connectorCatalog.filter((connector) => connector.id !== "sim").map((connector) => (
                <button
                  aria-checked={newPlcDriver === connector.id}
                  className={newPlcDriver === connector.id ? "selected" : ""}
                  disabled={!connector.available}
                  key={connector.id}
                  role="radio"
                  type="button"
                  onClick={() => setNewPlcDriver(connector.id)}
                >
                  <span><strong>{connector.name}</strong><small>{connector.available ? "Disponível" : "Em breve"}</small></span>
                  {newPlcDriver === connector.id && connector.available && <Check size={17} />}
                </button>
              ))}
            </div>
            <footer>
              <button type="button" onClick={() => setAddPlcOpen(false)}>Cancelar</button>
              <button className="primary-action compact" type="button" onClick={() => addProfile(newPlcDriver)}><Plus size={16} /> Adicionar PLC</button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}

function CommunicationRow({ active, profile, onSelect }: { active: boolean; profile: ProtocolProfile; onSelect: () => void }) {
  const manifest = getConnectorManifest(profile.driver);
  const Icon = profile.driver === "sim" ? FlaskConical : Cpu;
  return (
    <button className={`communication-row ${active ? "selected" : ""}`} type="button" onClick={onSelect}>
      <Icon size={18} />
      <span><strong>{profile.name}</strong><small>{manifest.name}</small></span>
      <span className="communication-address">{profile.driver === "sim" ? "Desenvolvimento" : endpointInputValue(profile)}</span>
      <span aria-label={profile.enabled ? "Em uso" : "Pausado"} className={`communication-dot ${profile.enabled ? "enabled" : ""}`} />
    </button>
  );
}
