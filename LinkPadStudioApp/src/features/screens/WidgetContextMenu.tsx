import { ClipboardPaste, Copy, Files, Lock, Scissors, Trash2, Unlock } from "lucide-react";
import type { RefObject } from "react";

interface WidgetContextMenuProps {
  allLocked: boolean;
  canEdit: boolean;
  canPaste: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  x: number;
  y: number;
  onCopy: () => void;
  onCut: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onLockChange: (locked: boolean) => void;
  onPaste: () => void;
}

export function WidgetContextMenu({
  allLocked,
  canEdit,
  canPaste,
  menuRef,
  x,
  y,
  onCopy,
  onCut,
  onDelete,
  onDuplicate,
  onLockChange,
  onPaste
}: WidgetContextMenuProps) {
  return (
    <div
      aria-label="Ações dos widgets selecionados"
      className="widget-context-menu"
      ref={menuRef}
      role="menu"
      style={{ left: x, top: y }}
    >
      <button role="menuitem" type="button" onClick={onCopy}><Copy size={14} /> Copiar</button>
      <button disabled={!canEdit} role="menuitem" type="button" onClick={onCut}><Scissors size={14} /> Recortar</button>
      <button disabled={!canPaste} role="menuitem" type="button" onClick={onPaste}><ClipboardPaste size={14} /> Colar</button>
      <div className="widget-context-separator" role="separator" />
      <button disabled={!canEdit} role="menuitem" type="button" onClick={onDuplicate}><Files size={14} /> Duplicar</button>
      <button role="menuitem" type="button" onClick={() => onLockChange(!allLocked)}>
        {allLocked ? <Unlock size={14} /> : <Lock size={14} />}
        {allLocked ? "Desbloquear" : "Bloquear"}
      </button>
      <div className="widget-context-separator" role="separator" />
      <button className="danger" disabled={!canEdit} role="menuitem" type="button" onClick={onDelete}><Trash2 size={14} /> Excluir</button>
    </div>
  );
}
