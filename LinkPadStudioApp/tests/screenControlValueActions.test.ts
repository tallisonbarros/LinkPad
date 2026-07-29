import { describe, expect, it } from "vitest";
import legacyProject from "./fixtures/project-v0.1.0.json";
import { migrateProject } from "../src/domain/project/migrations";
import type { ConnectorDataBinding } from "../src/types/project";
import {
  changeValueBinding,
  changeValueBindingRequirements
} from "../src/features/screens/screenControlValueActions";

describe("selecao de Tag nas acoes de controle", () => {
  const project = migrateProject(legacyProject);

  it("oferece todo tipo gravavel sem depender da operacao anterior", () => {
    expect(changeValueBindingRequirements).toEqual({
      access: "write",
      acceptedTypes: ["bool", "int", "float", "string"],
      includePolling: true
    });
  });

  it("troca inverter por definir ao apontar uma Tag numerica", () => {
    const boolBinding: ConnectorDataBinding = {
      kind: "connector",
      protocolProfileId: "sim-main",
      type: "bool",
      address: { key: "Motor.Enabled" },
      pollMs: 500
    };
    const intBinding: ConnectorDataBinding = {
      kind: "connector",
      protocolProfileId: "sim-main",
      type: "int",
      address: { key: "Motor.Speed" },
      pollMs: 500
    };

    expect(changeValueBinding({
      type: "changeValue",
      binding: boolBinding,
      operation: "toggle"
    }, intBinding, project)).toEqual({
      type: "changeValue",
      binding: intBinding,
      operation: "set",
      operand: 0,
      min: undefined,
      max: undefined
    });
  });
});
