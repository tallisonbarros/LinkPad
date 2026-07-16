import { Cable, ChevronRight, Cpu, FileJson, Folder, Gauge, HardDrive, Network, Plus, Tags, Wrench } from "lucide-react";
import { getHardwareManifest } from "../../data/hardwareCatalog";
import { createDefaultInputBindings } from "../../domain/project/migrations";
import type { LinkPadProject, WorkspaceTab } from "../../types/project";

interface ProjectTreeProps {
  project: LinkPadProject;
  onSetProject: (project: LinkPadProject) => void;
  onOpenTab: (tab: WorkspaceTab) => void;
}

function createId(prefix: string) {
  const cryptoId = globalThis.crypto?.randomUUID?.();
  return cryptoId ? `${prefix}-${cryptoId}` : `${prefix}-${Date.now()}`;
}

export function ProjectTree({ project, onSetProject, onOpenTab }: ProjectTreeProps) {
  function open(tab: WorkspaceTab) {
    onOpenTab(tab);
  }

  function createScreen() {
    const nextNumber = project.screens.length + 1;
    const display = getHardwareManifest(project.hardware.hardwareId).display;
    const screenBase = {
      id: createId("screen"),
      name: `Tela ${nextNumber}`,
      width: display.width,
      height: display.height,
      widgets: []
    };
    const screen = { ...screenBase, inputBindings: createDefaultInputBindings(screenBase) };
    onSetProject({
      ...project,
      screens: [...project.screens, screen],
      updatedAt: new Date().toISOString()
    });
    open({
      id: `screen:${screen.id}`,
      title: screen.name,
      kind: "screen",
      refId: screen.id
    });
  }

  return (
    <aside className="project-tree">
      <div className="tree-header">
        <Folder size={18} />
        <span>{project.name}</span>
      </div>

      <div className="tree-section">
        <button type="button" onClick={() => open({ id: "overview", title: "Projeto", kind: "overview" })}>
          <FileJson size={16} />
          Projeto
        </button>
        <button type="button" onClick={() => open({ id: "device", title: "Device", kind: "device" })}>
          <Cpu size={16} />
          Device
        </button>
        <button type="button" onClick={() => open({ id: "communication", title: "Comunicacao", kind: "communication" })}>
          <Network size={16} />
          Comunicacao
        </button>
        <button type="button" onClick={() => open({ id: "connectors", title: "Conectores", kind: "connectors" })}>
          <Cable size={16} />
          Conectores
        </button>
        <button type="button" onClick={() => open({ id: "tags", title: "Tags", kind: "tags" })}>
          <Tags size={16} />
          Tags
        </button>
      </div>

      <div className="tree-group">
        <div className="tree-group-title">
          <span>
            <ChevronRight size={14} />
            Telas
          </span>
          <button type="button" title="Nova tela" onClick={createScreen}>
            <Plus size={14} />
          </button>
        </div>
        {project.screens.map((screen) => (
          <button
            className="tree-child"
            key={screen.id}
            type="button"
            onClick={() => open({ id: `screen:${screen.id}`, title: screen.name, kind: "screen", refId: screen.id })}
          >
            <Gauge size={15} />
            {screen.name}
          </button>
        ))}
      </div>

      <div className="tree-section bottom">
        <button type="button" onClick={() => open({ id: "assets", title: "Assets", kind: "assets" })}>
          <HardDrive size={16} />
          Assets
        </button>
        <button type="button" onClick={() => open({ id: "build", title: "Build", kind: "build" })}>
          <Wrench size={16} />
          Build
        </button>
        <button type="button" onClick={() => open({ id: "diagnostics", title: "Diagnostico", kind: "diagnostics" })}>
          <Network size={16} />
          Diagnostico
        </button>
      </div>
    </aside>
  );
}
