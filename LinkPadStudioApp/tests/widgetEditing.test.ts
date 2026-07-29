import { describe, expect, it } from "vitest";
import type { LinkPadWidget } from "../src/types/project";
import {
  cloneWidgetsForPaste,
  expandedWidgetIds,
  groupWidgets,
  resolveWidgetContextSelection,
  setWidgetsLocked,
  ungroupWidgets
} from "../src/features/screens/widgetEditing";

function widget(id: string, x = 0): LinkPadWidget {
  return {
    id,
    type: "static_text",
    x,
    y: 0,
    width: 20,
    height: 10,
    visible: true,
    props: {},
    editor: { locked: false }
  };
}

describe("organização de widgets", () => {
  it("agrupa, expande a seleção e desagrupa o conjunto inteiro", () => {
    const grouped = groupWidgets([widget("a"), widget("b"), widget("c")], ["a", "b"], "group-1");
    expect(expandedWidgetIds(grouped, "a")).toEqual(["a", "b"]);
    expect(expandedWidgetIds(grouped, "a", true)).toEqual(["a"]);
    expect(ungroupWidgets(grouped, ["a"]).map((item) => item.editor?.groupId)).toEqual([undefined, undefined, undefined]);
  });

  it("bloqueia apenas os widgets selecionados", () => {
    const locked = setWidgetsLocked([widget("a"), widget("b")], ["b"], true);
    expect(locked.map((item) => item.editor?.locked)).toEqual([false, true]);
  });

  it("preserva a seleção múltipla ao abrir o menu sobre um item já selecionado", () => {
    const widgets = [widget("a"), widget("b"), widget("c")];
    expect(resolveWidgetContextSelection(widgets, ["a", "b"], "a")).toEqual(["a", "b"]);
    expect(resolveWidgetContextSelection(widgets, ["a", "b"], "c")).toEqual(["c"]);
  });

  it("cola cópias com ids e grupo novos sem ultrapassar a tela", () => {
    const source = groupWidgets([widget("a", 55), widget("b", 75)], ["a", "b"], "old-group");
    let index = 0;
    const pasted = cloneWidgetsForPaste(source, { width: 100, height: 40 }, 12, (prefix) => `${prefix}-${++index}`);

    expect(pasted.map((item) => item.id)).toEqual(["widget-2", "widget-3"]);
    expect(pasted.map((item) => item.x)).toEqual([60, 80]);
    expect(pasted[0].editor?.groupId).toBe("group-1");
    expect(pasted[1].editor?.groupId).toBe("group-1");
    expect(pasted.every((item) => item.editor?.locked === false)).toBe(true);
  });
});
