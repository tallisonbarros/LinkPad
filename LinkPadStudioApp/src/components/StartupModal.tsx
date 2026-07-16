import { useState } from "react";
import { ChevronDown, Cpu, FileJson, Folder, FolderOpen, Plus, RotateCcw } from "lucide-react";
import { hardwareCatalog } from "../data/hardwareCatalog";
import { openProjectFromDialog, pickProjectFolder } from "../services/projectService";
import type { HardwareId, LinkPadProject, RecentProject } from "../types/project";

type StartupMode = "start" | "new";

interface StartupModalProps {
  recents: RecentProject[];
  onCreateProject: (input: { name: string; folderPath: string; hardwareId: HardwareId }) => Promise<void>;
  onOpenProject: (project: LinkPadProject) => void;
}

export function StartupModal({ recents, onCreateProject, onOpenProject }: StartupModalProps) {
  const [mode, setMode] = useState<StartupMode>("start");
  const [showRecents, setShowRecents] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [hardwareId, setHardwareId] = useState<HardwareId>("m5stickc-plus2");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function chooseFolder() {
    try {
      setError("");
      const selected = await pickProjectFolder();
      if (selected) {
        setFolderPath(selected);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel selecionar a pasta.");
    }
  }

  async function loadProject() {
    try {
      setBusy(true);
      setError("");
      const project = await openProjectFromDialog();
      if (project) {
        onOpenProject(project);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel carregar o projeto.");
    } finally {
      setBusy(false);
    }
  }

  async function submitNewProject() {
    const name = projectName.trim();
    const path = folderPath.trim();

    if (!name) {
      setError("Informe um nome para o projeto.");
      return;
    }

    if (!path) {
      setError("Informe uma pasta para salvar o projeto.");
      return;
    }

    try {
      setBusy(true);
      setError("");
      await onCreateProject({ name, folderPath: path, hardwareId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel criar o projeto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="startup-page">
      <section className="startup-dialog" aria-label="Inicializacao do LinkPad Studio">
        <div className="startup-brand">
          <div className="brand-mark">LP</div>
          <div>
            <h1>LinkPad Studio</h1>
            <p>Ambiente de engenharia para devices industriais LinkPad</p>
          </div>
        </div>

        {mode === "start" ? (
          <div className="startup-actions">
            <button className="primary-action" type="button" onClick={() => setMode("new")}>
              <Plus size={18} />
              Novo projeto
            </button>
            <button className="secondary-action" type="button" onClick={loadProject} disabled={busy}>
              <FolderOpen size={18} />
              Carregar projeto
            </button>
            <div className="recents-control">
              <button
                className="subtle-action"
                type="button"
                onClick={() => setShowRecents((value) => !value)}
                aria-expanded={showRecents}
              >
                <RotateCcw size={16} />
                Recentes
                <ChevronDown size={16} />
              </button>
              {showRecents && (
                <div className="recents-menu">
                  {recents.length === 0 ? (
                    <div className="empty-menu">Nenhum projeto recente</div>
                  ) : (
                    recents.map((recent) => (
                      <button key={recent.projectId} type="button" onClick={() => onOpenProject(recent.snapshot)}>
                        <FileJson size={16} />
                        <span>
                          <strong>{recent.name}</strong>
                          <small>{recent.folderPath || "Sem pasta registrada"}</small>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <form className="new-project-form" onSubmit={(event) => {
            event.preventDefault();
            submitNewProject();
          }}>
            <label>
              Nome
              <input value={projectName} onChange={(event) => setProjectName(event.target.value)} autoFocus disabled={busy} />
            </label>

            <label>
              Pasta
              <div className="folder-row">
                <input value={folderPath} onChange={(event) => setFolderPath(event.target.value)} disabled={busy} />
                <button type="button" title="Selecionar pasta" onClick={chooseFolder} disabled={busy}>
                  <Folder size={17} />
                </button>
              </div>
            </label>

            <label>
              Device
              <select value={hardwareId} onChange={(event) => setHardwareId(event.target.value as HardwareId)} disabled={busy}>
                {hardwareCatalog.map((hardware) => (
                  <option key={hardware.id} value={hardware.id}>
                    {hardware.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="device-summary">
              <Cpu size={18} />
              <span>240 x 135 px | Wi-Fi | 3 botoes | Arduino ESP32</span>
            </div>

            <div className="form-actions">
              <button type="button" className="secondary-action compact" onClick={() => setMode("start")} disabled={busy}>
                Voltar
              </button>
              <button type="submit" className="primary-action compact" disabled={busy}>
                {busy ? "Criando..." : "Criar projeto"}
              </button>
            </div>
          </form>
        )}

        {error && <div className="startup-error">{error}</div>}
      </section>
    </main>
  );
}
