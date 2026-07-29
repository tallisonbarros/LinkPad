import { useMemo, useState } from "react";
import { FolderOpen, HelpCircle, LayoutGrid, Settings, Wrench } from "lucide-react";
import { StartupModal } from "./components/StartupModal";
import { WorkspaceShell } from "./components/WorkspaceShell";
import { createProject, loadRecentProjects, rememberProject, saveProjectToDisk } from "./services/projectService";
import type { HardwareId, LinkPadProject, WorkspaceTab } from "./types/project";

const initialTabs: WorkspaceTab[] = [
  {
    id: "overview",
    title: "Projeto",
    kind: "overview"
  }
];

export function App() {
  const [project, setProject] = useState<LinkPadProject | null>(null);
  const [tabs, setTabs] = useState<WorkspaceTab[]>(initialTabs);
  const [activeTabId, setActiveTabId] = useState("overview");
  const [recentsRefreshKey, setRecentsRefreshKey] = useState(0);

  const recents = useMemo(() => loadRecentProjects(), [recentsRefreshKey]);

  function openProject(nextProject: LinkPadProject) {
    rememberProject(nextProject);
    setProject(nextProject);
    setTabs(initialTabs);
    setActiveTabId("overview");
    setRecentsRefreshKey((value) => value + 1);
  }

  async function handleCreateProject(input: { name: string; folderPath: string; hardwareId: HardwareId }) {
    openProject(await saveProjectToDisk(createProject(input)));
  }

  async function handleSaveProject() {
    if (!project) {
      return;
    }

    const savedProject = await saveProjectToDisk(project);
    setProject(savedProject);
    rememberProject(savedProject);
    setRecentsRefreshKey((value) => value + 1);
  }

  if (!project) {
    return (
      <StartupModal
        recents={recents}
        onCreateProject={handleCreateProject}
        onOpenProject={openProject}
      />
    );
  }

  return (
    <WorkspaceShell
      project={project}
      tabs={tabs}
      activeTabId={activeTabId}
      appMenu={[
        { label: "Projeto", icon: FolderOpen },
        { label: "Exibir", icon: LayoutGrid },
        { label: "Ferramentas", icon: Wrench },
        { label: "Ajuda", icon: HelpCircle }
      ]}
      utilityActions={[
        { label: "Configuracoes", icon: Settings }
      ]}
      onSetProject={setProject}
      onOpenTab={(tab) => {
        setTabs((current) => {
          if (current.some((item) => item.id === tab.id)) {
            return current;
          }
          return [...current, tab];
        });
        setActiveTabId(tab.id);
      }}
      onCloseTab={(tabId) => {
        setTabs((current) => {
          const next = current.filter((tab) => tab.id !== tabId);
          if (activeTabId === tabId) {
            setActiveTabId(next.at(-1)?.id ?? "overview");
          }
          return next.length > 0 ? next : initialTabs;
        });
      }}
      onSetActiveTab={setActiveTabId}
      onSaveProject={handleSaveProject}
      onCloseProject={() => setProject(null)}
    />
  );
}
