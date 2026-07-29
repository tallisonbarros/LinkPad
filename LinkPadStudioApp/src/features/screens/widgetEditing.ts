import type { LinkPadScreen, LinkPadWidget } from "../../types/project";

export function widgetEditorMeta(widget: LinkPadWidget): NonNullable<LinkPadWidget["editor"]> {
  return {
    locked: widget.editor?.locked === true,
    ...(widget.editor?.groupId ? { groupId: widget.editor.groupId } : {})
  };
}

export function isWidgetLocked(widget: LinkPadWidget) {
  return widget.editor?.locked === true;
}

export function expandedWidgetIds(widgets: LinkPadWidget[], widgetId: string, isolate = false) {
  const widget = widgets.find((item) => item.id === widgetId);
  const groupId = isolate ? undefined : widget?.editor?.groupId;
  return groupId
    ? widgets.filter((item) => item.editor?.groupId === groupId).map((item) => item.id)
    : widget ? [widget.id] : [];
}

export function resolveWidgetContextSelection(
  widgets: LinkPadWidget[],
  selectedIds: string[],
  widgetId: string,
  isolate = false
) {
  const targetIds = expandedWidgetIds(widgets, widgetId, isolate);
  return targetIds.every((id) => selectedIds.includes(id)) ? selectedIds : targetIds;
}

export function groupWidgets(widgets: LinkPadWidget[], selectedIds: string[], groupId: string) {
  const selected = new Set(selectedIds);
  return widgets.map((widget) => selected.has(widget.id)
    ? { ...widget, editor: { ...widgetEditorMeta(widget), groupId } }
    : widget);
}

export function ungroupWidgets(widgets: LinkPadWidget[], selectedIds: string[]) {
  const selectedGroups = new Set(widgets
    .filter((widget) => selectedIds.includes(widget.id) && widget.editor?.groupId)
    .map((widget) => widget.editor!.groupId!));
  return widgets.map((widget) => widget.editor?.groupId && selectedGroups.has(widget.editor.groupId)
    ? { ...widget, editor: { ...widgetEditorMeta(widget), groupId: undefined } }
    : widget);
}

export function setWidgetsLocked(widgets: LinkPadWidget[], selectedIds: string[], locked: boolean) {
  const selected = new Set(selectedIds);
  return widgets.map((widget) => selected.has(widget.id)
    ? { ...widget, editor: { ...widgetEditorMeta(widget), locked } }
    : widget);
}

export function setWidgetsVisible(widgets: LinkPadWidget[], selectedIds: string[], visible: boolean) {
  const selected = new Set(selectedIds);
  return widgets.map((widget) => selected.has(widget.id) ? { ...widget, visible } : widget);
}

export function cloneWidgetsForPaste(
  source: LinkPadWidget[],
  screen: Pick<LinkPadScreen, "width" | "height">,
  offset: number,
  createId: (prefix: "widget" | "group") => string
) {
  if (source.length === 0) return [];
  const groupCounts = new Map<string, number>();
  for (const widget of source) {
    const groupId = widget.editor?.groupId;
    if (groupId) groupCounts.set(groupId, (groupCounts.get(groupId) ?? 0) + 1);
  }
  const groupIds = new Map<string, string>();
  const left = Math.min(...source.map((widget) => widget.x));
  const top = Math.min(...source.map((widget) => widget.y));
  const right = Math.max(...source.map((widget) => widget.x + widget.width));
  const bottom = Math.max(...source.map((widget) => widget.y + widget.height));
  const dx = Math.max(-left, Math.min(screen.width - right, offset));
  const dy = Math.max(-top, Math.min(screen.height - bottom, offset));

  return source.map((widget) => {
    const oldGroupId = widget.editor?.groupId;
    let groupId: string | undefined;
    if (oldGroupId && (groupCounts.get(oldGroupId) ?? 0) > 1) {
      groupId = groupIds.get(oldGroupId);
      if (!groupId) {
        groupId = createId("group");
        groupIds.set(oldGroupId, groupId);
      }
    }
    return {
      ...structuredClone(widget),
      id: createId("widget"),
      x: widget.x + dx,
      y: widget.y + dy,
      editor: { locked: false, ...(groupId ? { groupId } : {}) }
    };
  });
}

export function widgetLayerName(widget: LinkPadWidget, fallback: string) {
  const text = typeof widget.props.text === "string" ? widget.props.text.trim() : "";
  return text || fallback;
}
