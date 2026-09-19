"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Bell, ChevronDown, Clapperboard, FolderKanban, Image, LayoutDashboard, PanelsTopLeft,
  Menu, Palette, PanelLeftClose, PanelLeftOpen, Pin, Plus, Search, Send, Settings, Share2, Sparkles, X,
} from "lucide-react";
import { useProjects } from "@/features/projects/projects-context";

type DashboardShellProps = {
  children: React.ReactNode;
  projectId?: string;
  title: string;
  eyebrow?: string;
};

const projectNavigation = [
  { label: "Proje Merkezi", href: "", icon: PanelsTopLeft },
  { label: "Genel Bakış", href: "/overview", icon: LayoutDashboard },
  { label: "Görsel Üret", href: "/image-generation", icon: Image },
  { label: "Video Üret", href: "/video-generation", icon: Clapperboard },
  { label: "Paylaşım Planı", href: "/publishing", icon: Send },
  { label: "Hesaplar", href: "/accounts", icon: Share2 },
  { label: "Pinterest", href: "/pinterest", icon: Pin },
];

export function DashboardShell({ children, projectId, title, eyebrow }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { projects } = useProjects();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const activeProject = projectId ? projects.find((project) => project.id === projectId) : undefined;

  function projectHref(suffix = "") {
    return projectId ? `/projects/${projectId}${suffix}` : "/projects";
  }

  function switchProject(nextId: string) {
    const suffix = projectId && pathname.startsWith(`/projects/${projectId}`)
      ? pathname.slice(`/projects/${projectId}`.length)
      : "";
    setProjectMenuOpen(false);
    router.push(`/projects/${nextId}${suffix}`);
  }

  const sidebar = (
    <>
      <div className="brand-lockup">
        <div className="brand-mark"><Sparkles size={18} /></div>
        {!collapsed && <span>Yönetici</span>}
        <button className="icon-button collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label="Kenar çubuğunu daralt">
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Menüyü kapat"><X size={20} /></button>
      </div>

      <nav className="sidebar-nav">
        <p className="nav-label">GENEL</p>
        <Link href="/projects" className={`nav-item ${pathname === "/projects" ? "active" : ""}`} title="Projeler">
          <FolderKanban size={19} /><span>Projeler</span>
        </Link>

        {projectId && <>
          <p className="nav-label">PROJE</p>
          {projectNavigation.map((item) => {
            const href = projectHref(item.href);
            const active = item.href === "" ? pathname === href : pathname.startsWith(href);
            const Icon = item.icon;
            return (
              <Link key={item.label} href={href} className={`nav-item ${active ? "active" : ""}`} title={item.label} onClick={() => setMobileOpen(false)}>
                <Icon size={19} /><span>{item.label}</span>
              </Link>
            );
          })}
        </>}
      </nav>

      <div className="sidebar-footer">
        {projectId && <Link href={`/projects/${projectId}/settings`} className="nav-item" title="Proje Ayarları"><Palette size={19} /><span>Proje Ayarları</span></Link>}
        <Link href="/settings" className={`nav-item ${pathname === "/settings" ? "active" : ""}`} title="Sistem Ayarları"><Settings size={19} /><span>Sistem Ayarları</span></Link>
        <div className="profile-chip">
          <div className="avatar">OG</div>
          {!collapsed && <div><strong>Oğuz G.</strong><span>Yönetici</span></div>}
        </div>
      </div>
    </>
  );

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar desktop-sidebar">{sidebar}</aside>
      {mobileOpen && <><button className="mobile-overlay" onClick={() => setMobileOpen(false)} aria-label="Menüyü kapat" /><aside className="sidebar mobile-sidebar">{sidebar}</aside></>}

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button menu-button" onClick={() => setMobileOpen(true)} aria-label="Menüyü aç"><Menu size={20} /></button>
            <div className="page-heading"><span>{eyebrow || "Çalışma alanı"}</span><h1>{title}</h1></div>
          </div>

          <div className="topbar-actions">
            {projects.length > 0 && (
              <div className="project-switcher-wrap">
                <button className="project-switcher" onClick={() => setProjectMenuOpen(!projectMenuOpen)}>
                  <span className="project-dot" style={{ background: activeProject?.brand.primaryColor || "#6d5dfc" }} />
                  <span>{activeProject?.name || "Proje seç"}</span><ChevronDown size={16} />
                </button>
                {projectMenuOpen && (
                  <div className="project-menu surface-popover">
                    <p>PROJELER</p>
                    {projects.map((project) => (
                      <button key={project.id} onClick={() => switchProject(project.id)} className={project.id === projectId ? "selected" : ""}>
                        <span className="project-dot" style={{ background: project.brand.primaryColor }} />
                        <span>{project.name}</span>
                      </button>
                    ))}
                    <div className="popover-divider" />
                    <Link href="/projects"><FolderKanban size={16} />Tüm projeleri gör</Link>
                    <Link href="/projects?new=true"><Plus size={16} />Yeni proje ekle</Link>
                  </div>
                )}
              </div>
            )}
            <button className="search-button"><Search size={18} /><span>İçerik ara...</span><kbd>⌘ K</kbd></button>
            <button className="icon-button notification-button"><Bell size={19} /><span /></button>
          </div>
        </header>
        <main className="content-area">{children}</main>
      </div>
    </div>
  );
}
