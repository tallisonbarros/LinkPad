import { bindingFrom } from "../../domain/project/dataBindings";
import type { LinkPadProject, LinkPadScreen, LinkPadWidget } from "../../types/project";

export type WidgetAuditSeverity = "warning" | "info";

export interface WidgetAuditIssue {
  widgetId: string;
  code: "missing-binding" | "low-contrast" | "text-overflow" | "content-height" | "small-touch-target" | "invalid-range" | "hidden";
  severity: WidgetAuditSeverity;
  message: string;
}

export function auditScreenWidgets(project: LinkPadProject, screen: LinkPadScreen): WidgetAuditIssue[] {
  return screen.widgets.flatMap((widget) => auditWidget(project, widget));
}

export function auditWidget(project: LinkPadProject, widget: LinkPadWidget): WidgetAuditIssue[] {
  const issues: WidgetAuditIssue[] = [];
  const dataWidget = ["tag_value", "boolean_indicator", "gauge", "progress_bar", "write_button"].includes(widget.type);
  if (dataWidget && !bindingFrom(widget.props.binding)) {
    issues.push(issue(widget, "missing-binding", "warning", "Selecione a tag usada por este widget."));
  }
  if (!widget.visible) {
    issues.push(issue(widget, "hidden", "info", "Widget oculto no runtime."));
  }

  const fontSize = finiteNumber(widget.props.fontSize, 8);
  const padding = finiteNumber(widget.props.padding, widget.type === "write_button" ? 4 : 2);
  if (widget.height < fontSize + padding * 2) {
    issues.push(issue(widget, "content-height", "warning", "A altura pode cortar o conteúdo."));
  }

  const text = auditText(widget);
  if (text && text.length * fontSize * 0.58 > Math.max(0, widget.width - padding * 2)) {
    issues.push(issue(widget, "text-overflow", "warning", "O texto pode não caber na largura atual."));
  }

  const transparent = Boolean(widget.props.transparent ?? widget.type !== "write_button");
  if (!transparent) {
    const foreground = colorValue(widget.props.color, "#ffffff");
    const background = colorValue(widget.props.backgroundColor, widget.type === "write_button" ? "#41210f" : "#232528");
    if (contrastRatio(foreground, background) < 3) {
      issues.push(issue(widget, "low-contrast", "warning", "Contraste baixo entre texto e fundo."));
    }
  }

  if (widget.type === "write_button" && (widget.width < 44 || widget.height < 22)) {
    issues.push(issue(widget, "small-touch-target", "info", "Área pequena para acionamento em hardware com toque."));
  }
  if (widget.type === "gauge" || widget.type === "progress_bar") {
    const minimum = finiteNumber(widget.props.min, 0);
    const maximum = finiteNumber(widget.props.max, 100);
    if (minimum >= maximum) issues.push(issue(widget, "invalid-range", "warning", "Defina mínimo menor que máximo."));
  }

  // O projeto participa da assinatura para que a auditoria possa evoluir para nomes e tipos resolvidos.
  void project;
  return issues;
}

export function contrastRatio(foreground: string, background: string) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function issue(widget: LinkPadWidget, code: WidgetAuditIssue["code"], severity: WidgetAuditSeverity, message: string): WidgetAuditIssue {
  return { widgetId: widget.id, code, severity, message };
}

function auditText(widget: LinkPadWidget) {
  if (widget.type === "static_text" || widget.type === "status_indicator" || widget.type === "write_button") {
    return String(widget.props.text ?? "");
  }
  if (widget.type === "tag_value") return "##.##";
  if (widget.type === "boolean_indicator") return "Ligado";
  return "";
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function colorValue(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function relativeLuminance(color: string) {
  const channels = [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16) / 255)
    .map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
