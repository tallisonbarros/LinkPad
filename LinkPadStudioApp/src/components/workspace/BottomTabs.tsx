import { X } from "lucide-react";
import type { WorkspaceTab } from "../../types/project";

interface BottomTabsProps {
  tabs: WorkspaceTab[];
  activeTabId: string;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
}

export function BottomTabs({ tabs, activeTabId, onSelect, onClose }: BottomTabsProps) {
  return (
    <div className="bottom-tabs" aria-label="Guias abertas">
      {tabs.map((tab) => (
        <button
          className={tab.id === activeTabId ? "active" : ""}
          key={tab.id}
          type="button"
          onClick={() => onSelect(tab.id)}
        >
          <span>{tab.title}</span>
          {tabs.length > 1 && (
            <i
              role="button"
              tabIndex={0}
              title="Fechar guia"
              onClick={(event) => {
                event.stopPropagation();
                onClose(tab.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onClose(tab.id);
                }
              }}
            >
              <X size={13} />
            </i>
          )}
        </button>
      ))}
    </div>
  );
}
