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
            <h2>Comunicação</h2>
          </div>
          <span>Device → HTTP/JSON → LinkPad Agent</span>
        </div>

        <div className="settings-sections">
          <section>
            <h3><Wifi size={18} /> Rede do device</h3>
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
            <h3><RadioTower size={18} /> LinkPad Agent</h3>
            <div className="form-grid compact-grid">
              <label>
                Host ou IP
                <input value={project.agent.host} onChange={(event) => updateAgent({ host: event.target.value })} />
              </label>
              <label>
                Porta
                <input type="number" min={1} max={65535} value={project.agent.port} onChange={(event) => updateAgent({ port: Number(event.target.value) })} />
              </label>
              <label>
                Poll (ms)
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

            <div className="diagnostic-row">
              <button className="primary-action compact" type="button" disabled={testState.kind === "loading"} onClick={handleTest}>
                {testState.kind === "loading" ? <LoaderCircle className="spin" size={17} /> : <RadioTower size={17} />}
                Testar Agent
              </button>
              {testState.kind === "success" && (
                <div className="test-result success">
                  <CheckCircle2 size={18} />
                  Agent {testState.result.status.version ?? ""} disponível · drivers: {testState.result.status.drivers?.join(", ") || "nenhum"}
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
