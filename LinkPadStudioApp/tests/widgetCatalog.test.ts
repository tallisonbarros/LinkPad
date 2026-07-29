import { describe, expect, it } from "vitest";
import { createWidgetFromCatalog, isWidgetCatalogType, WIDGET_CATALOG } from "../src/features/screens/widgetCatalog";

describe("catálogo contextual de widgets", () => {
  it("oferece os sete tipos implementados sem duplicidade", () => {
    const types = WIDGET_CATALOG.map((item) => item.type);
    expect(types).toEqual([
      "static_text",
      "tag_value",
      "boolean_indicator",
      "gauge",
      "progress_bar",
      "status_indicator",
      "write_button"
    ]);
    expect(new Set(types).size).toBe(types.length);
    expect(WIDGET_CATALOG.every((item) => item.minimumSize.width > 0 && item.minimumSize.height > 0)).toBe(true);
  });

  it("cria o mesmo widget declarativo usado pelo editor", () => {
    const widget = createWidgetFromCatalog("write_button", 2, "widget-test");
    expect(widget).toEqual({
      id: "widget-test",
      type: "write_button",
      x: 12,
      y: 28,
      width: 90,
      height: 24,
      visible: true,
      editor: { locked: false },
      props: {
        text: "Escrever",
        value: 1,
        color: "#ff7a21",
        backgroundColor: "#41210f",
        transparent: false,
        fontSize: 8,
        textAlign: "center",
        verticalAlign: "middle",
        padding: 4,
        borderWidth: 1,
        borderColor: "#ff7a21",
        borderRadius: 3
      }
    });
  });

  it("reconhece somente tipos registrados no arraste interno", () => {
    expect(isWidgetCatalogType("gauge")).toBe(true);
    expect(isWidgetCatalogType("progress_bar")).toBe(true);
    expect(isWidgetCatalogType("arquivo-externo")).toBe(false);
  });
});
