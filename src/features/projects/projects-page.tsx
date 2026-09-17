"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, FolderKanban, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Project, useProjects } from "./projects-context";

export function ProjectsPage() {
  const { projects, ready, createProject, updateProject, deleteProject } = useProjects();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | "delete" | null>(searchParams.get("new") === "true" ? "create" : null);
  const [selected, setSelected] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const filtered = useMemo(() => projects.filter((project) => project.name.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR"))), [projects, query]);

  function closeModal() {
    setModal(null); setSelected(null); setName("");
    if (searchParams.get("new")) router.replace("/projects");
  }

  function submit() {
    if (!name.trim()) return;
    if (modal === "create") {
      const project = createProject(name);
      closeModal(); router.push(`/projects/${project.id}`);
    } else if (modal === "edit" && selected) {
      updateProject(selected.id, { name: name.trim() }); closeModal();
    }
  }

  return (
    <>
      <div className="page-intro">
        <div><h2>Projeleriniz</h2><p>Markalarınızı, üretimlerinizi ve paylaşım süreçlerinizi tek yerden yönetin.</p></div>
        <button className="button primary" onClick={() => setModal("create")}><Plus size={18} />Yeni proje</button>
      </div>
      <div className="toolbar">
        <label className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Proje ara..." /></label>
        <span className="result-count">{projects.length} proje</span>
      </div>

      {!ready ? <div className="project-grid"><div className="skeleton-card" /><div className="skeleton-card" /></div> : filtered.length ? (
        <div className="project-grid">
          {filtered.map((project) => (
            <article className="project-card" key={project.id}>
              <div className="project-card-top">
                <div className="project-monogram" style={{ background: `${project.brand.primaryColor}18`, color: project.brand.primaryColor }}>{project.name.slice(0, 2).toLocaleUpperCase("tr-TR")}</div>
                <div className="project-card-menu-wrap">
                  <button className="icon-button" onClick={() => setOpenMenu(openMenu === project.id ? null : project.id)}><MoreHorizontal size={20} /></button>
                  {openMenu === project.id && <div className="card-menu surface-popover">
                    <button onClick={() => { setSelected(project); setName(project.name); setModal("edit"); setOpenMenu(null); }}><Pencil size={15} />Düzenle</button>
                    <button className="danger-text" onClick={() => { setSelected(project); setModal("delete"); setOpenMenu(null); }}><Trash2 size={15} />Sil</button>
                  </div>}
                </div>
              </div>
              <div className="project-card-body"><h3>{project.name}</h3><p>{project.brand.industry || "Marka bilgileri bekleniyor"}</p></div>
              <div className="project-stats"><div><strong>0</strong><span>İçerik</span></div><div><strong>0</strong><span>Planlanan</span></div><div><strong>—</strong><span>Son işlem</span></div></div>
              <Link className="project-open" href={`/projects/${project.id}`}>Projeyi aç <ArrowRight size={17} /></Link>
            </article>
          ))}
          <button className="new-project-card" onClick={() => setModal("create")}><span><Plus size={24} /></span><strong>Yeni proje oluştur</strong><small>Yeni bir marka çalışma alanı ekleyin</small></button>
        </div>
      ) : (
        <div className="empty-state"><div><FolderKanban size={28} /></div><h3>Proje bulunamadı</h3><p>Arama ifadenizi değiştirin veya yeni bir proje oluşturun.</p><button className="button primary" onClick={() => setModal("create")}><Plus size={18} />Yeni proje</button></div>
      )}

      {modal && <div className="modal-backdrop" onMouseDown={closeModal}>
        <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
          <button className="icon-button modal-close" onClick={closeModal}><X size={20} /></button>
          {modal === "delete" ? <>
            <div className="modal-icon danger"><Trash2 size={22} /></div><h2>Projeyi sil</h2>
            <p><strong>{selected?.name}</strong> projesini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.</p>
            <div className="modal-actions"><button className="button secondary" onClick={closeModal}>Vazgeç</button><button className="button danger-button" onClick={() => { if (selected) deleteProject(selected.id); closeModal(); }}>Projeyi sil</button></div>
          </> : <>
            <div className="modal-icon"><FolderKanban size={22} /></div><h2>{modal === "create" ? "Yeni proje" : "Projeyi düzenle"}</h2>
            <p>{modal === "create" ? "Başlamak için projenize bir ad verin. Marka bilgilerini daha sonra ekleyebilirsiniz." : "Projenizin görünen adını güncelleyin."}</p>
            <label className="field-label">Proje adı<input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} placeholder="Örn. Nova Studio" /></label>
            <div className="modal-actions"><button className="button secondary" onClick={closeModal}>Vazgeç</button><button className="button primary" disabled={!name.trim()} onClick={submit}>{modal === "create" ? "Proje oluştur" : "Değişiklikleri kaydet"}</button></div>
          </>}
        </div>
      </div>}
    </>
  );
}
