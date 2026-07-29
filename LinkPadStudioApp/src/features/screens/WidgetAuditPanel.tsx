import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import type { LinkPadProject, LinkPadScreen } from "../../types/project";
import type { WidgetEditorController } from "./useWidgetEditorController";
import { auditScreenWidgets } from "./widgetAudit";
import { widgetLayerName } from "./widgetEditing";
import { widgetNames } from "./WidgetPropertiesPanel";

interface WidgetAuditPanelProps {
  embedded?: boolean;
  onNavigate?: () => void;
  project: LinkPadProject;
  screen: LinkPadScreen;
  controller: WidgetEditorController;
}

export function WidgetAuditPanel({ embedded = false, onNavigate, project, screen, controller }: WidgetAuditPanelProps) {
  const issues = auditScreenWidgets(project, screen);
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const content = (
    <>
      {issues.length === 0 ? (
        <div className="audit-empty"><CheckCircle2 size={15} /> Nenhum alerta nesta tela.</div>
      ) : (
        <div className="audit-list">
          {issues.map((issue, index) => {
            const widget = screen.widgets.find((item) => item.id === issue.widgetId);
            if (!widget) return null;
            return (
              <button key={`${issue.widgetId}-${issue.code}-${index}`} type="button" onClick={() => {
                controller.select(screen.id, [widget.id], widget.id);
                onNavigate?.();
              }}>
                {issue.severity === "warning" ? <TriangleAlert size={14} /> : <Info size={14} />}
                <span><strong>{widgetLayerName(widget, widgetNames[widget.type])}</strong><small>{issue.message}</small></span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );

  if (embedded) return <section className="widget-audit-embedded">{content}</section>;

  return (
    <details className="context-tool-section widget-audit-panel" open={warnings.length > 0}>
      <summary>
        <span>Qualidade visual</span>
        <span className={warnings.length > 0 ? "audit-count warning" : "audit-count ok"}>
          {warnings.length > 0 ? warnings.length : <CheckCircle2 size={13} />}
        </span>
      </summary>
      {content}
    </details>
  );
}
