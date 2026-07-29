import { ChevronDown, ChevronUp, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

export interface ScreenBottomPanelTab {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number | string;
  content: ReactNode;
}

interface ScreenBottomPanelProps {
  tabs: ScreenBottomPanelTab[];
  defaultExpanded?: boolean;
  initialTabId?: string;
}

export function ScreenBottomPanel({ tabs, defaultExpanded = false, initialTabId }: ScreenBottomPanelProps) {
  const firstTabId = initialTabId && tabs.some((tab) => tab.id === initialTabId) ? initialTabId : tabs[0]?.id ?? "";
  const [activeTabId, setActiveTabId] = useState(firstTabId);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  if (!activeTab) return null;

  function selectTab(tabId: string) {
    setActiveTabId(tabId);
    setExpanded(true);
  }

  return (
    <section className={`screen-bottom-panel ${expanded ? "expanded" : "collapsed"}`} aria-label="Ferramentas da tela">
      <header className="screen-bottom-panel-header">
        <div className="screen-bottom-panel-tabs" role="tablist" aria-label="Ferramentas inferiores">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab.id;
            return (
              <button
                aria-controls="screen-bottom-panel-content"
                aria-selected={active}
                className={active ? "active" : ""}
                id={`screen-bottom-tab-${tab.id}`}
                key={tab.id}
                role="tab"
                type="button"
                onClick={() => selectTab(tab.id)}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && <small>{tab.badge}</small>}
              </button>
            );
          })}
        </div>
        <button
          aria-expanded={expanded}
          aria-label={expanded ? "Recolher ferramentas da tela" : "Expandir ferramentas da tela"}
          className="screen-bottom-panel-toggle"
          title={expanded ? "Recolher" : "Expandir"}
          type="button"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </header>

      {expanded && (
        <div
          aria-labelledby={`screen-bottom-tab-${activeTab.id}`}
          className="screen-bottom-panel-content"
          id="screen-bottom-panel-content"
          role="tabpanel"
        >
          {activeTab.content}
        </div>
      )}
    </section>
  );
}
