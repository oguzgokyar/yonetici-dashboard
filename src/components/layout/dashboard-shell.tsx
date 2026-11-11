"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Bell, ChevronDown, ChevronRight, Clapperboard, Compass, Film, FolderKanban, Image, LayoutDashboard, PanelsTopLeft,
  Menu, Palette, PanelLeftClose, PanelLeftOpen, Pin, Plus, Search, Send, Settings, Share2, Sparkles, X,
  Layers, Bot, PhoneCall, Video, LogOut, FileText, Wrench, TrendingUp,
} from "lucide-react";
 import { useProjects } from "@/features/projects/projects-context";
 import { ProductionQueueDrawer } from "./production-queue-drawer";
 import { QuickIdeasDrawer } from "./quick-ideas-drawer";
 import { AiAssistantDrawer } from "./ai-assistant-drawer";

type DashboardShellProps = {
  children: React.ReactNode;
  projectId?: string;
  title: string;
  eyebrow?: string;
};

const projectNavigation = [
  { label: "Proje Merkezi", href: "", icon: PanelsTopLeft },
  { label: "Strateji & İçerik", href: "/strategy", icon: Compass },
  { label: "Görsel Üret", href: "/image-generation", icon: Image },
  { label: "Video Üret", href: "/video-generation", icon: Clapperboard },
  { label: "Stok İçerik", href: "/stock-videos", icon: Film },
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
  const [queueDrawerOpen, setQueueDrawerOpen] = useState(false);
  const [activeQueueCount, setActiveQueueCount] = useState(0);
  const [ideasDrawerOpen, setIdeasDrawerOpen] = useState(false);
  const [totalIdeasCount, setTotalIdeasCount] = useState(0);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [devToolsOpen, setDevToolsOpen] = useState(true);

  const isDevToolsRoute =
    pathname.startsWith("/developer-tools") ||
    pathname === "/growth-archive" ||
    pathname === "/meeting" ||
    pathname === "/teklif" ||
    pathname === "/instagram-growth";

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    router.push("/login");
    router.refresh();
  }

  useEffect(() => {
    function handleQueueUpdate(e: Event) {
      const customEvent = e as CustomEvent<{ openDrawer?: boolean }>;
      if (customEvent.detail?.openDrawer) {
        setQueueDrawerOpen(true);
      }
    }
    function handleIdeasUpdate(e: Event) {
      const customEvent = e as CustomEvent<{ openDrawer?: boolean }>;
      if (customEvent.detail?.openDrawer) {
        setIdeasDrawerOpen(true);
      }
    }
    window.addEventListener("production-queue-updated", handleQueueUpdate);
    window.addEventListener("quick-ideas-updated", handleIdeasUpdate);
    return () => {
      window.removeEventListener("production-queue-updated", handleQueueUpdate);
      window.removeEventListener("quick-ideas-updated", handleIdeasUpdate);
    };
  }, []);

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
        {!collapsed && <div className="brand-mark"><Sparkles size={18} /></div>}
        {!collapsed && <span>Marka Motoru</span>}
        <button
          className="icon-button collapse-button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Kenar çubuğunu genişlet" : "Kenar çubuğunu daralt"}
          title={collapsed ? "Genişlet" : "Daralt"}
        >
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={18} />}
        </button>
        <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Menüyü kapat"><X size={20} /></button>
      </div>

      <nav className="sidebar-nav">
        <p className="nav-label">GENEL</p>
        <Link href="/projects" className={`nav-item ${pathname === "/projects" ? "active" : ""}`} title="Projeler">
          <FolderKanban size={19} /><span>Projeler</span>
        </Link>

        {/* Geliştirici Araçları Açılır Menüsü */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            className={`nav-item ${isDevToolsRoute ? "active" : ""}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingRight: "8px",
            }}
          >
            <Link
              href="/developer-tools"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "11px",
                flex: 1,
                color: "inherit",
                textDecoration: "none",
              }}
              onClick={() => setMobileOpen(false)}
              title="Geliştirici Araçları"
            >
              <Wrench size={19} />
              <span>Geliştirici Araçları</span>
            </Link>

            {!collapsed && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDevToolsOpen(!devToolsOpen);
                }}
                className="icon-button"
                style={{
                  width: "24px",
                  height: "24px",
                  display: "grid",
                  placeItems: "center",
                  color: "inherit",
                  opacity: 0.75,
                  padding: 0,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
                title={devToolsOpen ? "Daralt" : "Genişlet"}
                aria-label={devToolsOpen ? "Geliştirici Araçlarını Daralt" : "Geliştirici Araçlarını Genişlet"}
              >
                <ChevronDown
                  size={15}
                  style={{
                    transform: devToolsOpen ? "rotate(0deg)" : "rotate(-90deg)",
                    transition: "transform 0.18s ease",
                  }}
                />
              </button>
            )}
          </div>

          {/* Açılır Alt Menü */}
          {devToolsOpen && !collapsed && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                paddingLeft: "18px",
                marginTop: "2px",
                marginBottom: "4px",
                borderLeft: "2px solid rgba(99, 102, 241, 0.15)",
                marginLeft: "18px",
              }}
            >
              <Link
                href="/growth-archive"
                className={`nav-item ${pathname === "/growth-archive" ? "active" : ""}`}
                style={{ minHeight: "36px", fontSize: "13px", padding: "6px 10px", gap: "9px" }}
                onClick={() => setMobileOpen(false)}
                title="Büyüme & Strateji Arşivi"
              >
                <Sparkles size={16} />
                <span>Büyüme Arşivi</span>
              </Link>

              <Link
                href="/meeting"
                className={`nav-item ${pathname === "/meeting" ? "active" : ""}`}
                style={{ minHeight: "36px", fontSize: "13px", padding: "6px 10px", gap: "9px" }}
                onClick={() => setMobileOpen(false)}
                title="Toplantı Asistanı"
              >
                <Video size={16} />
                <span>Toplantı Asistanı</span>
              </Link>

              <Link
                href="/teklif"
                className={`nav-item ${pathname === "/teklif" ? "active" : ""}`}
                style={{ minHeight: "36px", fontSize: "13px", padding: "6px 10px", gap: "9px" }}
                onClick={() => setMobileOpen(false)}
                title="Teklif Aracı"
              >
                <FileText size={16} />
                <span>Teklif Aracı</span>
              </Link>

              <Link
                href="/instagram-growth"
                className={`nav-item ${pathname === "/instagram-growth" ? "active" : ""}`}
                style={{ minHeight: "36px", fontSize: "13px", padding: "6px 10px", gap: "9px" }}
                onClick={() => setMobileOpen(false)}
                title="Instagram Growth"
              >
                <TrendingUp size={16} />
                <span>Instagram Growth</span>
              </Link>
            </div>
          )}
        </div>

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
        <Link href="/settings" className={`nav-item ${pathname === "/settings" ? "active" : ""}`} title="Sistem Ayarları"><Settings size={19} /><span>Sistem Ayarları</span></Link>
        <div className="profile-chip" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="avatar">OG</div>
            {!collapsed && <div><strong>Oğuz G.</strong><span>Yönetici</span></div>}
          </div>
          {!collapsed && (
            <button
              type="button"
              onClick={handleLogout}
              className="icon-button"
              title="Çıkış Yap"
              style={{ color: "#94a3b8", width: "28px", height: "28px" }}
              aria-label="Çıkış Yap"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""} ${assistantOpen ? "assistant-open" : ""}`}>
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

            {/* Hızlı İçerik Önerileri Butonu */}
            {projectId && (
              <button
                type="button"
                className={`icon-button queue-button ${totalIdeasCount > 0 ? "has-active-jobs" : ""}`}
                style={totalIdeasCount > 0 ? { borderColor: "#f0abfc", background: "#fdf4ff", color: "#c026d3" } : {}}
                onClick={() => setIdeasDrawerOpen(true)}
                title={totalIdeasCount > 0 ? `Hızlı İçerik Önerileri (${totalIdeasCount} öneri)` : "Hızlı İçerik Önerileri"}
                aria-label="Hızlı içerik önerilerini aç"
              >
                <Compass size={19} />
                {totalIdeasCount > 0 ? (
                  <span className="queue-indicator active" style={{ background: "#c026d3" }}>{totalIdeasCount}</span>
                ) : (
                  <span className="queue-indicator" />
                )}
              </button>
            )}

            {/* Üretim Listesi & Kuyruk Butonu */}
            {projectId && (
              <button
                type="button"
                className={`icon-button queue-button ${activeQueueCount > 0 ? "has-active-jobs" : ""}`}
                onClick={() => setQueueDrawerOpen(true)}
                title={activeQueueCount > 0 ? `Üretim Listesi (${activeQueueCount} sırada)` : "Üretim Listesi"}
                aria-label="Üretim listesini aç"
              >
                <Layers size={19} />
                {activeQueueCount > 0 ? (
                  <span className="queue-indicator active">{activeQueueCount}</span>
                ) : (
                  <span className="queue-indicator" />
                )}
              </button>
            )}

            <button
              type="button"
              className={`icon-button queue-button ${assistantOpen ? "has-active-jobs" : ""}`}
              style={assistantOpen ? { borderColor: "#6d5dfc", background: "#f3f0ff", color: "#6d5dfc" } : {}}
              onClick={() => setAssistantOpen((prev) => !prev)}
              title="AI Sistem Asistanı (Hermes)"
              aria-label="AI sistem asistanını aç/kapat"
            >
              <Bot size={19} />
            </button>

            {/* Canlı Görüşme (Hands-free Voice Call) */}
            <Link
              href="/call"
              className="icon-button queue-button"
              style={{ color: "#22c55e", borderColor: "rgba(34, 197, 94, 0.4)", background: "rgba(34, 197, 94, 0.08)" }}
              title="Hermes Canlı Sesli Arama (Hands-free)"
              aria-label="Hermes ile canlı konuş"
            >
              <PhoneCall size={18} />
            </Link>

            <button className="icon-button notification-button"><Bell size={19} /><span /></button>
          </div>
        </header>
        <main className="content-area">{children}</main>
      </div>

      {/* Right Docked AI System Assistant (Shrinks Page Width) */}
      <AiAssistantDrawer
        projectId={projectId}
        isOpen={assistantOpen}
        onClose={() => setAssistantOpen(false)}
      />

      {/* Slide-over Production Queue Drawer */}
      <ProductionQueueDrawer
        projectId={projectId}
        isOpen={queueDrawerOpen}
        onClose={() => setQueueDrawerOpen(false)}
        onActiveCountChange={(count) => setActiveQueueCount(count)}
      />

      {/* Slide-over Quick Ideas Drawer */}
      <QuickIdeasDrawer
        projectId={projectId}
        isOpen={ideasDrawerOpen}
        onClose={() => setIdeasDrawerOpen(false)}
        onTotalCountChange={(count) => setTotalIdeasCount(count)}
      />
    </div>
  );
}
