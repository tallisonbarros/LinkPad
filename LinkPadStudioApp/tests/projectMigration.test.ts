import { describe, expect, it } from "vitest";
import legacyProject from "./fixtures/project-v0.1.0.json";
import { createDefaultSimProfile, migrateProject } from "../src/domain/project/migrations";
import { validateProjectForBuild } from "../src/domain/project/validation";
import { calculateStatusOverlayLayout } from "../src/domain/runtime/statusOverlay";

describe("project migration", () => {
  it("migrates 0.1.0 projects without losing the existing tag", () => {
    const migrated = migrateProject(legacyProject);

    expect(migrated.schemaVersion).toBe("0.3.0");
    expect(migrated.studioVersion).toBe("0.6.0");
    expect(migrated.agent.protocolVersion).toBe("0.1.0");
    expect(migrated.protocols).toEqual([createDefaultSimProfile("project-legacy")]);
    expect(migrated.hardware.statusOverlay).toEqual({
      enabled: true,
      placement: "top-right",
      style: "watermark",
      indicators: ["wifi", "agent"]
    });
    expect(migrated.tags[0]).toMatchObject({
      name: "MotorSpeed",
      protocolProfileId: "sim-main",
      address: { key: "Motor.Speed" }
    });
    expect(migrated.screens).toHaveLength(1);
    expect(migrated.screens[0].inputBindings).toEqual([{
      inputId: "primary",
      event: "press",
      action: { type: "navigate", target: "next" }
    }]);
  });

  it("migrates 0.2.0 implicit M5 behavior into explicit screen controls", () => {
    const migrated = migrateProject({
      ...legacyProject,
      schemaVersion: "0.2.0",
      studioVersion: "0.5.1",
      network: { mode: "wifi", ssid: "factory", password: "" },
      agent: { ...legacyProject.agent, protocolVersion: "0.1.0" },
      protocols: [createDefaultSimProfile("project-legacy")],
      tags: [{
        ...legacyProject.tags[0],
        direction: "readWrite",
        protocolProfileId: "sim-main",
        address: { key: "Motor.Speed" },
        min: 0,
        max: 60
      }],
      screens: [{
        ...legacyProject.screens[0],
        widgets: [{ id: "write-speed", type: "write_button", x: 5, y: 50, width: 80, height: 24, visible: true, props: { tag: "MotorSpeed", value: 42 } }]
      }],
      build: { serialPort: "", baudRate: 115200 }
    });

    expect(migrated.schemaVersion).toBe("0.3.0");
    expect(migrated.screens[0].inputBindings).toEqual([
      { inputId: "primary", event: "press", action: { type: "navigate", target: "next" } },
      { inputId: "secondary", event: "press", action: { type: "activateWidget", widgetId: "write-speed" } }
    ]);
  });

  it("rejects bindings for reserved hardware controls", () => {
    const migrated = migrateProject(legacyProject);
    migrated.screens[0].inputBindings = [{
      inputId: "power",
      event: "press",
      action: { type: "navigate", target: "next" }
    }];

    const issues = validateProjectForBuild(migrated);
    expect(issues.some((issue) => issue.path.includes("inputBindings.power") && issue.message.includes("reservado"))).toBe(true);
  });

  it("rejects screen actions that write to read-only tags", () => {
    const migrated = migrateProject(legacyProject);
    migrated.screens[0].inputBindings = [{
      inputId: "secondary",
      event: "press",
      action: { type: "writeTag", tag: "MotorSpeed", value: 10 }
    }];

    const issues = validateProjectForBuild(migrated);
    expect(issues.some((issue) => issue.path.includes("inputBindings.secondary") && issue.message.includes("somente leitura"))).toBe(true);
  });

  it("accepts a private Siemens S7 profile and typed DB address", () => {
    const migrated = migrateProject({
      ...legacyProject,
      schemaVersion: "0.2.0",
      studioVersion: "0.2.0",
      network: { mode: "wifi", ssid: "factory", password: "" },
      protocols: [{
        id: "s7-main",
        name: "S7 principal",
        driver: "siemens-s7",
        endpoint: "s7://192.168.0.10:102",
        enabled: true,
        options: { rack: 0, slot: 1, timeoutMs: 2000 }
      }],
      tags: [{
        ...legacyProject.tags[0],
        type: "float",
        source: "agent",
        protocolProfileId: "s7-main",
        address: { area: "DB", dbNumber: 100, byteOffset: 0, dataType: "REAL" }
      }],
      build: { serialPort: "", baudRate: 115200 }
    });

    const issues = validateProjectForBuild(migrated);
    expect(issues.some((issue) => issue.path.startsWith("protocols.s7-main") || issue.path.includes(".address"))).toBe(false);
  });

  it("renames the untouched simulation default after changing its driver to Siemens", () => {
    const migrated = migrateProject({
      ...legacyProject,
      schemaVersion: "0.2.0",
      studioVersion: "0.3.0",
      network: { mode: "wifi", ssid: "factory", password: "" },
      protocols: [{
        id: "sim-main",
        name: "Simulação principal",
        driver: "siemens-s7",
        endpoint: "s7://192.168.0.10:102",
        enabled: true,
        options: { rack: 0, slot: 1, timeoutMs: 2000 }
      }],
      tags: [],
      build: { serialPort: "", baudRate: 115200 }
    });

    expect(migrated.protocols[0].name).toBe("Siemens S7 principal");
    expect(migrated.protocols[0].id).toBe("sim-main");
  });

  it("accepts multiple enabled connectors with tags bound to different profiles", () => {
    const migrated = migrateProject({
      ...legacyProject,
      schemaVersion: "0.2.0",
      studioVersion: "0.3.0",
      network: { mode: "wifi", ssid: "factory", password: "" },
      protocols: [
        {
          id: "sim-main",
          name: "Simulacao principal",
          driver: "sim",
          endpoint: "memory://line-1",
          enabled: true,
          options: {}
        },
        {
          id: "s7-main",
          name: "S7 principal",
          driver: "siemens-s7",
          endpoint: "s7://192.168.0.10:102",
          enabled: true,
          options: { rack: 0, slot: 1, timeoutMs: 2000 }
        }
      ],
      tags: [
        {
          ...legacyProject.tags[0],
          source: "agent",
          protocolProfileId: "sim-main",
          address: { key: "Motor.Speed" }
        },
        {
          ...legacyProject.tags[0],
          name: "S7Speed",
          source: "agent",
          protocolProfileId: "s7-main",
          address: { area: "DB", dbNumber: 100, byteOffset: 0, dataType: "REAL" }
        }
      ],
      build: { serialPort: "", baudRate: 115200 }
    });

    const errors = validateProjectForBuild(migrated).filter((issue) => issue.severity === "error");
    expect(errors).toEqual([]);
  });

  it("blocks public S7 targets and mismatched PLC data types", () => {
    const migrated = migrateProject({
      ...legacyProject,
      schemaVersion: "0.2.0",
      studioVersion: "0.2.0",
      network: { mode: "wifi", ssid: "factory", password: "" },
      protocols: [{
        id: "s7-main",
        name: "S7 principal",
        driver: "siemens-s7",
        endpoint: "s7://8.8.8.8:102",
        enabled: true,
        options: { rack: 0, slot: 1, timeoutMs: 2000 }
      }],
      tags: [{
        ...legacyProject.tags[0],
        type: "float",
        source: "agent",
        protocolProfileId: "s7-main",
        address: { area: "DB", dbNumber: 100, byteOffset: 0, dataType: "DINT" }
      }],
      build: { serialPort: "", baudRate: 115200 }
    });

    const issues = validateProjectForBuild(migrated);
    expect(issues.some((issue) => issue.path.endsWith("endpoint"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("não é compatível"))).toBe(true);
  });

  it("normalizes missing optional 0.2.0 collections", () => {
    const migrated = migrateProject({
      ...legacyProject,
      schemaVersion: "0.2.0",
      studioVersion: "0.2.0",
      network: { mode: "wifi", ssid: "", password: "" },
      protocols: [],
      build: { serialPort: "", baudRate: 115200 }
    });

    expect(migrated.protocols[0].driver).toBe("sim");
  });

  it("reports build blockers without rejecting the editable project", () => {
    const migrated = migrateProject(legacyProject);
    const issues = validateProjectForBuild(migrated);

    expect(issues.some((issue) => issue.path === "network.ssid" && issue.severity === "error")).toBe(true);
  });

  it("rejects widgets outside the M5 display during build validation", () => {
    const migrated = migrateProject({
      ...legacyProject,
      schemaVersion: "0.2.0",
      studioVersion: "0.2.0",
      network: { mode: "wifi", ssid: "factory", password: "" },
      protocols: [createDefaultSimProfile("project-legacy")],
      build: { serialPort: "", baudRate: 115200 },
      screens: [{
        ...legacyProject.screens[0],
        widgets: [{ id: "outside", type: "static_text", x: 230, y: 10, width: 30, height: 20, visible: true, props: { text: "x" } }]
      }]
    });

    const issues = validateProjectForBuild(migrated);
    expect(issues.some((issue) => issue.path.includes("outside") && issue.severity === "error")).toBe(true);
  });

  it("calculates a responsive top-right overlay from display dimensions", () => {
    expect(calculateStatusOverlayLayout(240, 135, 2, "top-right")).toEqual({
      x: 204,
      y: 3,
      iconSize: 14,
      gap: 5
    });
    const larger = calculateStatusOverlayLayout(320, 240, 2, "bottom-left");
    expect(larger.iconSize).toBe(18);
    expect(larger.x).toBeGreaterThan(0);
    expect(larger.y).toBeGreaterThan(200);
  });
});
