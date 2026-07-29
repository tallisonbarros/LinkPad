import { Eye, EyeOff, Layers3, Lock, Unlock } from "lucide-react";
import type { LinkPadScreen } from "../../types/project";
import type { WidgetEditorController } from "./useWidgetEditorController";
import {
  expandedWidgetIds,
  setWidgetsLocked,
  setWidgetsVisible,
  widgetLayerName
} from "./widgetEditing";
import { widgetDefinition } from "./widgetCatalog";

interface WidgetLayersPanelProps {
  embedded?: boolean;
  onNavigate?: () => void;
  screen: LinkPadScreen;
  controller: WidgetEditorController;
}

export function WidgetLayersPanel({ embedded = false, onNavigate, screen, controller }: WidgetLayersPanelProps) {
  const selection = controller.selection.screenId === screen.id ? controller.selection.ids : [];

  function selectWidget(widgetId: string, extend: boolean, isolate: boolean) {
    const ids = expandedWidgetIds(screen.widgets, widgetId, isolate);
    controller.select(screen.id, extend ? [...selection, ...ids] : ids, widgetId);
    onNavigate?.();
  }

  const list = (
    <div className="widget-layers-list">
        {[...screen.widgets].reverse().map((widget) => {
          const selected = selection.includes(widget.id);
          const locked = widget.editor?.locked === true;
          return (
            <div className={`widget-layer-row ${selected ? "selected" : ""} ${locked ? "locked" : ""}`} key={widget.id}>
              <button
                className="widget-layer-name"
                title={widget.editor?.groupId ? "Clique seleciona o grupo; Alt seleciona somente este item" : "Selecionar widget"}
                type="button"
                onClick={(event) => selectWidget(widget.id, event.shiftKey, event.altKey)}
              >
                <strong>{widgetLayerName(widget, widgetDefinition(widget.type).label)}</strong>
                <small>{widgetDefinition(widget.type).label}{widget.editor?.groupId ? " · grupo" : ""}</small>
              </button>
              <button
                aria-label={widget.visible ? "Ocultar widget" : "Mostrar widget"}
                title={widget.visible ? "Ocultar" : "Mostrar"}
                type="button"
                onClick={() => controller.commitWidgets(
                  screen.id,
                  setWidgetsVisible(screen.widgets, [widget.id], !widget.visible),
                  widget.visible ? "Ocultar widget" : "Mostrar widget",
                  selection
                )}
              >{widget.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
              <button
                aria-label={locked ? "Desbloquear widget" : "Bloquear widget"}
                title={locked ? "Desbloquear" : "Bloquear"}
                type="button"
                onClick={() => controller.commitWidgets(
                  screen.id,
                  setWidgetsLocked(screen.widgets, [widget.id], !locked),
                  locked ? "Desbloquear widget" : "Bloquear widget",
                  selection
                )}
              >{locked ? <Lock size={14} /> : <Unlock size={14} />}</button>
            </div>
          );
        })}
        {screen.widgets.length === 0 && <p>Nenhum widget nesta tela.</p>}
    </div>
  );

  if (embedded) return <section className="widget-layers-embedded">{list}</section>;

  return (
    <details className="context-tool-section widget-layers-section" open>
      <summary><span><Layers3 size={14} /> Camadas</span><small>{screen.widgets.length}</small></summary>
      {list}
    </details>
  );
}
