import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { RuntimeStatusOverlay } from "../../components/runtime/RuntimeStatusOverlay";
import {
  bindingFrom,
  simulationValueForBinding,
  valueTypeForBinding
} from "../../domain/project/dataBindings";
import type { LinkPadProject, LinkPadScreen, LinkPadWidget } from "../../types/project";
import type { WidgetEditorController } from "./useWidgetEditorController";
import {
  createWidgetFromCatalog,
  isWidgetCatalogType,
  WIDGET_POINTER_DRAG_EVENT,
  widgetDefinition,
  type WidgetPointerDragDetail
} from "./widgetCatalog";
import {
  cloneWidgetsForPaste,
  expandedWidgetIds,
  groupWidgets,
  isWidgetLocked,
  resolveWidgetContextSelection,
  setWidgetsLocked,
  ungroupWidgets
} from "./widgetEditing";
import {
  applyBounds,
  boundsOf,
  intersects,
  moveBoundsGroup,
  normalizedRect,
  resizeBounds,
  smartSnapMove,
  smartSnapResize,
  type Point,
  type ResizeHandle,
  type SnapGuide,
  type WidgetBounds
} from "./widgetGeometry";
import { widgetNames } from "./WidgetPropertiesPanel";
import { auditScreenWidgets } from "./widgetAudit";
import { WidgetContextMenu } from "./WidgetContextMenu";

interface ScreenCanvasProps {
  project: LinkPadProject;
  screen: LinkPadScreen;
  controller: WidgetEditorController;
  zoom: number;
  gridEnabled: boolean;
  snapEnabled: boolean;
  guidesEnabled: boolean;
  auditEnabled: boolean;
  gridSize: number;
}

interface Manipulation {
  kind: "move" | "resize";
  pointerId: number;
  start: Point;
  initial: LinkPadWidget[];
  draft: Record<string, WidgetBounds>;
  handle?: ResizeHandle;
  moved: boolean;
  selectionIds: string[];
  toggleRemoveIds?: string[];
  guides: SnapGuide[];
}

interface Marquee {
  pointerId: number;
  start: Point;
  current: Point;
  initialIds: string[];
}

interface PointerInput {
  pointerId: number;
  clientX: number;
  clientY: number;
  shiftKey: boolean;
}

interface WidgetContextMenuState {
  x: number;
  y: number;
}

const RESIZE_HANDLES: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function widgetId() {
  return globalThis.crypto?.randomUUID?.() ?? `widget-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function boundsStyle(bounds: WidgetBounds, screen: LinkPadScreen): CSSProperties {
  return {
    left: `${bounds.x / screen.width * 100}%`,
    top: `${bounds.y / screen.height * 100}%`,
    width: `${bounds.width / screen.width * 100}%`,
    height: `${bounds.height / screen.height * 100}%`
  };
}

export function ScreenCanvas({
  project,
  screen,
  controller,
  zoom,
  gridEnabled,
  snapEnabled,
  guidesEnabled,
  auditEnabled,
  gridSize
}: ScreenCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const pointerCaptureRef = useRef<Element | null>(null);
  const manipulationRef = useRef<Manipulation | null>(null);
  const marqueeRef = useRef<Marquee | null>(null);
  const [manipulation, setManipulationState] = useState<Manipulation | null>(null);
  const [marquee, setMarqueeState] = useState<Marquee | null>(null);
  const [dropTarget, setDropTarget] = useState(false);
  const [contextMenu, setContextMenu] = useState<WidgetContextMenuState | null>(null);
  const selection = controller.selection.screenId === screen.id ? controller.selection : { screenId: screen.id, ids: [], primaryId: "" };
  const selectedIds = selection.ids.filter((id) => screen.widgets.some((widget) => widget.id === id));
  const auditIssues = auditEnabled ? auditScreenWidgets(project, screen) : [];
  const auditWarnings = new Set(auditIssues.filter((issue) => issue.severity === "warning").map((issue) => issue.widgetId));

  useEffect(() => {
    if (!contextMenu) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!contextMenuRef.current?.contains(event.target as Node)) setContextMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };
    const close = () => setContextMenu(null);
    document.addEventListener("pointerdown", closeOnPointerDown);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  useEffect(() => setContextMenu(null), [screen.id]);

  useEffect(() => {
    const pointerId = manipulation?.pointerId;
    if (pointerId === undefined) return;
    const move = (event: PointerEvent) => {
      if (event.pointerId === pointerId) updateManipulationPointer(event);
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId === pointerId) finishManipulationPointer(event);
    };
    const cancel = (event: PointerEvent) => {
      if (event.pointerId === pointerId) resetManipulationPointer(pointerId);
    };
    const blur = () => finishManipulationDraft();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", blur);
    };
  }, [manipulation?.pointerId]);

  useEffect(() => {
    const handleCatalogDrag = (event: Event) => {
      const detail = (event as CustomEvent<WidgetPointerDragDetail>).detail;
      if (!detail || !isWidgetCatalogType(detail.type)) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const inside = detail.clientX >= rect.left
        && detail.clientX <= rect.right
        && detail.clientY >= rect.top
        && detail.clientY <= rect.bottom;
      if (detail.phase === "start" || detail.phase === "move") {
        setDropTarget(inside);
        return;
      }
      setDropTarget(false);
      if (detail.phase === "drop" && inside) addWidgetAt(detail.type, detail.clientX, detail.clientY);
    };
    window.addEventListener(WIDGET_POINTER_DRAG_EVENT, handleCatalogDrag);
    return () => window.removeEventListener(WIDGET_POINTER_DRAG_EVENT, handleCatalogDrag);
  }, [screen, snapEnabled, gridSize, controller]);

  function setManipulation(next: Manipulation | null) {
    manipulationRef.current = next;
    setManipulationState(next);
  }

  function setMarquee(next: Marquee | null) {
    marqueeRef.current = next;
    setMarqueeState(next);
  }

  function screenPoint(clientX: number, clientY: number): Point {
    const element = canvasRef.current;
    if (!element) return { x: 0, y: 0 };
    const rect = element.getBoundingClientRect();
    const borderX = Math.max(0, (rect.width - element.clientWidth) / 2);
    const borderY = Math.max(0, (rect.height - element.clientHeight) / 2);
    return {
      x: Math.max(0, Math.min(screen.width, (clientX - rect.left - borderX) / element.clientWidth * screen.width)),
      y: Math.max(0, Math.min(screen.height, (clientY - rect.top - borderY) / element.clientHeight * screen.height))
    };
  }

  function draftManipulation(current: Manipulation, point: Point, preserveRatio: boolean): Manipulation {
    const delta = { x: point.x - current.start.x, y: point.y - current.start.y };
    const moved = current.moved || Math.abs(delta.x) >= 1 || Math.abs(delta.y) >= 1;
    if (current.kind === "move") {
      const proposed = moveBoundsGroup(
        current.initial,
        delta,
        { width: screen.width, height: screen.height },
        snapEnabled ? gridSize : undefined
      );
      const result = snapEnabled
        ? smartSnapMove(
          current.initial,
          proposed,
          screen.widgets.filter((widget) => !current.selectionIds.includes(widget.id) && widget.visible),
          screen
        )
        : { bounds: proposed, guides: [] };
      return {
        ...current,
        moved,
        draft: result.bounds,
        guides: result.guides
      };
    }
    const widget = current.initial[0];
    const minimum = widgetDefinition(widget.type).minimumSize;
    const proposed = resizeBounds(
      boundsOf(widget),
      current.handle ?? "se",
      delta,
      { width: screen.width, height: screen.height },
      minimum,
      snapEnabled ? gridSize : undefined,
      preserveRatio
    );
    const result = snapEnabled && !preserveRatio
      ? smartSnapResize(
        proposed,
        current.handle ?? "se",
        screen.widgets.filter((item) => item.id !== widget.id && item.visible),
        screen,
        minimum
      )
      : { bounds: proposed, guides: [] };
    return {
      ...current,
      moved,
      draft: {
        [widget.id]: result.bounds
      },
      guides: result.guides
    };
  }

  function beginMove(event: React.PointerEvent, widget: LinkPadWidget) {
    if (event.button !== 0) return;
    event.stopPropagation();
    canvasRef.current?.focus();
    const clickedIds = expandedWidgetIds(screen.widgets, widget.id, event.altKey);
    const clickedSelected = clickedIds.every((id) => selectedIds.includes(id));
    let nextIds = selectedIds;
    let toggleRemoveIds: string[] | undefined;
    if (event.shiftKey && clickedSelected) {
      toggleRemoveIds = clickedIds;
    } else if (event.shiftKey) {
      nextIds = [...new Set([...selectedIds, ...clickedIds])];
      controller.select(screen.id, nextIds, widget.id);
    } else if (!clickedSelected) {
      nextIds = clickedIds;
      controller.select(screen.id, nextIds, widget.id);
    }
    const initial = movableWidgets(nextIds);
    if (initial.length === 0) return;
    const draft = Object.fromEntries(initial.map((item) => [item.id, boundsOf(item)]));
    setManipulation({
      kind: "move",
      pointerId: event.pointerId,
      start: screenPoint(event.clientX, event.clientY),
      initial,
      draft,
      moved: false,
      selectionIds: nextIds,
      toggleRemoveIds,
      guides: []
    });
    capturePointer(event.currentTarget, event.pointerId);
  }

  function openWidgetProperties(event: React.MouseEvent, widget: LinkPadWidget) {
    event.preventDefault();
    event.stopPropagation();
    controller.select(screen.id, [widget.id], widget.id);
  }

  function openWidgetContextMenu(event: React.MouseEvent, widget: LinkPadWidget) {
    event.preventDefault();
    event.stopPropagation();
    canvasRef.current?.focus();
    const nextIds = resolveWidgetContextSelection(screen.widgets, selectedIds, widget.id, event.altKey);
    if (nextIds !== selectedIds) controller.select(screen.id, nextIds, widget.id);
    const menuWidth = 204;
    const menuHeight = 228;
    setContextMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8))
    });
  }

  function beginResize(event: React.PointerEvent, widget: LinkPadWidget, handle: ResizeHandle) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    canvasRef.current?.focus();
    controller.select(screen.id, [widget.id], widget.id);
    if (isWidgetLocked(widget)) return;
    setManipulation({
      kind: "resize",
      pointerId: event.pointerId,
      start: screenPoint(event.clientX, event.clientY),
      initial: [widget],
      draft: { [widget.id]: boundsOf(widget) },
      handle,
      moved: false,
      selectionIds: [widget.id],
      guides: []
    });
    capturePointer(event.currentTarget, event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const current = manipulationRef.current;
    if (current?.pointerId === event.pointerId) {
      updateManipulationPointer(event);
      return;
    }
    const currentMarquee = marqueeRef.current;
    if (currentMarquee?.pointerId === event.pointerId) {
      setMarquee({ ...currentMarquee, current: screenPoint(event.clientX, event.clientY) });
    }
  }

  function finishPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (finishManipulationPointer(event)) return;

    const currentMarquee = marqueeRef.current;
    if (currentMarquee?.pointerId === event.pointerId) {
      const area = normalizedRect(currentMarquee.start, screenPoint(event.clientX, event.clientY));
      const found = area.width < 1 && area.height < 1
        ? []
        : screen.widgets.filter((widget) => widget.visible && intersects(boundsOf(widget), area)).flatMap((widget) => expandedWidgetIds(screen.widgets, widget.id));
      controller.select(screen.id, [...new Set([...currentMarquee.initialIds, ...found])]);
      setMarquee(null);
      if (canvasRef.current?.hasPointerCapture(event.pointerId)) canvasRef.current.releasePointerCapture(event.pointerId);
    }
  }

  function updateManipulationPointer(event: PointerInput) {
    const current = manipulationRef.current;
    if (current?.pointerId !== event.pointerId) return;
    setManipulation(draftManipulation(current, screenPoint(event.clientX, event.clientY), event.shiftKey));
  }

  function finishManipulationPointer(event: PointerInput) {
    const current = manipulationRef.current;
    if (current?.pointerId !== event.pointerId) return false;
    finalizeManipulation(draftManipulation(current, screenPoint(event.clientX, event.clientY), event.shiftKey));
    resetManipulationPointer(event.pointerId);
    return true;
  }

  function finishManipulationDraft() {
    const current = manipulationRef.current;
    if (!current) return;
    finalizeManipulation(current);
    resetManipulationPointer(current.pointerId);
  }

  function finalizeManipulation(final: Manipulation) {
    if (final.toggleRemoveIds && !final.moved) {
      const removed = new Set(final.toggleRemoveIds);
      controller.select(screen.id, selectedIds.filter((id) => !removed.has(id)));
    } else if (final.moved) {
      controller.commitWidgets(
        screen.id,
        applyBounds(screen.widgets, final.draft),
        final.kind === "move" ? "Mover widgets" : "Redimensionar widget",
        final.selectionIds
      );
    }
  }

  function resetManipulationPointer(pointerId: number) {
    setManipulation(null);
    const capture = pointerCaptureRef.current;
    try {
      if (capture?.hasPointerCapture(pointerId)) capture.releasePointerCapture(pointerId);
    } catch {
      // A captura pode ter sido liberada automaticamente pelo sistema.
    }
    pointerCaptureRef.current = null;
  }

  function capturePointer(element: Element, pointerId: number) {
    try {
      element.setPointerCapture(pointerId);
      pointerCaptureRef.current = element;
    } catch {
      // O listener global ainda conclui o gesto se o WebView negar a captura.
      pointerCaptureRef.current = null;
    }
  }

  function cancelPointer(event?: React.PointerEvent<HTMLDivElement>) {
    setManipulation(null);
    setMarquee(null);
    if (event && canvasRef.current?.hasPointerCapture(event.pointerId)) canvasRef.current.releasePointerCapture(event.pointerId);
  }

  function beginMarquee(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    canvasRef.current?.focus();
    const point = screenPoint(event.clientX, event.clientY);
    const initialIds = event.shiftKey ? selectedIds : [];
    if (!event.shiftKey) controller.select(screen.id, []);
    setMarquee({ pointerId: event.pointerId, start: point, current: point, initialIds });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function deleteSelection() {
    const editable = movableWidgets(selectedIds);
    if (editable.length === 0) return;
    const editableIds = new Set(editable.map((widget) => widget.id));
    controller.commitWidgets(
      screen.id,
      screen.widgets.filter((widget) => !editableIds.has(widget.id)),
      editable.length === 1 ? "Excluir widget" : "Excluir widgets",
      selectedIds.filter((id) => !editableIds.has(id))
    );
  }

  function duplicateSelection() {
    const selected = movableWidgets(selectedIds);
    if (selected.length === 0) return;
    const copies = cloneWidgetsForPaste(selected, screen, 4, (prefix) => `${prefix}-${widgetId()}`);
    controller.commitWidgets(screen.id, [...screen.widgets, ...copies], "Duplicar widgets", copies.map((widget) => widget.id));
  }

  function closeContextMenu(action: () => void) {
    action();
    setContextMenu(null);
  }

  function lockSelection(locked: boolean) {
    if (selectedIds.length === 0) return;
    controller.commitWidgets(
      screen.id,
      setWidgetsLocked(screen.widgets, selectedIds, locked),
      locked ? "Bloquear widgets" : "Desbloquear widgets",
      selectedIds
    );
  }

  function movableWidgets(ids: string[]) {
    const selected = screen.widgets.filter((widget) => ids.includes(widget.id));
    const blockedGroups = new Set(selected.filter(isWidgetLocked).map((widget) => widget.editor?.groupId).filter(Boolean));
    return selected.filter((widget) => !isWidgetLocked(widget) && (!widget.editor?.groupId || !blockedGroups.has(widget.editor.groupId)));
  }

  function groupSelection() {
    const selected = movableWidgets(selectedIds);
    if (selected.length < 2) return;
    const groupId = `group-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
    controller.commitWidgets(screen.id, groupWidgets(screen.widgets, selected.map((widget) => widget.id), groupId), "Agrupar widgets", selectedIds);
  }

  function ungroupSelection() {
    if (!screen.widgets.some((widget) => selectedIds.includes(widget.id) && widget.editor?.groupId)) return;
    controller.commitWidgets(screen.id, ungroupWidgets(screen.widgets, selectedIds), "Desagrupar widgets", selectedIds);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) controller.redo();
      else controller.undo();
      return;
    }
    if (modifier && event.key.toLowerCase() === "y") {
      event.preventDefault();
      controller.redo();
      return;
    }
    if (modifier && event.key.toLowerCase() === "a") {
      event.preventDefault();
      controller.select(screen.id, screen.widgets.map((widget) => widget.id));
      return;
    }
    if (modifier && event.key.toLowerCase() === "c") {
      event.preventDefault();
      controller.copyWidgets(screen.widgets.filter((widget) => selectedIds.includes(widget.id)));
      return;
    }
    if (modifier && event.key.toLowerCase() === "x") {
      event.preventDefault();
      controller.copyWidgets(movableWidgets(selectedIds));
      deleteSelection();
      return;
    }
    if (modifier && event.key.toLowerCase() === "v") {
      event.preventDefault();
      controller.pasteWidgets(screen.id);
      return;
    }
    if (modifier && event.key.toLowerCase() === "g") {
      event.preventDefault();
      if (event.shiftKey) ungroupSelection();
      else groupSelection();
      return;
    }
    if (modifier && event.key.toLowerCase() === "d") {
      event.preventDefault();
      duplicateSelection();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelection();
      return;
    }
    if (event.key === "Escape") {
      cancelPointer();
      controller.select(screen.id, []);
      return;
    }
    const directions: Record<string, Point> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 }
    };
    const direction = directions[event.key];
    if (direction && selectedIds.length > 0) {
      event.preventDefault();
      const step = event.shiftKey ? 5 : 1;
      const selected = movableWidgets(selectedIds);
      if (selected.length === 0) return;
      const bounds = moveBoundsGroup(selected, { x: direction.x * step, y: direction.y * step }, screen);
      controller.commitWidgets(screen.id, applyBounds(screen.widgets, bounds), "Mover widgets", selectedIds);
    }
  }

  function addWidgetAt(type: LinkPadWidget["type"], clientX: number, clientY: number) {
    const point = screenPoint(clientX, clientY);
    const widget = createWidgetFromCatalog(type, screen.widgets.length);
    widget.x = Math.max(0, Math.min(screen.width - widget.width, Math.round(point.x - widget.width / 2)));
    widget.y = Math.max(0, Math.min(screen.height - widget.height, Math.round(point.y - widget.height / 2)));
    if (snapEnabled) {
      const snapped = moveBoundsGroup([widget], { x: 0, y: 0 }, screen, gridSize)[widget.id];
      Object.assign(widget, snapped);
    }
    controller.commitWidgets(screen.id, [...screen.widgets, widget], "Adicionar widget", [widget.id]);
  }

  function renderWidget(widget: LinkPadWidget) {
    if (widget.type === "static_text" || widget.type === "status_indicator") return String(widget.props.text ?? widgetNames[widget.type]);
    if (widget.type === "write_button") return String(widget.props.text ?? "Escrever");
    const binding = bindingFrom(widget.props.binding);
    const value = simulationValueForBinding(project, binding);
    if (widget.type === "boolean_indicator") {
      return <><i className={value === true ? "led on" : "led"} /> {typeof value === "boolean" ? (value ? "Ligado" : "Desligado") : "Estado"}</>;
    }
    if (widget.type === "gauge" || widget.type === "progress_bar") {
      const minimum = Number(widget.props.min ?? 0);
      const maximum = Number(widget.props.max ?? 100);
      const numeric = typeof value === "number" && Number.isFinite(value) ? value : minimum;
      const ratio = maximum > minimum ? Math.max(0, Math.min(1, (numeric - minimum) / (maximum - minimum))) : 0;
      const label = value === undefined ? "###" : String(value);
      const color = String(widget.props.color ?? "#ff7a21");
      if (widget.type === "progress_bar") {
        return (
          <span className="progress-widget">
            <i style={{ background: color, width: `${ratio * 100}%` }} />
            {Boolean(widget.props.showValue ?? true) && <b>{label}</b>}
          </span>
        );
      }
      return (
        <svg aria-label={`Medidor ${label}`} className="gauge-widget" viewBox="0 0 100 58">
          <path d="M 10 50 A 40 40 0 0 1 90 50" pathLength="100" />
          <path className="value" d="M 10 50 A 40 40 0 0 1 90 50" pathLength="100" stroke={color} strokeDasharray={`${ratio * 100} 100`} />
          {Boolean(widget.props.showValue ?? true) && <text x="50" y="49">{label}</text>}
        </svg>
      );
    }
    if (value !== undefined) return String(value);
    const type = valueTypeForBinding(project, binding);
    if (type === "float") return "##.##";
    if (type === "string") return "Texto";
    if (type === "bool") return "ON/OFF";
    return "###";
  }

  const canvasStyle = {
    aspectRatio: `${screen.width} / ${screen.height}`,
    width: zoom === 0 ? "min(720px, 92%)" : `${Math.round(720 * zoom)}px`,
    "--grid-size-x": `${gridSize / screen.width * 100}%`,
    "--grid-size-y": `${gridSize / screen.height * 100}%`
  } as CSSProperties;
  const marqueeBounds = marquee ? normalizedRect(marquee.start, marquee.current) : undefined;
  const selectedWidgets = screen.widgets.filter((widget) => selectedIds.includes(widget.id));
  const editableWidgets = movableWidgets(selectedIds);
  const allSelectedLocked = selectedWidgets.length > 0 && selectedWidgets.every(isWidgetLocked);

  return (
    <>
      <div
      aria-label={`Canvas da ${screen.name}`}
      className={`device-preview ${dropTarget ? "drop-target" : ""}`}
      ref={canvasRef}
      role="application"
      style={canvasStyle}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerCancel={cancelPointer}
      onPointerDown={beginMarquee}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
    >
      <div className={`preview-grid ${gridEnabled ? "" : "hidden"}`} />
      {guidesEnabled && manipulation?.guides.map((guide, index) => (
        <div
          className={`smart-guide ${guide.axis} ${guide.source}`}
          key={`${guide.axis}-${guide.position}-${index}`}
          style={guide.axis === "vertical"
            ? { left: `${guide.position / screen.width * 100}%` }
            : { top: `${guide.position / screen.height * 100}%` }}
        />
      ))}
      {screen.widgets.filter((widget) => widget.visible).map((widget) => {
        const bounds = manipulation?.draft[widget.id] ?? boundsOf(widget);
        const selected = selectedIds.includes(widget.id);
        const transparent = Boolean(widget.props.transparent ?? widget.type !== "write_button");
        const fontSize = Math.max(6, Math.min(32, Number(widget.props.fontSize ?? 8)));
        const padding = Math.max(0, Math.min(20, Number(widget.props.padding ?? (widget.type === "write_button" ? 4 : 2))));
        const borderWidth = Math.max(0, Math.min(8, Number(widget.props.borderWidth ?? (widget.type === "write_button" ? 1 : 0))));
        const borderRadius = Math.max(0, Math.min(20, Number(widget.props.borderRadius ?? (widget.type === "write_button" ? 3 : 0))));
        const horizontal = String(widget.props.textAlign ?? (widget.type === "write_button" ? "center" : "left"));
        const vertical = String(widget.props.verticalAlign ?? "middle");
        return (
          <button
            className={`canvas-widget ${selected ? "selected" : ""} ${isWidgetLocked(widget) ? "locked" : ""} ${auditWarnings.has(widget.id) ? "audit-warning" : ""} ${manipulation?.draft[widget.id] ? "manipulating" : ""} ${widget.type}`}
            key={widget.id}
            title={isWidgetLocked(widget)
              ? "Widget bloqueado; use o clique direito para desbloquear"
              : auditWarnings.has(widget.id)
                ? auditIssues.filter((issue) => issue.widgetId === widget.id && issue.severity === "warning").map((issue) => issue.message).join(" ")
                : "Duplo clique para configurar"}
            type="button"
            style={{
              ...boundsStyle(bounds, screen),
              color: String(widget.props.color ?? "#fff"),
              background: transparent
                ? "transparent"
                : String(widget.props.backgroundColor ?? (widget.type === "write_button" ? "#41210f" : "#232528")),
              fontSize: `${fontSize / screen.width * 100}cqw`,
              justifyContent: horizontal === "right" ? "flex-end" : horizontal === "center" ? "center" : "flex-start",
              alignItems: vertical === "top" ? "flex-start" : vertical === "bottom" ? "flex-end" : "center",
              padding: `${padding / screen.width * 100}cqw`,
              border: borderWidth > 0 ? `${borderWidth / screen.width * 100}cqw solid ${String(widget.props.borderColor ?? widget.props.color ?? "#ffffff")}` : "none",
              borderRadius: `${borderRadius / screen.width * 100}cqw`,
              textAlign: horizontal as CSSProperties["textAlign"]
             }}
             onDragStart={(event) => event.preventDefault()}
             onContextMenu={(event) => openWidgetContextMenu(event, widget)}
             onDoubleClick={(event) => openWidgetProperties(event, widget)}
             onPointerDown={(event) => beginMove(event, widget)}
           >{renderWidget(widget)}</button>
        );
      })}

      {manipulation?.moved && manipulation.initial.map((widget) => (
        <div className="widget-drag-origin" key={widget.id} style={boundsStyle(boundsOf(widget), screen)} />
      ))}

      {selectedIds.map((id) => {
        const widget = screen.widgets.find((item) => item.id === id);
        if (!widget || !widget.visible) return null;
        const bounds = manipulation?.draft[id] ?? boundsOf(widget);
        const primary = selection.primaryId === id;
        return (
          <div className={`widget-selection-box ${primary ? "primary" : ""}`} key={id} style={boundsStyle(bounds, screen)}>
            {primary && selectedIds.length === 1 && !isWidgetLocked(widget) && RESIZE_HANDLES.map((handle) => (
              <button
                aria-label={`Redimensionar ${handle}`}
                className={`resize-handle ${handle}`}
                key={handle}
                type="button"
                onPointerDown={(event) => beginResize(event, widget, handle)}
              />
            ))}
          </div>
        );
      })}

      {marqueeBounds && <div className="selection-marquee" style={boundsStyle(marqueeBounds, screen)} />}
      <RuntimeStatusOverlay
        agentOnline
        config={project.hardware.statusOverlay}
        height={screen.height}
        wifiOnline
        width={screen.width}
      />
      {screen.widgets.length === 0 && <div className="preview-label">Arraste um widget do Contexto para começar</div>}
      </div>
      {contextMenu && createPortal(
        <WidgetContextMenu
          allLocked={allSelectedLocked}
          canEdit={editableWidgets.length > 0}
          canPaste={controller.canPaste}
          menuRef={contextMenuRef}
          x={contextMenu.x}
          y={contextMenu.y}
          onCopy={() => closeContextMenu(() => controller.copyWidgets(selectedWidgets))}
          onCut={() => closeContextMenu(() => {
            controller.copyWidgets(editableWidgets);
            deleteSelection();
          })}
          onDelete={() => closeContextMenu(deleteSelection)}
          onDuplicate={() => closeContextMenu(duplicateSelection)}
          onLockChange={(locked) => closeContextMenu(() => lockSelection(locked))}
          onPaste={() => closeContextMenu(() => controller.pasteWidgets(screen.id))}
        />,
        document.body
      )}
    </>
  );
}
