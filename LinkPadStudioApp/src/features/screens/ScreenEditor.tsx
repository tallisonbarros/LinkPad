import { useMemo, useRef, useState } from "react";
import { CircleGauge, Monitor, Plus, Trash2, Type } from "lucide-react";
import { RuntimeStatusOverlay } from "../../components/runtime/RuntimeStatusOverlay";
import type { LinkPadProject, LinkPadScreen, LinkPadWidget } from "../../types/project";

interface ScreenEditorProps {
  project: LinkPadProject;
  screenId?: string;
  onSetProject: (project: LinkPadProject) => void;
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `widget-${Date.now()}`;
}

const widgetNames: Record<LinkPadWidget["type"], string> = {
  static_text: "Texto",
  tag_value: "Valor da tag",
  status_indicator: "Status",
  boolean_indicator: "Indicador booleano",
  write_button: "Botão de escrita"
};

export function ScreenEditor({ project, screenId, onSetProject }: ScreenEditorProps) {
  const screen = project.screens.find((item) => item.id === screenId) ?? project.screens[0];
  const [selectedId, setSelectedId] = useState(screen?.widgets[0]?.id ?? "");
  const canvasRef = useRef<HTMLDivElement>(null);
  const selected = screen?.widgets.find((widget) => widget.id === selectedId);

  const sampleValues = useMemo(() => Object.fromEntries(project.tags.map((tag) => [tag.name, tag.simulationValue ?? "--"])), [project.tags]);

  if (!screen) return null;

  function updateScreen(nextScreen: LinkPadScreen) {
    onSetProject({
      ...project,
      screens: project.screens.map((item) => item.id === nextScreen.id ? nextScreen : item),
      updatedAt: new Date().toISOString()
    });
  }

  function addWidget(type: LinkPadWidget["type"]) {
    const id = createId();
    const tag = project.tags[0]?.name ?? "";
    const widget: LinkPadWidget = {
      id,
      type,
      x: 12,
      y: 12 + screen.widgets.length * 8,
      width: type === "static_text" ? 100 : 90,
      height: 24,
      visible: true,
      props: type === "static_text"
        ? { text: "Novo texto", color: "#ffffff" }
        : type === "status_indicator"
          ? { text: "Agent online", color: "#42c879" }
          : type === "write_button"
            ? { text: "Escrever", tag, value: 1, color: "#ff7a21" }
            : { tag, color: "#ffffff" }
    };
    updateScreen({ ...screen, widgets: [...screen.widgets, widget] });
    setSelectedId(id);
  }

  function updateWidget(patch: Partial<LinkPadWidget>, props?: Record<string, string | number | boolean>) {
    if (!selected) return;
    updateScreen({ ...screen, widgets: screen.widgets.map((widget) => widget.id === selected.id ? { ...widget, ...patch, props: props ? { ...widget.props, ...props } : widget.props } : widget) });
  }

  function removeWidget() {
    if (!selected) return;
    updateScreen({ ...screen, widgets: screen.widgets.filter((widget) => widget.id !== selected.id) });
    setSelectedId("");
  }

  function moveWidget(event: React.DragEvent, widget: LinkPadWidget) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.round(((event.clientX - rect.left) / rect.width) * screen.width - widget.width / 2);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * screen.height - widget.height / 2);
    const clampedX = Math.max(0, Math.min(screen.width - widget.width, x));
    const clampedY = Math.max(0, Math.min(screen.height - widget.height, y));
    updateScreen({ ...screen, widgets: screen.widgets.map((item) => item.id === widget.id ? { ...item, x: clampedX, y: clampedY } : item) });
  }

  function renderWidget(widget: LinkPadWidget) {
    if (widget.type === "static_text" || widget.type === "status_indicator") return String(widget.props.text ?? widgetNames[widget.type]);
    if (widget.type === "write_button") return String(widget.props.text ?? "Escrever");
    const tag = String(widget.props.tag ?? "");
    const value = sampleValues[tag] ?? "--";
    if (widget.type === "boolean_indicator") return <><i className={value ? "led on" : "led"} /> {tag || "Sem tag"}</>;
    return `${tag || "Sem tag"}: ${String(value)}`;
  }

  return (
    <main className="workbench">
      <section className="editor-surface screen-editor">
        <div className="editor-header"><div><Monitor size={21} /><h2>{screen.name}</h2></div><span>{screen.width} × {screen.height}</span></div>
        <div className="screen-toolbar">
          <button type="button" onClick={() => addWidget("static_text")}><Type size={16} /> Texto</button>
          <button type="button" onClick={() => addWidget("tag_value")}><Plus size={16} /> Valor</button>
          <button type="button" onClick={() => addWidget("boolean_indicator")}><CircleGauge size={16} /> Booleano</button>
          <button type="button" onClick={() => addWidget("status_indicator")}><Plus size={16} /> Status</button>
          <button type="button" onClick={() => addWidget("write_button")}><Plus size={16} /> Escrita</button>
        </div>

        <div className="screen-layout">
          <div className="device-preview-wrap">
            <div className="device-preview" ref={canvasRef} style={{ aspectRatio: `${screen.width} / ${screen.height}` }}>
              <div className="preview-grid" />
              {screen.widgets.filter((widget) => widget.visible).map((widget) => (
                <button
                  className={`canvas-widget ${selectedId === widget.id ? "selected" : ""} ${widget.type}`}
                  draggable
                  key={widget.id}
                  type="button"
                  style={{ left: `${widget.x / screen.width * 100}%`, top: `${widget.y / screen.height * 100}%`, width: `${widget.width / screen.width * 100}%`, height: `${widget.height / screen.height * 100}%`, color: String(widget.props.color ?? "#fff") }}
                  onClick={() => setSelectedId(widget.id)}
                  onDragEnd={(event) => moveWidget(event, widget)}
                >{renderWidget(widget)}</button>
              ))}
              <RuntimeStatusOverlay
                agentOnline
                config={project.hardware.statusOverlay}
                height={screen.height}
                wifiOnline
                width={screen.width}
              />
              {screen.widgets.length === 0 && <div className="preview-label">Adicione um widget para começar</div>}
            </div>
          </div>

          <aside className="widget-editor">
            {selected ? <>
              <div className="aside-title"><h3>{widgetNames[selected.type]}</h3><button type="button" title="Excluir widget" onClick={removeWidget}><Trash2 size={16} /></button></div>
              {(selected.type === "static_text" || selected.type === "status_indicator" || selected.type === "write_button") && <label>Texto<input value={String(selected.props.text ?? "")} onChange={(event) => updateWidget({}, { text: event.target.value })} /></label>}
              {(selected.type === "tag_value" || selected.type === "boolean_indicator" || selected.type === "write_button") && <label>Tag<select value={String(selected.props.tag ?? "")} onChange={(event) => updateWidget({}, { tag: event.target.value })}><option value="">Selecione</option>{project.tags.map((tag) => <option value={tag.name} key={tag.name}>{tag.name}</option>)}</select></label>}
              {selected.type === "write_button" && <label>Valor<input value={String(selected.props.value ?? "")} onChange={(event) => updateWidget({}, { value: Number(event.target.value) || event.target.value })} /></label>}
              <div className="two-columns"><label>X<input type="number" value={selected.x} onChange={(event) => updateWidget({ x: Number(event.target.value) })} /></label><label>Y<input type="number" value={selected.y} onChange={(event) => updateWidget({ y: Number(event.target.value) })} /></label></div>
              <div className="two-columns"><label>Largura<input type="number" min={8} value={selected.width} onChange={(event) => updateWidget({ width: Number(event.target.value) })} /></label><label>Altura<input type="number" min={8} value={selected.height} onChange={(event) => updateWidget({ height: Number(event.target.value) })} /></label></div>
              <label>Cor<input type="color" value={String(selected.props.color ?? "#ffffff")} onChange={(event) => updateWidget({}, { color: event.target.value })} /></label>
              <p>Arraste o widget no display para reposicioná-lo.</p>
            </> : <div className="table-empty">Selecione um widget.</div>}
          </aside>
        </div>
      </section>
    </main>
  );
}
