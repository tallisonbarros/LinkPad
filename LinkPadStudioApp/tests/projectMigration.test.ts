import { describe, expect, it } from "vitest";
import legacyProject from "./fixtures/project-v0.1.0.json";
import { createDefaultSimProfile, migrateProject } from "../src/domain/project/migrations";
import { validateProjectForBuild, validateTag } from "../src/domain/project/validation";
import { calculateStatusOverlayLayout } from "../src/domain/runtime/statusOverlay";
import { getHardwareManifest } from "../src/data/hardwareCatalog";

describe("project migration", () => {
  it("migrates 0.1.0 projects without losing the existing tag", () => {
    const migrated = migrateProject(legacyProject);

    expect(migrated.schemaVersion).toBe("0.9.0");
    expect(migrated.studioVersion).toBe("0.17.1");
    expect(migrated.agent.protocolVersion).toBe("0.1.0");
    expect(migrated.protocols).toEqual([createDefaultSimProfile("project-legacy")]);
    expect(migrated.hardware.statusOverlay).toEqual({
      enabled: true,
      placement: "top-right",
      style: "watermark",
      indicators: ["wifi", "agent"]
    });
    expect(migrated.tags[0]).toMatchObject({
      id: "global-tag-motorspeed",
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

  it("migrates schema 0.7.0 controls without rewriting their actions", () => {
    const current = migrateProject(legacyProject);
    const previousBindings = structuredClone(current.screens[0].inputBindings);
    const migrated = migrateProject({ ...current, schemaVersion: "0.7.0", studioVersion: "0.14.0" });

    expect(migrated.schemaVersion).toBe("0.9.0");
    expect(migrated.studioVersion).toBe("0.17.1");
    expect(migrated.screens[0].inputBindings).toEqual(previousBindings);
  });

  it("migrates 0.8.0 write and toggle actions into the unified value operation", () => {
    const current = migrateProject(legacyProject);
    const migrated = migrateProject({
      ...current,
      schemaVersion: "0.8.0",
      studioVersion: "0.15.0",
      screens: [{
        ...current.screens[0],
        inputBindings: [{
          inputId: "primary",
          event: "press",
          action: { type: "writeTag", binding: { kind: "global-tag", tagId: current.tags[0].id }, value: 12, min: 0, max: 100 }
        }, {
          inputId: "secondary",
          event: "press",
          action: { type: "toggleTag", binding: { kind: "connector", protocolProfileId: "sim-main", type: "bool", address: { key: "Enabled" }, pollMs: 500 } }
        }]
      }]
    });

    expect(migrated.schemaVersion).toBe("0.9.0");
    expect(migrated.screens[0].inputBindings).toEqual([{
      inputId: "primary",
      event: "press",
      action: {
        type: "changeValue",
        binding: { kind: "global-tag", tagId: current.tags[0].id },
        operation: "set",
        operand: 12,
        min: 0,
        max: 100
      }
    }, {
      inputId: "secondary",
      event: "press",
      action: {
        type: "changeValue",
        binding: { kind: "connector", protocolProfileId: "sim-main", type: "bool", address: { key: "Enabled" }, pollMs: 500 },
        operation: "toggle"
      }
    }]);
  });

  it("publishes short and long events for every M5 button", () => {
    const hardware = getHardwareManifest("m5stickc-plus2");
    expect(hardware.capabilities.powerOff).toBe(true);
    expect(hardware.inputs.map((input) => [input.id, input.configurable, input.events, input.deviceActions])).toEqual([
      ["primary", true, ["press", "longPress"], []],
      ["secondary", true, ["press", "longPress"], []],
      ["power", true, ["press", "longPress"], ["powerOff"]]
    ]);
  });

  it("normalizes editor metadata and removes orphan groups", () => {
    const current = migrateProject(legacyProject);
    current.screens[0].widgets = [{
      id: "label",
      type: "static_text",
      x: 0,
      y: 0,
      width: 40,
      height: 12,
      visible: true,
      props: { text: "Teste" },
      editor: { locked: true, groupId: "orphan" }
    }];

    const migrated = migrateProject({ ...current, schemaVersion: "0.5.0" });
    expect(migrated.screens[0].widgets[0].editor).toEqual({ locked: true });
    expect(migrated.screens[0].widgets[0].props).toMatchObject({
      fontSize: 8,
      textAlign: "left",
      verticalAlign: "middle",
      padding: 2,
      borderWidth: 0,
      borderRadius: 0
    });
  });

  it("migrates internal 0.4.0 tags into local runtime values", () => {
    const current = migrateProject(legacyProject);
    const migrated = migrateProject({
      ...current,
      schemaVersion: "0.4.0",
      studioVersion: "0.7.2",
      tags: [{
        ...current.tags[0],
        source: "internal",
        direction: "readWrite",
        simulationValue: 17.5,
        retentive: true
      }]
    });

    expect(migrated.tags[0]).toMatchObject({
      source: "internal",
      direction: "readWrite",
      initialValue: 17.5,
      retentive: true,
      quality: "good"
    });
    expect(migrated.tags[0].protocolProfileId).toBeUndefined();
    expect(migrated.tags[0].address).toBeUndefined();
    expect(migrated.tags[0].simulationValue).toBeUndefined();
    expect(validateTag(migrated, migrated.tags[0])).toEqual([]);
  });

  it("treats retentive as an internal-tag attribute", () => {
    const project = migrateProject(legacyProject);
    project.tags[0].retentive = true;

    const issues = validateTag(project, project.tags[0]);
    expect(issues.some((issue) => issue.path.endsWith(".retentive") && issue.message.includes("exclusivo"))).toBe(true);
  });

  it("normalizes the disabled Siemens OPC UA placeholder into the generic OPC UA connector", () => {
    const current = migrateProject(legacyProject);
    const migrated = migrateProject({
      ...current,
      studioVersion: "0.8.0",
      protocols: [{
        id: "opc-main",
        name: "PLC Siemens OPC UA",
        driver: "siemens-opcua",
        endpoint: "opc.tcp://192.168.0.10:4840",
        enabled: true,
        options: {}
      }]
    });

    expect(migrated.protocols[0]).toMatchObject({
      driver: "opcua",
      name: "PLC OPC UA",
      options: {
        securityPolicy: "None",
        securityMode: "None",
        sessionTimeoutMs: 30000,
        requestTimeoutMs: 2000
      },
      auth: { mode: "anonymous" }
    });
  });

  it("accepts an OPC UA profile and direct Node ID binding", () => {
    const migrated = migrateProject(legacyProject);
    migrated.network.ssid = "factory";
    migrated.protocols = [{
      id: "opc-main",
      name: "PLC OPC UA",
      driver: "opcua",
      endpoint: "opc.tcp://192.168.0.10:4840",
      enabled: true,
      options: {
        securityPolicy: "None",
        securityMode: "None",
        sessionTimeoutMs: 30000,
        requestTimeoutMs: 2000
      },
      auth: { mode: "anonymous" }
    }];
    migrated.tags = [];
    migrated.screens[0].widgets = [{
      id: "opc-value",
      type: "tag_value",
      x: 5,
      y: 5,
      width: 100,
      height: 20,
      visible: true,
      props: {
        binding: {
          kind: "connector",
          protocolProfileId: "opc-main",
          type: "float",
          address: { nodeId: "ns=3;s=Motor.Speed" },
          pollMs: 500
        }
      }
    }];

    const issues = validateProjectForBuild(migrated);
    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(issues.some((issue) => issue.severity === "warning" && issue.path.includes("security"))).toBe(true);
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

    expect(migrated.schemaVersion).toBe("0.9.0");
    expect(migrated.screens[0].widgets[0].props.binding).toEqual({
      kind: "global-tag",
      tagId: "global-tag-motorspeed"
    });
    expect(migrated.screens[0].widgets[0].props.min).toBe(0);
    expect(migrated.screens[0].widgets[0].props.max).toBe(60);
    expect(migrated.tags[0].min).toBeUndefined();
    expect(migrated.tags[0].max).toBeUndefined();
    expect(migrated.screens[0].inputBindings).toEqual([
      { inputId: "primary", event: "press", action: { type: "navigate", target: "next" } },
      { inputId: "secondary", event: "press", action: { type: "activateWidget", widgetId: "write-speed" } }
    ]);
  });

  it("accepts power events and ordered actions for the same event", () => {
    const migrated = migrateProject(legacyProject);
    migrated.screens[0].inputBindings = [
      { inputId: "power", event: "longPress", action: { type: "navigate", target: "next" } },
      { inputId: "power", event: "longPress", action: { type: "powerOff" } }
    ];

    const issues = validateProjectForBuild(migrated);
    expect(issues.some((issue) => issue.path.includes("inputBindings.power") && issue.severity === "error")).toBe(false);
  });

  it("warns when power off is not the last action in an event", () => {
    const migrated = migrateProject(legacyProject);
    migrated.screens[0].inputBindings = [
      { inputId: "power", event: "longPress", action: { type: "powerOff" } },
      { inputId: "power", event: "longPress", action: { type: "navigate", target: "next" } }
    ];

    const issues = validateProjectForBuild(migrated);
    expect(issues.some((issue) => issue.path.includes("inputBindings.power") && issue.message.includes("última ação") && issue.severity === "warning")).toBe(true);
  });

  it("rejects power off on inputs not authorized by the hardware manifest", () => {
    const migrated = migrateProject(legacyProject);
    migrated.screens[0].inputBindings = [
      { inputId: "primary", event: "longPress", action: { type: "powerOff" } }
    ];

    const issues = validateProjectForBuild(migrated);
    expect(issues.some((issue) => issue.path.includes("inputBindings.primary") && issue.message.includes("manifesto") && issue.severity === "error")).toBe(true);
  });

  it("rejects screen actions that write to read-only tags", () => {
    const migrated = migrateProject(legacyProject);
    migrated.screens[0].inputBindings = [{
      inputId: "secondary",
      event: "press",
      action: { type: "changeValue", binding: { kind: "global-tag", tagId: migrated.tags[0].id }, operation: "set", operand: 10 }
    }];

    const issues = validateProjectForBuild(migrated);
    expect(issues.some((issue) => issue.path.includes("inputBindings.secondary") && issue.message.includes("não permite"))).toBe(true);
  });

  it("accepts numeric set, add and subtract operations on a read-write tag", () => {
    const migrated = migrateProject(legacyProject);
    migrated.tags[0].direction = "readWrite";
    const binding = { kind: "global-tag", tagId: migrated.tags[0].id } as const;
    migrated.screens[0].inputBindings = [
      { inputId: "primary", event: "press", action: { type: "changeValue", binding, operation: "set", operand: 10, min: 0, max: 100 } },
      { inputId: "primary", event: "press", action: { type: "changeValue", binding, operation: "add", operand: 2, min: 0, max: 100 } },
      { inputId: "primary", event: "press", action: { type: "changeValue", binding, operation: "subtract", operand: 1, min: 0, max: 100 } }
    ];

    const issues = validateProjectForBuild(migrated);
    expect(issues.filter((issue) => issue.path.includes("inputBindings.primary") && issue.severity === "error")).toEqual([]);
  });

  it("validates numeric write limits on the widget instead of the selected tag", () => {
    const migrated = migrateProject(legacyProject);
    migrated.tags[0].direction = "readWrite";
    migrated.screens[0].widgets = [{
      id: "write-speed",
      type: "write_button",
      x: 5,
      y: 5,
      width: 80,
      height: 24,
      visible: true,
      props: {
        binding: { kind: "global-tag", tagId: migrated.tags[0].id },
        value: 42
      }
    }];

    expect(validateProjectForBuild(migrated).some((issue) => issue.path.endsWith(".limits"))).toBe(true);
    migrated.screens[0].widgets[0].props.min = 0;
    migrated.screens[0].widgets[0].props.max = 60;
    expect(validateProjectForBuild(migrated).some((issue) => issue.path.endsWith(".limits"))).toBe(false);
  });

  it("accepts a direct S7 binding without requiring a Global Tag", () => {
    const migrated = migrateProject({
      ...legacyProject,
      schemaVersion: "0.3.0",
      studioVersion: "0.6.0",
      network: { mode: "wifi", ssid: "factory", password: "" },
      protocols: [{
        id: "s7-main",
        name: "S7 principal",
        driver: "siemens-s7",
        endpoint: "s7://192.168.0.10:102",
        enabled: true,
        options: { rack: 0, slot: 1, timeoutMs: 2000 }
      }],
      tags: [],
      screens: [{
        ...legacyProject.screens[0],
        widgets: [{
          id: "direct-value",
          type: "tag_value",
          x: 5,
          y: 5,
          width: 100,
          height: 20,
          visible: true,
          props: {
            binding: {
              kind: "connector",
              protocolProfileId: "s7-main",
              type: "float",
              address: { area: "DB", dbNumber: 10, byteOffset: 4, dataType: "REAL" },
              pollMs: 500,
              simulationValue: 12.5
            }
          }
        }],
        inputBindings: []
      }],
      build: { serialPort: "", baudRate: 115200 }
    });

    const errors = validateProjectForBuild(migrated).filter((issue) => issue.severity === "error");
    expect(errors).toEqual([]);
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

    expect(migrated.protocols[0].name).toBe("PLC Siemens S7 nativo");
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
