"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Player } from "@remotion/player";
import {
  BookmarkCheck,
  Check,
  Clapperboard,
  Download,
  Film,
  FolderOpen,
  FolderSync,
  KeyRound,
  Layers,
  LoaderCircle,
  Music,
  Play,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  Type,
  Video,
  Volume2,
  X,
} from "lucide-react";
import { useProjects } from "@/features/projects/projects-context";
import { StockFramedVideo, type StockFrameStyle } from "@/remotion/StockFramedVideo";
import { DriveSettingsModal } from "./drive-settings-modal";
import { OutroLibraryModal } from "./outro-library-modal";
import { StockAccordionSection } from "./stock-accordion-section";
import type { DriveConfig, OutroItem } from "./types";

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

  // Drive and editor dialogs
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [driveModalTab, setDriveModalTab] = useState<"accounts" | "folders">("folders");
  const [driveAccountLabel, setDriveAccountLabel] = useState("Drive hesabı");
  const [outroModalOpen, setOutroModalOpen] = useState(false);
  const [openCustomizerSection, setOpenCustomizerSection] = useState("frame");

  const brandColor = project?.brand.primaryColor || "#6d5dfc";
  const brandLogo = project?.brand.logo || "";

  const loadData = useCallback(async () => {
    try {
      const [stockRes, vidRes, settingsRes, driveRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/stock-videos`, { cache: "no-store" }),
        fetch(`/api/videos?projectId=${projectId}`, { cache: "no-store" }),
        fetch(`/api/projects/${projectId}/stock-videos/settings`, { cache: "no-store" }),
        fetch(`/api/projects/${projectId}/stock-videos/drive-accounts`, { cache: "no-store" }),
      ]);

      if (stockRes.ok) {
        const stockData = await stockRes.json();
        setVideos(stockData.videos || []);
        setConfig(stockData.config);
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

      if (driveRes.ok) {
        const driveData = await driveRes.json();
        const selected = (driveData.accounts || []).find(
          (account: { selectedForProject?: boolean }) => account.selectedForProject,
        );
        setDriveAccountLabel(selected?.label || driveData.systemAccount?.displayName || "Drive hesabı");
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
      setOutroModalOpen(true);
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

  async function openDriveSettings(tab: "accounts" | "folders" = "folders") {
    setDriveModalTab(tab);
    setDriveModalOpen(true);
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
              {driveAccountLabel}
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
                <StockAccordionSection
                  id="frame"
                  title="Çerçeve"
                  summary={frameStyles.find((style) => style.id === frameStyle)?.name || "Düzen seçin"}
                  icon={<Layers size={15} />}
                  openSection={openCustomizerSection}
                  onToggle={(id) => setOpenCustomizerSection((current) => current === id ? "" : id)}
                >
                  <div className="frame-style-grid-2x2">
                    {frameStyles.map((style) => (
                      <button type="button" key={style.id} className={`frame-style-btn-compact ${frameStyle === style.id ? "selected" : ""}`} onClick={() => setFrameStyle(style.id)}>
                        <span className="frame-style-btn-text"><strong>{style.name}</strong><small>{style.desc}</small></span>
                        {frameStyle === style.id && <Check size={13} />}
                      </button>
                    ))}
                  </div>
                </StockAccordionSection>

                <StockAccordionSection
                  id="text"
                  title="Metin ve renkler"
                  summary={headline.trim() || "Başlık eklenmedi"}
                  icon={<Type size={15} />}
                  openSection={openCustomizerSection}
                  onToggle={(id) => setOpenCustomizerSection((current) => current === id ? "" : id)}
                >
                  <input type="text" className="custom-input" placeholder="Kanca başlık" value={headline} onChange={(event) => setHeadline(event.target.value)} />
                  <input type="text" className="custom-input" placeholder="Alt başlık" value={subtitle} onChange={(event) => setSubtitle(event.target.value)} />
                  <div className="stock-color-grid">
                    <div className="stock-color-item"><small>Başlık</small><input type="color" value={headlineColor.startsWith("#") ? headlineColor : "#ffffff"} onChange={(event) => setHeadlineColor(event.target.value)} /></div>
                    <div className="stock-color-item"><small>Alt metin</small><input type="color" value={subtitleColor.startsWith("#") ? subtitleColor : "#cbd5e1"} onChange={(event) => setSubtitleColor(event.target.value)} /></div>
                  </div>
                  <div className="stock-color-presets wide">
                    {[
                      { label: "Koyu cam", value: "rgba(10, 12, 20, 0.82)" },
                      { label: "Siyah", value: "#000000" },
                      { label: "Marka", value: brandColor },
                      { label: "Şeffaf", value: "transparent" },
                    ].map((item) => <button type="button" key={item.label} className={`stock-bg-chip ${headlineBgColor === item.value ? "active" : ""}`} onClick={() => setHeadlineBgColor(item.value)}>{item.label}</button>)}
                  </div>
                </StockAccordionSection>

                <StockAccordionSection
                  id="logo"
                  title="Logo"
                  summary={logoPosition === "none" ? "Gizli" : `${logoPosition === "top_right" ? "Sağ üst" : logoPosition === "top_left" ? "Sol üst" : "Alt merkez"} · ${logoSize}px`}
                  icon={<Sparkles size={15} />}
                  openSection={openCustomizerSection}
                  onToggle={(id) => setOpenCustomizerSection((current) => current === id ? "" : id)}
                >
                  <div className="segmented-grid">
                    {[{ id: "top_right", label: "Sağ Üst" }, { id: "top_left", label: "Sol Üst" }, { id: "bottom_center", label: "Alt Merkez" }, { id: "none", label: "Gizle" }].map((position) => (
                      <button type="button" key={position.id} className={logoPosition === position.id ? "active" : ""} onClick={() => setLogoPosition(position.id as typeof logoPosition)}>{position.label}</button>
                    ))}
                  </div>
                  {logoPosition !== "none" && <div className="slider-item"><small>Logo genişliği: {logoSize}px</small><input type="range" min="60" max="240" step="5" value={logoSize} onChange={(event) => setLogoSize(Number(event.target.value))} /></div>}
                </StockAccordionSection>

                <StockAccordionSection
                  id="audio"
                  title="Ses"
                  summary={`Video %${Math.round(originalVolume * 100)} · Müzik ${musicTrack === "none" ? "Kapalı" : `%${Math.round(musicVolume * 100)}`}`}
                  icon={<Music size={15} />}
                  openSection={openCustomizerSection}
                  onToggle={(id) => setOpenCustomizerSection((current) => current === id ? "" : id)}
                >
                  <div className="audio-select-row">
                    <button type="button" className={`audio-option-btn ${musicTrack !== "none" ? "active" : ""}`} onClick={() => setMusicTrack("/audio/ambient_track.mp3")}><Volume2 size={13} /> Ambient</button>
                    <button type="button" className={`audio-option-btn ${musicTrack === "none" ? "active" : ""}`} onClick={() => setMusicTrack("none")}><X size={13} /> Müzik yok</button>
                  </div>
                  <div className="slider-row">
                    <div className="slider-item"><small>Video sesi %{Math.round(originalVolume * 100)}</small><input type="range" min="0" max="1" step="0.05" value={originalVolume} onChange={(event) => setOriginalVolume(Number(event.target.value))} /></div>
                    {musicTrack !== "none" && <div className="slider-item"><small>Müzik %{Math.round(musicVolume * 100)}</small><input type="range" min="0" max="1" step="0.05" value={musicVolume} onChange={(event) => setMusicVolume(Number(event.target.value))} /></div>}
                  </div>
                </StockAccordionSection>

                <StockAccordionSection
                  id="outro"
                  title="Outro"
                  summary={outros.find((outro) => outro.id === selectedOutroId)?.title || "Outro kullanılmıyor"}
                  icon={<Film size={15} />}
                  openSection={openCustomizerSection}
                  onToggle={(id) => setOpenCustomizerSection((current) => current === id ? "" : id)}
                >
                  <div className="selected-outro-summary">
                    <span><strong>{outros.find((outro) => outro.id === selectedOutroId)?.title || "Outro yok"}</strong><small>{selectedOutroId ? "Video sonunda oynatılacak" : "Video ana içerikten sonra bitecek"}</small></span>
                    <button type="button" className="button secondary" onClick={() => setOutroModalOpen(true)}>Seç / Yönet</button>
                  </div>
                </StockAccordionSection>

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

      {driveModalOpen && (
        <DriveSettingsModal
          projectId={projectId}
          config={config}
          initialTab={driveModalTab}
          onClose={() => setDriveModalOpen(false)}
          onConfigured={async (message: string, syncAfterSave?: boolean) => {
            setFeedback(message);
            await loadData();
            if (syncAfterSave) setTimeout(() => void handleSync(), 100);
          }}
        />
      )}

      {outroModalOpen && (
        <OutroLibraryModal
          outros={outros}
          selectedOutroId={selectedOutroId}
          uploading={uploadingOutro}
          onSelect={setSelectedOutroId}
          onUpload={handleUploadOutro}
          onDelete={(id) => void handleDeleteOutro(id)}
          onClose={() => setOutroModalOpen(false)}
        />
      )}
    </div>
  );
}
