import { renderToStaticMarkup } from "react-dom/server";
import { Keyboard, TriangleAlert } from "lucide-react";
import { describe, expect, it } from "vitest";
import { ScreenBottomPanel } from "../src/features/screens/ScreenBottomPanel";

const tabs = [
  {
    id: "controls",
    label: "Controles",
    icon: Keyboard,
    badge: 3,
    content: <div>Ações configuradas</div>
  },
  {
    id: "alerts",
    label: "Alertas",
    icon: TriangleAlert,
    badge: 2,
    content: <div>Alertas da tela</div>
  }
];

describe("screen bottom panel", () => {
  it("starts collapsed without mounting the active tool", () => {
    const markup = renderToStaticMarkup(<ScreenBottomPanel tabs={tabs} initialTabId="controls" />);

    expect(markup).toContain("screen-bottom-panel collapsed");
    expect(markup).toContain("Controles");
    expect(markup).toContain("Alertas");
    expect(markup).toContain(">3<");
    expect(markup).toContain(">2<");
    expect(markup).not.toContain("Ações configuradas");
    expect(markup).not.toContain("Alertas da tela");
  });

  it("renders the selected tool inside the expanded tab panel", () => {
    const markup = renderToStaticMarkup(<ScreenBottomPanel tabs={tabs} defaultExpanded initialTabId="controls" />);

    expect(markup).toContain("screen-bottom-panel expanded");
    expect(markup).toContain('role="tabpanel"');
    expect(markup).toContain("Ações configuradas");
  });
});
