import { describe, expect, it } from "vitest";
import type { LinkPadWidget } from "../src/types/project";
import {
  alignWidgets,
  distributeWidgets,
  moveBoundsGroup,
  reorderWidgets,
  resizeBounds,
  smartSnapMove,
  smartSnapResize
} from "../src/features/screens/widgetGeometry";

function widget(id: string, x: number, y: number, width = 20, height = 10): LinkPadWidget {
  return { id, type: "static_text", x, y, width, height, visible: true, props: {} };
}

describe("geometria do editor de widgets", () => {
  it("move um grupo sem permitir que ultrapasse o display", () => {
    const result = moveBoundsGroup([widget("a", 10, 10), widget("b", 40, 30)], { x: 100, y: 100 }, { width: 80, height: 50 });
    expect(result.a).toMatchObject({ x: 30, y: 20 });
    expect(result.b).toMatchObject({ x: 60, y: 40 });
  });

  it("aplica snap na ancora do grupo", () => {
    const result = moveBoundsGroup([widget("a", 3, 5)], { x: 6, y: 6 }, { width: 80, height: 50 }, 4);
    expect(result.a).toMatchObject({ x: 8, y: 12 });
  });

  it("redimensiona pelo canto respeitando minimo e display", () => {
    const result = resizeBounds({ x: 10, y: 10, width: 20, height: 20 }, "se", { x: 100, y: -18 }, { width: 50, height: 40 }, { width: 8, height: 8 });
    expect(result).toEqual({ x: 10, y: 10, width: 40, height: 8 });
  });

  it("alinha pela referencia primaria", () => {
    const result = alignWidgets([widget("a", 10, 5), widget("b", 40, 20, 10, 10)], "a", "hcenter");
    expect(result.find((item) => item.id === "b")?.x).toBe(15);
  });

  it("distribui tres widgets preservando os extremos", () => {
    const result = distributeWidgets([widget("a", 0, 0, 10), widget("b", 12, 0, 10), widget("c", 40, 0, 10)], "horizontal");
    expect(result.map((item) => item.x)).toEqual([0, 20, 40]);
  });

  it("move uma selecao uma camada sem alterar sua ordem interna", () => {
    const widgets = [widget("a", 0, 0), widget("b", 0, 0), widget("c", 0, 0), widget("d", 0, 0)];
    expect(reorderWidgets(widgets, ["a", "b"], "forward").map((item) => item.id)).toEqual(["c", "a", "b", "d"]);
    expect(reorderWidgets(widgets, ["c", "d"], "backward").map((item) => item.id)).toEqual(["a", "c", "d", "b"]);
  });

  it("cria guias e encaixa centro e bordas entre widgets", () => {
    const moving = widget("a", 10, 10, 20, 10);
    const proposed = moveBoundsGroup([moving], { x: 29, y: 19 }, { width: 100, height: 60 });
    const result = smartSnapMove([moving], proposed, [widget("b", 59, 31, 20, 10)], { width: 100, height: 60 }, 2);
    expect(result.bounds.a).toMatchObject({ x: 39, y: 30 });
    expect(result.guides).toEqual(expect.arrayContaining([
      { axis: "vertical", position: 59, source: "widget" },
      { axis: "horizontal", position: 30, source: "screen" }
    ]));
  });

  it("encaixa a aresta redimensionada", () => {
    const result = smartSnapResize(
      { x: 10, y: 10, width: 39, height: 20 },
      "e",
      [widget("b", 50, 5, 20, 20)],
      { width: 100, height: 60 },
      { width: 8, height: 8 },
      2
    );
    expect(result.bounds.width).toBe(40);
    expect(result.guides[0]).toMatchObject({ axis: "vertical", position: 50 });
  });
});
