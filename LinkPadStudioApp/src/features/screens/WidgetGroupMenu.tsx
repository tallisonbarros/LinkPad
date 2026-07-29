import { ChevronDown, Group, Ungroup } from "lucide-react";
import type { LinkPadScreen } from "../../types/project";
import { groupWidgets, isWidgetLocked, ungroupWidgets } from "./widgetEditing";
import type { WidgetEditorController } from "./useWidgetEditorController";

interface WidgetGroupMenuProps {
  controller: WidgetEditorController;
  open: boolean;
  screen: LinkPadScreen;
  onOpenChange: (open: boolean) => void;
}

export function WidgetGroupMenu({ controller, open, screen, onOpenChange }: WidgetGroupMenuProps) {
  const selection = controller.selection.screenId === screen.id
    ? controller.selection
    : { screenId: "", ids: [], primaryId: "" };
  const selectedWidgets = screen.widgets.filter((widget) => selection.ids.includes(widget.id));
  const editableIds = selectedWidgets.filter((widget) => !isWidgetLocked(widget)).map((widget) => widget.id);
  const hasGroup = selectedWidgets.some((widget) => widget.editor?.groupId);

  function groupSelection() {
    if (editableIds.length < 2) return;
    const groupId = `group-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
    controller.commitWidgets(
      screen.id,
      groupWidgets(screen.widgets, editableIds, groupId),
      "Agrupar widgets",
      selection.ids
    );
  }

  function ungroupSelection() {
    if (!hasGroup) return;
    controller.commitWidgets(
      screen.id,
      ungroupWidgets(screen.widgets, selection.ids),
      "Desagrupar widgets",
      selection.ids
    );
  }

  return (
    <details className="canvas-tool-menu" open={open} onToggle={(event) => onOpenChange(event.currentTarget.open)}>
      <summary title="Agrupar ou desagrupar widgets">
        <Group size={16} />
        <span>Grupo</span>
        <ChevronDown className="menu-chevron" size={13} />
      </summary>
      <div className="canvas-tool-popover compact">
        <section>
          <strong>Organizar seleção</strong>
          <div className="arrange-command-grid two-columns">
            <button disabled={editableIds.length < 2} type="button" onClick={groupSelection}><Group size={13} /> Agrupar</button>
            <button disabled={!hasGroup} type="button" onClick={ungroupSelection}><Ungroup size={13} /> Desagrupar</button>
          </div>
        </section>
        <small>Selecione dois ou mais widgets para criar um grupo.</small>
      </div>
    </details>
  );
}
