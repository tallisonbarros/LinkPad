import type {
  LinkPadProject,
  LinkPadProjectV1,
  LinkPadTag,
  ProtocolProfile
} from "./types";
import { createDefaultStatusOverlay, normalizeStatusOverlay } from "../runtime/statusOverlay";

export const CURRENT_PROJECT_SCHEMA = "0.2.0" as const;
export const CURRENT_STUDIO_VERSION = "0.5.1" as const;

export function createDefaultSimProfile(projectId: string): ProtocolProfile {
  return {
    id: "sim-main",
    name: "Simulação principal",
    driver: "sim",
    endpoint: `memory://${projectId}`,
    enabled: true,
    options: {}
  };
}

export function migrateProject(candidate: unknown): LinkPadProject {
  if (!candidate || typeof candidate !== "object") {
    throw new Error("Arquivo de projeto inválido.");
  }

  const schemaVersion = (candidate as { schemaVersion?: unknown }).schemaVersion;
  if (schemaVersion === CURRENT_PROJECT_SCHEMA) {
    return normalizeCurrentProject(candidate as LinkPadProject);
  }
  if (schemaVersion === "0.1.0") {
    return migrateV1ToV2(candidate as LinkPadProjectV1);
  }
  throw new Error(`Versão de projeto não suportada: ${String(schemaVersion ?? "ausente")}.`);
}

export function migrateV1ToV2(project: LinkPadProjectV1): LinkPadProject {
  if (!project.projectId || !project.name || !project.hardware || !project.agent) {
    throw new Error("O projeto 0.1.0 não possui os campos obrigatórios.");
  }

  const now = new Date().toISOString();
  const simProfile = createDefaultSimProfile(project.projectId);
  const tags: LinkPadTag[] = (project.tags ?? []).map((tag) => ({
    ...tag,
    source: tag.source ?? "agent",
    protocolProfileId: simProfile.id,
    address: { key: tag.agentTag || tag.name },
    quality: tag.quality ?? "unknown"
  }));

  return {
    schemaVersion: CURRENT_PROJECT_SCHEMA,
    studioVersion: CURRENT_STUDIO_VERSION,
    projectId: project.projectId,
    name: project.name,
    description: project.description ?? "",
    folderPath: project.folderPath ?? "",
    createdAt: project.createdAt ?? now,
    updatedAt: now,
    hardware: {
      ...project.hardware,
      statusOverlay: normalizeStatusOverlay(project.hardware.statusOverlay)
    },
    network: {
      mode: "wifi",
      ssid: "",
      password: ""
    },
    agent: {
      ...project.agent,
      protocolVersion: "0.1.0"
    },
    protocols: [simProfile],
    tags,
    screens: project.screens ?? [],
    assets: project.assets ?? { fonts: [], images: [] },
    build: {
      serialPort: "",
      baudRate: 115200
    }
  };
}

function normalizeCurrentProject(project: LinkPadProject): LinkPadProject {
  if (!project.projectId || !project.name || !project.hardware || !project.agent) {
    throw new Error("O projeto não possui os campos obrigatórios.");
  }

  const protocols = project.protocols?.length > 0
    ? project.protocols.map((profile) => (
        profile.driver === "siemens-s7" && profile.name === "Simulação principal"
          ? { ...profile, name: "Siemens S7 principal" }
          : profile
      ))
    : [createDefaultSimProfile(project.projectId)];

  return {
    ...project,
    schemaVersion: CURRENT_PROJECT_SCHEMA,
    studioVersion: CURRENT_STUDIO_VERSION,
    hardware: {
      ...project.hardware,
      statusOverlay: normalizeStatusOverlay(project.hardware.statusOverlay ?? createDefaultStatusOverlay())
    },
    network: project.network ?? { mode: "wifi", ssid: "", password: "" },
    agent: {
      ...project.agent,
      protocolVersion: "0.1.0"
    },
    protocols,
    tags: project.tags ?? [],
    screens: project.screens ?? [],
    assets: project.assets ?? { fonts: [], images: [] },
    build: project.build ?? { serialPort: "", baudRate: 115200 }
  };
}
