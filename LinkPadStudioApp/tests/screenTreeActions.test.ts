import { describe, expect, it } from "vitest";
import type { LinkPadScreen } from "../src/types/project";
import {
  duplicateScreen,
  insertScreenAfter,
  moveScreenAfter
} from "../src/features/screens/screenTreeActions";

function idFactory() {
  let index = 0;
  return (prefix: "screen" | "widget" | "group") => `${prefix}-${++index}`;
}

const source: LinkPadScreen = {
  id: "screen-main",
  name: "Principal",
  width: 240,
  height: 135,
  widgets: [{
    id: "widget-button",
    type: "write_button",
    x: 0,
    y: 0,
    width: 60,
    height: 20,
    visible: true,
    props: { text: "Acionar" },
    editor: { locked: false, groupId: "group-actions" }
  }],
  inputBindings: [{
    inputId: "primary",
    event: "press",
    action: { type: "activateWidget", widgetId: "widget-button" }
  }, {
    inputId: "secondary",
    event: "press",
    action: { type: "navigate", target: "screen", screenId: "screen-main" }
  }]
};

describe("acoes de tela na arvore", () => {
  it("duplica com IDs independentes e remapeia referencias internas", () => {
    const duplicate = duplicateScreen(source, [source], idFactory());

    expect(duplicate.id).not.toBe(source.id);
    expect(duplicate.name).toBe("Principal - Cópia");
    expect(duplicate.widgets[0].id).not.toBe(source.widgets[0].id);
    expect(duplicate.widgets[0].editor?.groupId).not.toBe(source.widgets[0].editor?.groupId);
    expect(duplicate.inputBindings[0].action).toEqual({
      type: "activateWidget",
      widgetId: duplicate.widgets[0].id
    });
    expect(duplicate.inputBindings[1].action).toEqual({
      type: "navigate",
      target: "screen",
      screenId: duplicate.id
    });
  });

  it("gera nomes de copia sem colisao", () => {
    const existing = { ...source, id: "screen-copy", name: "Principal - Cópia" };
    expect(duplicateScreen(source, [source, existing], idFactory()).name).toBe("Principal - Cópia 2");
  });

  it("insere copia e move recorte logo abaixo da tela alvo", () => {
    const second = { ...source, id: "screen-second", name: "Segunda" };
    const third = { ...source, id: "screen-third", name: "Terceira" };
    const copy = { ...source, id: "screen-copy", name: "Cópia" };

    expect(insertScreenAfter([source, second, third], copy, second.id).map((screen) => screen.id))
      .toEqual([source.id, second.id, copy.id, third.id]);
    expect(moveScreenAfter([source, second, third], source.id, second.id).map((screen) => screen.id))
      .toEqual([second.id, source.id, third.id]);
  });
});
