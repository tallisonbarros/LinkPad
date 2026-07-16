import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { LinkPadProject } from "../types/project";

export interface FirmwareGenerationResult {
  ok: boolean;
  outputPath: string;
}

export interface FirmwareBuildResult {
  ok: boolean;
  action: "build" | "flash";
  firmwareDir: string;
  logPath: string;
}

export interface FirmwareProgress {
  stage: string;
  message: string;
  percent: number;
}

export interface ToolchainStatus {
  state: "ready" | "not_installed";
  ready: boolean;
  version?: string;
  executablePath: string;
  rootPath: string;
  managed: true;
}

export interface ToolchainProgress {
  stage: string;
  message: string;
  percent: number;
}

export function generateFirmware(project: LinkPadProject) {
  return invoke<FirmwareGenerationResult>("generate_firmware", { project });
}

export async function runFirmwareBuild(
  project: LinkPadProject,
  flash = false,
  onProgress: (progress: FirmwareProgress) => void = () => undefined
) {
  const unlisten = await listen<FirmwareProgress>("firmware-progress", (event) => onProgress(event.payload));
  try {
    return await invoke<FirmwareBuildResult>("run_firmware_build", { project, flash });
  } finally {
    unlisten();
  }
}

export function getToolchainStatus() {
  return invoke<ToolchainStatus>("get_toolchain_status");
}

export async function prepareToolchain(onProgress: (progress: ToolchainProgress) => void) {
  const unlisten = await listen<ToolchainProgress>("toolchain-progress", (event) => onProgress(event.payload));
  try {
    return await invoke<ToolchainStatus>("prepare_toolchain");
  } finally {
    unlisten();
  }
}
