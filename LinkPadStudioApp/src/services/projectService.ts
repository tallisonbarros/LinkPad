import { invoke } from "@tauri-apps/api/core";
import { getHardwareManifest } from "../data/hardwareCatalog";
import {
  CURRENT_PROJECT_SCHEMA,
  CURRENT_STUDIO_VERSION,
  createDefaultInputBindings,
  createDefaultSimProfile,
  migrateProject
} from "../domain/project/migrations";
import type { HardwareId, LinkPadProject, RecentProject } from "../types/project";

const RECENTS_KEY = "linkpad-studio:recent-projects";

function createId(prefix: string) {
  const cryptoId = globalThis.crypto?.randomUUID?.();
  return cryptoId ? `${prefix}-${cryptoId}` : `${prefix}-${Date.now()}`;
}

export function createProject(input: {
  name: string;
  folderPath: string;
  hardwareId: HardwareId;
}): LinkPadProject {
  const now = new Date().toISOString();
  const hardware = getHardwareManifest(input.hardwareId);
  const projectId = createId("project");
  const initialScreen = {
    id: createId("screen"),
    name: "Tela Principal",
    width: hardware.display.width,
    height: hardware.display.height,
    widgets: []
  };

  return {
    schemaVersion: CURRENT_PROJECT_SCHEMA,
    studioVersion: CURRENT_STUDIO_VERSION,
    projectId,
    name: input.name.trim(),
    description: "",
    folderPath: input.folderPath.trim(),
    createdAt: now,
    updatedAt: now,
    hardware: {
      hardwareId: hardware.id,
      runtime: hardware.runtime,
      orientation: "landscape",
      statusOverlay: {
        ...hardware.display.statusOverlay,
        indicators: [...hardware.display.statusOverlay.indicators]
      }
    },
    network: {
      mode: "wifi",
      ssid: "",
      password: ""
    },
    agent: {
      mode: "http",
      host: "192.168.168.25",
      port: 8008,
      timeoutMs: 1200,
      pollMs: 1000,
      token: "",
      protocolVersion: "0.1.0"
    },
    protocols: [createDefaultSimProfile(projectId)],
    tags: [],
    screens: [{ ...initialScreen, inputBindings: createDefaultInputBindings(initialScreen) }],
    assets: {
      fonts: [],
      images: []
    },
    build: {
      serialPort: "",
      baudRate: 115200
    }
  };
}

export function validateProject(candidate: unknown): LinkPadProject {
  return migrateProject(candidate);
}

export async function pickProjectFolder(): Promise<string | null> {
  return invoke<string | null>("pick_project_folder");
}

export async function openProjectFromDialog(): Promise<LinkPadProject | null> {
  const project = await invoke<unknown | null>("open_project_from_dialog");
  return project ? validateProject(project) : null;
}

export async function saveProjectToDisk(project: LinkPadProject): Promise<LinkPadProject> {
  const updatedProject = await invoke<unknown>("save_project_to_disk", { project });
  return validateProject(updatedProject);
}

export function loadRecentProjects(): RecentProject[] {
  const raw = localStorage.getItem(RECENTS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as RecentProject[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((recent) => {
      try {
        const snapshot = migrateProject(recent.snapshot);
        return [{ ...recent, snapshot, hardwareId: snapshot.hardware.hardwareId }];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export function rememberProject(project: LinkPadProject) {
  const recents = loadRecentProjects().filter((item) => item.projectId !== project.projectId);
  const next: RecentProject[] = [
    {
      projectId: project.projectId,
      name: project.name,
      folderPath: project.folderPath,
      hardwareId: project.hardware.hardwareId,
      openedAt: new Date().toISOString(),
      snapshot: project
    },
    ...recents
  ].slice(0, 8);

  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}
