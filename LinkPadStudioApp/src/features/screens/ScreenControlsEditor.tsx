import {
  ArrowDown,
  ArrowUp,
  Check,
  CornerDownRight,
  Pencil,
  Plus,
  Trash2,
  X
} from "lucide-react";
import { useState } from "react";
import { DataBindingField } from "../../components/data-binding/DataBindingField";
import { WriteLimitsFields } from "../../components/data-binding/WriteLimitsFields";
import { getHardwareManifest, inputSupportsDeviceAction } from "../../data/hardwareCatalog";
import {
  createDefaultConnectorBinding,
  dataBindingSummary,
  defaultValueForType,
  valueTypeForBinding
} from "../../domain/project/dataBindings";
import type {
  HardwareInputEvent,
  HardwareInputManifest,
  LinkPadAction,
  LinkPadChangeOperation,
  LinkPadInputBinding,
  LinkPadProject,
  LinkPadScreen,
  LinkPadValueType,
  TagValue
} from "../../types/project";
import {
  actionCategories,
  actionCategory,
  actionChoice,
  actionChoices,
  eventCatalog,
  inputIcon,
  type ActionChoice
} from "./screenControlCatalog";
import {
  changeOperationsForBinding,
  changeValueBinding,
  changeValueBindingRequirements,
  changeValueOperation,
  type ChangeValueAction
} from "./screenControlValueActions";

interface ScreenControlsEditorProps {
  project: LinkPadProject;
  screen: LinkPadScreen;
  onUpdateScreen: (screen: LinkPadScreen) => void;
}

interface EditingBinding {
  inputId: string;
  event: HardwareInputEvent;
  index: number;
  draft: LinkPadInputBinding;
}

export function ScreenControlsEditor({ project, screen, onUpdateScreen }: ScreenControlsEditorProps) {
  const hardware = getHardwareManifest(project.hardware.hardwareId);
  const interactiveWidgets = screen.widgets.filter((widget) => widget.type === "write_button");
  const firstInput = hardware.inputs.find((input) => input.configurable) ?? hardware.inputs[0];
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<EditingBinding | null>(null);
  const [expandedWrite, setExpandedWrite] = useState<string | null>(null);
  const [draft, setDraft] = useState<LinkPadInputBinding>(() => createDraft(firstInput, project, screen, interactiveWidgets));

  function bindingsFor(inputId: string, event: HardwareInputEvent) {
    return screen.inputBindings.filter((binding) => binding.inputId === inputId && binding.event === event);
  }

  function setEventActions(inputId: string, event: HardwareInputEvent, actions: LinkPadAction[]) {
    const matches = (binding: LinkPadInputBinding) => binding.inputId === inputId && binding.event === event;
    const firstIndex = screen.inputBindings.findIndex(matches);
    const remaining = screen.inputBindings.filter((binding) => !matches(binding));
    const insertAt = firstIndex < 0
      ? remaining.length
      : screen.inputBindings.slice(0, firstIndex).filter((binding) => !matches(binding)).length;
    const replacements = actions.map((action) => ({ inputId, event, action }));
    onUpdateScreen({
      ...screen,
      inputBindings: [...remaining.slice(0, insertAt), ...replacements, ...remaining.slice(insertAt)]
    });
  }

  function openCreate(inputId = firstInput.id) {
    const input = hardware.inputs.find((item) => item.id === inputId && item.configurable) ?? firstInput;
    setDraft(createDraft(input, project, screen, interactiveWidgets));
    setEditing(null);
    setExpandedWrite(null);
    setCreateOpen(true);
  }

  function updateDraftInput(inputId: string) {
    const input = hardware.inputs.find((item) => item.id === inputId) ?? firstInput;
    const currentChoice = actionChoice(draft.action);
    const powerOffAllowed = inputSupportsDeviceAction(hardware, input, "powerOff");
    setDraft({
      inputId: input.id,
      event: input.events.includes(draft.event) ? draft.event : input.events[0],
      action: actionChoiceAllowed(currentChoice, interactiveWidgets, powerOffAllowed)
        ? draft.action
        : createAction("navigate:next", project, screen, interactiveWidgets)
    });
  }

  function addDraft() {
    const actions = bindingsFor(draft.inputId, draft.event).map((binding) => binding.action);
    setEventActions(draft.inputId, draft.event, [...actions, draft.action]);
    setCreateOpen(false);
  }

  function beginEditing(inputId: string, event: HardwareInputEvent, index: number, action: LinkPadAction) {
    setEditing({ inputId, event, index, draft: { inputId, event, action } });
    setExpandedWrite(null);
  }

  function updateEditingInput(inputId: string) {
    setEditing((current) => {
      if (!current) return current;
      const input = hardware.inputs.find((item) => item.id === inputId) ?? firstInput;
      const currentChoice = actionChoice(current.draft.action);
      const powerOffAllowed = inputSupportsDeviceAction(hardware, input, "powerOff");
      return {
        ...current,
        draft: {
          inputId: input.id,
          event: input.events.includes(current.draft.event) ? current.draft.event : input.events[0],
          action: actionChoiceAllowed(currentChoice, interactiveWidgets, powerOffAllowed)
            ? current.draft.action
            : createAction("navigate:next", project, screen, interactiveWidgets)
        }
      };
    });
  }

  function commitEditing() {
    if (!editing) return;
    const originalIndex = bindingIndex(screen.inputBindings, editing.inputId, editing.event, editing.index);
    if (originalIndex < 0) {
      setEditing(null);
      return;
    }

    const sameBranch = editing.inputId === editing.draft.inputId && editing.event === editing.draft.event;
    const nextBindings = [...screen.inputBindings];
    if (sameBranch) {
      nextBindings[originalIndex] = editing.draft;
    } else {
      nextBindings.splice(originalIndex, 1);
      const targetLastIndex = findLastBindingIndex(nextBindings, editing.draft.inputId, editing.draft.event);
      nextBindings.splice(targetLastIndex < 0 ? nextBindings.length : targetLastIndex + 1, 0, editing.draft);
    }
    onUpdateScreen({ ...screen, inputBindings: nextBindings });
    setEditing(null);
    setExpandedWrite(null);
  }

  const configuredInputs = hardware.inputs.filter((input) => input.events.some((event) => bindingsFor(input.id, event).length > 0));
  const draftInput = hardware.inputs.find((input) => input.id === draft.inputId) ?? firstInput;
  const draftPowerOffAllowed = inputSupportsDeviceAction(hardware, draftInput, "powerOff");

  return (
    <section className="screen-controls-inline" aria-label="Configuração dos controles da tela">
      <div className="screen-controls-toolbar">
        <span>{screen.inputBindings.length} {screen.inputBindings.length === 1 ? "ação" : "ações"}</span>
        <button className="screen-controls-add" type="button" onClick={() => openCreate()}><Plus size={15} /> Nova ação</button>
      </div>

      <div className="screen-controls-table-scroll">
              <div className="screen-controls-grid" role="table" aria-label="Ações configuradas nos controles">
                <div className="screen-controls-grid-header" role="row">
                  <span role="columnheader">Controle</span>
                  <span role="columnheader">Evento</span>
                  <span role="columnheader">Ação</span>
                  <span role="columnheader">Configuração</span>
                  <span aria-hidden="true" />
                </div>

                {configuredInputs.length === 0 ? (
                  <div className="screen-controls-grid-empty">
                    <span>Nenhuma ação configurada</span>
                    <button type="button" onClick={() => openCreate()}><Plus size={14} /> Adicionar ação</button>
                  </div>
                ) : configuredInputs.map((input) => {
                  const configuredEvents = input.events.filter((event) => bindingsFor(input.id, event).length > 0);
                  let firstInputRow = true;
                  return configuredEvents.map((event) => {
                    const actions = bindingsFor(input.id, event).map((binding) => binding.action);
                    return actions.map((action, index) => {
                      const actionKey = `${input.id}:${event}:${index}`;
                      const isFirstInput = firstInputRow;
                      const isFirstEvent = index === 0;
                      firstInputRow = false;
                      const rowEditing = editing?.inputId === input.id && editing.event === event && editing.index === index;
                      return rowEditing ? (
                        <CompactEditRow
                          editing={editing}
                          expanded={expandedWrite === actionKey}
                          hardwareInputs={hardware.inputs}
                          interactiveWidgets={interactiveWidgets}
                          key={actionKey}
                          powerOffAllowed={inputSupportsDeviceAction(hardware, hardware.inputs.find((item) => item.id === editing.draft.inputId) ?? input, "powerOff")}
                          project={project}
                          screen={screen}
                          onCancel={() => { setEditing(null); setExpandedWrite(null); }}
                          onChange={(draftBinding) => setEditing({ ...editing, draft: draftBinding })}
                          onChangeInput={updateEditingInput}
                          onSave={commitEditing}
                          onToggleExpanded={() => setExpandedWrite((current) => current === actionKey ? null : actionKey)}
                        />
                      ) : (
                        <CompactActionRow
                          action={action}
                          configSummary={actionConfigurationSummary(action, project, screen)}
                          event={event}
                          index={index}
                          input={input}
                          isFirstEvent={isFirstEvent}
                          isFirstInput={isFirstInput}
                          key={actionKey}
                          total={actions.length}
                          onEdit={() => beginEditing(input.id, event, index, action)}
                          onMove={(direction) => {
                            setEventActions(input.id, event, moveAction(actions, index, direction));
                            setEditing(null);
                          }}
                          onRemove={() => {
                            setEventActions(input.id, event, actions.filter((_, itemIndex) => itemIndex !== index));
                            setEditing(null);
                          }}
                        />
                      );
                    });
                  });
                })}
              </div>
      </div>

      {createOpen && (
        <div className="screen-action-create-backdrop" role="presentation">
              <section aria-labelledby="screen-action-create-heading" aria-modal="true" className="screen-controls-dialog screen-action-create-dialog" role="dialog">
                <header className="screen-controls-dialog-header">
                  <div className="screen-controls-heading">
                    <span className="screen-controls-heading-icon"><Plus size={18} /></span>
                    <span><strong id="screen-action-create-heading">Nova ação</strong><small>{screen.name}</small></span>
                  </div>
                  <button aria-label="Fechar nova ação" className="screen-controls-close" title="Fechar" type="button" onClick={() => setCreateOpen(false)}><X size={17} /></button>
                </header>

                <div className="screen-action-create-content">
                  <div className="screen-action-create-pair">
                    <label>Controle
                      <select value={draft.inputId} onChange={(event) => updateDraftInput(event.target.value)}>
                        {hardware.inputs.filter((input) => input.configurable).map((input) => <option key={input.id} value={input.id}>{input.label}</option>)}
                      </select>
                    </label>
                    <label>Evento
                      <select value={draft.event} onChange={(event) => setDraft({ ...draft, event: event.target.value as HardwareInputEvent })}>
                        {draftInput.events.map((event) => <option key={event} value={event}>{eventCatalog[event].label}</option>)}
                      </select>
                    </label>
                  </div>
                  <label>Ação
                    <select value={actionChoice(draft.action)} onChange={(event) => setDraft({ ...draft, action: createAction(event.target.value as ActionChoice, project, screen, interactiveWidgets) })}>
                      <ActionOptions currentChoice={actionChoice(draft.action)} interactiveWidgets={interactiveWidgets} powerOffAllowed={draftPowerOffAllowed} />
                    </select>
                  </label>
                  {actionNeedsParameters(draft.action) && (
                    <div className="screen-action-create-parameters">
                      <ActionParameters action={draft.action} project={project} interactiveWidgets={interactiveWidgets} onChange={(action) => setDraft({ ...draft, action })} />
                    </div>
                  )}
                </div>

                <footer className="screen-action-create-footer">
                  <button type="button" onClick={() => setCreateOpen(false)}>Cancelar</button>
                  <button className="primary-action compact" type="button" onClick={addDraft}><Plus size={15} /> Adicionar</button>
                </footer>
              </section>
        </div>
      )}
    </section>
  );
}

function CompactActionRow({ action, input, event, index, total, isFirstInput, isFirstEvent, configSummary, onEdit, onMove, onRemove }: {
  action: LinkPadAction;
  input: HardwareInputManifest;
  event: HardwareInputEvent;
  index: number;
  total: number;
  isFirstInput: boolean;
  isFirstEvent: boolean;
  configSummary: string;
  onEdit: () => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const InputIcon = inputIcon(input);
  const EventIcon = eventCatalog[event].icon;
  const category = actionCategory(action);
  const CategoryIcon = category.icon;
  const choice = actionChoices.find((item) => item.id === actionChoice(action));
  const misplacedPowerOff = action.type === "powerOff" && index < total - 1;
  return (
    <div
      className={`screen-controls-grid-row ${category.id} ${isFirstInput ? "input-start" : ""} ${isFirstEvent ? "event-start" : ""}`}
      role="row"
      tabIndex={0}
      title="Clique para editar"
      onClick={onEdit}
      onKeyDown={(keyboardEvent) => { if (keyboardEvent.key === "Enter") onEdit(); }}
    >
      <span className="screen-controls-control-cell" role="cell">
        {isFirstInput ? <><InputIcon size={15} /><strong>{input.label}</strong></> : <span className="screen-controls-tree-line" />}
      </span>
      <span className="screen-controls-event-cell" role="cell">
        {isFirstEvent ? <><EventIcon size={14} /><span>{eventCatalog[event].label}</span></> : <CornerDownRight size={13} />}
      </span>
      <span className="screen-controls-action-cell" role="cell"><CategoryIcon size={14} /><strong>{choice?.label ?? action.type}</strong></span>
      <span className={`screen-controls-config-cell ${misplacedPowerOff ? "warning" : ""}`} role="cell">
        <span>{configSummary}</span>
        {misplacedPowerOff && <small>Deve ser a última ação</small>}
      </span>
      <span className="screen-controls-row-commands" role="cell">
        <button aria-label="Editar ação" title="Editar" type="button" onClick={(event) => { event.stopPropagation(); onEdit(); }}><Pencil size={13} /></button>
        <button aria-label="Mover ação para cima" disabled={index === 0} title="Mover para cima" type="button" onClick={(event) => { event.stopPropagation(); onMove(-1); }}><ArrowUp size={13} /></button>
        <button aria-label="Mover ação para baixo" disabled={index === total - 1} title="Mover para baixo" type="button" onClick={(event) => { event.stopPropagation(); onMove(1); }}><ArrowDown size={13} /></button>
        <button aria-label="Remover ação" className="danger" title="Remover" type="button" onClick={(event) => { event.stopPropagation(); onRemove(); }}><Trash2 size={13} /></button>
      </span>
    </div>
  );
}

function CompactEditRow({ editing, project, screen, hardwareInputs, interactiveWidgets, powerOffAllowed, expanded, onChange, onChangeInput, onSave, onCancel, onToggleExpanded }: {
  editing: EditingBinding;
  project: LinkPadProject;
  screen: LinkPadScreen;
  hardwareInputs: HardwareInputManifest[];
  interactiveWidgets: LinkPadScreen["widgets"];
  powerOffAllowed: boolean;
  expanded: boolean;
  onChange: (binding: LinkPadInputBinding) => void;
  onChangeInput: (inputId: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onToggleExpanded: () => void;
}) {
  const input = hardwareInputs.find((item) => item.id === editing.draft.inputId) ?? hardwareInputs[0];
  const editAction = editing.draft.action;
  const category = actionCategory(editAction);
  return (
    <div className={`screen-controls-grid-edit ${category.id}`} role="row">
      <select aria-label="Controle" value={editing.draft.inputId} onChange={(event) => onChangeInput(event.target.value)}>
        {hardwareInputs.filter((item) => item.configurable).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      <select aria-label="Evento" value={editing.draft.event} onChange={(event) => onChange({ ...editing.draft, event: event.target.value as HardwareInputEvent })}>
        {input.events.map((event) => <option key={event} value={event}>{eventCatalog[event].label}</option>)}
      </select>
      <select aria-label="Ação" value={actionChoice(editAction)} onChange={(event) => onChange({ ...editing.draft, action: createAction(event.target.value as ActionChoice, project, screen, interactiveWidgets) })}>
        <ActionOptions currentChoice={actionChoice(editAction)} interactiveWidgets={interactiveWidgets} powerOffAllowed={powerOffAllowed} />
      </select>
      <ActionConfiguration action={editAction} expanded={expanded} interactiveWidgets={interactiveWidgets} project={project} onChange={(action) => onChange({ ...editing.draft, action })} onToggleExpanded={onToggleExpanded} />
      <span className="screen-controls-row-commands visible">
        <button aria-label="Salvar ação" className="confirm" title="Salvar" type="button" onClick={onSave}><Check size={14} /></button>
        <button aria-label="Cancelar edição" title="Cancelar" type="button" onClick={onCancel}><X size={14} /></button>
      </span>
      {expanded && editAction.type === "changeValue" && (
        <div className="screen-controls-write-details">
          <ChangeOperationFields action={editAction} project={project} onChange={(action) => onChange({ ...editing.draft, action })} />
        </div>
      )}
    </div>
  );
}

function ActionConfiguration({ action, project, interactiveWidgets, expanded, onChange, onToggleExpanded }: {
  action: LinkPadAction;
  project: LinkPadProject;
  interactiveWidgets: LinkPadScreen["widgets"];
  expanded: boolean;
  onChange: (action: LinkPadAction) => void;
  onToggleExpanded: () => void;
}) {
  if (action.type === "navigate" && action.target === "screen") {
    return <select aria-label="Tela de destino" className="screen-controls-config-select" value={action.screenId ?? ""} onChange={(event) => onChange({ ...action, screenId: event.target.value })}>{project.screens.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>;
  }
  if (action.type === "activateWidget") {
    return <select aria-label="Widget" className="screen-controls-config-select" value={action.widgetId} onChange={(event) => onChange({ ...action, widgetId: event.target.value })}><option value="">Selecione</option>{interactiveWidgets.map((widget) => <option key={widget.id} value={widget.id}>{String(widget.props.text ?? widget.id)}</option>)}</select>;
  }
  if (action.type === "changeValue") {
    return (
      <div className="screen-controls-write-config">
        <DataBindingField
          access={changeValueBindingRequirements.access}
          acceptedTypes={changeValueBindingRequirements.acceptedTypes}
          includePolling={changeValueBindingRequirements.includePolling}
          label="Tag"
          project={project}
          value={action.binding}
          onChange={(binding) => onChange(changeValueBinding(action, binding, project))}
        />
        <button aria-expanded={expanded} className="screen-controls-write-toggle" title="Editar operação, valor e limites" type="button" onClick={onToggleExpanded}><span>{changeOperationSummary(action)}</span><Pencil size={13} /></button>
      </div>
    );
  }
  return <span className="screen-controls-static-config">{action.type === "powerOff" ? "Dispositivo" : "—"}</span>;
}

function ActionOptions({ currentChoice, interactiveWidgets, powerOffAllowed }: {
  currentChoice: ActionChoice;
  interactiveWidgets: LinkPadScreen["widgets"];
  powerOffAllowed: boolean;
}) {
  return (
    <>
      {actionCategories.map((category) => {
        const choices = actionChoices.filter((choice) => choice.category === category.id && (
          actionChoiceAllowed(choice.id, interactiveWidgets, powerOffAllowed) || choice.id === currentChoice
        ));
        if (choices.length === 0) return null;
        return (
          <optgroup key={category.id} label={category.label}>
            {choices.map((choice) => (
              <option disabled={!actionChoiceAllowed(choice.id, interactiveWidgets, powerOffAllowed)} key={choice.id} value={choice.id}>
                {choice.label}{actionChoiceAllowed(choice.id, interactiveWidgets, powerOffAllowed) ? "" : " (não permitido)"}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}

function ActionParameters({ action, project, interactiveWidgets, onChange }: {
  action: LinkPadAction;
  project: LinkPadProject;
  interactiveWidgets: LinkPadScreen["widgets"];
  onChange: (action: LinkPadAction) => void;
}) {
  if (action.type === "navigate" && action.target === "screen") {
    return <label>Destino<select value={action.screenId ?? ""} onChange={(event) => onChange({ ...action, screenId: event.target.value })}>{project.screens.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
  }
  if (action.type === "activateWidget") {
    return <label>Widget<select value={action.widgetId} onChange={(event) => onChange({ ...action, widgetId: event.target.value })}><option value="">Selecione</option>{interactiveWidgets.map((widget) => <option key={widget.id} value={widget.id}>{String(widget.props.text ?? widget.id)}</option>)}</select></label>;
  }
  if (action.type === "changeValue") {
    return (
      <>
        <DataBindingField
          access={changeValueBindingRequirements.access}
          acceptedTypes={changeValueBindingRequirements.acceptedTypes}
          includePolling={changeValueBindingRequirements.includePolling}
          label="Tag"
          project={project}
          value={action.binding}
          onChange={(binding) => onChange(changeValueBinding(action, binding, project))}
        />
        <ChangeOperationFields action={action} project={project} onChange={onChange} />
      </>
    );
  }
  return null;
}

const changeOperationLabels: Record<LinkPadChangeOperation, string> = {
  set: "Definir",
  add: "Somar ao valor atual",
  subtract: "Subtrair do valor atual",
  toggle: "Inverter estado"
};

function ChangeOperationFields({ action, project, onChange }: {
  action: ChangeValueAction;
  project: LinkPadProject;
  onChange: (action: ChangeValueAction) => void;
}) {
  const type = valueTypeForBinding(project, action.binding);
  const operations = changeOperationsForBinding(project, action.binding);
  return (
    <>
      <label>Operação
        <select value={action.operation} onChange={(event) => onChange(changeValueOperation(action, event.target.value as LinkPadChangeOperation, project))}>
          {operations.map((operation) => <option key={operation} value={operation}>{changeOperationLabels[operation]}</option>)}
        </select>
      </label>
      {action.operation !== "toggle" && (type === "bool" ? (
        <label>Novo valor<select value={String(action.operand)} onChange={(event) => onChange({ ...action, operand: event.target.value === "true" })}><option value="true">true</option><option value="false">false</option></select></label>
      ) : (
        <label>{changeOperandLabel(action.operation)}<input value={String(action.operand ?? "")} onChange={(event) => onChange({ ...action, operand: parseDataValue(event.target.value, type) })} /></label>
      ))}
      <WriteLimitsFields type={type} min={action.min} max={action.max} onChange={(limits) => onChange({ ...action, ...limits })} />
    </>
  );
}

function changeOperationSummary(action: ChangeValueAction) {
  if (action.operation === "toggle") return "Inverter";
  if (action.operation === "add") return `Somar ${String(action.operand ?? 0)}`;
  if (action.operation === "subtract") return `Subtrair ${String(action.operand ?? 0)}`;
  return `Definir ${String(action.operand ?? "")}`;
}

function changeOperandLabel(operation: LinkPadChangeOperation) {
  if (operation === "add") return "Valor a somar";
  if (operation === "subtract") return "Valor a subtrair";
  return "Novo valor";
}

function createDraft(input: HardwareInputManifest, project: LinkPadProject, screen: LinkPadScreen, interactiveWidgets: LinkPadScreen["widgets"]): LinkPadInputBinding {
  return {
    inputId: input.id,
    event: input.events[0],
    action: createAction("navigate:next", project, screen, interactiveWidgets)
  };
}

function createAction(choice: ActionChoice, project: LinkPadProject, screen: LinkPadScreen, interactiveWidgets: LinkPadScreen["widgets"]): LinkPadAction {
  if (choice === "navigate:next") return { type: "navigate", target: "next" };
  if (choice === "navigate:previous") return { type: "navigate", target: "previous" };
  if (choice === "navigate:screen") return { type: "navigate", target: "screen", screenId: project.screens.find((item) => item.id !== screen.id)?.id ?? screen.id };
  if (choice === "changeValue") {
    const binding = createDefaultConnectorBinding(project);
    return { type: "changeValue", binding, operation: "set", operand: defaultValueForType(binding.type) };
  }
  if (choice === "activateWidget") return { type: "activateWidget", widgetId: interactiveWidgets[0]?.id ?? "" };
  return { type: "powerOff" };
}

function actionConfigurationSummary(action: LinkPadAction, project: LinkPadProject, screen: LinkPadScreen) {
  if (action.type === "navigate" && action.target === "screen") return project.screens.find((item) => item.id === action.screenId)?.name ?? "Tela não encontrada";
  if (action.type === "activateWidget") return String(screen.widgets.find((widget) => widget.id === action.widgetId)?.props.text ?? "Widget não encontrado");
  if (action.type === "changeValue") return `${dataBindingSummary(project, action.binding)} · ${changeOperationSummary(action)}`;
  if (action.type === "powerOff") return "Dispositivo";
  return "—";
}

function actionChoiceAllowed(choice: ActionChoice, interactiveWidgets: LinkPadScreen["widgets"], powerOffAllowed: boolean) {
  if (choice === "activateWidget") return interactiveWidgets.length > 0;
  if (choice === "powerOff") return powerOffAllowed;
  return true;
}

function actionNeedsParameters(action: LinkPadAction) {
  return action.type === "changeValue"
    || action.type === "activateWidget"
    || (action.type === "navigate" && action.target === "screen");
}

function bindingIndex(bindings: LinkPadInputBinding[], inputId: string, event: HardwareInputEvent, index: number) {
  let current = -1;
  return bindings.findIndex((binding) => {
    if (binding.inputId !== inputId || binding.event !== event) return false;
    current += 1;
    return current === index;
  });
}

function findLastBindingIndex(bindings: LinkPadInputBinding[], inputId: string, event: HardwareInputEvent) {
  for (let index = bindings.length - 1; index >= 0; index -= 1) {
    if (bindings[index].inputId === inputId && bindings[index].event === event) return index;
  }
  return -1;
}

function moveAction(actions: LinkPadAction[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= actions.length) return actions;
  const next = [...actions];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function parseDataValue(value: string, type?: LinkPadValueType): TagValue {
  if (type === "string") return value;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}
