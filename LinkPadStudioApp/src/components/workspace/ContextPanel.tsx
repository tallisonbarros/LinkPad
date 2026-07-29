import { useEffect, useState } from "react";
import {
  Cable,
  Cpu,
  Gauge,
  Info,
  Layers3,
  Plus,
  RadioTower,
  Tags,
  X
} from "lucide-react";
import { WidgetCatalogPanel } from "../../features/screens/WidgetCatalogPanel";
import { WidgetLayersPanel } from "../../features/screens/WidgetLayersPanel";
import type { WidgetEditorController } from "../../features/screens/useWidgetEditorController";
import { createWidgetFromCatalog, widgetDefinition } from "../../features/screens/widgetCatalog";
import { WidgetPropertiesPanel } from "../../features/screens/WidgetPropertiesPanel";
import type { HardwareManifest, LinkPadProject, LinkPadWidget, WorkspaceTab } from "../../types/project";

interface ContextPanelProps {
  project: LinkPadProject;
  hardware: HardwareManifest;
  activeTab: WorkspaceTab;
  widgetEditor: WidgetEditorController;
}

type ContextDrawer = "catalog" | "layers" | null;

export function ContextPanel({ project, hardware, activeTab, widgetEditor }: ContextPanelProps) {
  const activeScreen = activeTab.kind === "screen"
    ? project.screens.find((screen) => screen.id === activeTab.refId)
    : undefined;
  const selection = activeScreen && widgetEditor.selection.screenId === activeScreen.id
    ? widgetEditor.selection
    : { screenId: "", ids: [], primaryId: "" };
  const selectedWidgets = activeScreen?.widgets.filter((widget) => selection.ids.includes(widget.id)) ?? [];
  const selectedPrimaryWidget = selectedWidgets.find((widget) => widget.id === selection.primaryId) ?? selectedWidgets.at(-1);
  const [drawer, setDrawer] = useState<ContextDrawer>(null);

  useEffect(() => {
    setDrawer(null);
  }, [activeScreen?.id]);

  useEffect(() => {
    if (selectedWidgets.length > 0) setDrawer(null);
  }, [widgetEditor.selection, selectedWidgets.length]);

  const sections = {
    overview: [["Projeto", project.name], ["Hardware", hardware.name], ["Runtime", hardware.runtime], ["Schema", project.schemaVersion], ["Pasta", project.folderPath || "-"]],
    communication: [["Wi-Fi", project.network.ssid || "Não configurado"], ["Agente LinkPad", project.agent.host], ["Timeout", `${project.agent.timeoutMs} ms`]],
    connectors: [["PLCs", String(project.protocols.filter((profile) => profile.driver !== "sim").length)], ["Em uso", String(project.protocols.filter((profile) => profile.driver !== "sim" && profile.enabled).length)], ["Simulações", String(project.protocols.filter((profile) => profile.driver === "sim").length)]],
    tags: [["Tags globais", String(project.tags.length)], ["Origem padrão", "agent"], ["Qualidade inicial", "unknown"]],
    screen: [["Tela", activeTab.title], ["Resolução", `${hardware.display.width} x ${hardware.display.height}`], ["Widgets", String(activeScreen?.widgets.length ?? 0)]],
    build: [["Target", hardware.runtime], ["Device", hardware.id], ["Estado", "Pendente"]],
    diagnostics: [["Agente", "Não testado"], ["PLC", "Indisponível"], ["Último erro", "-"]]
  } as const;

  const icons = {
    overview: Info,
    communication: RadioTower,
    connectors: Cable,
    tags: Tags,
    screen: Gauge,
    build: Cpu,
    diagnostics: Info
  };
  const Icon = icons[activeTab.kind];

  function clampWidget(widget: LinkPadWidget) {
    if (!activeScreen) return widget;
    const minimum = widgetDefinition(widget.type).minimumSize;
    const width = Math.max(minimum.width, Math.min(activeScreen.width, widget.width));
    const height = Math.max(minimum.height, Math.min(activeScreen.height, widget.height));
    return {
      ...widget,
      width,
      height,
      x: Math.max(0, Math.min(activeScreen.width - width, Math.round(widget.x))),
      y: Math.max(0, Math.min(activeScreen.height - height, Math.round(widget.y)))
    };
  }

  function addWidget(type: Parameters<typeof createWidgetFromCatalog>[0]) {
    if (!activeScreen) return;
    const widget = createWidgetFromCatalog(type, activeScreen.widgets.length);
    widgetEditor.commitWidgets(activeScreen.id, [...activeScreen.widgets, widget], "Adicionar widget", [widget.id]);
    setDrawer(null);
  }

  function updateWidget(widgetId: string, patch: Partial<LinkPadWidget>, props?: Record<string, unknown>) {
    if (!activeScreen) return;
    const widgets = activeScreen.widgets.map((widget) => {
      if (widget.id !== widgetId) return widget;
      return clampWidget({
        ...widget,
        ...patch,
        props: props ? { ...widget.props, ...props } : widget.props
      });
    });
    widgetEditor.commitWidgets(activeScreen.id, widgets, "Configurar widget", [widgetId]);
  }

  function toggleDrawer(next: Exclude<ContextDrawer, null>) {
    const nextDrawer = drawer === next ? null : next;
    setDrawer(nextDrawer);
  }

  if (!activeScreen) {
    return (
      <aside className="context-panel">
        <div className="panel-title"><Icon size={18} /><span>Contexto</span></div>
        <div className="property-list">
          {sections[activeTab.kind].map(([label, value]) => (
            <div className="property-row" key={label}><small>{label}</small><strong>{value}</strong></div>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="context-panel screen-context-panel">
      <nav className="context-command-bar" aria-label="Ferramentas de contexto da tela">
        <button className={drawer === "catalog" ? "active" : ""} type="button" onClick={() => toggleDrawer("catalog")}><Plus size={15} /> Adicionar</button>
        <button className={drawer === "layers" ? "active" : ""} type="button" onClick={() => toggleDrawer("layers")}><Layers3 size={15} /> Camadas</button>
      </nav>

      {drawer && (
        <section className="context-drawer">
          <header>
            <div>
              <strong>{drawer === "catalog" ? "Adicionar widget" : "Camadas"}</strong>
              <small>{drawer === "catalog" ? "Arraste ou clique" : `${activeScreen.widgets.length} itens`}</small>
            </div>
            <button aria-label="Fechar painel" type="button" onClick={() => setDrawer(null)}><X size={15} /></button>
          </header>
          {drawer === "catalog" && <WidgetCatalogPanel compact screenName={activeScreen.name} onAdd={addWidget} />}
          {drawer === "layers" && <WidgetLayersPanel embedded controller={widgetEditor} screen={activeScreen} onNavigate={() => setDrawer(null)} />}
        </section>
      )}

      {!drawer && selectedWidgets.length === 0 && (
        <section className="context-empty-state">
          <Gauge size={24} />
          <strong>Nenhum widget selecionado</strong>
          <span>Selecione um item na tela ou adicione um novo widget.</span>
          <button type="button" onClick={() => setDrawer("catalog")}><Plus size={14} /> Adicionar widget</button>
        </section>
      )}

      {!drawer && selectedPrimaryWidget && selectedWidgets.length === 1 && (
        <WidgetPropertiesPanel
          key={selectedPrimaryWidget.id}
          project={project}
          widget={selectedPrimaryWidget}
          onChange={(patch, props) => updateWidget(selectedPrimaryWidget.id, patch, props)}
        />
      )}

      {!drawer && selectedWidgets.length > 1 && (
        <section className="context-empty-state context-multi-selection">
          <Layers3 size={24} />
          <strong>{selectedWidgets.length} widgets selecionados</strong>
          <span>As ações da seleção estão na barra superior. Selecione apenas um widget para editar suas propriedades.</span>
        </section>
      )}

      <footer className="context-screen-footer" aria-label="Informações da tela">
        <span>{activeScreen.name}</span>
        <span>{activeScreen.width} × {activeScreen.height}</span>
        <span>{activeScreen.widgets.length} {activeScreen.widgets.length === 1 ? "widget" : "widgets"}</span>
      </footer>
    </aside>
  );
}
