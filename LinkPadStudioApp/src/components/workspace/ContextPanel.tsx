import { Cable, Cpu, FileJson, Gauge, Info, RadioTower, Tags } from "lucide-react";
import type { HardwareManifest, LinkPadProject, WorkspaceTab } from "../../types/project";

interface ContextPanelProps {
  project: LinkPadProject;
  hardware: HardwareManifest;
  activeTab: WorkspaceTab;
}

export function ContextPanel({ project, hardware, activeTab }: ContextPanelProps) {
  const sections = {
    overview: [
      ["Projeto", project.name],
      ["Schema", project.schemaVersion],
      ["Pasta", project.folderPath || "-"]
    ],
    device: [
      ["Hardware", hardware.name],
      ["Runtime", hardware.runtime],
      ["Entrada", hardware.inputs.map((input) => input.label).join(", ")]
    ],
    communication: [
      ["Modo", project.agent.mode.toUpperCase()],
      ["Host", project.agent.host],
      ["Timeout", `${project.agent.timeoutMs} ms`]
    ],
    connectors: [
      ["Perfis", String(project.protocols.length)],
      ["Ativos", String(project.protocols.filter((profile) => profile.enabled).length)],
      ["Drivers", [...new Set(project.protocols.filter((profile) => profile.enabled).map((profile) => profile.driver))].join(", ") || "-"]
    ],
    tags: [
      ["Tags", String(project.tags.length)],
      ["Origem padrao", "agent"],
      ["Qualidade inicial", "unknown"]
    ],
    screen: [
      ["Tela", activeTab.title],
      ["Resolucao", `${hardware.display.width} x ${hardware.display.height}`],
      ["Touch", hardware.display.touch ? "Sim" : "Nao"]
    ],
    assets: [
      ["Fontes", String(project.assets.fonts.length)],
      ["Imagens", String(project.assets.images.length)],
      ["Destino", "assets/"]
    ],
    build: [
      ["Target", hardware.runtime],
      ["Device", hardware.id],
      ["Estado", "Pendente"]
    ],
    diagnostics: [
      ["Agent", "Nao testado"],
      ["PLC", "Indisponivel"],
      ["Ultimo erro", "-"]
    ]
  } as const;

  const icons = {
    overview: Info,
    device: Cpu,
    communication: RadioTower,
    connectors: Cable,
    tags: Tags,
    screen: Gauge,
    assets: FileJson,
    build: Cpu,
    diagnostics: Info
  };

  const Icon = icons[activeTab.kind];

  return (
    <aside className="context-panel">
      <div className="panel-title">
        <Icon size={18} />
        <span>Contexto</span>
      </div>
      <div className="property-list">
        {sections[activeTab.kind].map(([label, value]) => (
          <div className="property-row" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="context-band">
        <small>Guia ativa</small>
        <strong>{activeTab.title}</strong>
      </div>
    </aside>
  );
}
