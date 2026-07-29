import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import legacyProject from "./fixtures/project-v0.1.0.json";
import { migrateProject } from "../src/domain/project/migrations";
import { createWidgetFromCatalog } from "../src/features/screens/widgetCatalog";
import { WidgetPropertiesPanel } from "../src/features/screens/WidgetPropertiesPanel";
import { WidgetArrangeMenu } from "../src/features/screens/WidgetArrangeMenu";
import { WidgetContextMenu } from "../src/features/screens/WidgetContextMenu";
import { WidgetSelectionToolbar } from "../src/features/screens/WidgetSelectionToolbar";
import type { WidgetEditorController } from "../src/features/screens/useWidgetEditorController";

describe("widget properties layout", () => {
  it("renders one properties surface with property, value and animation columns", () => {
    const project = migrateProject(legacyProject);
    const widget = createWidgetFromCatalog("gauge", 0, "gauge-test");
    const markup = renderToStaticMarkup(
      <WidgetPropertiesPanel project={project} widget={widget} onChange={vi.fn()} />
    );

    expect(markup).toContain('class="widget-properties-panel"');
    expect(markup).toContain(">Propriedades<");
    expect(markup).toContain(">Propriedade<");
    expect(markup).toContain(">Valor<");
    expect(markup).not.toContain("widget-properties-tabs");
    expect(markup).toContain('data-property="x"');
    expect(markup).toContain('data-property="visible"');
    expect(markup).toContain('data-property="fontSize"');
    expect(markup).toContain('data-animation-property="fontSize"');
    expect(markup).toContain("disabled");

    const contentGroup = markup.match(/<details[^>]*data-property-group="content"[^>]*>/)?.[0] ?? "";
    const visualGroup = markup.match(/<details[^>]*data-property-group="visual"[^>]*>/)?.[0] ?? "";
    const borderGroup = markup.match(/<details[^>]*data-property-group="border"[^>]*>/)?.[0] ?? "";
    const positionGroup = markup.match(/<details[^>]*data-property-group="position"[^>]*>/)?.[0] ?? "";
    expect(contentGroup).toContain('open=""');
    expect(visualGroup).toContain('open=""');
    expect(borderGroup).not.toContain('open=""');
    expect(positionGroup).not.toContain('open=""');
    expect(markup.indexOf('data-property-group="position"')).toBeGreaterThan(markup.indexOf('data-property-group="border"'));
  });

  it("keeps only the compact selection identity in the editor toolbar", () => {
    const project = migrateProject(legacyProject);
    const widget = createWidgetFromCatalog("static_text", 0, "text-test");
    const screen = { ...project.screens[0], widgets: [widget] };
    const controller: WidgetEditorController = {
      selection: { screenId: screen.id, ids: [widget.id], primaryId: widget.id },
      canUndo: false,
      canRedo: false,
      canPaste: false,
      select: vi.fn(),
      commitWidgets: vi.fn(),
      copyWidgets: vi.fn(),
      pasteWidgets: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn()
    };
    const markup = renderToStaticMarkup(
      <WidgetSelectionToolbar controller={controller} screen={screen} />
    );

    expect(markup).toContain('class="widget-selection-toolbar"');
    expect(markup).toContain("Texto");
    expect(markup).not.toContain("Duplicar");
    expect(markup).not.toContain(">Mais<");
  });

  it("offers size matching inside Align and editing commands in the widget context menu", () => {
    const project = migrateProject(legacyProject);
    const first = createWidgetFromCatalog("static_text", 0, "text-a");
    const second = createWidgetFromCatalog("static_text", 1, "text-b");
    const screen = { ...project.screens[0], widgets: [first, second] };
    const controller: WidgetEditorController = {
      selection: { screenId: screen.id, ids: [first.id, second.id], primaryId: second.id },
      canUndo: false,
      canRedo: false,
      canPaste: true,
      select: vi.fn(),
      commitWidgets: vi.fn(),
      copyWidgets: vi.fn(),
      pasteWidgets: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn()
    };
    const arrangeMarkup = renderToStaticMarkup(
      <WidgetArrangeMenu controller={controller} open screen={screen} onOpenChange={vi.fn()} />
    );
    const contextMarkup = renderToStaticMarkup(
      <WidgetContextMenu
        allLocked={false}
        canEdit
        canPaste
        menuRef={{ current: null }}
        x={10}
        y={10}
        onCopy={vi.fn()}
        onCut={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onLockChange={vi.fn()}
        onPaste={vi.fn()}
      />
    );

    expect(arrangeMarkup).toContain("Igualar tamanho");
    expect(arrangeMarkup).toContain(">Largura<");
    expect(arrangeMarkup).toContain(">Altura<");
    expect(arrangeMarkup).toContain(">Ambos<");
    expect(contextMarkup).toContain("Copiar");
    expect(contextMarkup).toContain("Recortar");
    expect(contextMarkup).toContain("Colar");
    expect(contextMarkup).toContain("Duplicar");
    expect(contextMarkup).toContain("Bloquear");
    expect(contextMarkup).toContain("Excluir");
  });
});
