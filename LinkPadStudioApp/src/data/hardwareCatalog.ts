import type { HardwareDeviceAction, HardwareInputManifest, HardwareManifest } from "../types/project";

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
    inputs: [
      {
        id: "primary",
        label: "Botão A",
        kind: "button",
        events: ["press", "longPress"],
        deviceActions: [],
        configurable: true,
        description: "Controle frontal principal do M5StickC Plus2."
      },
      {
        id: "secondary",
        label: "Botão B",
        kind: "button",
        events: ["press", "longPress"],
        deviceActions: [],
        configurable: true,
        description: "Controle lateral secundário do M5StickC Plus2."
      },
      {
        id: "power",
        label: "Power",
        kind: "button",
        events: ["press", "longPress"],
        deviceActions: ["powerOff"],
        configurable: true,
        description: "Botão de energia do M5StickC Plus2."
      }
    ],
    network: ["wifi"],
    storage: ["nvs", "spiffs"],
    capabilities: {
      battery: true,
      buzzer: true,
      imu: true,
      powerOff: true
    }
  }
];

export function getHardwareManifest(id: string) {
  return hardwareCatalog.find((hardware) => hardware.id === id) ?? hardwareCatalog[0];
}

export function inputSupportsDeviceAction(
  hardware: HardwareManifest,
  input: HardwareInputManifest,
  action: HardwareDeviceAction
) {
  if (!input.deviceActions.includes(action)) return false;
  if (action === "powerOff") return hardware.capabilities.powerOff;
  return false;
}
