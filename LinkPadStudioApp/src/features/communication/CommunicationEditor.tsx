import { useState } from "react";
import { CheckCircle2, LoaderCircle, RadioTower, Wifi, XCircle } from "lucide-react";
import { testAgentConnection, type AgentDiagnostic } from "../../services/agentService";
import type { LinkPadProject } from "../../types/project";

interface CommunicationEditorProps {
  project: LinkPadProject;
  onSetProject: (project: LinkPadProject) => void;
}

type TestState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; result: AgentDiagnostic }
  | { kind: "error"; message: string };

export function CommunicationEditor({ project, onSetProject }: CommunicationEditorProps) {
  const [testState, setTestState] = useState<TestState>({ kind: "idle" });

  function updateAgent(patch: Partial<LinkPadProject["agent"]>) {
    onSetProject({
      ...project,
      agent: { ...project.agent, ...patch },
      updatedAt: new Date().toISOString()
    });
  }

  function updateNetwork(patch: Partial<LinkPadProject["network"]>) {
    onSetProject({
      ...project,
      network: { ...project.network, ...patch },
      updatedAt: new Date().toISOString()
    });
  }

  async function handleTest() {
    setTestState({ kind: "loading" });
    try {
      const result = await testAgentConnection(project.agent);
      setTestState({ kind: "success", result });
    } catch (error) {
      setTestState({ kind: "error", message: String(error) });
    }
  }

  return (
    <main className="workbench">
      <section className="editor-surface">
        <div className="editor-header">
          <div>
            <RadioTower size={21} />
            <h2>Rede LinkPad</h2>
          </div>
          <span>Wi-Fi e conexão com o Agente LinkPad</span>
        </div>

        <div className="settings-sections">
          <section>
            <h3><Wifi size={18} /> Wi-Fi do dispositivo</h3>
            <div className="form-grid compact-grid">
              <label>
                SSID Wi-Fi
                <input value={project.network.ssid} onChange={(event) => updateNetwork({ ssid: event.target.value })} />
              </label>
              <label>
                Senha Wi-Fi
                <input type="password" value={project.network.password} onChange={(event) => updateNetwork({ password: event.target.value })} />
              </label>
            </div>
            <p className="security-note">No MVP, a credencial Wi-Fi é incorporada ao firmware gerado.</p>
          </section>

          <section>
            <h3><RadioTower size={18} /> Agente LinkPad</h3>
            <div className="form-grid compact-grid">
              <label>
                Host ou IP
                <input value={project.agent.host} onChange={(event) => updateAgent({ host: event.target.value })} />
              </label>
              <label>
                Porta
                <input type="number" min={1} max={65535} value={project.agent.port} onChange={(event) => updateAgent({ port: Number(event.target.value) })} />
              </label>
            </div>

            <details className="advanced-settings network-advanced-settings">
              <summary>Configurações avançadas</summary>
              <div className="form-grid compact-grid">
                <label>
                  Atualização (ms)
                  <input type="number" min={100} value={project.agent.pollMs} onChange={(event) => updateAgent({ pollMs: Number(event.target.value) })} />
                </label>
                <label>
                  Timeout (ms)
                  <input type="number" min={100} value={project.agent.timeoutMs} onChange={(event) => updateAgent({ timeoutMs: Number(event.target.value) })} />
                </label>
                <label className="span-two">
                  Token opcional
                  <input type="password" value={project.agent.token} onChange={(event) => updateAgent({ token: event.target.value })} />
                </label>
              </div>
            </details>

            <div className="diagnostic-row">
              <button className="primary-action compact" type="button" disabled={testState.kind === "loading"} onClick={handleTest}>
                {testState.kind === "loading" ? <LoaderCircle className="spin" size={17} /> : <RadioTower size={17} />}
                Testar Agente
              </button>
              {testState.kind === "success" && (
                <div className="test-result success">
                  <CheckCircle2 size={18} />
                  Agente {testState.result.status.version ?? ""} disponível
                </div>
              )}
              {testState.kind === "error" && (
                <div className="test-result error"><XCircle size={18} /> {testState.message}</div>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
