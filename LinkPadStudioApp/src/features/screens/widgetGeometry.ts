import type { LinkPadWidget } from "../../types/project";

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface WidgetBounds extends Point, Size {}

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export type AlignmentMode = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";
export type DistributionMode = "horizontal" | "vertical";
export type LayerOrder = "front" | "forward" | "backward" | "back";
export interface SnapGuide {
  axis: "horizontal" | "vertical";
  position: number;
  source: "screen" | "widget";
}

export interface SmartSnapResult {
  bounds: Record<string, WidgetBounds>;
  guides: SnapGuide[];
}

export function boundsOf(widget: LinkPadWidget): WidgetBounds {
  return { x: widget.x, y: widget.y, width: widget.width, height: widget.height };
}

export function snapValue(value: number, gridSize?: number) {
  if (!gridSize || gridSize <= 1) return Math.round(value);
  return Math.round(value / gridSize) * gridSize;
}

export function moveBoundsGroup(
  widgets: Array<Pick<LinkPadWidget, "id" | "x" | "y" | "width" | "height">>,
  delta: Point,
  screen: Size,
  gridSize?: number
): Record<string, WidgetBounds> {
  if (widgets.length === 0) return {};
  const left = Math.min(...widgets.map((widget) => widget.x));
  const top = Math.min(...widgets.map((widget) => widget.y));
  const right = Math.max(...widgets.map((widget) => widget.x + widget.width));
  const bottom = Math.max(...widgets.map((widget) => widget.y + widget.height));
  let dx = Math.round(delta.x);
  let dy = Math.round(delta.y);
  if (gridSize && gridSize > 1) {
    dx = snapValue(left + dx, gridSize) - left;
    dy = snapValue(top + dy, gridSize) - top;
  }
  dx = Math.max(-left, Math.min(screen.width - right, dx));
  dy = Math.max(-top, Math.min(screen.height - bottom, dy));
  return Object.fromEntries(widgets.map((widget) => [widget.id, {
    x: widget.x + dx,
    y: widget.y + dy,
    width: widget.width,
    height: widget.height
  }]));
}

export function smartSnapMove(
  widgets: Array<Pick<LinkPadWidget, "id" | "x" | "y" | "width" | "height">>,
  proposed: Record<string, WidgetBounds>,
  others: Array<Pick<LinkPadWidget, "x" | "y" | "width" | "height">>,
  screen: Size,
  threshold = 2
): SmartSnapResult {
  const selected = widgets.map((widget) => proposed[widget.id]).filter(Boolean);
  if (selected.length === 0) return { bounds: proposed, guides: [] };
  const group = unionBounds(selected);
  const xMatch = closestAnchorMatch(
    anchors(group.x, group.width),
    axisTargets(others, screen.width, "x"),
    threshold
  );
  const yMatch = closestAnchorMatch(
    anchors(group.y, group.height),
    axisTargets(others, screen.height, "y"),
    threshold
  );
  let dx = xMatch?.delta ?? 0;
  let dy = yMatch?.delta ?? 0;
  dx = Math.max(-group.x, Math.min(screen.width - group.x - group.width, dx));
  dy = Math.max(-group.y, Math.min(screen.height - group.y - group.height, dy));
  return {
    bounds: Object.fromEntries(Object.entries(proposed).map(([id, bounds]) => [id, {
      ...bounds,
      x: bounds.x + dx,
      y: bounds.y + dy
    }])),
    guides: [
      ...(xMatch && dx === xMatch.delta ? [{ axis: "vertical" as const, position: xMatch.target.value, source: xMatch.target.source }] : []),
      ...(yMatch && dy === yMatch.delta ? [{ axis: "horizontal" as const, position: yMatch.target.value, source: yMatch.target.source }] : [])
    ]
  };
}

export function smartSnapResize(
  proposed: WidgetBounds,
  handle: ResizeHandle,
  others: Array<Pick<LinkPadWidget, "x" | "y" | "width" | "height">>,
  screen: Size,
  minimum: Size,
  threshold = 2
): { bounds: WidgetBounds; guides: SnapGuide[] } {
  let { x, y, width, height } = proposed;
  const guides: SnapGuide[] = [];
  const xTargets = axisTargets(others, screen.width, "x");
  const yTargets = axisTargets(others, screen.height, "y");
  const movingX = handle.includes("w") ? x : handle.includes("e") ? x + width : undefined;
  const movingY = handle.includes("n") ? y : handle.includes("s") ? y + height : undefined;
  const xMatch = movingX === undefined ? undefined : closestAnchorMatch([movingX], xTargets, threshold);
  const yMatch = movingY === undefined ? undefined : closestAnchorMatch([movingY], yTargets, threshold);

  if (xMatch) {
    if (handle.includes("w")) {
      const right = x + width;
      x = Math.min(right - minimum.width, xMatch.target.value);
      width = right - x;
    } else {
      width = Math.max(minimum.width, xMatch.target.value - x);
    }
    guides.push({ axis: "vertical", position: xMatch.target.value, source: xMatch.target.source });
  }
  if (yMatch) {
    if (handle.includes("n")) {
      const bottom = y + height;
      y = Math.min(bottom - minimum.height, yMatch.target.value);
      height = bottom - y;
    } else {
      height = Math.max(minimum.height, yMatch.target.value - y);
    }
    guides.push({ axis: "horizontal", position: yMatch.target.value, source: yMatch.target.source });
  }
  return { bounds: { x, y, width, height }, guides };
}

function unionBounds(bounds: WidgetBounds[]): WidgetBounds {
  const x = Math.min(...bounds.map((item) => item.x));
  const y = Math.min(...bounds.map((item) => item.y));
  const right = Math.max(...bounds.map((item) => item.x + item.width));
  const bottom = Math.max(...bounds.map((item) => item.y + item.height));
  return { x, y, width: right - x, height: bottom - y };
}

function anchors(start: number, size: number) {
  return [start, start + size / 2, start + size];
}

interface AxisTarget {
  value: number;
  source: SnapGuide["source"];
}

function axisTargets(
  widgets: Array<Pick<LinkPadWidget, "x" | "y" | "width" | "height">>,
  screenSize: number,
  axis: "x" | "y"
): AxisTarget[] {
  const screenTargets = anchors(0, screenSize).map((value) => ({ value, source: "screen" as const }));
  const widgetTargets = widgets.flatMap((widget) => anchors(
    axis === "x" ? widget.x : widget.y,
    axis === "x" ? widget.width : widget.height
  ).map((value) => ({ value, source: "widget" as const })));
  return [...screenTargets, ...widgetTargets];
}

function closestAnchorMatch(selected: number[], targets: AxisTarget[], threshold: number) {
  let best: { delta: number; target: AxisTarget } | undefined;
  for (const source of selected) {
    for (const target of targets) {
      const delta = target.value - source;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
        best = { delta, target };
      }
    }
  }
  return best;
}

export function resizeBounds(
  initial: WidgetBounds,
  handle: ResizeHandle,
  delta: Point,
  screen: Size,
  minimum: Size,
  gridSize?: number,
  preserveRatio = false
): WidgetBounds {
  let left = initial.x;
  let top = initial.y;
  let right = initial.x + initial.width;
  let bottom = initial.y + initial.height;
  const dx = Math.round(delta.x);
  const dy = Math.round(delta.y);

  if (handle.includes("w")) left += dx;
  if (handle.includes("e")) right += dx;
  if (handle.includes("n")) top += dy;
  if (handle.includes("s")) bottom += dy;

  if (gridSize && gridSize > 1) {
    if (handle.includes("w")) left = snapValue(left, gridSize);
    if (handle.includes("e")) right = snapValue(right, gridSize);
    if (handle.includes("n")) top = snapValue(top, gridSize);
    if (handle.includes("s")) bottom = snapValue(bottom, gridSize);
  }

  if (preserveRatio && handle.length === 2) {
    const ratio = initial.width / initial.height;
    const requestedWidth = Math.max(minimum.width, right - left);
    const requestedHeight = Math.max(minimum.height, bottom - top);
    if (Math.abs(requestedWidth - initial.width) >= Math.abs(requestedHeight - initial.height) * ratio) {
      const height = Math.max(minimum.height, Math.round(requestedWidth / ratio));
      if (handle.includes("n")) top = bottom - height;
      else bottom = top + height;
    } else {
      const width = Math.max(minimum.width, Math.round(requestedHeight * ratio));
      if (handle.includes("w")) left = right - width;
      else right = left + width;
    }
  }

  if (handle.includes("w")) left = Math.max(0, Math.min(right - minimum.width, left));
  if (handle.includes("e")) right = Math.min(screen.width, Math.max(left + minimum.width, right));
  if (handle.includes("n")) top = Math.max(0, Math.min(bottom - minimum.height, top));
  if (handle.includes("s")) bottom = Math.min(screen.height, Math.max(top + minimum.height, bottom));

  left = Math.max(0, left);
  top = Math.max(0, top);
  right = Math.min(screen.width, Math.max(left + minimum.width, right));
  bottom = Math.min(screen.height, Math.max(top + minimum.height, bottom));

  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function intersects(a: WidgetBounds, b: WidgetBounds) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

export function normalizedRect(start: Point, end: Point): WidgetBounds {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  };
}

export function alignWidgets(
  widgets: LinkPadWidget[],
  primaryId: string,
  mode: AlignmentMode
): LinkPadWidget[] {
  if (widgets.length < 2) return widgets;
  const primary = widgets.find((widget) => widget.id === primaryId) ?? widgets[0];
  const targetX = mode === "left" ? primary.x
    : mode === "hcenter" ? primary.x + primary.width / 2
      : primary.x + primary.width;
  const targetY = mode === "top" ? primary.y
    : mode === "vcenter" ? primary.y + primary.height / 2
      : primary.y + primary.height;
  return widgets.map((widget) => {
    if (mode === "left") return { ...widget, x: Math.round(targetX) };
    if (mode === "hcenter") return { ...widget, x: Math.round(targetX - widget.width / 2) };
    if (mode === "right") return { ...widget, x: Math.round(targetX - widget.width) };
    if (mode === "top") return { ...widget, y: Math.round(targetY) };
    if (mode === "vcenter") return { ...widget, y: Math.round(targetY - widget.height / 2) };
    return { ...widget, y: Math.round(targetY - widget.height) };
  });
}

export function distributeWidgets(widgets: LinkPadWidget[], mode: DistributionMode): LinkPadWidget[] {
  if (widgets.length < 3) return widgets;
  const ordered = [...widgets].sort((a, b) => mode === "horizontal" ? a.x - b.x : a.y - b.y);
  if (mode === "horizontal") {
    const left = ordered[0].x;
    const right = ordered.at(-1)!.x + ordered.at(-1)!.width;
    const occupied = ordered.reduce((total, widget) => total + widget.width, 0);
    const gap = (right - left - occupied) / (ordered.length - 1);
    let cursor = left;
    const positions = new Map<string, number>();
    for (const widget of ordered) {
      positions.set(widget.id, Math.round(cursor));
      cursor += widget.width + gap;
    }
    return widgets.map((widget) => ({ ...widget, x: positions.get(widget.id) ?? widget.x }));
  }
  const top = ordered[0].y;
  const bottom = ordered.at(-1)!.y + ordered.at(-1)!.height;
  const occupied = ordered.reduce((total, widget) => total + widget.height, 0);
  const gap = (bottom - top - occupied) / (ordered.length - 1);
  let cursor = top;
  const positions = new Map<string, number>();
  for (const widget of ordered) {
    positions.set(widget.id, Math.round(cursor));
    cursor += widget.height + gap;
  }
  return widgets.map((widget) => ({ ...widget, y: positions.get(widget.id) ?? widget.y }));
}

export function centerWidgetsOnScreen(widgets: LinkPadWidget[], screen: Size, axis: "horizontal" | "vertical") {
  if (widgets.length === 0) return widgets;
  const left = Math.min(...widgets.map((widget) => widget.x));
  const top = Math.min(...widgets.map((widget) => widget.y));
  const right = Math.max(...widgets.map((widget) => widget.x + widget.width));
  const bottom = Math.max(...widgets.map((widget) => widget.y + widget.height));
  const dx = axis === "horizontal" ? Math.round((screen.width - (right - left)) / 2 - left) : 0;
  const dy = axis === "vertical" ? Math.round((screen.height - (bottom - top)) / 2 - top) : 0;
  return widgets.map((widget) => ({ ...widget, x: widget.x + dx, y: widget.y + dy }));
}

export function matchWidgetSize(widgets: LinkPadWidget[], primaryId: string, dimension: "width" | "height" | "both") {
  const primary = widgets.find((widget) => widget.id === primaryId) ?? widgets[0];
  if (!primary) return widgets;
  return widgets.map((widget) => ({
    ...widget,
    width: dimension === "height" ? widget.width : primary.width,
    height: dimension === "width" ? widget.height : primary.height
  }));
}

export function applyBounds(widgets: LinkPadWidget[], bounds: Record<string, WidgetBounds>) {
  return widgets.map((widget) => bounds[widget.id] ? { ...widget, ...bounds[widget.id] } : widget);
}

export function reorderWidgets(widgets: LinkPadWidget[], selectedIds: string[], destination: LayerOrder) {
  const selected = new Set(selectedIds);
  const selectedWidgets = widgets.filter((widget) => selected.has(widget.id));
  if (selectedWidgets.length === 0) return widgets;
  if (destination === "front" || destination === "back") {
    const unselected = widgets.filter((widget) => !selected.has(widget.id));
    return destination === "front" ? [...unselected, ...selectedWidgets] : [...selectedWidgets, ...unselected];
  }
  const next = [...widgets];
  if (destination === "forward") {
    for (let index = next.length - 2; index >= 0; index -= 1) {
      if (selected.has(next[index].id) && !selected.has(next[index + 1].id)) {
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
      }
    }
  } else {
    for (let index = 1; index < next.length; index += 1) {
      if (selected.has(next[index].id) && !selected.has(next[index - 1].id)) {
        [next[index], next[index - 1]] = [next[index - 1], next[index]];
      }
    }
  }
  return next;
}
