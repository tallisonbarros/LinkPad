import {
  CircleDot,
  Clock3,
  Copy,
  Database,
  Hand,
  Keyboard,
  MousePointerClick,
  Navigation,
  Power,
  RotateCcw,
  RotateCw,
  type LucideIcon
} from "lucide-react";
import type { HardwareInputEvent, HardwareInputManifest, LinkPadAction } from "../../types/project";

export type ActionChoice =
  | "navigate:next"
  | "navigate:previous"
  | "navigate:screen"
  | "activateWidget"
  | "changeValue"
  | "powerOff";

export type ActionCategoryId = "navigation" | "interface" | "data" | "device";

export const eventCatalog: Record<HardwareInputEvent, { label: string; icon: LucideIcon }> = {
  press: { label: "Pressionar", icon: MousePointerClick },
  longPress: { label: "Pressionar e segurar", icon: Clock3 },
  doublePress: { label: "Pressionar duas vezes", icon: Copy },
  rotateLeft: { label: "Girar à esquerda", icon: RotateCcw },
  rotateRight: { label: "Girar à direita", icon: RotateCw }
};

export const actionCategories: Array<{ id: ActionCategoryId; label: string; icon: LucideIcon }> = [
  { id: "navigation", label: "Navegação", icon: Navigation },
  { id: "interface", label: "Interface", icon: MousePointerClick },
  { id: "data", label: "Dados", icon: Database },
  { id: "device", label: "Dispositivo", icon: Power }
];

export const actionChoices: Array<{ id: ActionChoice; category: ActionCategoryId; label: string }> = [
  { id: "navigate:next", category: "navigation", label: "Próxima tela" },
  { id: "navigate:previous", category: "navigation", label: "Tela anterior" },
  { id: "navigate:screen", category: "navigation", label: "Ir para tela" },
  { id: "activateWidget", category: "interface", label: "Acionar widget" },
  { id: "changeValue", category: "data", label: "Alterar valor" },
  { id: "powerOff", category: "device", label: "Desligar" }
];

export function actionChoice(action: LinkPadAction): ActionChoice {
  if (action.type === "navigate") return `navigate:${action.target}` as ActionChoice;
  return action.type;
}

export function actionCategory(action: LinkPadAction) {
  const choice = actionChoices.find((item) => item.id === actionChoice(action));
  return actionCategories.find((item) => item.id === choice?.category) ?? actionCategories[1];
}

export function inputIcon(input: HardwareInputManifest): LucideIcon {
  if (input.deviceActions.includes("powerOff")) return Power;
  if (input.kind === "encoder") return RotateCw;
  if (input.kind === "key") return Keyboard;
  if (input.kind === "touch") return Hand;
  return CircleDot;
}
