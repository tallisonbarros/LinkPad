import { useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import { Activity, Cpu, Database, Monitor, RadioTower, Save, X } from "lucide-react";
import { getHardwareManifest } from "../data/hardwareCatalog";
import type { LinkPadProject, WorkspaceTab } from "../types/project";
import { BottomTabs } from "./workspace/BottomTabs";
import { ContextPanel } from "./workspace/ContextPanel";
import { ProjectTree } from "./workspace/ProjectTree";
import { Workbench } from "./workspace/Workbench";

interface WorkspaceShellProps {
  project: LinkPadProject;
  tabs: WorkspaceTab[];
  activeTabId: string;
  appMenu: Array<{ label: string; icon: LucideIcon }>;
  utilityActions: Array<{ label: string; icon: LucideIcon }>;
  onSetProject: (project: LinkPadProject) => void;
  onOpenTab: (tab: WorkspaceTab) => void;
  onCloseTab: (tabId: string) => void;
  onSetActiveTab: (tabId: string) => void;
  onSaveProject: () => void;
  onCloseProject: () => void;
}

export function WorkspaceShell({
  project,
  tabs,
  activeTabId,
  appMenu,
  utilityActions,
  onSetProject,
  onOpenTab,
  onCloseTab,
  onSetActiveTab,
  onSaveProject,
  onCloseProject
}: WorkspaceShellProps) {
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const hardware = getHardwareManifest(project.hardware.hardwareId);

  const statusItems = useMemo(
    () => [
      { icon: Cpu, label: hardware.name },
      { icon: RadioTower, label: `${project.agent.host}:${project.agent.port}` },
      { icon: Monitor, label: `${hardware.display.width}x${hardware.display.height}` },
      { icon: Database, label: `${project.tags.length} tags` },
      { icon: Activity, label: "Agent nao testado" }
    ],
    [hardware, project.agent.host, project.agent.port, project.tags.length]
  );

  return (
    <div className="studio-shell">
      <header className="top-menu">
        <div className="top-brand">
          <div className="brand-mark small">LP</div>
          <strong>LinkPad Studio</strong>
        </div>
        <nav className="menu-groups" aria-label="Menu superior">
          {appMenu.map((item) => (
            <button key={item.label} type="button">
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="window-actions">
          {utilityActions.map((item) => (
            <button key={item.label} type="button" title={item.label}>
              <item.icon size={17} />
            </button>
          ))}
          <button type="button" title="Salvar snapshot" onClick={onSaveProject}>
            <Save size={17} />
          </button>
          <button type="button" title="Fechar projeto" onClick={onCloseProject}>
            <X size={17} />
          </button>
        </div>
      </header>

      <div className="workspace-grid">
        <ProjectTree
          project={project}
          onSetProject={onSetProject}
          onOpenTab={onOpenTab}
        />
        <Workbench
          project={project}
          hardware={hardware}
          activeTab={activeTab}
          onSetProject={onSetProject}
          onOpenTab={onOpenTab}
        />
        <ContextPanel project={project} hardware={hardware} activeTab={activeTab} />
      </div>

      <footer className="bottom-area">
        <BottomTabs tabs={tabs} activeTabId={activeTabId} onSelect={onSetActiveTab} onClose={onCloseTab} />
        <div className="status-bar">
          {statusItems.map((item) => (
            <span key={item.label}>
              <item.icon size={14} />
              {item.label}
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}
