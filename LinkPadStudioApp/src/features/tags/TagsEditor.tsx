import { useState } from "react";
import { Plus, Tags } from "lucide-react";
import { addressSummary, countGlobalTagBindings } from "../../domain/project/dataBindings";
import type { LinkPadProject, LinkPadTag } from "../../types/project";
import { createInternalTagDraft, TagEditorDialog } from "./TagEditorDialog";

interface TagsEditorProps {
  project: LinkPadProject;
  onSetProject: (project: LinkPadProject) => void;
}

export function TagsEditor({ project, onSetProject }: TagsEditorProps) {
  const [selectedId, setSelectedId] = useState(project.tags[0]?.id ?? "");
  const [editingId, setEditingId] = useState("");
  const [newTag, setNewTag] = useState<LinkPadTag>();
  const editingTag = project.tags.find((tag) => tag.id === editingId);
  const dialogTag = newTag ?? editingTag;
  const referenceCount = editingTag ? countGlobalTagBindings(project, editingTag.id) : 0;

  function setTags(tags: LinkPadTag[]) {
    onSetProject({ ...project, tags, updatedAt: new Date().toISOString() });
  }

  function openCreateDialog() {
    setEditingId("");
    setNewTag(createInternalTagDraft(project));
  }

  function openEditDialog(tagId: string) {
    setNewTag(undefined);
    setSelectedId(tagId);
    setEditingId(tagId);
  }

  function saveTag(tag: LinkPadTag) {
    if (newTag) setTags([...project.tags, tag]);
    else setTags(project.tags.map((item) => item.id === tag.id ? tag : item));
    setSelectedId(tag.id);
    closeDialog();
  }

  function removeEditingTag() {
    if (!editingTag || referenceCount > 0) return;
    const next = project.tags.filter((tag) => tag.id !== editingTag.id);
    setTags(next);
    setSelectedId(next[0]?.id ?? "");
    closeDialog();
  }

  function closeDialog() {
    setEditingId("");
    setNewTag(undefined);
  }

  function tagOrigin(tag: LinkPadTag) {
    if (tag.source === "internal") return "Interna";
    return project.protocols.find((profile) => profile.id === tag.protocolProfileId)?.name ?? "Comunicação ausente";
  }

  function tagReference(tag: LinkPadTag) {
    if (tag.source === "internal") return tag.retentive ? "Memória retentiva" : "Memória local";
    if (!tag.protocolProfileId || !tag.address) return "Endereço pendente";
    return addressSummary(project, {
      kind: "connector",
      protocolProfileId: tag.protocolProfileId,
      type: tag.type,
      address: tag.address,
      pollMs: tag.pollMs ?? project.agent.pollMs
    });
  }

  return (
    <main className="workbench">
      <section className="editor-surface">
        <div className="editor-header">
          <div><Tags size={21} /><h2>Tags globais</h2></div>
          <button className="primary-action compact" type="button" onClick={openCreateDialog}><Plus size={16} /> Nova tag</button>
        </div>

        <div className="data-table tag-table global-tag-table">
          <div className="table-head">
            <span>Nome</span><span>Tipo</span><span>Origem</span><span>Referência</span><span>Usos</span>
          </div>
          {project.tags.length === 0 ? (
            <div className="table-empty">Nenhuma Tag global. Crie uma Tag interna ou externa.</div>
          ) : project.tags.map((tag) => (
            <button
              className={`table-row ${tag.id === selectedId ? "selected" : ""}`}
              key={tag.id}
              title="Duplo clique para configurar"
              type="button"
              onClick={() => setSelectedId(tag.id)}
              onDoubleClick={() => openEditDialog(tag.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter") openEditDialog(tag.id);
              }}
            >
              <span>{tag.name}</span>
              <span>{tag.type}</span>
              <span>{tagOrigin(tag)}</span>
              <span>{tagReference(tag)}</span>
              <span>{countGlobalTagBindings(project, tag.id)}</span>
            </button>
          ))}
        </div>

        {dialogTag && (
          <TagEditorDialog
            key={`${newTag ? "create" : "edit"}:${dialogTag.id}`}
            mode={newTag ? "create" : "edit"}
            project={project}
            referenceCount={referenceCount}
            tag={dialogTag}
            onClose={closeDialog}
            onRemove={newTag ? undefined : removeEditingTag}
            onSave={saveTag}
          />
        )}
      </section>
    </main>
  );
}
