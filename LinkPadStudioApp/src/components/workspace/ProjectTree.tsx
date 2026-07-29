import { useEffect, useRef, useState } from "react";
import { Cable, ChevronRight, ClipboardPaste, Copy, FileJson, Files, Folder, Gauge, Network, Plus, Scissors, Tags, Trash2, Wrench } from "lucide-react";
import { getHardwareManifest } from "../../data/hardwareCatalog";
import { createDefaultInputBindings } from "../../domain/project/migrations";
import {
  createEntityId,
  duplicateScreen,
  insertScreenAfter,
  moveScreenAfter
} from "../../features/screens/screenTreeActions";
import type { LinkPadProject, LinkPadScreen, WorkspaceTab } from "../../types/project";

interface ProjectTreeProps {
  project: LinkPadProject;
  activeTab: WorkspaceTab;
  onSetProject: (project: LinkPadProject) => void;
  onOpenTab: (tab: WorkspaceTab) => void;
  onCloseTab: (tabId: string) => void;
}

type ScreenClipboard = { mode: "copy" | "cut"; screen: LinkPadScreen };
type ScreenContextMenu = { screenId: string; x: number; y: number };

export function ProjectTree({ project, activeTab, onSetProject, onOpenTab, onCloseTab }: ProjectTreeProps) {
  const [clipboard, setClipboard] = useState<ScreenClipboard | null>(null);
  const [contextMenu, setContextMenu] = useState<ScreenContextMenu | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    function closeOutside(event: PointerEvent) {
      if (!contextMenuRef.current?.contains(event.target as Node)) setContextMenu(null);
    }
    function closeOnKey(event: KeyboardEvent) {
      if (event.key === "Escape") setContextMenu(null);
    }
    function close() {
      setContextMenu(null);
    }
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnKey);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnKey);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  function open(tab: WorkspaceTab) {
    onOpenTab(tab);
  }

  function screenTab(screen: LinkPadScreen): WorkspaceTab {
    return { id: `screen:${screen.id}`, title: screen.name, kind: "screen", refId: screen.id };
  }

  function activeClass(tabId: string) {
    return activeTab.id === tabId ? "active" : undefined;
  }

  function createScreen() {
    const nextNumber = project.screens.length + 1;
    const display = getHardwareManifest(project.hardware.hardwareId).display;
    const screenBase = {
      id: createEntityId("screen"),
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
    open(screenTab(screen));
  }

  function updateScreens(screens: LinkPadScreen[]) {
    onSetProject({ ...project, screens, updatedAt: new Date().toISOString() });
  }

  function copyScreen(screen: LinkPadScreen, mode: ScreenClipboard["mode"]) {
    setClipboard({ mode, screen: structuredClone(screen) });
    setContextMenu(null);
  }

  function pasteScreen(target: LinkPadScreen) {
    if (!clipboard) return;
    if (clipboard.mode === "cut") {
      const source = project.screens.find((screen) => screen.id === clipboard.screen.id);
      if (!source || source.id === target.id) return;
      updateScreens(moveScreenAfter(project.screens, source.id, target.id));
      setClipboard(null);
      setContextMenu(null);
      open(screenTab(source));
      return;
    }
    const duplicate = duplicateScreen(clipboard.screen, project.screens);
    updateScreens(insertScreenAfter(project.screens, duplicate, target.id));
    setContextMenu(null);
    open(screenTab(duplicate));
  }

  function duplicateSelectedScreen(screen: LinkPadScreen) {
    const duplicate = duplicateScreen(screen, project.screens);
    updateScreens(insertScreenAfter(project.screens, duplicate, screen.id));
    setContextMenu(null);
    open(screenTab(duplicate));
  }

  function deleteScreen(screen: LinkPadScreen) {
    if (project.screens.length <= 1) return;
    if (!window.confirm(`Excluir a tela "${screen.name}"? Referências de navegação para ela precisarão ser revisadas.`)) return;
    updateScreens(project.screens.filter((item) => item.id !== screen.id));
    if (clipboard?.mode === "cut" && clipboard.screen.id === screen.id) setClipboard(null);
    setContextMenu(null);
    onCloseTab(`screen:${screen.id}`);
  }

  function openScreenContextMenu(event: React.MouseEvent, screen: LinkPadScreen) {
    event.preventDefault();
    event.stopPropagation();
    open(screenTab(screen));
    const menuWidth = 196;
    const menuHeight = 210;
    setContextMenu({
      screenId: screen.id,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8))
    });
  }

  const contextScreen = contextMenu ? project.screens.find((screen) => screen.id === contextMenu.screenId) : undefined;
  const pasteDisabled = !clipboard || (clipboard.mode === "cut" && clipboard.screen.id === contextScreen?.id);

  return (
    <aside className="project-tree">
      <div className="tree-header">
        <Folder size={18} />
        <span>{project.name}</span>
      </div>

      <div className="tree-section">
        <button className={activeClass("overview")} type="button" onClick={() => open({ id: "overview", title: "Projeto", kind: "overview" })}>
          <FileJson size={16} />
          Projeto
        </button>
        <button className={activeClass("communication")} type="button" onClick={() => open({ id: "communication", title: "Rede LinkPad", kind: "communication" })}>
          <Network size={16} />
          Rede LinkPad
        </button>
        <button className={activeClass("connectors")} type="button" onClick={() => open({ id: "connectors", title: "Comunicações", kind: "connectors" })}>
          <Cable size={16} />
          Comunicações
        </button>
        <button className={activeClass("tags")} type="button" onClick={() => open({ id: "tags", title: "Tags globais", kind: "tags" })}>
          <Tags size={16} />
          Tags globais
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
            className={`tree-child ${activeTab.id === `screen:${screen.id}` ? "active" : ""} ${clipboard?.mode === "cut" && clipboard.screen.id === screen.id ? "cut" : ""}`}
            key={screen.id}
            type="button"
            onClick={() => open(screenTab(screen))}
            onContextMenu={(event) => openScreenContextMenu(event, screen)}
          >
            <Gauge size={15} />
            {screen.name}
          </button>
        ))}
      </div>

      <div className="tree-section bottom">
        <button className={activeClass("build")} type="button" onClick={() => open({ id: "build", title: "Build", kind: "build" })}>
          <Wrench size={16} />
          Build
        </button>
        <button className={activeClass("diagnostics")} type="button" onClick={() => open({ id: "diagnostics", title: "Diagnostico", kind: "diagnostics" })}>
          <Network size={16} />
          Diagnostico
        </button>
      </div>

      {contextMenu && contextScreen && (
        <div
          aria-label={`Ações da tela ${contextScreen.name}`}
          className="screen-tree-context-menu"
          ref={contextMenuRef}
          role="menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button role="menuitem" type="button" onClick={() => copyScreen(contextScreen, "copy")}><Copy size={15} /> Copiar</button>
          <button role="menuitem" type="button" onClick={() => copyScreen(contextScreen, "cut")}><Scissors size={15} /> Recortar</button>
          <button disabled={pasteDisabled} role="menuitem" title={pasteDisabled ? "Copie ou recorte outra tela primeiro" : `Colar abaixo de ${contextScreen.name}`} type="button" onClick={() => pasteScreen(contextScreen)}><ClipboardPaste size={15} /> Colar</button>
          <span className="screen-tree-context-separator" role="separator" />
          <button role="menuitem" type="button" onClick={() => duplicateSelectedScreen(contextScreen)}><Files size={15} /> Duplicar</button>
          <button className="danger" disabled={project.screens.length <= 1} role="menuitem" title={project.screens.length <= 1 ? "O projeto precisa manter ao menos uma tela" : "Excluir tela"} type="button" onClick={() => deleteScreen(contextScreen)}><Trash2 size={15} /> Excluir</button>
        </div>
      )}
    </aside>
  );
}
