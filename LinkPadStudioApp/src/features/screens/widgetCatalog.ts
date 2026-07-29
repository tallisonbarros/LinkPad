import type { LinkPadWidget } from "../../types/project";

export interface WidgetCatalogItem {
  type: LinkPadWidget["type"];
  label: string;
  description: string;
  minimumSize: { width: number; height: number };
}

export const WIDGET_POINTER_DRAG_EVENT = "linkpad:widget-pointer-drag";

export interface WidgetPointerDragDetail {
  phase: "start" | "move" | "drop" | "cancel";
  type: LinkPadWidget["type"];
  clientX: number;
  clientY: number;
}

export function dispatchWidgetPointerDrag(detail: WidgetPointerDragDetail) {
  window.dispatchEvent(new CustomEvent<WidgetPointerDragDetail>(WIDGET_POINTER_DRAG_EVENT, { detail }));
}

export function isWidgetCatalogType(value: unknown): value is LinkPadWidget["type"] {
  return typeof value === "string" && WIDGET_CATALOG.some((item) => item.type === value);
}

export const WIDGET_CATALOG: WidgetCatalogItem[] = [
  { type: "static_text", label: "Texto", description: "Conteúdo fixo", minimumSize: { width: 24, height: 12 } },
  { type: "tag_value", label: "Valor", description: "Valor de uma tag", minimumSize: { width: 28, height: 14 } },
  { type: "boolean_indicator", label: "Booleano", description: "Estado ligado ou desligado", minimumSize: { width: 24, height: 14 } },
  { type: "gauge", label: "Medidor", description: "Medidor circular para valor numérico", minimumSize: { width: 36, height: 28 } },
  { type: "progress_bar", label: "Barra", description: "Progresso de um valor numérico", minimumSize: { width: 40, height: 12 } },
  { type: "status_indicator", label: "Status", description: "Texto de estado", minimumSize: { width: 28, height: 14 } },
  { type: "write_button", label: "Escrita", description: "Envia um valor", minimumSize: { width: 32, height: 18 } }
];

export function widgetDefinition(type: LinkPadWidget["type"]) {
  return WIDGET_CATALOG.find((item) => item.type === type) ?? WIDGET_CATALOG[0];
}

function createWidgetId() {
  return globalThis.crypto?.randomUUID?.() ?? `widget-${Date.now()}`;
}

export function createWidgetFromCatalog(
  type: LinkPadWidget["type"],
  widgetCount: number,
  id = createWidgetId()
): LinkPadWidget {
  const visualProps = {
    color: type === "status_indicator" ? "#42c879" : type === "write_button" ? "#ff7a21" : "#ffffff",
    backgroundColor: type === "write_button" ? "#41210f" : "#232528",
    transparent: type !== "write_button",
    fontSize: 8,
    textAlign: type === "write_button" ? "center" : "left",
    verticalAlign: "middle",
    padding: type === "write_button" ? 4 : 2,
    borderWidth: type === "write_button" ? 1 : 0,
    borderColor: type === "write_button" ? "#ff7a21" : "#ffffff",
    borderRadius: type === "write_button" ? 3 : 0
  };
  return {
    id,
    type,
    x: 12,
    y: 12 + widgetCount * 8,
    width: type === "static_text" ? 100 : type === "gauge" ? 64 : 90,
    height: type === "gauge" ? 50 : 24,
    visible: true,
    editor: { locked: false },
    props: type === "static_text"
      ? { text: "Novo texto", ...visualProps }
      : type === "status_indicator"
        ? { text: "Agente online", ...visualProps }
        : type === "write_button"
          ? { text: "Escrever", value: 1, ...visualProps }
          : type === "gauge" || type === "progress_bar"
            ? { ...visualProps, min: 0, max: 100, showValue: true, color: "#ff7a21" }
            : { ...visualProps }
  };
}
