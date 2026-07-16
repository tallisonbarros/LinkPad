import { Link2, Wifi } from "lucide-react";
import { calculateStatusOverlayLayout, normalizeStatusOverlay } from "../../domain/runtime/statusOverlay";
import type { RuntimeStatusOverlayConfig } from "../../types/project";

interface RuntimeStatusOverlayProps {
  width: number;
  height: number;
  config?: RuntimeStatusOverlayConfig;
  wifiOnline: boolean;
  agentOnline: boolean;
}

export function RuntimeStatusOverlay({
  width,
  height,
  config,
  wifiOnline,
  agentOnline
}: RuntimeStatusOverlayProps) {
  const resolvedConfig = normalizeStatusOverlay(config);
  if (!resolvedConfig.enabled || resolvedConfig.indicators.length === 0) return null;
  const layout = calculateStatusOverlayLayout(width, height, resolvedConfig.indicators.length, resolvedConfig.placement);

  return (
    <svg
      aria-hidden="true"
      className="runtime-status-overlay"
      viewBox={`0 0 ${width} ${height}`}
    >
      {resolvedConfig.indicators.map((indicator, index) => {
        const x = layout.x + index * (layout.iconSize + layout.gap);
        const online = indicator === "wifi" ? wifiOnline : agentOnline;
        const Icon = indicator === "wifi" ? Wifi : Link2;
        return (
          <Icon
            color={online ? "#42c879" : "#f16969"}
            height={layout.iconSize}
            key={indicator}
            strokeWidth={2.2}
            width={layout.iconSize}
            x={x}
            y={layout.y}
          />
        );
      })}
    </svg>
  );
}
