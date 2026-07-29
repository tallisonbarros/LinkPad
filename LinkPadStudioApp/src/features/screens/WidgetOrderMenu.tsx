import { ChevronDown, Layers3 } from "lucide-react";
import type { LinkPadScreen } from "../../types/project";
import { isWidgetLocked } from "./widgetEditing";
import { reorderWidgets } from "./widgetGeometry";
import type { WidgetEditorController } from "./useWidgetEditorController";

interface WidgetOrderMenuProps {
  controller: WidgetEditorController;
  open: boolean;
  screen: LinkPadScreen;
  onOpenChange: (open: boolean) => void;
}

type OrderDestination = "front" | "forward" | "backward" | "back";

export function WidgetOrderMenu({ controller, open, screen, onOpenChange }: WidgetOrderMenuProps) {
  const selection = controller.selection.screenId === screen.id
    ? controller.selection
    : { screenId: "", ids: [], primaryId: "" };
  const editableIds = screen.widgets
    .filter((widget) => selection.ids.includes(widget.id) && !isWidgetLocked(widget))
    .map((widget) => widget.id);

  function reorder(destination: OrderDestination) {
    if (editableIds.length === 0) return;
    const labels: Record<OrderDestination, string> = {
      front: "Trazer para frente",
      forward: "Avançar uma camada",
      backward: "Recuar uma camada",
      back: "Enviar para trás"
    };
    controller.commitWidgets(
      screen.id,
      reorderWidgets(screen.widgets, editableIds, destination),
      labels[destination],
      selection.ids
    );
  }

  return (
    <details className="canvas-tool-menu" open={open} onToggle={(event) => onOpenChange(event.currentTarget.open)}>
      <summary title="Alterar a ordem das camadas">
        <Layers3 size={16} />
        <span>Ordem</span>
        <ChevronDown className="menu-chevron" size={13} />
      </summary>
      <div className="canvas-tool-popover compact">
        <section>
          <strong>Ordem das camadas</strong>
          <div className="arrange-command-grid two-columns">
            <button disabled={editableIds.length === 0} type="button" onClick={() => reorder("front")}>Trazer à frente</button>
            <button disabled={editableIds.length === 0} type="button" onClick={() => reorder("forward")}>Avançar</button>
            <button disabled={editableIds.length === 0} type="button" onClick={() => reorder("backward")}>Recuar</button>
            <button disabled={editableIds.length === 0} type="button" onClick={() => reorder("back")}>Enviar atrás</button>
          </div>
        </section>
        <small>Itens bloqueados mantêm a posição atual.</small>
      </div>
    </details>
  );
}
