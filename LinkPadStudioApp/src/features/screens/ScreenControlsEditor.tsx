import { Keyboard, Settings2, X } from "lucide-react";
import { useState } from "react";
import { getHardwareManifest } from "../../data/hardwareCatalog";
import type {
  HardwareInputEvent,
  HardwareInputManifest,
  LinkPadAction,
  LinkPadInputBinding,
  LinkPadProject,
  LinkPadScreen,
  LinkPadTag,
  TagValue
} from "../../types/project";

interface ScreenControlsEditorProps {
  project: LinkPadProject;
  screen: LinkPadScreen;
  onUpdateScreen: (screen: LinkPadScreen) => void;
}

type ActionChoice = "" | "navigate:next" | "navigate:previous" | "navigate:screen" | "writeTag" | "toggleTag" | "activateWidget";

const eventLabels: Record<HardwareInputEvent, string> = {
  press: "Pressionar",
  longPress: "Segurar",
  doublePress: "Pressionar duas vezes",
  rotateLeft: "Girar à esquerda",
  rotateRight: "Girar à direita"
};

export function ScreenControlsEditor({ project, screen, onUpdateScreen }: ScreenControlsEditorProps) {
  const [open, setOpen] = useState(false);
  const hardware = getHardwareManifest(project.hardware.hardwareId);
  const writableTags = project.tags.filter((tag) => tag.direction !== "read");
  const writableBooleanTags = project.tags.filter((tag) => tag.type === "bool" && tag.direction === "readWrite");
  const interactiveWidgets = screen.widgets.filter((widget) => widget.type === "write_button");

  function findBinding(inputId: string, event: HardwareInputEvent) {
    return screen.inputBindings.find((binding) => binding.inputId === inputId && binding.event === event);
  }

  function setBinding(inputId: string, event: HardwareInputEvent, action: LinkPadAction | null) {
    const remaining = screen.inputBindings.filter((binding) => !(binding.inputId === inputId && binding.event === event));
    onUpdateScreen({
      ...screen,
      inputBindings: action ? [...remaining, { inputId, event, action }] : remaining
    });
  }

  function createAction(choice: ActionChoice): LinkPadAction | null {
    if (choice === "navigate:next") return { type: "navigate", target: "next" };
    if (choice === "navigate:previous") return { type: "navigate", target: "previous" };
    if (choice === "navigate:screen") {
      return { type: "navigate", target: "screen", screenId: project.screens.find((item) => item.id !== screen.id)?.id ?? screen.id };
    }
    if (choice === "writeTag") {
      const tag = writableTags[0];
      return { type: "writeTag", tag: tag?.name ?? "", value: defaultTagValue(tag) };
    }
    if (choice === "toggleTag") return { type: "toggleTag", tag: writableBooleanTags[0]?.name ?? "" };
    if (choice === "activateWidget") return { type: "activateWidget", widgetId: interactiveWidgets[0]?.id ?? "" };
    return null;
  }

  function summaryFor(input: HardwareInputManifest) {
    if (!input.configurable) return "Reservado";
    const bindings = screen.inputBindings.filter((binding) => binding.inputId === input.id);
    if (bindings.length === 0) return "Sem ação";
    return bindings.map((binding) => `${eventLabels[binding.event]}: ${actionLabel(binding.action, project, screen)}`).join(" · ");
  }

  return (
    <>
      <section className="screen-controls-summary">
        <div className="screen-controls-title">
          <span><Keyboard size={17} /><strong>Controles desta tela</strong></span>
          <button type="button" onClick={() => setOpen(true)}><Settings2 size={15} /> Configurar</button>
        </div>
        <div className="screen-control-chips">
          {hardware.inputs.map((input) => (
            <button key={input.id} type="button" disabled={!input.configurable} onClick={() => setOpen(true)}>
              <strong>{input.label}</strong>
              <small>{summaryFor(input)}</small>
            </button>
          ))}
        </div>
      </section>

      {open && (
        <div className="screen-controls-backdrop" role="presentation">
          <section aria-labelledby="screen-controls-heading" aria-modal="true" className="screen-controls-dialog" role="dialog">
            <header>
              <div>
                <Keyboard size={20} />
                <span><strong id="screen-controls-heading">Controles de {screen.name}</strong><small>{hardware.name}</small></span>
              </div>
              <button aria-label="Fechar controles" title="Fechar" type="button" onClick={() => setOpen(false)}><X size={18} /></button>
            </header>

            <div className="screen-controls-list">
              {hardware.inputs.map((input) => (
                <InputControlRows
                  input={input}
                  key={input.id}
                  project={project}
                  screen={screen}
                  writableBooleanTags={writableBooleanTags}
                  writableTags={writableTags}
                  interactiveWidgets={interactiveWidgets}
                  findBinding={findBinding}
                  onSetBinding={setBinding}
                  onCreateAction={createAction}
                />
              ))}
            </div>

            <footer><button className="primary-action compact" type="button" onClick={() => setOpen(false)}>Concluir</button></footer>
          </section>
        </div>
      )}
    </>
  );
}

interface InputControlRowsProps {
  input: HardwareInputManifest;
  project: LinkPadProject;
  screen: LinkPadScreen;
  writableTags: LinkPadTag[];
  writableBooleanTags: LinkPadTag[];
  interactiveWidgets: LinkPadScreen["widgets"];
  findBinding: (inputId: string, event: HardwareInputEvent) => LinkPadInputBinding | undefined;
  onSetBinding: (inputId: string, event: HardwareInputEvent, action: LinkPadAction | null) => void;
  onCreateAction: (choice: ActionChoice) => LinkPadAction | null;
}

function InputControlRows({ input, project, screen, writableTags, writableBooleanTags, interactiveWidgets, findBinding, onSetBinding, onCreateAction }: InputControlRowsProps) {
  return (
    <article className={`screen-control-card ${input.configurable ? "" : "reserved"}`}>
      <div className="screen-control-card-heading">
        <span><strong>{input.label}</strong><small>{input.description ?? input.kind}</small></span>
        <em>{input.configurable ? input.kind : "Reservado"}</em>
      </div>
      {!input.configurable || input.events.length === 0 ? (
        <p>Este controle não está disponível para configuração neste runtime.</p>
      ) : input.events.map((event) => {
        const binding = findBinding(input.id, event);
        return (
          <div className="screen-control-binding" key={`${input.id}-${event}`}>
            <label>Evento<input readOnly value={eventLabels[event]} /></label>
            <label>Ação
              <select value={actionChoice(binding?.action)} onChange={(change) => onSetBinding(input.id, event, onCreateAction(change.target.value as ActionChoice))}>
                <option value="">Sem ação</option>
                <option value="navigate:next">Próxima tela</option>
                <option value="navigate:previous">Tela anterior</option>
                <option value="navigate:screen">Ir para tela específica</option>
                <option disabled={interactiveWidgets.length === 0} value="activateWidget">Acionar widget interativo</option>
                <option disabled={writableTags.length === 0} value="writeTag">Escrever valor em tag</option>
                <option disabled={writableBooleanTags.length === 0} value="toggleTag">Alternar tag booleana</option>
              </select>
            </label>
            {binding && (
              <ActionParameters
                action={binding.action}
                project={project}
                screen={screen}
                writableBooleanTags={writableBooleanTags}
                writableTags={writableTags}
                interactiveWidgets={interactiveWidgets}
                onChange={(action) => onSetBinding(input.id, event, action)}
              />
            )}
          </div>
        );
      })}
    </article>
  );
}

function ActionParameters({ action, project, writableTags, writableBooleanTags, interactiveWidgets, onChange }: {
  action: LinkPadAction;
  project: LinkPadProject;
  screen: LinkPadScreen;
  writableTags: LinkPadTag[];
  writableBooleanTags: LinkPadTag[];
  interactiveWidgets: LinkPadScreen["widgets"];
  onChange: (action: LinkPadAction) => void;
}) {
  if (action.type === "navigate" && action.target === "screen") {
    return <label>Destino<select value={action.screenId ?? ""} onChange={(event) => onChange({ ...action, screenId: event.target.value })}>{project.screens.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
  }
  if (action.type === "activateWidget") {
    return <label>Widget<select value={action.widgetId} onChange={(event) => onChange({ ...action, widgetId: event.target.value })}><option value="">Selecione</option>{interactiveWidgets.map((widget) => <option key={widget.id} value={widget.id}>{String(widget.props.text ?? widget.id)}</option>)}</select></label>;
  }
  if (action.type === "toggleTag") {
    return <label>Tag booleana<select value={action.tag} onChange={(event) => onChange({ ...action, tag: event.target.value })}><option value="">Selecione</option>{writableBooleanTags.map((tag) => <option key={tag.name} value={tag.name}>{tag.name}</option>)}</select></label>;
  }
  if (action.type === "writeTag") {
    const selectedTag = writableTags.find((tag) => tag.name === action.tag);
    return (
      <>
        <label>Tag<select value={action.tag} onChange={(event) => {
          const tag = writableTags.find((item) => item.name === event.target.value);
          onChange({ ...action, tag: event.target.value, value: defaultTagValue(tag) });
        }}><option value="">Selecione</option>{writableTags.map((tag) => <option key={tag.name} value={tag.name}>{tag.name}</option>)}</select></label>
        {selectedTag?.type === "bool" ? (
          <label>Valor<select value={String(action.value)} onChange={(event) => onChange({ ...action, value: event.target.value === "true" })}><option value="true">true</option><option value="false">false</option></select></label>
        ) : (
          <label>Valor<input value={String(action.value)} onChange={(event) => onChange({ ...action, value: parseTagValue(event.target.value, selectedTag) })} /></label>
        )}
      </>
    );
  }
  return null;
}

function actionChoice(action?: LinkPadAction): ActionChoice {
  if (!action) return "";
  if (action.type === "navigate") return `navigate:${action.target}` as ActionChoice;
  return action.type;
}

function actionLabel(action: LinkPadAction, project: LinkPadProject, screen: LinkPadScreen) {
  if (action.type === "navigate") {
    if (action.target === "next") return "Próxima tela";
    if (action.target === "previous") return "Tela anterior";
    return project.screens.find((item) => item.id === action.screenId)?.name ?? "Tela ausente";
  }
  if (action.type === "activateWidget") {
    const widget = screen.widgets.find((item) => item.id === action.widgetId);
    return `Acionar ${String(widget?.props.text ?? "widget ausente")}`;
  }
  if (action.type === "toggleTag") return `Alternar ${action.tag || "tag"}`;
  return `Escrever ${action.tag || "tag"}`;
}

function defaultTagValue(tag?: LinkPadTag): TagValue {
  if (!tag) return "";
  if (tag.type === "bool") return true;
  if (tag.type === "string") return "";
  return tag.min ?? 0;
}

function parseTagValue(value: string, tag?: LinkPadTag): TagValue {
  if (tag?.type === "string") return value;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}
