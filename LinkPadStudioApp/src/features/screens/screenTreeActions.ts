import type { LinkPadScreen } from "../../types/project";

export type EntityIdFactory = (prefix: "screen" | "widget" | "group") => string;

export function createEntityId(prefix: "screen" | "widget" | "group") {
  const cryptoId = globalThis.crypto?.randomUUID?.();
  return cryptoId
    ? `${prefix}-${cryptoId}`
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function duplicateScreen(
  source: LinkPadScreen,
  screens: LinkPadScreen[],
  createId: EntityIdFactory = createEntityId
): LinkPadScreen {
  const screen = structuredClone(source);
  const screenId = createId("screen");
  const widgetIds = new Map(screen.widgets.map((widget) => [widget.id, createId("widget")]));
  const groupIds = new Map<string, string>();

  screen.id = screenId;
  screen.name = nextCopyName(source.name, screens);
  screen.widgets = screen.widgets.map((widget) => {
    const groupId = widget.editor?.groupId;
    if (groupId && !groupIds.has(groupId)) groupIds.set(groupId, createId("group"));
    return {
      ...widget,
      id: widgetIds.get(widget.id) ?? createId("widget"),
      editor: widget.editor ? {
        ...widget.editor,
        groupId: groupId ? groupIds.get(groupId) : undefined
      } : undefined
    };
  });
  screen.inputBindings = screen.inputBindings.map((binding) => {
    if (binding.action.type === "activateWidget") {
      return {
        ...binding,
        action: {
          ...binding.action,
          widgetId: widgetIds.get(binding.action.widgetId) ?? binding.action.widgetId
        }
      };
    }
    if (binding.action.type === "navigate" && binding.action.target === "screen" && binding.action.screenId === source.id) {
      return { ...binding, action: { ...binding.action, screenId } };
    }
    return binding;
  });
  return screen;
}

export function insertScreenAfter(screens: LinkPadScreen[], screen: LinkPadScreen, targetId: string) {
  const targetIndex = screens.findIndex((item) => item.id === targetId);
  const insertionIndex = targetIndex < 0 ? screens.length : targetIndex + 1;
  return [...screens.slice(0, insertionIndex), screen, ...screens.slice(insertionIndex)];
}

export function moveScreenAfter(screens: LinkPadScreen[], sourceId: string, targetId: string) {
  if (sourceId === targetId) return screens;
  const source = screens.find((screen) => screen.id === sourceId);
  if (!source || !screens.some((screen) => screen.id === targetId)) return screens;
  return insertScreenAfter(screens.filter((screen) => screen.id !== sourceId), source, targetId);
}

function nextCopyName(sourceName: string, screens: LinkPadScreen[]) {
  const names = new Set(screens.map((screen) => screen.name.toLocaleLowerCase()));
  const base = `${sourceName} - Cópia`;
  if (!names.has(base.toLocaleLowerCase())) return base;
  for (let index = 2; ; index += 1) {
    const candidate = `${base} ${index}`;
    if (!names.has(candidate.toLocaleLowerCase())) return candidate;
  }
}
