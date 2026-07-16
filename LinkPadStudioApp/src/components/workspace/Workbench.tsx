import { Cpu, Database, RadioTower, Save, Tags } from "lucide-react";
import { CommunicationEditor } from "../../features/communication/CommunicationEditor";
import { ConnectorEditor } from "../../features/connectors/ConnectorEditor";
import { BuildEditor } from "../../features/build/BuildEditor";
import { ScreenEditor } from "../../features/screens/ScreenEditor";
import { TagsEditor } from "../../features/tags/TagsEditor";
import type { HardwareManifest, LinkPadProject, WorkspaceTab } from "../../types/project";

interface WorkbenchProps {
  project: LinkPadProject;
  hardware: HardwareManifest;
  activeTab: WorkspaceTab;
  onSetProject: (project: LinkPadProject) => void;
  onOpenTab: (tab: WorkspaceTab) => void;
}

export function Workbench({ project, hardware, activeTab, onSetProject, onOpenTab }: WorkbenchProps) {
  if (activeTab.kind === "device") {
    return (
      <main className="workbench">
        <section className="editor-surface">
          <Header icon={Cpu} title="Device" subtitle={hardware.name} />
          <div className="spec-grid">
            <Spec label="Runtime" value={hardware.runtime} />
            <Spec label="Display" value={`${hardware.display.width} x ${hardware.display.height}`} />
            <Spec label="Rede" value={hardware.network.join(", ")} />
            <Spec label="Storage" value={hardware.storage.join(", ")} />
            <Spec label="Entradas" value={hardware.inputs.join(", ")} />
            <Spec label="Touch" value={hardware.display.touch ? "Sim" : "Nao"} />
          </div>
        </section>
      </main>
    );
  }

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
    return <ScreenEditor project={project} screenId={activeTab.refId} onSetProject={onSetProject} />;
  }

  if (activeTab.kind === "build") {
    return <BuildEditor project={project} onSetProject={onSetProject} />;
  }

  return (
    <main className="workbench">
      <section className="editor-surface overview">
        <Header icon={Database} title={project.name} subtitle={project.folderPath || "Pasta nao definida"} />
        <div className="quick-grid">
          <button type="button" onClick={() => onOpenTab({ id: "device", title: "Device", kind: "device" })}>
            <Cpu size={20} />
            <span>Device</span>
            <strong>{hardware.name}</strong>
          </button>
          <button type="button" onClick={() => onOpenTab({ id: "communication", title: "Comunicacao", kind: "communication" })}>
            <RadioTower size={20} />
            <span>Agente</span>
            <strong>{project.agent.host}:{project.agent.port}</strong>
          </button>
          <button type="button" onClick={() => onOpenTab({ id: "tags", title: "Tags", kind: "tags" })}>
            <Tags size={20} />
            <span>Tags</span>
            <strong>{project.tags.length}</strong>
          </button>
          <button type="button" onClick={() => onOpenTab({ id: "build", title: "Build", kind: "build" })}>
            <Save size={20} />
            <span>Build</span>
            <strong>Pendente</strong>
          </button>
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
