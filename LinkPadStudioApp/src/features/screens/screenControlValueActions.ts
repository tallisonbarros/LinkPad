import {
  defaultValueForType,
  globalTagForBinding,
  valueTypeForBinding,
  writeLimitsForBinding
} from "../../domain/project/dataBindings";
import type {
  LinkPadAction,
  LinkPadChangeOperation,
  LinkPadDataBinding,
  LinkPadProject,
  LinkPadValueType,
  TagValue
} from "../../types/project";

export type ChangeValueAction = Extract<LinkPadAction, { type: "changeValue" }>;

/**
 * A escolha da Tag e guiada pela acao Alterar valor, nao pela operacao que
 * estava selecionada anteriormente. A operacao e reconciliada depois.
 */
export const changeValueBindingRequirements = {
  access: "write" as const,
  acceptedTypes: ["bool", "int", "float", "string"] as LinkPadValueType[],
  includePolling: true
};

export function changeValueBinding(
  action: ChangeValueAction,
  binding: LinkPadDataBinding,
  project: LinkPadProject
): ChangeValueAction {
  const previousType = valueTypeForBinding(project, action.binding);
  const type = valueTypeForBinding(project, binding);
  const operations = changeOperationsForBinding(project, binding);
  const operation = operations.includes(action.operation) ? action.operation : "set";
  const legacyLimits = writeLimitsForBinding(project, binding);
  return {
    ...action,
    binding,
    operation,
    operand: operation === "toggle"
      ? undefined
      : type === previousType && compatibleOperand(action.operand, type)
        ? action.operand
        : defaultValueForType(type),
    min: type === "int" || type === "float" ? action.min ?? legacyLimits.min : undefined,
    max: type === "int" || type === "float" ? action.max ?? legacyLimits.max : undefined
  };
}

export function changeValueOperation(
  action: ChangeValueAction,
  operation: LinkPadChangeOperation,
  project: LinkPadProject
): ChangeValueAction {
  const type = valueTypeForBinding(project, action.binding);
  if (!changeOperationsForBinding(project, action.binding).includes(operation)) return action;
  return {
    ...action,
    operation,
    operand: operation === "toggle"
      ? undefined
      : compatibleOperand(action.operand, type) ? action.operand : defaultValueForType(type),
    min: type === "int" || type === "float" ? action.min : undefined,
    max: type === "int" || type === "float" ? action.max : undefined
  };
}

export function changeOperationsForBinding(
  project: LinkPadProject,
  binding: LinkPadDataBinding
): LinkPadChangeOperation[] {
  const type = valueTypeForBinding(project, binding);
  const globalTag = globalTagForBinding(project, binding);
  const canReadCurrent = !globalTag || globalTag.direction === "readWrite";
  if (type === "bool") return canReadCurrent ? ["set", "toggle"] : ["set"];
  if (type === "int" || type === "float") return canReadCurrent ? ["set", "add", "subtract"] : ["set"];
  return ["set"];
}

function compatibleOperand(value: TagValue | undefined, type?: LinkPadValueType) {
  if (type === "bool") return typeof value === "boolean";
  if (type === "string") return typeof value === "string";
  if (type === "int") return typeof value === "number" && Number.isInteger(value);
  return type === "float" && typeof value === "number" && Number.isFinite(value);
}
