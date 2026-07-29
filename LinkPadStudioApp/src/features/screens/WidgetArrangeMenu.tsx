import { AlignCenterHorizontal, ChevronDown } from "lucide-react";
import type { LinkPadScreen, LinkPadWidget } from "../../types/project";
import { isWidgetLocked } from "./widgetEditing";
import {
  alignWidgets,
  centerWidgetsOnScreen,
  distributeWidgets,
  matchWidgetSize,
  type AlignmentMode,
  type DistributionMode
} from "./widgetGeometry";
import type { WidgetEditorController } from "./useWidgetEditorController";
import { widgetDefinition } from "./widgetCatalog";

interface WidgetArrangeMenuProps {
  controller: WidgetEditorController;
  open: boolean;
  screen: LinkPadScreen;
  onOpenChange: (open: boolean) => void;
}

export function WidgetArrangeMenu({ controller, open, screen, onOpenChange }: WidgetArrangeMenuProps) {
  const selection = controller.selection.screenId === screen.id
    ? controller.selection
    : { screenId: "", ids: [], primaryId: "" };
  const selectedWidgets = screen.widgets.filter((widget) => selection.ids.includes(widget.id));
  const editableWidgets = selectedWidgets.filter((widget) => !isWidgetLocked(widget));
  const primaryWidget = editableWidgets.find((widget) => widget.id === selection.primaryId) ?? editableWidgets.at(-1);

  function clampWidget(widget: LinkPadWidget) {
    const minimum = widgetDefinition(widget.type).minimumSize;
    const width = Math.max(minimum.width, Math.min(screen.width, widget.width));
    const height = Math.max(minimum.height, Math.min(screen.height, widget.height));
    return {
      ...widget,
      width,
      height,
      x: Math.max(0, Math.min(screen.width - width, Math.round(widget.x))),
      y: Math.max(0, Math.min(screen.height - height, Math.round(widget.y)))
    };
  }

  function commitSelected(transformed: LinkPadWidget[], label: string) {
    const replacements = new Map(transformed.map((widget) => [widget.id, clampWidget(widget)]));
    controller.commitWidgets(
      screen.id,
      screen.widgets.map((widget) => replacements.get(widget.id) ?? widget),
      label,
      selection.ids
    );
  }

  function align(mode: AlignmentMode) {
    if (!primaryWidget) return;
    commitSelected(alignWidgets(editableWidgets, primaryWidget.id, mode), "Alinhar widgets");
  }

  function distribute(mode: DistributionMode) {
    commitSelected(distributeWidgets(editableWidgets, mode), "Distribuir widgets");
  }

  function center(axis: "horizontal" | "vertical") {
    commitSelected(centerWidgetsOnScreen(editableWidgets, screen, axis), "Centralizar widgets");
  }

  function matchSize(dimension: "width" | "height" | "both") {
    if (!primaryWidget) return;
    commitSelected(matchWidgetSize(editableWidgets, primaryWidget.id, dimension), "Igualar tamanho");
  }

  return (
    <details className="canvas-tool-menu" open={open} onToggle={(event) => onOpenChange(event.currentTarget.open)}>
      <summary
        title="Alinhar, distribuir e igualar widgets"
      >
        <AlignCenterHorizontal size={16} />
        <span>Alinhar</span>
        <ChevronDown className="menu-chevron" size={13} />
      </summary>
      <div className="canvas-tool-popover">
        <section>
          <strong>Alinhar à referência</strong>
          <div className="arrange-command-grid three-columns">
            <button disabled={editableWidgets.length < 2} title="O último widget selecionado é a referência" type="button" onClick={() => align("left")}>Esquerda</button>
            <button disabled={editableWidgets.length < 2} type="button" onClick={() => align("hcenter")}>Centro H</button>
            <button disabled={editableWidgets.length < 2} type="button" onClick={() => align("right")}>Direita</button>
            <button disabled={editableWidgets.length < 2} type="button" onClick={() => align("top")}>Topo</button>
            <button disabled={editableWidgets.length < 2} type="button" onClick={() => align("vcenter")}>Centro V</button>
            <button disabled={editableWidgets.length < 2} type="button" onClick={() => align("bottom")}>Base</button>
          </div>
        </section>
        <section>
          <strong>Distribuir</strong>
          <div className="arrange-command-grid two-columns">
            <button disabled={editableWidgets.length < 3} type="button" onClick={() => distribute("horizontal")}>Horizontal</button>
            <button disabled={editableWidgets.length < 3} type="button" onClick={() => distribute("vertical")}>Vertical</button>
          </div>
        </section>
        <section>
          <strong>Centralizar na tela</strong>
          <div className="arrange-command-grid two-columns">
            <button disabled={editableWidgets.length === 0} type="button" onClick={() => center("horizontal")}>Horizontal</button>
            <button disabled={editableWidgets.length === 0} type="button" onClick={() => center("vertical")}>Vertical</button>
          </div>
        </section>
        <section>
          <strong>Igualar tamanho</strong>
          <div className="arrange-command-grid three-columns">
            <button disabled={editableWidgets.length < 2} type="button" onClick={() => matchSize("width")}>Largura</button>
            <button disabled={editableWidgets.length < 2} type="button" onClick={() => matchSize("height")}>Altura</button>
            <button disabled={editableWidgets.length < 2} type="button" onClick={() => matchSize("both")}>Ambos</button>
          </div>
        </section>
        <small>Alinhamento usa o último widget selecionado como referência.</small>
      </div>
    </details>
  );
}
