import { describe, expect, it } from "vitest";
import legacyProject from "./fixtures/project-v0.1.0.json";
import { migrateProject } from "../src/domain/project/migrations";
import type { LinkPadWidget } from "../src/types/project";
import { auditWidget, contrastRatio } from "../src/features/screens/widgetAudit";

function widget(patch: Partial<LinkPadWidget> = {}): LinkPadWidget {
  return {
    id: "widget-audit",
    type: "static_text",
    x: 0,
    y: 0,
    width: 80,
    height: 20,
    visible: true,
    editor: { locked: false },
    props: { text: "Texto", fontSize: 8, padding: 2, transparent: true },
    ...patch
  };
}

describe("auditoria visual de widgets", () => {
  const project = migrateProject(legacyProject);

  it("detecta vínculo ausente e intervalo inválido", () => {
    const issues = auditWidget(project, widget({ type: "gauge", props: { min: 100, max: 0 } }));
    expect(issues.map((item) => item.code)).toEqual(expect.arrayContaining(["missing-binding", "invalid-range"]));
  });

  it("detecta corte, estouro e baixo contraste", () => {
    const issues = auditWidget(project, widget({
      width: 20,
      height: 8,
      props: { text: "Texto muito longo", fontSize: 10, padding: 2, transparent: false, color: "#777777", backgroundColor: "#707070" }
    }));
    expect(issues.map((item) => item.code)).toEqual(expect.arrayContaining(["content-height", "text-overflow", "low-contrast"]));
  });

  it("calcula contraste em ordem independente", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 3);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 3);
  });
});
