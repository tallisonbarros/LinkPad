import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ChartNoAxesColumnIncreasing,
  Binary,
  MousePointerClick,
  CircleGauge,
  Tags,
  Type,
  type LucideIcon
} from "lucide-react";
import type { LinkPadWidget } from "../../types/project";
import {
  dispatchWidgetPointerDrag,
  WIDGET_CATALOG,
  type WidgetCatalogItem
} from "./widgetCatalog";

interface WidgetCatalogPanelProps {
  compact?: boolean;
  screenName: string;
  onAdd: (type: LinkPadWidget["type"]) => void;
}

const WIDGET_ICONS: Record<LinkPadWidget["type"], LucideIcon> = {
  static_text: Type,
  tag_value: Tags,
  boolean_indicator: Binary,
  gauge: CircleGauge,
  progress_bar: ChartNoAxesColumnIncreasing,
  status_indicator: Activity,
  write_button: MousePointerClick
};

export function WidgetCatalogPanel({ compact = false, screenName, onAdd }: WidgetCatalogPanelProps) {
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const suppressClickRef = useRef(false);
  const [ghost, setGhost] = useState<{ label: string; x: number; y: number } | null>(null);

  useEffect(() => () => dragCleanupRef.current?.(), []);

  function beginPointerDrag(event: React.PointerEvent<HTMLButtonElement>, item: WidgetCatalogItem) {
    if (event.button !== 0) return;
    dragCleanupRef.current?.();
    const capture = event.currentTarget;
    const session = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      dragging: false
    };

    const publish = (phase: "start" | "move" | "drop" | "cancel") => dispatchWidgetPointerDrag({
      phase,
      type: item.type,
      clientX: session.lastX,
      clientY: session.lastY
    });
    const move = (pointer: PointerEvent) => {
      if (pointer.pointerId !== session.pointerId) return;
      session.lastX = pointer.clientX;
      session.lastY = pointer.clientY;
      if (!session.dragging && Math.hypot(pointer.clientX - session.startX, pointer.clientY - session.startY) < 4) return;
      if (!session.dragging) {
        session.dragging = true;
        suppressClickRef.current = true;
        document.body.classList.add("linkpad-pointer-dragging");
        publish("start");
      }
      pointer.preventDefault();
      setGhost({ label: item.label, x: pointer.clientX, y: pointer.clientY });
      publish("move");
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", blur);
      document.body.classList.remove("linkpad-pointer-dragging");
      setGhost(null);
      try {
        if (capture.hasPointerCapture(session.pointerId)) capture.releasePointerCapture(session.pointerId);
      } catch {
        // A captura pode ter sido liberada automaticamente.
      }
      dragCleanupRef.current = null;
      if (session.dragging) window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    };
    const finish = (phase: "drop" | "cancel", pointer?: PointerEvent) => {
      if (pointer && pointer.pointerId !== session.pointerId) return;
      if (pointer) {
        session.lastX = pointer.clientX;
        session.lastY = pointer.clientY;
      }
      if (session.dragging) publish(phase);
      cleanup();
    };
    const up = (pointer: PointerEvent) => finish("drop", pointer);
    const cancel = (pointer: PointerEvent) => finish("cancel", pointer);
    const blur = () => finish("cancel");

    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", blur);
    dragCleanupRef.current = cleanup;
    try {
      capture.setPointerCapture(event.pointerId);
    } catch {
      // Os listeners globais mantem o gesto funcional sem captura.
    }
  }

  return (
    <section className="widget-catalog" aria-label={`Widgets para ${screenName}`}>
      {!compact && (
        <div className="widget-catalog-header">
          <strong>Widgets</strong>
          <span>Adicionar à tela</span>
        </div>
      )}
      <div className="widget-catalog-grid">
        {WIDGET_CATALOG.map((item) => {
          const Icon = WIDGET_ICONS[item.type];
          return (
            <button
              key={item.type}
              type="button"
              title={`Arraste para a tela ou clique para adicionar: ${item.description}`}
              onClick={(event) => {
                if (suppressClickRef.current) {
                  event.preventDefault();
                  event.stopPropagation();
                  suppressClickRef.current = false;
                  return;
                }
                onAdd(item.type);
              }}
              onPointerDown={(event) => beginPointerDrag(event, item)}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      {!compact && <small>Arraste para posicionar ou clique para adicionar.</small>}
      {ghost && <div className="widget-pointer-ghost" style={{ left: ghost.x, top: ghost.y }}>{ghost.label}</div>}
    </section>
  );
}
