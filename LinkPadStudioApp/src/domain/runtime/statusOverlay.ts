import type {
  RuntimeStatusIndicator,
  RuntimeStatusOverlayConfig,
  RuntimeStatusOverlayPlacement
} from "../project/types";

const placements = new Set<RuntimeStatusOverlayPlacement>([
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right"
]);
const indicators = new Set<RuntimeStatusIndicator>(["wifi", "agent"]);

export function createDefaultStatusOverlay(): RuntimeStatusOverlayConfig {
  return {
    enabled: true,
    placement: "top-right",
    style: "watermark",
    indicators: ["wifi", "agent"]
  };
}

export function normalizeStatusOverlay(candidate: unknown): RuntimeStatusOverlayConfig {
  const fallback = createDefaultStatusOverlay();
  if (!candidate || typeof candidate !== "object") return fallback;
  const raw = candidate as Partial<RuntimeStatusOverlayConfig>;
  const placement = placements.has(raw.placement as RuntimeStatusOverlayPlacement)
    ? raw.placement as RuntimeStatusOverlayPlacement
    : fallback.placement;
  const selectedIndicators = Array.isArray(raw.indicators)
    ? raw.indicators.filter((item): item is RuntimeStatusIndicator => indicators.has(item as RuntimeStatusIndicator))
    : fallback.indicators;
  return {
    enabled: raw.enabled !== false,
    placement,
    style: "watermark",
    indicators: selectedIndicators.length > 0 ? [...new Set(selectedIndicators)] : fallback.indicators
  };
}

export interface RuntimeStatusOverlayLayout {
  x: number;
  y: number;
  iconSize: number;
  gap: number;
}

export function calculateStatusOverlayLayout(
  width: number,
  height: number,
  count: number,
  placement: RuntimeStatusOverlayPlacement
): RuntimeStatusOverlayLayout {
  const shortSide = Math.max(1, Math.min(width, height));
  const iconSize = Math.max(10, Math.min(18, Math.round(shortSide / 10)));
  const margin = Math.max(2, Math.min(6, Math.round(shortSide / 45)));
  const gap = Math.max(3, Math.min(6, Math.round(iconSize / 3)));
  const totalWidth = Math.max(0, count * iconSize + Math.max(0, count - 1) * gap);
  const x = placement.endsWith("right") ? width - margin - totalWidth : margin;
  const y = placement.startsWith("bottom") ? height - margin - iconSize : margin;
  return { x, y, iconSize, gap };
}
