import type { LinkPadScreen } from "../../types/project";
import type { WidgetEditorController } from "./useWidgetEditorController";
import { widgetLayerName } from "./widgetEditing";
import { widgetNames } from "./WidgetPropertiesPanel";

interface WidgetSelectionToolbarProps {
  controller: WidgetEditorController;
  screen: LinkPadScreen;
}

export function WidgetSelectionToolbar({ controller, screen }: WidgetSelectionToolbarProps) {
  const selection = controller.selection.screenId === screen.id
    ? controller.selection
    : { screenId: "", ids: [], primaryId: "" };
  const selectedWidgets = screen.widgets.filter((widget) => selection.ids.includes(widget.id));
  const primaryWidget = selectedWidgets.find((widget) => widget.id === selection.primaryId) ?? selectedWidgets.at(-1);

  if (selectedWidgets.length === 0) return null;

  const selectionTitle = selectedWidgets.length === 1 && primaryWidget
    ? widgetLayerName(primaryWidget, widgetNames[primaryWidget.type])
    : `${selectedWidgets.length} widgets`;

  return (
    <div className="widget-selection-toolbar" aria-label="Seleção de widgets">
      <span className="widget-selection-toolbar-identity" title={selectionTitle}>
        <strong>{selectionTitle}</strong>
        <small>{selectedWidgets.length === 1 ? widgetNames[selectedWidgets[0].type] : "Seleção múltipla"}</small>
      </span>
    </div>
  );
}
