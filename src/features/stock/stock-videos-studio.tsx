"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Player } from "@remotion/player";
import {
  BookmarkCheck,
  Check,
  ChevronRight,
  Clapperboard,
  Download,
  Film,
  Folder,
  FolderOpen,
  FolderSync,
  HardDrive,
  KeyRound,
  Layers,
  LoaderCircle,
  Music,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  Type,
  Upload,
  UserCheck,
  Video,
  Volume2,
  X,
} from "lucide-react";
import { useProjects } from "@/features/projects/projects-context";
import { StockFramedVideo, type StockFrameStyle } from "@/remotion/StockFramedVideo";

type StockVideoItem = {
  id: string;
  driveFileId: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  thumbnailUrl?: string;
  durationSeconds: number;
  width: number;
  height: number;
  hasCache: boolean;
  streamUrl: string;
  createdAt: string;
};

type DriveConfig = {
  accountId?: string;
  folderId: string;
  folderName: string;
  rootFolderId?: string;
  rootFolderName?: string;
  includeSubfolders?: boolean;
  lastSyncedAt: string | null;
  syncStatus: string;
};

type DriveAccount = {
  id: string;
  label: string;
  email: string;
  displayName: string;
  photoLink?: string;
  isActive: boolean;
  createdAt: string;
};

type FolderTreeNode = {
  id: string;
  name: string;
  isExpanded?: boolean;
  children?: FolderTreeNode[];
  loading?: boolean;
};

type RenderedItem = {
  id: string;
  url: string;
  title?: string;
  durationSeconds?: number;
  createdAt: string;
};

const frameStyles: { id: StockFrameStyle; name: string; desc: string }[] = [
  {
    id: "blur_padding",
    name: "Modern Blur",
    desc: "Bulanık Zemin",
  },
  {
    id: "modern_card",
    name: "Şık Kart",
    desc: "Kavisli Kenarlık",
  },
  {
    id: "split_screen",
    name: "Bölünmüş",
    desc: "Üst/Alt Başlık",
  },
  {
    id: "minimal_glow",
    name: "Minimal Işıltı",
    desc: "İnce Parlak",
  },
];

type OutroItem = {
  id: string;
  title: string;
  videoUrl: string;
  durationSeconds?: number;
  createdAt?: string;
};

export function StockVideosStudio({ projectId }: { projectId: string }) {
  const { getProject } = useProjects();
  const project = getProject(projectId);

  const [videos, setVideos] = useState<StockVideoItem[]>([]);
  const [renderedVideos, setRenderedVideos] = useState<RenderedItem[]>([]);
  const [config, setConfig] = useState<DriveConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"library" | "rendered">("library");

  // Selected video for customizer
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");

  // Pagination for stock videos
  const PAGE_SIZE = 12;
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Editor states
  const [frameStyle, setFrameStyle] = useState<StockFrameStyle>("blur_padding");
  const [headline, setHeadline] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [headlineColor, setHeadlineColor] = useState("#ffffff");
  const [subtitleColor, setSubtitleColor] = useState("#cbd5e1");
  const [headlineBgColor, setHeadlineBgColor] = useState("rgba(10, 12, 20, 0.82)");
  const [logoPosition, setLogoPosition] = useState<
    "top_left" | "top_right" | "bottom_left" | "bottom_right" | "bottom_center" | "none"
  >("top_right");
  const [logoSize, setLogoSize] = useState<number>(130);
  const [musicTrack, setMusicTrack] = useState<string>("/audio/ambient_track.mp3");
  const [originalVolume, setOriginalVolume] = useState<number>(1);
  const [musicVolume, setMusicVolume] = useState<number>(0.4);

  // Outro states
  const [outros, setOutros] = useState<OutroItem[]>([]);
  const [selectedOutroId, setSelectedOutroId] = useState<string>("");
  const [uploadingOutro, setUploadingOutro] = useState(false);

  // Settings persistence
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedNotice, setSettingsSavedNotice] = useState(false);

  // Render & action states
  const [rendering, setRendering] = useState(false);
  const [lastRendered, setLastRendered] = useState<RenderedItem | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Drive Settings & Accounts Modal
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [driveModalTab, setDriveModalTab] = useState<"accounts" | "folders">("folders");
  const [accounts, setAccounts] = useState<DriveAccount[]>([]);
  const [systemAccount, setSystemAccount] = useState<{ email: string; displayName: string; photoLink?: string } | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [newAccountLabel, setNewAccountLabel] = useState("");
  const [newAccountTokenJson, setNewAccountTokenJson] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountActionNotice, setAccountActionNotice] = useState<string | null>(null);

  // Hierarchical Folder Tree
  const [folderTree, setFolderTree] = useState<FolderTreeNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [includeSubfolders, setIncludeSubfolders] = useState(true);

  const brandColor = project?.brand.primaryColor || "#6d5dfc";
  const brandLogo = project?.brand.logo || "";

  const loadData = useCallback(async () => {
    try {
      const [stockRes, vidRes, settingsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/stock-videos`, { cache: "no-store" }),
        fetch(`/api/videos?projectId=${projectId}`, { cache: "no-store" }),
        fetch(`/api/projects/${projectId}/stock-videos/settings`, { cache: "no-store" }),
      ]);

      if (stockRes.ok) {
        const stockData = await stockRes.json();
        setVideos(stockData.videos || []);
        setConfig(stockData.config);
        if (stockData.config?.includeSubfolders !== undefined) {
          setIncludeSubfolders(stockData.config.includeSubfolders);
        }
        if (stockData.videos?.length > 0 && !selectedVideoId) {
          setSelectedVideoId(stockData.videos[0].id);
        }
      }

      if (vidRes.ok) {
        const vidData = await vidRes.json();
        setRenderedVideos(vidData.videos || []);
      }

      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        if (sData.outros) setOutros(sData.outros);
        if (sData.settings) {
          const s = sData.settings;
          if (s.frameStyle) setFrameStyle(s.frameStyle);
          if (s.headlineColor) setHeadlineColor(s.headlineColor);
          if (s.subtitleColor) setSubtitleColor(s.subtitleColor);
          if (s.headlineBgColor) setHeadlineBgColor(s.headlineBgColor);
          if (s.logoPosition) setLogoPosition(s.logoPosition);
          if (typeof s.logoSize === "number") setLogoSize(s.logoSize);
          if (s.musicTrack) setMusicTrack(s.musicTrack);
          if (typeof s.originalVolume === "number") setOriginalVolume(s.originalVolume);
          if (typeof s.musicVolume === "number") setMusicVolume(s.musicVolume);
          if (s.selectedOutroId) setSelectedOutroId(s.selectedOutroId);
        }
      }
    } catch {
      setFeedback("Stok videolar ve ayarlar yüklenirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedVideoId]);

  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/stock-videos/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frameStyle,
          headlineColor,
          subtitleColor,
          headlineBgColor,
          logoPosition,
          logoSize,
          musicTrack,
          originalVolume,
          musicVolume,
          selectedOutroId,
        }),
      });
      if (res.ok) {
        setSettingsSavedNotice(true);
        setTimeout(() => setSettingsSavedNotice(false), 2500);
      }
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleUploadOutro(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingOutro(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(/\.[^/.]+$/, ""));

      const res = await fetch(`/api/projects/${projectId}/stock-videos/outros`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.outro) {
        throw new Error(data.message || "Outro videosu yüklenemedi.");
      }
      setOutros((prev) => [data.outro, ...prev]);
      setSelectedOutroId(data.outro.id);
      setFeedback("Yeni outro videosu başarıyla yüklendi ve seçildi.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadingOutro(false);
    }
  }

  async function handleDeleteOutro(id: string) {
    try {
      await fetch(`/api/projects/${projectId}/stock-videos/outros?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setOutros((prev) => prev.filter((o) => o.id !== id));
      if (selectedOutroId === id) setSelectedOutroId("");
    } catch {
      // ignore
    }
  }

  async function handleDeleteVideo(id: string) {
    if (!confirm("Bu üretilen videoyu silmek istediğinize emin misiniz?")) return;
    try {
      const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRenderedVideos((prev) => prev.filter((v) => v.id !== id));
        if (lastRendered?.id === id) setLastRendered(null);
        setFeedback("Video başarıyla silindi.");
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  // Selected video object
  const selectedVideo = useMemo(
    () => videos.find((v) => v.id === selectedVideoId) || videos[0] || null,
    [videos, selectedVideoId]
  );

  // Filtered videos
  const filteredVideos = useMemo(() => {
    if (!search.trim()) return videos;
    const term = search.toLowerCase();
    return videos.filter((v) => v.name.toLowerCase().includes(term));
  }, [videos, search]);

  const totalPages = Math.max(1, Math.ceil(filteredVideos.length / PAGE_SIZE));
  const paginatedVideos = useMemo(() => {
    return filteredVideos.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  }, [filteredVideos, currentPage, PAGE_SIZE]);

  // Sync with Google Drive
  async function handleSync() {
    setSyncing(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/stock-videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", folderId: config?.folderId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Senkronizasyon başarısız.");
      setFeedback(`${data.syncedCount || 0} adet stok video Google Drive'dan güncellendi.`);
      await loadData();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }

  // Load Accounts & Folders for Modal
  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/stock-videos/drive-accounts`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setAccounts(data.accounts || []);
        setSystemAccount(data.systemAccount || null);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAccounts(false);
    }
  }, [projectId]);

  const loadRootFolders = useCallback(async () => {
    setLoadingTree(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/stock-videos/drive-tree`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setFolderTree((data.folders || []).map((f: { id: string; name: string }) => ({ ...f, children: [] })));
      }
    } catch {
      // ignore
    } finally {
      setLoadingTree(false);
    }
  }, [projectId]);

  async function openDriveSettings(tab: "accounts" | "folders" = "folders") {
    setDriveModalTab(tab);
    setDriveModalOpen(true);
    loadAccounts();
    loadRootFolders();
  }

  // Expand / collapse folder node
  async function toggleFolderExpand(node: FolderTreeNode) {
    if (node.isExpanded) {
      setFolderTree((prev) => updateTreeNode(prev, node.id, { isExpanded: false }));
      return;
    }

    setFolderTree((prev) => updateTreeNode(prev, node.id, { loading: true }));
    try {
      const res = await fetch(`/api/projects/${projectId}/stock-videos/drive-tree?parentId=${encodeURIComponent(node.id)}`);
      const data = await res.json();
      const children: FolderTreeNode[] = (data.folders || []).map((f: { id: string; name: string }) => ({
        ...f,
        children: [],
      }));
      setFolderTree((prev) => updateTreeNode(prev, node.id, { isExpanded: true, loading: false, children }));
    } catch {
      setFolderTree((prev) => updateTreeNode(prev, node.id, { isExpanded: true, loading: false }));
    }
  }

  function updateTreeNode(nodes: FolderTreeNode[], id: string, patch: Partial<FolderTreeNode>): FolderTreeNode[] {
    return nodes.map((node) => {
      if (node.id === id) {
        return { ...node, ...patch };
      }
      if (node.children && node.children.length > 0) {
        return { ...node, children: updateTreeNode(node.children, id, patch) };
      }
      return node;
    });
  }

  // Select Root Folder
  async function handleSetRootFolder(folderId: string, folderName: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/stock-videos/drive-tree`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootFolderId: folderId,
          rootFolderName: folderName,
          includeSubfolders,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setConfig((prev) => ({
          ...prev!,
          folderId,
          folderName,
          rootFolderId: folderId,
          rootFolderName: folderName,
          includeSubfolders,
          lastSyncedAt: prev?.lastSyncedAt || null,
          syncStatus: "idle",
        }));
        setDriveModalOpen(false);
        setFeedback(`Ana dizin '${folderName}' olarak ayarlandı. Senkronizasyon başlatılıyor...`);
        setTimeout(() => handleSync(), 150);
      }
    } catch {
      setFeedback("Ana dizin belirlenirken bir sorun oluştu.");
    }
  }

  // Add new Google Account (Token JSON)
  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!newAccountTokenJson.trim()) return;

    setSavingAccount(true);
    setAccountActionNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/stock-videos/drive-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          label: newAccountLabel.trim(),
          tokenJson: newAccountTokenJson.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Hesap eklenemedi.");
      }

      setAccountActionNotice(data.message || "Hesap başarıyla eklendi.");
      setNewAccountLabel("");
      setNewAccountTokenJson("");
      await loadAccounts();
      await loadRootFolders();
    } catch (err) {
      setAccountActionNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingAccount(false);
    }
  }

  // Activate Account
  async function handleActivateAccount(accountId: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/stock-videos/drive-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate", accountId }),
      });
      if (res.ok) {
        await loadAccounts();
        await loadRootFolders();
        setFeedback("Drive hesabı değiştirildi. Klasör ağacı güncellendi.");
      }
    } catch {
      // ignore
    }
  }

  // Switch to System Account
  async function handleUseSystemAccount() {
    try {
      const res = await fetch(`/api/projects/${projectId}/stock-videos/drive-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "use_system" }),
      });
      if (res.ok) {
        await loadAccounts();
        await loadRootFolders();
        setFeedback("Sistem varsayılan Drive hesabına geçildi.");
      }
    } catch {
      // ignore
    }
  }

  // Delete Account
  async function handleDeleteAccount(accountId: string) {
    if (!confirm("Bu Drive hesabını bu projeden kaldırmak istediğinize emin misiniz?")) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/stock-videos/drive-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", accountId }),
      });
      if (res.ok) {
        await loadAccounts();
      }
    } catch {
      // ignore
    }
  }

  // Render framed video
  async function handleRender() {
    if (!selectedVideo) return;
    setRendering(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/stock-videos/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockVideoId: selectedVideo.id,
          frameStyle,
          headline: headline.trim(),
          subtitle: subtitle.trim(),
          headlineColor,
          subtitleColor,
          headlineBgColor,
          accentColor: brandColor,
          logoUrl: brandLogo,
          logoPosition,
          logoSize,
          outroId: selectedOutroId || undefined,
          musicTrack: musicTrack !== "none" ? musicTrack : undefined,
          originalVolume,
          musicVolume: musicTrack !== "none" ? musicVolume : 0,
          maxDurationSeconds: Math.min(selectedVideo.durationSeconds || 25, 30),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok || !data.video) {
        throw new Error(data.message || "Render işlemi tamamlanamadı.");
      }

      setLastRendered(data.video);
      setRenderedVideos((prev) => [data.video, ...prev]);
      setFeedback("Özel çerçeveli video başarıyla üretildi! Şimdi paylaşım planına ekleyebilirsiniz.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : String(err));
    } finally {
      setRendering(false);
    }
  }

  if (!project) return <div className="overview-loading" />;

  const activeAccount = accounts.find((a) => a.isActive);

  return (
    <div className="stock-studio-wrap">
      {/* Top Banner & Drive Sync Bar */}
      <header className="stock-header-card">
        <div className="stock-header-info">
          <div className="stock-header-badge">
            <Film size={20} />
          </div>
          <div>
            <h2>Stok İçerik Stüdyosu</h2>
            <p>
              Google Drive senkronize video arşivi, özel çerçeveler, logo ve sosyal medya paylaşım entegrasyonu.
            </p>
          </div>
        </div>

        <div className="stock-header-actions">
          {/* Drive Settings & Account Button */}
          <button
            type="button"
            className="button secondary"
            onClick={() => openDriveSettings("accounts")}
            title="Google Drive Hesap Ayarları"
          >
            <KeyRound size={15} />
            <span>
              {activeAccount ? activeAccount.label : systemAccount ? "Sistem Drive Hesabı" : "Drive Hesabı"}
            </span>
          </button>

          {/* Drive Folder & Root Selector Button */}
          <button
            type="button"
            className="button secondary"
            onClick={() => openDriveSettings("folders")}
            title="Ana Dizin ve Alt Klasörleri Belirle"
          >
            <FolderSync size={15} />
            <span>
              {config?.rootFolderName
                ? `Ana Dizin: ${config.rootFolderName}`
                : config?.folderName
                ? `Klasör: ${config.folderName}`
                : "Ana Dizin Belirle"}
            </span>
          </button>

          <button
            type="button"
            className="button primary"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}
            <span>{syncing ? "Senkronize Ediliyor..." : "Drive'ı Senkronize Et"}</span>
          </button>
        </div>
      </header>

      {/* Feedback notice */}
      {feedback && (
        <div className="generation-notice" style={{ margin: "14px 0" }}>
          <Sparkles size={15} />
          <span>{feedback}</span>
          <button
            type="button"
            className="icon-button"
            onClick={() => setFeedback(null)}
            style={{ marginLeft: "auto", width: 22, height: 22 }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Active Root Folder Banner */}
      {config?.rootFolderName && (
        <div className="stock-root-indicator-bar">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FolderOpen size={16} color="var(--primary)" />
            <span>
              Aktif Ana Dizin: <strong>{config.rootFolderName}</strong>
              {config.includeSubfolders !== false && <small> (Tüm alt dizinler taranıyor)</small>}
            </span>
          </div>
          <button
            type="button"
            className="text-btn"
            style={{ fontSize: "11px", color: "var(--primary)", cursor: "pointer", background: "none", border: "none" }}
            onClick={() => openDriveSettings("folders")}
          >
            Dizini Değiştir
          </button>
        </div>
      )}

      {/* Main Studio Columns */}
      <div className="stock-layout-grid">
        {/* Left Column: Gallery / Archive */}
        <section className="stock-archive-panel">
          <div className="stock-toolbar">
            <div className="segmented-filter">
              <button
                type="button"
                className={activeTab === "library" ? "active" : ""}
                onClick={() => setActiveTab("library")}
              >
                Stok Arşivi ({videos.length})
              </button>
              <button
                type="button"
                className={activeTab === "rendered" ? "active" : ""}
                onClick={() => setActiveTab("rendered")}
              >
                Üretilen Videolar ({renderedVideos.length})
              </button>
            </div>

            {activeTab === "library" && (
              <div className="stock-search-wrap">
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Videolarda ara..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setCurrentPage(1);
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Library Tab */}
          {activeTab === "library" && (
            <>
              {loading ? (
                <div className="history-empty">
                  <LoaderCircle className="spin" size={24} />
                  <span>Stok videolar taranıyor...</span>
                </div>
              ) : filteredVideos.length === 0 ? (
                <div className="history-empty">
                  <Film size={32} />
                  <span>Henüz senkronize edilmiş video bulunamadı.</span>
                  <button type="button" className="button secondary" onClick={handleSync}>
                    Drive&apos;dan Çek
                  </button>
                </div>
              ) : (
                <>
                  <div className="stock-video-grid">
                    {paginatedVideos.map((item) => {
                      const isSelected = selectedVideo?.id === item.id;
                      const mins = Math.floor(item.durationSeconds / 60);
                      const secs = item.durationSeconds % 60;
                      const durationLabel = `${mins > 0 ? `${mins}m ` : ""}${secs}s`;

                      return (
                        <article
                          key={item.id}
                          className={`stock-video-card ${isSelected ? "selected" : ""}`}
                          onClick={() => setSelectedVideoId(item.id)}
                        >
                          <div className="stock-thumb-wrap">
                            {item.thumbnailUrl ? (
                              <Image
                                src={item.thumbnailUrl}
                                alt={item.name}
                                fill
                                sizes="(max-width: 768px) 50vw, 240px"
                                unoptimized
                              />
                            ) : (
                              <div className="stock-thumb-fallback">
                                <Video size={28} />
                              </div>
                            )}
                            <span className="stock-duration-tag">{durationLabel}</span>
                            {isSelected && (
                              <span className="stock-selected-tag">
                                <Check size={12} />
                              </span>
                            )}
                          </div>

                          <div className="stock-card-content">
                            <strong title={item.name}>{item.name}</strong>
                            <div className="stock-card-meta">
                              <span>{item.width && item.height ? `${item.width}×${item.height}` : "HD"}</span>
                              <span>·</span>
                              <span>{item.sizeBytes ? `${(item.sizeBytes / (1024 * 1024)).toFixed(1)} MB` : ""}</span>
                            </div>

                            {/* Quick Actions */}
                            <div className="stock-card-actions">
                              {/* 1. Directly Share (Raw video) */}
                              <Link
                                href={`/projects/${projectId}/publishing?assetId=${item.id}`}
                                className="stock-btn-share"
                                title="Olduğu Gibi Paylaşım Planına Ekle"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Send size={12} />
                                <span>Doğrudan Paylaş</span>
                              </Link>

                              {/* 2. Customize & Edit */}
                              <button
                                type="button"
                                className={`stock-btn-edit ${isSelected ? "active" : ""}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedVideoId(item.id);
                                }}
                              >
                                <Sparkles size={12} />
                                <span>Özelleştir</span>
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {/* Pagination Bar */}
                  {totalPages > 1 && (
                    <div className="stock-pagination-bar">
                      <span className="stock-pagination-info">
                        Toplam {filteredVideos.length} videodan {(currentPage - 1) * PAGE_SIZE + 1} -{" "}
                        {Math.min(currentPage * PAGE_SIZE, filteredVideos.length)} arası
                      </span>
                      <div className="stock-pagination-btns">
                        <button
                          type="button"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className="button secondary"
                          style={{ height: "30px", fontSize: "11px", padding: "0 10px" }}
                        >
                          ‹ Önceki
                        </button>
                        <span className="stock-page-indicator">
                          {currentPage} / {totalPages}
                        </span>
                        <button
                          type="button"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className="button secondary"
                          style={{ height: "30px", fontSize: "11px", padding: "0 10px" }}
                        >
                          Sonraki ›
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Rendered Videos Tab */}
          {activeTab === "rendered" && (
            <div className="stock-video-grid">
              {renderedVideos.length === 0 ? (
                <div className="history-empty">
                  <Clapperboard size={32} />
                  <span>Henüz çerçeveli bir video üretilmedi.</span>
                </div>
              ) : (
                renderedVideos.map((rv) => (
                  <article key={rv.id} className="stock-video-card">
                    <div className="stock-thumb-wrap">
                      <video src={rv.url} preload="metadata" controls muted />
                    </div>
                    <div className="stock-card-content">
                      <strong title={rv.title || rv.id}>{rv.title || `Render-${rv.id.slice(0, 8)}`}</strong>
                      <div className="stock-card-actions">
                        <Link
                          href={`/projects/${projectId}/publishing?assetId=${rv.id}`}
                          className="stock-btn-share"
                        >
                          <Send size={12} />
                          <span>Planla</span>
                        </Link>
                        <a href={rv.url} download className="stock-btn-edit">
                          <Download size={12} />
                          <span>İndir</span>
                        </a>
                        <button
                          type="button"
                          className="stock-btn-del"
                          title="Videoyu Sil"
                          onClick={() => void handleDeleteVideo(rv.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}
        </section>

        {/* Right Column: Customizer & Live Remotion Preview */}
        <section className="stock-customizer-panel">
          <div className="customizer-heading">
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3>
                <Sparkles size={16} /> Video Özelleştirme &amp; Çerçeve
              </h3>
              <p>Reels/Story formatına uygun çerçeve, logo, başlık ve müzik miksajı.</p>
            </div>
            {selectedVideo && (
              <span className="stock-badge-selected" title={selectedVideo.name}>
                {selectedVideo.name}
              </span>
            )}
          </div>

          {selectedVideo ? (
            <div className="customizer-body">
              {/* Live Remotion Preview */}
              <div className="remotion-stage-wrap">
                <div className="remotion-player-box">
                  <Player
                    component={StockFramedVideo}
                    inputProps={{
                      videoSrc: selectedVideo.streamUrl,
                      frameStyle,
                      headline,
                      subtitle,
                      headlineColor,
                      subtitleColor,
                      headlineBgColor,
                      accentColor: brandColor,
                      logoSrc: brandLogo,
                      logoPosition,
                      logoSize,
                      outroSrc: outros.find((o) => o.id === selectedOutroId)?.videoUrl,
                      musicSrc: musicTrack !== "none" ? musicTrack : undefined,
                      originalVolume,
                      musicVolume: musicTrack !== "none" ? musicVolume : 0,
                    }}
                    durationInFrames={
                      Math.min((selectedVideo.durationSeconds || 15) * 30, 450) +
                      (selectedOutroId ? 90 : 0)
                    }
                    compositionWidth={1080}
                    compositionHeight={1920}
                    fps={30}
                    controls
                    loop
                    style={{ width: "100%", height: "100%" }}
                  />
                </div>
                <div className="remotion-meta-bar">
                  <span>9:16 Dikey Format</span>
                  <span>1080 × 1920</span>
                  <span>{selectedOutroId ? "Outro Ekli" : "Tek Sahne"}</span>
                </div>
              </div>

              {/* Editor Controls */}
              <div className="customizer-controls">
                {/* 1. Frame Style */}
                <div className="editor-group">
                  <label className="editor-label">
                    <Layers size={14} /> Çerçeve Düzeni
                  </label>
                  <div className="frame-style-grid-2x2">
                    {frameStyles.map((fs) => (
                      <button
                        type="button"
                        key={fs.id}
                        className={`frame-style-btn-compact ${frameStyle === fs.id ? "selected" : ""}`}
                        onClick={() => setFrameStyle(fs.id)}
                      >
                        <div className="frame-style-btn-text">
                          <strong>{fs.name}</strong>
                          <small>{fs.desc}</small>
                        </div>
                        {frameStyle === fs.id && <Check size={13} />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Text & Headline */}
                <div className="editor-group">
                  <label className="editor-label">
                    <Type size={14} /> Kanca Başlık &amp; Metin
                  </label>
                  <input
                    type="text"
                    className="custom-input"
                    placeholder="Örn: Doğanın Büyüleyici Dengesi (Kanca Başlık)"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                  />
                  <input
                    type="text"
                    className="custom-input"
                    placeholder="Örn: Detaylı bilgi almak için kaydırın (Alt başlık)"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    style={{ marginTop: 6 }}
                  />

                  {/* Text and Card Colors */}
                  <div className="stock-color-grid" style={{ marginTop: 10 }}>
                    <div className="stock-color-item">
                      <small>Başlık Rengi</small>
                      <div className="stock-color-picker-row">
                        <input
                          type="color"
                          value={headlineColor.startsWith("#") ? headlineColor : "#ffffff"}
                          onChange={(e) => setHeadlineColor(e.target.value)}
                        />
                        <div className="stock-color-presets">
                          {["#ffffff", "#facc15", "#38bdf8", "#4ade80"].map((c) => (
                            <button
                              key={c}
                              type="button"
                              style={{ backgroundColor: c }}
                              className={headlineColor === c ? "active" : ""}
                              onClick={() => setHeadlineColor(c)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="stock-color-item">
                      <small>Alt Metin Rengi</small>
                      <div className="stock-color-picker-row">
                        <input
                          type="color"
                          value={subtitleColor.startsWith("#") ? subtitleColor : "#cbd5e1"}
                          onChange={(e) => setSubtitleColor(e.target.value)}
                        />
                        <div className="stock-color-presets">
                          {["#cbd5e1", "#ffffff", "#fde047", "#f43f5e"].map((c) => (
                            <button
                              key={c}
                              type="button"
                              style={{ backgroundColor: c }}
                              className={subtitleColor === c ? "active" : ""}
                              onClick={() => setSubtitleColor(c)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="stock-color-item" style={{ gridColumn: "span 2" }}>
                      <small>Kart Arka Plan Rengi</small>
                      <div className="stock-color-picker-row">
                        <div className="stock-color-presets" style={{ width: "100%", gap: 6 }}>
                          {[
                            { label: "Koyu Cam", val: "rgba(10, 12, 20, 0.82)" },
                            { label: "Tam Siyah", val: "#000000" },
                            { label: "Marka Rengi", val: brandColor },
                            { label: "Şeffaf", val: "transparent" },
                          ].map((item) => (
                            <button
                              key={item.label}
                              type="button"
                              className={`stock-bg-chip ${headlineBgColor === item.val ? "active" : ""}`}
                              onClick={() => setHeadlineBgColor(item.val)}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Logo Placement */}
                <div className="editor-group">
                  <label className="editor-label">
                    <Sparkles size={14} /> Marka Logosu &amp; Ölçüsü
                  </label>
                  <div className="segmented-grid">
                    {[
                      { id: "top_right", label: "Sağ Üst" },
                      { id: "top_left", label: "Sol Üst" },
                      { id: "bottom_center", label: "Alt Merkez" },
                      { id: "none", label: "Gizle" },
                    ].map((pos) => (
                      <button
                        type="button"
                        key={pos.id}
                        className={logoPosition === pos.id ? "active" : ""}
                        onClick={() => setLogoPosition(pos.id as typeof logoPosition)}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>

                  {logoPosition !== "none" && (
                    <div className="slider-item" style={{ marginTop: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <small>Logo Genişliği: {logoSize}px</small>
                        <div className="stock-color-presets" style={{ gap: 4 }}>
                          {[
                            { label: "K", val: 90 },
                            { label: "O", val: 140 },
                            { label: "B", val: 200 },
                          ].map((s) => (
                            <button
                              key={s.label}
                              type="button"
                              className={`stock-size-chip ${logoSize === s.val ? "active" : ""}`}
                              onClick={() => setLogoSize(s.val)}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        type="range"
                        min="60"
                        max="240"
                        step="5"
                        value={logoSize}
                        onChange={(e) => setLogoSize(Number.parseInt(e.target.value, 10))}
                      />
                    </div>
                  )}
                </div>

                {/* 4. Audio & Music Mix */}
                <div className="editor-group">
                  <label className="editor-label">
                    <Music size={14} /> Arka Plan Müziği &amp; Ses Miksajı
                  </label>
                  <div className="audio-select-row">
                    <button
                      type="button"
                      className={`audio-option-btn ${musicTrack === "/audio/ambient_track.mp3" ? "active" : ""}`}
                      onClick={() => setMusicTrack("/audio/ambient_track.mp3")}
                    >
                      <Volume2 size={13} />
                      <span>Huzurlu &amp; Sakin (Ambient)</span>
                    </button>
                    <button
                      type="button"
                      className={`audio-option-btn ${musicTrack === "none" ? "active" : ""}`}
                      onClick={() => setMusicTrack("none")}
                    >
                      <X size={13} />
                      <span>Müzik Yok (Sadece Video Sesi)</span>
                    </button>
                  </div>

                  <div className="slider-row" style={{ marginTop: 10 }}>
                    <div className="slider-item">
                      <small>Orijinal Video Sesi: %{Math.round(originalVolume * 100)}</small>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={originalVolume}
                        onChange={(e) => setOriginalVolume(Number.parseFloat(e.target.value))}
                      />
                    </div>
                    {musicTrack !== "none" && (
                      <div className="slider-item">
                        <small>Müzik Sesi: %{Math.round(musicVolume * 100)}</small>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={musicVolume}
                          onChange={(e) => setMusicVolume(Number.parseFloat(e.target.value))}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Outro (Bitiş) Videosu */}
                <div className="editor-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label className="editor-label">
                      <Film size={14} /> Bitiş (Outro) Videosu
                    </label>
                    <label className="stock-upload-btn">
                      {uploadingOutro ? <LoaderCircle className="spin" size={12} /> : <Upload size={12} />}
                      <span>{uploadingOutro ? "Yükleniyor..." : "Outro Yükle"}</span>
                      <input
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm"
                        style={{ display: "none" }}
                        disabled={uploadingOutro}
                        onChange={handleUploadOutro}
                      />
                    </label>
                  </div>

                  <div className="outro-picker-grid">
                    <button
                      type="button"
                      className={`outro-card-btn ${!selectedOutroId ? "active" : ""}`}
                      onClick={() => setSelectedOutroId("")}
                    >
                      <span>Outro Yok</span>
                      {!selectedOutroId && <Check size={12} />}
                    </button>
                    {outros.map((o) => (
                      <div
                        key={o.id}
                        className={`outro-card-item ${selectedOutroId === o.id ? "active" : ""}`}
                        onClick={() => setSelectedOutroId(o.id)}
                      >
                        <span title={o.title}>{o.title}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {selectedOutroId === o.id && <Check size={12} style={{ color: "var(--primary)" }} />}
                          <button
                            type="button"
                            className="icon-button outro-del-btn"
                            title="Outro'yu Sil"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteOutro(o.id);
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Save settings for this brand */}
                <div className="stock-save-settings-bar">
                  <div>
                    <strong>Firma Ayarlarını Sabitle</strong>
                    <p>Çerçeve, renkler, logo ve outro ayarlarını bu marka için kaydet</p>
                  </div>
                  <button
                    type="button"
                    className="button secondary"
                    style={{ height: "32px", fontSize: "11px", padding: "0 10px" }}
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                  >
                    {savingSettings ? (
                      <LoaderCircle className="spin" size={13} />
                    ) : settingsSavedNotice ? (
                      <Check size={13} style={{ color: "#22c55e" }} />
                    ) : (
                      <BookmarkCheck size={13} />
                    )}
                    <span>{settingsSavedNotice ? "Kaydedildi" : "Ayarları Kaydet"}</span>
                  </button>
                </div>

                {/* Render Button */}
                <button
                  type="button"
                  className="button primary render-action-btn"
                  onClick={handleRender}
                  disabled={rendering}
                >
                  {rendering ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Play size={17} />
                  )}
                  <span>
                    {rendering
                      ? "Video Render Ediliyor..."
                      : selectedOutroId
                      ? "Çerçeveli Video + Outro Üret"
                      : "Özel Çerçeveli Videoyu Üret"}
                  </span>
                </button>

                {/* Last Rendered Success & Share Banner */}
                {lastRendered && (
                  <div className="rendered-success-box">
                    <div>
                      <Check size={16} />
                      <strong>Video başarıyla üretildi!</strong>
                    </div>
                    <div className="rendered-actions">
                      <Link
                        href={`/projects/${projectId}/publishing?assetId=${lastRendered.id}`}
                        className="button primary"
                      >
                        <Send size={14} />
                        <span>Paylaşım Planına Ekle</span>
                      </Link>
                      <a href={lastRendered.url} download className="button secondary">
                        <Download size={14} />
                        <span>İndir</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="customizer-empty">
              <Film size={40} />
              <p>Özelleştirmek için soldaki arşivden bir stok video seçin.</p>
            </div>
          )}
        </section>
      </div>

      {/* Drive Configuration Modal (Accounts & Root Folder) */}
      {driveModalOpen && (
        <div className="modal-backdrop">
          <div className="surface-modal drive-config-modal">
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Settings2 size={18} color="var(--primary)" />
                <h3>Google Drive Yapılandırması</h3>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setDriveModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="segmented-filter" style={{ margin: "12px 0 16px" }}>
              <button
                type="button"
                className={driveModalTab === "folders" ? "active" : ""}
                onClick={() => setDriveModalTab("folders")}
              >
                <FolderOpen size={13} style={{ marginRight: 6 }} />
                Ana Dizin &amp; Klasör Kapsamı
              </button>
              <button
                type="button"
                className={driveModalTab === "accounts" ? "active" : ""}
                onClick={() => setDriveModalTab("accounts")}
              >
                <HardDrive size={13} style={{ marginRight: 6 }} />
                Drive Hesapları ({accounts.length + (systemAccount ? 1 : 0)})
              </button>
            </div>

            {/* TAB 1: Ana Dizin ve Klasör Ağacı */}
            {driveModalTab === "folders" && (
              <div className="drive-tab-content">
                <p className="modal-desc">
                  Bu projede taranacak <strong>Ana Dizin</strong> klasörünü belirleyin. Sistem sadece seçtiğiniz bu ana dizin ve altındaki klasörlerdeki stok videoları projeye çeker.
                </p>

                <div className="subfolder-toggle-bar">
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "12px" }}>
                    <input
                      type="checkbox"
                      checked={includeSubfolders}
                      onChange={(e) => setIncludeSubfolders(e.target.checked)}
                      style={{ accentColor: "var(--primary)" }}
                    />
                    <span>Alt dizinlerdeki videoları da otomatik tara (Recursive)</span>
                  </label>
                </div>

                <div className="folder-tree-container">
                  {loadingTree ? (
                    <div className="overview-loading">Klasör ağacı taranıyor...</div>
                  ) : folderTree.length === 0 ? (
                    <div className="history-empty">
                      <Folder size={28} />
                      <span>Bağlı Drive hesabında klasör bulunamadı.</span>
                    </div>
                  ) : (
                    <div className="folder-tree-list">
                      {folderTree.map((node) => (
                        <FolderTreeItem
                          key={node.id}
                          node={node}
                          selectedId={config?.rootFolderId || config?.folderId}
                          onSelect={handleSetRootFolder}
                          onToggle={toggleFolderExpand}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Drive Hesapları & Token Yükleme */}
            {driveModalTab === "accounts" && (
              <div className="drive-tab-content">
                <p className="modal-desc">
                  Bu projeye özel bir Google Drive hesabı tanımlayabilir veya hesaplar arasında geçiş yapabilirsiniz:
                </p>

                {accountActionNotice && (
                  <div className="generation-notice" style={{ marginBottom: 12 }}>
                    <span>{accountActionNotice}</span>
                  </div>
                )}

                {/* Accounts list */}
                <div className="drive-accounts-list">
                  {/* System default account */}
                  {systemAccount && (
                    <div className={`drive-account-card ${!activeAccount ? "active" : ""}`}>
                      <div className="account-avatar-wrap">
                        {systemAccount.photoLink ? (
                          <img src={systemAccount.photoLink} alt="" />
                        ) : (
                          <HardDrive size={18} />
                        )}
                      </div>
                      <div className="account-meta">
                        <strong>{systemAccount.displayName || "Sistem Varsayılan Drive"}</strong>
                        <small>{systemAccount.email}</small>
                        {!activeAccount && <span className="account-badge-active">Aktif (Sistem)</span>}
                      </div>
                      {activeAccount && (
                        <button
                          type="button"
                          className="button secondary"
                          style={{ height: 30, fontSize: 11 }}
                          onClick={handleUseSystemAccount}
                        >
                          Bu Hesaba Geç
                        </button>
                      )}
                    </div>
                  )}

                  {/* Custom Project Accounts */}
                  {accounts.map((acc) => (
                    <div key={acc.id} className={`drive-account-card ${acc.isActive ? "active" : ""}`}>
                      <div className="account-avatar-wrap">
                        {acc.photoLink ? (
                          <img src={acc.photoLink} alt="" />
                        ) : (
                          <UserCheck size={18} />
                        )}
                      </div>
                      <div className="account-meta">
                        <strong>{acc.label}</strong>
                        <small>{acc.email || "Özel Hesap"}</small>
                        {acc.isActive && <span className="account-badge-active">Aktif</span>}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {!acc.isActive && (
                          <button
                            type="button"
                            className="button secondary"
                            style={{ height: 30, fontSize: 11 }}
                            onClick={() => handleActivateAccount(acc.id)}
                          >
                            Aktifleştir
                          </button>
                        )}
                        <button
                          type="button"
                          className="stock-btn-del"
                          title="Hesabı Kaldır"
                          onClick={() => handleDeleteAccount(acc.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add new account form */}
                <form onSubmit={handleAddAccount} className="add-drive-account-form">
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: "12px" }}>
                    <Plus size={14} color="var(--primary)" />
                    <span>Farklı Drive Hesabı Ekle (Token JSON)</span>
                  </div>
                  <input
                    type="text"
                    className="custom-input"
                    placeholder="Hesap Etiketi (Örn: Yedek Arşiv, Şirket Drive)"
                    value={newAccountLabel}
                    onChange={(e) => setNewAccountLabel(e.target.value)}
                  />
                  <textarea
                    className="custom-textarea"
                    rows={4}
                    placeholder='{"access_token": "...", "refresh_token": "...", "client_id": "...", "client_secret": "..."}'
                    value={newAccountTokenJson}
                    onChange={(e) => setNewAccountTokenJson(e.target.value)}
                    required
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="submit"
                      className="button primary"
                      style={{ height: 34, fontSize: 11 }}
                      disabled={savingAccount}
                    >
                      {savingAccount ? <LoaderCircle className="spin" size={13} /> : <Check size={13} />}
                      <span>Hesabı Doğrula ve Bağla</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Recursive Folder Tree Component
function FolderTreeItem({
  node,
  selectedId,
  onSelect,
  onToggle,
  level = 0,
}: {
  node: FolderTreeNode;
  selectedId?: string;
  onSelect: (id: string, name: string) => void;
  onToggle: (node: FolderTreeNode) => void;
  level?: number;
}) {
  const isSelected = selectedId === node.id;

  return (
    <div className="folder-tree-node-wrap">
      <div
        className={`folder-tree-row ${isSelected ? "selected" : ""}`}
        style={{ paddingLeft: `${level * 18 + 10}px` }}
      >
        <button
          type="button"
          className="folder-chevron-btn"
          onClick={() => onToggle(node)}
        >
          {node.loading ? (
            <LoaderCircle className="spin" size={13} />
          ) : (
            <ChevronRight
              size={14}
              style={{
                transform: node.isExpanded ? "rotate(90deg)" : "none",
                transition: "transform .15s ease",
              }}
            />
          )}
        </button>

        <div className="folder-tree-title" onClick={() => onToggle(node)}>
          {node.isExpanded ? <FolderOpen size={15} color="var(--primary)" /> : <Folder size={15} color="#7c819a" />}
          <span title={node.name}>{node.name}</span>
        </div>

        <button
          type="button"
          className={`folder-set-root-btn ${isSelected ? "active" : ""}`}
          onClick={() => onSelect(node.id, node.name)}
        >
          {isSelected ? <Check size={12} /> : null}
          <span>{isSelected ? "Ana Dizin" : "Ana Dizin Yap"}</span>
        </button>
      </div>

      {node.isExpanded && node.children && node.children.length > 0 && (
        <div className="folder-tree-children">
          {node.children.map((child) => (
            <FolderTreeItem
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onToggle={onToggle}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
