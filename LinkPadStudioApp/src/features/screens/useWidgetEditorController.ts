import { useCallback, useEffect, useRef, useState } from "react";
import type { LinkPadProject, LinkPadWidget } from "../../types/project";
import { cloneWidgetsForPaste } from "./widgetEditing";

export interface WidgetSelection {
  screenId: string;
  ids: string[];
  primaryId: string;
}

interface WidgetHistoryEntry {
  screenId: string;
  before: LinkPadWidget[];
  after: LinkPadWidget[];
  label: string;
}

export interface WidgetEditorController {
  selection: WidgetSelection;
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
  select: (screenId: string, ids: string[], primaryId?: string) => void;
  commitWidgets: (screenId: string, widgets: LinkPadWidget[], label: string, selectedIds?: string[]) => void;
  copyWidgets: (widgets: LinkPadWidget[]) => void;
  pasteWidgets: (screenId: string) => void;
  undo: () => void;
  redo: () => void;
}

const EMPTY_SELECTION: WidgetSelection = { screenId: "", ids: [], primaryId: "" };

function sameWidgets(left: LinkPadWidget[], right: LinkPadWidget[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useWidgetEditorController(
  project: LinkPadProject,
  activeScreenId: string,
  onSetProject: (project: LinkPadProject) => void
): WidgetEditorController {
  const projectRef = useRef(project);
  const projectIdRef = useRef(project.projectId);
  const [selection, setSelection] = useState<WidgetSelection>(EMPTY_SELECTION);
  const [past, setPast] = useState<WidgetHistoryEntry[]>([]);
  const [future, setFuture] = useState<WidgetHistoryEntry[]>([]);
  const [clipboard, setClipboard] = useState<LinkPadWidget[]>([]);
  const pasteOffsetRef = useRef(4);

  useEffect(() => {
    projectRef.current = project;
    if (projectIdRef.current !== project.projectId) {
      projectIdRef.current = project.projectId;
      setPast([]);
      setFuture([]);
      setSelection(EMPTY_SELECTION);
      setClipboard([]);
      pasteOffsetRef.current = 4;
    }
  }, [project]);

  useEffect(() => {
    if (selection.screenId !== activeScreenId) {
      setSelection(activeScreenId ? { screenId: activeScreenId, ids: [], primaryId: "" } : EMPTY_SELECTION);
    }
  }, [activeScreenId, selection.screenId]);

  const applyWidgets = useCallback((screenId: string, widgets: LinkPadWidget[]) => {
    const current = projectRef.current;
    const next = {
      ...current,
      screens: current.screens.map((screen) => screen.id === screenId ? { ...screen, widgets } : screen),
      updatedAt: new Date().toISOString()
    };
    projectRef.current = next;
    onSetProject(next);
  }, [onSetProject]);

  const select = useCallback((screenId: string, ids: string[], primaryId = ids.at(-1) ?? "") => {
    const unique = [...new Set(ids)];
    setSelection({
      screenId,
      ids: unique,
      primaryId: unique.includes(primaryId) ? primaryId : unique.at(-1) ?? ""
    });
  }, []);

  const commitWidgets = useCallback((screenId: string, widgets: LinkPadWidget[], label: string, selectedIds?: string[]) => {
    const currentScreen = projectRef.current.screens.find((screen) => screen.id === screenId);
    if (!currentScreen || sameWidgets(currentScreen.widgets, widgets)) return;
    const entry: WidgetHistoryEntry = {
      screenId,
      before: structuredClone(currentScreen.widgets),
      after: structuredClone(widgets),
      label
    };
    setPast((current) => [...current.slice(-99), entry]);
    setFuture([]);
    applyWidgets(screenId, widgets);
    if (selectedIds) select(screenId, selectedIds);
  }, [applyWidgets, select]);

  const copyWidgets = useCallback((widgets: LinkPadWidget[]) => {
    if (widgets.length === 0) return;
    setClipboard(structuredClone(widgets));
    pasteOffsetRef.current = 4;
  }, []);

  const pasteWidgets = useCallback((screenId: string) => {
    const screen = projectRef.current.screens.find((item) => item.id === screenId);
    if (!screen || clipboard.length === 0) return;
    const copies = cloneWidgetsForPaste(clipboard, screen, pasteOffsetRef.current, (prefix) => {
      const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      return `${prefix}-${id}`;
    });
    pasteOffsetRef.current = Math.min(40, pasteOffsetRef.current + 4);
    commitWidgets(screenId, [...screen.widgets, ...copies], "Colar widgets", copies.map((widget) => widget.id));
  }, [clipboard, commitWidgets]);

  const undo = useCallback(() => {
    const entry = past.at(-1);
    if (!entry) return;
    applyWidgets(entry.screenId, structuredClone(entry.before));
    setPast((current) => current.slice(0, -1));
    setFuture((current) => [entry, ...current]);
    const validIds = selection.screenId === entry.screenId
      ? selection.ids.filter((id) => entry.before.some((widget) => widget.id === id))
      : [];
    setSelection({ screenId: entry.screenId, ids: validIds, primaryId: validIds.at(-1) ?? "" });
  }, [applyWidgets, past, selection]);

  const redo = useCallback(() => {
    const entry = future[0];
    if (!entry) return;
    applyWidgets(entry.screenId, structuredClone(entry.after));
    setPast((current) => [...current, entry]);
    setFuture((current) => current.slice(1));
    const validIds = selection.screenId === entry.screenId
      ? selection.ids.filter((id) => entry.after.some((widget) => widget.id === id))
      : [];
    setSelection({ screenId: entry.screenId, ids: validIds, primaryId: validIds.at(-1) ?? "" });
  }, [applyWidgets, future, selection]);

  return {
    selection,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    canPaste: clipboard.length > 0,
    select,
    commitWidgets,
    copyWidgets,
    pasteWidgets,
    undo,
    redo
  };
}
