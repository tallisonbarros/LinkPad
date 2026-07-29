import { useState } from "react";
import { Grid3X3, Keyboard, Magnet, Minus, Monitor, Plus, Redo2, Ruler, ShieldCheck, TriangleAlert, Undo2 } from "lucide-react";
import type { LinkPadProject, LinkPadScreen } from "../../types/project";
import { ScreenCanvas } from "./ScreenCanvas";
import { ScreenBottomPanel } from "./ScreenBottomPanel";
import { ScreenControlsEditor } from "./ScreenControlsEditor";
import type { WidgetEditorController } from "./useWidgetEditorController";
import { WidgetArrangeMenu } from "./WidgetArrangeMenu";
import { WidgetAuditPanel } from "./WidgetAuditPanel";
import { WidgetGroupMenu } from "./WidgetGroupMenu";
import { WidgetOrderMenu } from "./WidgetOrderMenu";
import { WidgetSelectionToolbar } from "./WidgetSelectionToolbar";
import { auditScreenWidgets } from "./widgetAudit";

interface ScreenEditorProps {
  project: LinkPadProject;
  screenId?: string;
  controller: WidgetEditorController;
  onSetProject: (project: LinkPadProject) => void;
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];
type CanvasToolMenu = "arrange" | "order" | "group";

export function ScreenEditor({ project, screenId, controller, onSetProject }: ScreenEditorProps) {
  const screen = project.screens.find((item) => item.id === screenId) ?? project.screens[0];
  const [zoom, setZoom] = useState(0);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [guidesEnabled, setGuidesEnabled] = useState(true);
  const [auditEnabled, setAuditEnabled] = useState(true);
  const [gridSize, setGridSize] = useState(4);
  const [openToolMenu, setOpenToolMenu] = useState<CanvasToolMenu | null>(null);

  if (!screen) return null;

  const auditWarningCount = auditScreenWidgets(project, screen)
    .filter((issue) => issue.severity === "warning")
    .length;

  function updateScreen(nextScreen: LinkPadScreen) {
    onSetProject({
      ...project,
      screens: project.screens.map((item) => item.id === nextScreen.id ? nextScreen : item),
      updatedAt: new Date().toISOString()
    });
  }

  function changeZoom(direction: -1 | 1) {
    const current = zoom === 0 ? 1 : zoom;
    const index = ZOOM_STEPS.reduce((best, value, itemIndex) => Math.abs(value - current) < Math.abs(ZOOM_STEPS[best] - current) ? itemIndex : best, 0);
    setZoom(ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, index + direction))]);
  }

  function setToolMenuOpen(menu: CanvasToolMenu, open: boolean) {
    setOpenToolMenu((current) => open ? menu : current === menu ? null : current);
  }

  return (
    <main className="workbench screen-workbench">
      <section className="editor-surface screen-editor">
        <div className="editor-header">
          <div><Monitor size={21} /><h2>{screen.name}</h2></div>
          <span>{screen.width} × {screen.height}</span>
        </div>

        <div className="canvas-toolbar" aria-label="Ferramentas do canvas">
          <div className="canvas-toolbar-group">
            <button disabled={!controller.canUndo} title="Desfazer (Ctrl+Z)" type="button" onClick={controller.undo}><Undo2 size={16} /></button>
            <button disabled={!controller.canRedo} title="Refazer (Ctrl+Y)" type="button" onClick={controller.redo}><Redo2 size={16} /></button>
          </div>
          <div className="canvas-toolbar-group">
            <button title="Diminuir zoom" type="button" onClick={() => changeZoom(-1)}><Minus size={16} /></button>
            <button className="zoom-label" title="Ajustar o display" type="button" onClick={() => setZoom(0)}>{zoom === 0 ? "Ajustar" : `${Math.round(zoom * 100)}%`}</button>
            <button title="Aumentar zoom" type="button" onClick={() => changeZoom(1)}><Plus size={16} /></button>
          </div>
          <div className="canvas-toolbar-group">
            <button className={gridEnabled ? "active" : ""} title="Mostrar grade" type="button" onClick={() => setGridEnabled((value) => !value)}><Grid3X3 size={16} /> Grade</button>
            <button className={snapEnabled ? "active" : ""} title={`Snap de ${gridSize} px`} type="button" onClick={() => setSnapEnabled((value) => !value)}><Magnet size={16} /> Snap</button>
            <button className={guidesEnabled ? "active" : ""} title="Mostrar guias inteligentes" type="button" onClick={() => setGuidesEnabled((value) => !value)}><Ruler size={16} /> Guias</button>
            <button className={auditEnabled ? "active" : ""} title="Destacar alertas de qualidade visual" type="button" onClick={() => setAuditEnabled((value) => !value)}><ShieldCheck size={16} /> Revisão</button>
            <label className="grid-size-control" title="Espaçamento da grade">
              <span>px</span>
              <select aria-label="Espaçamento da grade" value={gridSize} onChange={(event) => setGridSize(Number(event.target.value))}>
                {[1, 2, 4, 5, 8, 10].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
          </div>
          <div className="canvas-toolbar-group">
            <WidgetArrangeMenu
              controller={controller}
              open={openToolMenu === "arrange"}
              screen={screen}
              onOpenChange={(open) => setToolMenuOpen("arrange", open)}
            />
            <WidgetOrderMenu
              controller={controller}
              open={openToolMenu === "order"}
              screen={screen}
              onOpenChange={(open) => setToolMenuOpen("order", open)}
            />
            <WidgetGroupMenu
              controller={controller}
              open={openToolMenu === "group"}
              screen={screen}
              onOpenChange={(open) => setToolMenuOpen("group", open)}
            />
          </div>
          <WidgetSelectionToolbar controller={controller} screen={screen} />
        </div>

        <div className="screen-layout">
          <div className="device-preview-wrap">
            <ScreenCanvas
              controller={controller}
              auditEnabled={auditEnabled}
              gridEnabled={gridEnabled}
              guidesEnabled={guidesEnabled}
              gridSize={gridSize}
              project={project}
              screen={screen}
              snapEnabled={snapEnabled}
              zoom={zoom}
            />
          </div>
          <ScreenBottomPanel
            initialTabId="controls"
            tabs={[
              {
                id: "controls",
                label: "Controles",
                icon: Keyboard,
                badge: screen.inputBindings.length,
                content: <ScreenControlsEditor key={screen.id} project={project} screen={screen} onUpdateScreen={updateScreen} />
              },
              {
                id: "alerts",
                label: "Alertas",
                icon: TriangleAlert,
                badge: auditWarningCount,
                content: <WidgetAuditPanel embedded controller={controller} project={project} screen={screen} />
              }
            ]}
          />
        </div>
      </section>
    </main>
  );
}
