import { ChevronRight, SlidersHorizontal, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";
import { DataBindingField } from "../../components/data-binding/DataBindingField";
import {
  bindingFrom,
  defaultValueForType,
  valueTypeForBinding,
  writeLimitsForBinding
} from "../../domain/project/dataBindings";
import type { LinkPadDataBinding, LinkPadProject, LinkPadWidget } from "../../types/project";

interface WidgetPropertiesPanelProps {
  project: LinkPadProject;
  widget: LinkPadWidget;
  onChange: (patch: Partial<LinkPadWidget>, props?: Record<string, unknown>) => void;
}

interface PropertyRowProps {
  children: ReactNode;
  label: string;
  propertyKey: string;
}

interface PropertyGroupProps {
  children: ReactNode;
  defaultOpen?: boolean;
  groupKey: string;
  label: string;
}

export const widgetNames: Record<LinkPadWidget["type"], string> = {
  static_text: "Texto",
  tag_value: "Valor da tag",
  status_indicator: "Status",
  boolean_indicator: "Indicador booleano",
  gauge: "Medidor",
  progress_bar: "Barra de progresso",
  write_button: "Botão de escrita"
};

function PropertyRow({ children, label, propertyKey }: PropertyRowProps) {
  return (
    <div className="widget-property-row" data-property={propertyKey}>
      <span className="widget-property-name">{label}</span>
      <div className="widget-property-value">{children}</div>
      <button
        aria-label={`Animar ${label}`}
        className="widget-property-animation"
        data-animation-property={propertyKey}
        disabled
        title="Animações de propriedades serão disponibilizadas em uma próxima etapa"
        type="button"
      >
        <Sparkles size={13} />
      </button>
    </div>
  );
}

function PropertyGroup({ children, defaultOpen = false, groupKey, label }: PropertyGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details className="widget-property-group" data-property-group={groupKey} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <ChevronRight size={13} />
        <span>{label}</span>
      </summary>
      <div className="widget-property-group-body">{children}</div>
    </details>
  );
}

function numberOrUndefined(value: string) {
  return value === "" ? undefined : Number(value);
}

export function WidgetPropertiesPanel({ project, widget, onChange }: WidgetPropertiesPanelProps) {
  const numericDisplay = widget.type === "gauge" || widget.type === "progress_bar";
  const transparent = Boolean(widget.props.transparent ?? widget.type !== "write_button");
  const locked = widget.editor?.locked === true;
  const usesData = widget.type === "tag_value" || widget.type === "boolean_indicator" || numericDisplay || widget.type === "write_button";
  const hasText = widget.type === "static_text" || widget.type === "status_indicator" || widget.type === "write_button";
  const writeType = widget.type === "write_button"
    ? valueTypeForBinding(project, bindingFrom(widget.props.binding))
    : undefined;
  const writeIsNumeric = writeType === "int" || writeType === "float";

  function updateProps(props: Record<string, unknown>) {
    onChange({}, props);
  }

  function updateBinding(binding: LinkPadDataBinding) {
    const nextProps: Record<string, unknown> = { binding };
    if (widget.type === "write_button") {
      const type = valueTypeForBinding(project, binding);
      const current = widget.props.value;
      const compatible = type === "bool" ? typeof current === "boolean"
        : type === "string" ? typeof current === "string"
          : typeof current === "number";
      if (!compatible) nextProps.value = defaultValueForType(type);
      if (type === "int" || type === "float") {
        const legacyLimits = writeLimitsForBinding(project, binding);
        if (typeof widget.props.min !== "number" && legacyLimits.min !== undefined) nextProps.min = legacyLimits.min;
        if (typeof widget.props.max !== "number" && legacyLimits.max !== undefined) nextProps.max = legacyLimits.max;
      } else {
        nextProps.min = undefined;
        nextProps.max = undefined;
      }
    }
    updateProps(nextProps);
  }

  return (
    <section aria-labelledby="widget-properties-heading" className="widget-properties-panel">
      <header className="widget-properties-panel-header">
        <SlidersHorizontal size={16} />
        <div>
          <strong id="widget-properties-heading">Propriedades</strong>
          <small>{widgetNames[widget.type]}</small>
        </div>
      </header>

      <div className="widget-property-columns" aria-hidden="true">
        <span>Propriedade</span>
        <span>Valor</span>
        <Sparkles size={12} />
      </div>

      <div className="widget-properties-list">
        {(hasText || usesData || numericDisplay) && (
          <PropertyGroup defaultOpen groupKey="content" label="Conteúdo">

        {hasText && (
          <PropertyRow label="Texto" propertyKey="text">
            <input aria-label="Texto" value={String(widget.props.text ?? "")} onChange={(event) => updateProps({ text: event.target.value })} />
          </PropertyRow>
        )}

        {usesData && (
          <PropertyRow label={widget.type === "write_button" ? "Destino" : "Tag"} propertyKey="binding">
            <DataBindingField
              compact
              access={widget.type === "write_button" ? "write" : "read"}
              acceptedTypes={widget.type === "boolean_indicator" ? ["bool"] : numericDisplay ? ["int", "float"] : ["bool", "int", "float", "string"]}
              label={widget.type === "write_button" ? "Destino da escrita" : "Selecionar tag"}
              project={project}
              value={bindingFrom(widget.props.binding)}
              onChange={updateBinding}
            />
          </PropertyRow>
        )}

        {widget.type === "write_button" && (
          <PropertyRow label="Valor" propertyKey="value">
            {writeType === "bool" ? (
              <select aria-label="Valor" value={String(widget.props.value ?? true)} onChange={(event) => updateProps({ value: event.target.value === "true" })}>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input aria-label="Valor" value={String(widget.props.value ?? "")} onChange={(event) => updateProps({ value: writeType === "string" ? event.target.value : Number(event.target.value) })} />
            )}
          </PropertyRow>
        )}

        {writeIsNumeric && (
          <>
            <PropertyRow label="Mínimo" propertyKey="min">
              <input aria-label="Mínimo da escrita" type="number" value={typeof widget.props.min === "number" ? widget.props.min : ""} onChange={(event) => updateProps({ min: numberOrUndefined(event.target.value) })} />
            </PropertyRow>
            <PropertyRow label="Máximo" propertyKey="max">
              <input aria-label="Máximo da escrita" type="number" value={typeof widget.props.max === "number" ? widget.props.max : ""} onChange={(event) => updateProps({ max: numberOrUndefined(event.target.value) })} />
            </PropertyRow>
          </>
        )}

        {numericDisplay && (
          <>
            <PropertyRow label="Mínimo" propertyKey="min">
              <input aria-label="Mínimo" type="number" value={Number(widget.props.min ?? 0)} onChange={(event) => updateProps({ min: Number(event.target.value) })} />
            </PropertyRow>
            <PropertyRow label="Máximo" propertyKey="max">
              <input aria-label="Máximo" type="number" value={Number(widget.props.max ?? 100)} onChange={(event) => updateProps({ max: Number(event.target.value) })} />
            </PropertyRow>
            <PropertyRow label="Mostrar valor" propertyKey="showValue">
              <label className="widget-property-toggle">
                <input type="checkbox" checked={Boolean(widget.props.showValue ?? true)} onChange={(event) => updateProps({ showValue: event.target.checked })} />
                <span>{Boolean(widget.props.showValue ?? true) ? "Sim" : "Não"}</span>
              </label>
            </PropertyRow>
          </>
        )}

          </PropertyGroup>
        )}

        <PropertyGroup defaultOpen groupKey="visual" label="Visual">

        <PropertyRow label="Fonte" propertyKey="fontSize">
          <input aria-label="Tamanho da fonte" type="number" min={6} max={32} value={Number(widget.props.fontSize ?? 8)} onChange={(event) => updateProps({ fontSize: Number(event.target.value) })} />
        </PropertyRow>
        <PropertyRow label="Cor" propertyKey="color">
          <input aria-label="Cor do texto" type="color" value={String(widget.props.color ?? "#ffffff")} onChange={(event) => updateProps({ color: event.target.value })} />
        </PropertyRow>
        <PropertyRow label="Alinh. H" propertyKey="textAlign">
          <select aria-label="Alinhamento horizontal" value={String(widget.props.textAlign ?? "left")} onChange={(event) => updateProps({ textAlign: event.target.value })}>
            <option value="left">Esquerda</option>
            <option value="center">Centro</option>
            <option value="right">Direita</option>
          </select>
        </PropertyRow>
        <PropertyRow label="Alinh. V" propertyKey="verticalAlign">
          <select aria-label="Alinhamento vertical" value={String(widget.props.verticalAlign ?? "middle")} onChange={(event) => updateProps({ verticalAlign: event.target.value })}>
            <option value="top">Topo</option>
            <option value="middle">Centro</option>
            <option value="bottom">Base</option>
          </select>
        </PropertyRow>
        <PropertyRow label="Transparente" propertyKey="transparent">
          <label className="widget-property-toggle">
            <input type="checkbox" checked={transparent} onChange={(event) => updateProps({ transparent: event.target.checked })} />
            <span>{transparent ? "Sim" : "Não"}</span>
          </label>
        </PropertyRow>
        {!transparent && (
          <PropertyRow label="Fundo" propertyKey="backgroundColor">
            <input aria-label="Cor do fundo" type="color" value={String(widget.props.backgroundColor ?? (widget.type === "write_button" ? "#41210f" : "#232528"))} onChange={(event) => updateProps({ backgroundColor: event.target.value })} />
          </PropertyRow>
        )}
        </PropertyGroup>

        <PropertyGroup groupKey="border" label="Borda e espaço">

        <PropertyRow label="Espaçamento" propertyKey="padding">
          <input aria-label="Espaçamento interno" type="number" min={0} max={20} value={Number(widget.props.padding ?? (widget.type === "write_button" ? 4 : 2))} onChange={(event) => updateProps({ padding: Number(event.target.value) })} />
        </PropertyRow>
        <PropertyRow label="Arredondar" propertyKey="borderRadius">
          <input aria-label="Arredondamento" type="number" min={0} max={20} value={Number(widget.props.borderRadius ?? (widget.type === "write_button" ? 3 : 0))} onChange={(event) => updateProps({ borderRadius: Number(event.target.value) })} />
        </PropertyRow>
        <PropertyRow label="Borda" propertyKey="borderWidth">
          <input aria-label="Espessura da borda" type="number" min={0} max={8} value={Number(widget.props.borderWidth ?? (widget.type === "write_button" ? 1 : 0))} onChange={(event) => updateProps({ borderWidth: Number(event.target.value) })} />
        </PropertyRow>
        <PropertyRow label="Cor da borda" propertyKey="borderColor">
          <input aria-label="Cor da borda" type="color" value={String(widget.props.borderColor ?? widget.props.color ?? "#ffffff")} onChange={(event) => updateProps({ borderColor: event.target.value })} />
        </PropertyRow>
        </PropertyGroup>

        <PropertyGroup groupKey="position" label="Posição e exibição">
          <PropertyRow label="X" propertyKey="x">
            <input aria-label="Posição X" defaultValue={widget.x} disabled={locked} key={`${widget.id}-x-${widget.x}`} min={0} title={locked ? "Desbloqueie o widget para alterar sua posição" : undefined} type="number" onBlur={(event) => onChange({ x: Number(event.target.value) })} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
          </PropertyRow>
          <PropertyRow label="Y" propertyKey="y">
            <input aria-label="Posição Y" defaultValue={widget.y} disabled={locked} key={`${widget.id}-y-${widget.y}`} min={0} title={locked ? "Desbloqueie o widget para alterar sua posição" : undefined} type="number" onBlur={(event) => onChange({ y: Number(event.target.value) })} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
          </PropertyRow>
          <PropertyRow label="Largura" propertyKey="width">
            <input aria-label="Largura" defaultValue={widget.width} disabled={locked} key={`${widget.id}-width-${widget.width}`} min={1} title={locked ? "Desbloqueie o widget para alterar seu tamanho" : undefined} type="number" onBlur={(event) => onChange({ width: Number(event.target.value) })} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
          </PropertyRow>
          <PropertyRow label="Altura" propertyKey="height">
            <input aria-label="Altura" defaultValue={widget.height} disabled={locked} key={`${widget.id}-height-${widget.height}`} min={1} title={locked ? "Desbloqueie o widget para alterar seu tamanho" : undefined} type="number" onBlur={(event) => onChange({ height: Number(event.target.value) })} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
          </PropertyRow>
          <PropertyRow label="Visível" propertyKey="visible">
            <label className="widget-property-toggle">
              <input type="checkbox" checked={widget.visible} onChange={(event) => onChange({ visible: event.target.checked })} />
              <span>{widget.visible ? "Sim" : "Não"}</span>
            </label>
          </PropertyRow>
        </PropertyGroup>
      </div>
    </section>
  );
}
