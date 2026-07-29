import { Cable, Cpu, Database, RadioTower, Save, Tags } from "lucide-react";
import { CommunicationEditor } from "../../features/communication/CommunicationEditor";
import { ConnectorEditor } from "../../features/connectors/ConnectorEditor";
import { BuildEditor } from "../../features/build/BuildEditor";
import { ScreenEditor } from "../../features/screens/ScreenEditor";
import type { WidgetEditorController } from "../../features/screens/useWidgetEditorController";
import { TagsEditor } from "../../features/tags/TagsEditor";
import type { HardwareManifest, LinkPadProject, WorkspaceTab } from "../../types/project";

interface WorkbenchProps {
  project: LinkPadProject;
  hardware: HardwareManifest;
  activeTab: WorkspaceTab;
  widgetEditor: WidgetEditorController;
  onSetProject: (project: LinkPadProject) => void;
  onOpenTab: (tab: WorkspaceTab) => void;
}

export function Workbench({ project, hardware, activeTab, widgetEditor, onSetProject, onOpenTab }: WorkbenchProps) {
  if (activeTab.kind === "communication") {
    return <CommunicationEditor project={project} onSetProject={onSetProject} />;
  }

  if (activeTab.kind === "connectors") {
    return <ConnectorEditor project={project} onSetProject={onSetProject} />;
  }

  if (activeTab.kind === "tags") {
    return <TagsEditor project={project} onSetProject={onSetProject} />;
  }

  if (activeTab.kind === "screen") {
    return <ScreenEditor controller={widgetEditor} project={project} screenId={activeTab.refId} onSetProject={onSetProject} />;
  }

  if (activeTab.kind === "build") {
    return <BuildEditor project={project} onSetProject={onSetProject} />;
  }

  return (
    <main className="workbench">
      <section className="editor-surface overview">
        <Header icon={Database} title={project.name} subtitle={project.folderPath || "Pasta nao definida"} />
        <div className="project-overview-content">
          <section className="project-overview-section" aria-labelledby="project-device-title">
            <div className="overview-section-header">
              <Cpu size={19} />
              <div>
                <h3 id="project-device-title">Device</h3>
                <span>Hardware deste projeto</span>
              </div>
              <strong>{hardware.name}</strong>
            </div>
            <div className="spec-grid compact-device-specs">
              <Spec label="Runtime" value={hardware.runtime} />
              <Spec label="Display" value={`${hardware.display.width} x ${hardware.display.height}`} />
              <Spec label="Rede" value={hardware.network.join(", ")} />
              <Spec label="Storage" value={hardware.storage.join(", ")} />
              <Spec label="Entradas" value={hardware.inputs.map((input) => input.label).join(", ")} />
              <Spec label="Touch" value={hardware.display.touch ? "Sim" : "Nao"} />
            </div>
          </section>

          <section className="project-overview-section" aria-labelledby="project-access-title">
            <div className="overview-section-header compact">
              <div>
                <h3 id="project-access-title">Configuração do projeto</h3>
                <span>Acessos rápidos</span>
              </div>
            </div>
            <div className="quick-grid project-quick-grid">
              <button type="button" onClick={() => onOpenTab({ id: "communication", title: "Rede LinkPad", kind: "communication" })}>
                <RadioTower size={20} />
                <span>Rede LinkPad</span>
                <strong>{project.agent.host}:{project.agent.port}</strong>
              </button>
              <button type="button" onClick={() => onOpenTab({ id: "connectors", title: "Comunicações", kind: "connectors" })}>
                <Cable size={20} />
                <span>PLCs</span>
                <strong>{project.protocols.filter((profile) => profile.driver !== "sim").length}</strong>
              </button>
              <button type="button" onClick={() => onOpenTab({ id: "tags", title: "Tags globais", kind: "tags" })}>
                <Tags size={20} />
                <span>Tags globais</span>
                <strong>{project.tags.length}</strong>
              </button>
              <button type="button" onClick={() => onOpenTab({ id: "build", title: "Build", kind: "build" })}>
                <Save size={20} />
                <span>Build</span>
                <strong>Pendente</strong>
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Header({ icon: Icon, title, subtitle }: { icon: typeof Cpu; title: string; subtitle: string }) {
  return (
    <div className="editor-header">
      <div>
        <Icon size={21} />
        <h2>{title}</h2>
      </div>
      <span>{subtitle}</span>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="spec-item">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
