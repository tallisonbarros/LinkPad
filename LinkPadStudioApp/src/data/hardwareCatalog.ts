import type { HardwareManifest } from "../types/project";

export const hardwareCatalog: HardwareManifest[] = [
  {
    id: "m5stickc-plus2",
    name: "M5StickC Plus2",
    family: "m5stack",
    runtime: "arduino-esp32",
    display: {
      width: 240,
      height: 135,
      touch: false,
      color: true,
      statusOverlay: {
        enabled: true,
        placement: "top-right",
        style: "watermark",
        indicators: ["wifi", "agent"]
      }
    },
    inputs: ["button_a", "button_b", "power_button"],
    network: ["wifi"],
    storage: ["nvs", "spiffs"],
    capabilities: {
      battery: true,
      buzzer: true,
      imu: true
    }
  }
];

export function getHardwareManifest(id: string) {
  return hardwareCatalog.find((hardware) => hardware.id === id) ?? hardwareCatalog[0];
}
