"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Player } from "@remotion/player";
import {
  Check,
  Clapperboard,
  Download,
  Film,
  FolderSync,
  Layers,
  LoaderCircle,
  Music,
  Play,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Type,
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
  folderId: string;
  folderName: string;
  lastSyncedAt: string | null;
  syncStatus: string;
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
    name: "Modern Blur Kenarlık",
    desc: "Yatay/kare videoyu arka plan bulanıklığıyla 9:16 Reels formatına dönüştürür",
  },
  {
    id: "modern_card",
    name: "Şık Kart & Vurgu",
    desc: "Yumuşak köşeli, zarif marka çerçeveli ve gölgeli vitrin düzeni",
  },
  {
    id: "split_screen",
    name: "Bölünmüş Ekran (Header/Footer)",
    desc: "Üstte kanca başlık alanı, ortada video, altta marka alanı",
  },
  {
    id: "minimal_glow",
    name: "Minimalist Işıltı",
    desc: "Tam ekran video üzerine ince parlak marka çerçevesi",
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

  // Render & action states
  const [rendering, setRendering] = useState(false);
  const [lastRendered, setLastRendered] = useState<RenderedItem | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Folder management
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [availableFolders, setAvailableFolders] = useState<{ id: string; name: string }[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);

  const brandColor = project?.brand.primaryColor || "#6d5dfc";
  const brandLogo = project?.brand.logo || "";

  const loadData = useCallback(async () => {
    try {
      const [stockRes, vidRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/stock-videos`, { cache: "no-store" }),
        fetch(`/api/videos?projectId=${projectId}`, { cache: "no-store" }),
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
    } catch {
      setFeedback("Stok videolar yüklenirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedVideoId]);

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

  // Open folder selector modal
  async function openFolderPicker() {
    setFolderModalOpen(true);
    setLoadingFolders(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/stock-videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_folders" }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setAvailableFolders(data.folders || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingFolders(false);
    }
  }

  // Choose a folder from Drive
  async function selectFolder(folderId: string, folderName: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/stock-videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_folder", folderId, folderName }),
      });
      if (res.ok) {
        setConfig((prev) => ({
          folderId,
          folderName,
          lastSyncedAt: prev?.lastSyncedAt || null,
          syncStatus: "idle",
        }));
        setFolderModalOpen(false);
        // Trigger auto sync for new folder
        setTimeout(() => handleSync(), 100);
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
          <button
            type="button"
            className="button secondary"
            onClick={openFolderPicker}
            title="Drive Klasörünü Seç"
          >
            <FolderSync size={15} />
            <span>
              {config?.folderName ? `Klasör: ${config.folderName}` : "Drive Klasörü Seç"}
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
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")}>
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
                <div className="stock-video-grid">
                  {filteredVideos.map((item) => {
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
                      <strong>{rv.title || `Render-${rv.id.slice(0, 8)}`}</strong>
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
            <div>
              <h3>
                <Sparkles size={16} /> Video Özelleştirme &amp; Çerçeve
              </h3>
              <p>Reels/Story formatına uygun çerçeve, logo, başlık ve müzik miksajı.</p>
            </div>
            {selectedVideo && (
              <span className="stock-badge-selected">
                {selectedVideo.name.slice(0, 22)}...
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
                      musicSrc: musicTrack !== "none" ? musicTrack : undefined,
                      originalVolume,
                      musicVolume: musicTrack !== "none" ? musicVolume : 0,
                    }}
                    durationInFrames={Math.min((selectedVideo.durationSeconds || 15) * 30, 450)}
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
                  <span>Canlı Önizleme</span>
                </div>
              </div>

              {/* Editor Controls */}
              <div className="customizer-controls">
                {/* 1. Frame Style */}
                <div className="editor-group">
                  <label className="editor-label">
                    <Layers size={14} /> Çerçeve Stili
                  </label>
                  <div className="frame-style-picker">
                    {frameStyles.map((fs) => (
                      <button
                        type="button"
                        key={fs.id}
                        className={`frame-style-btn ${frameStyle === fs.id ? "selected" : ""}`}
                        onClick={() => setFrameStyle(fs.id)}
                      >
                        <div>
                          <strong>{fs.name}</strong>
                          <small>{fs.desc}</small>
                        </div>
                        {frameStyle === fs.id && <Check size={14} />}
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
                    {rendering ? "Video Render Ediliyor..." : "Özel Çerçeveli Videoyu Üret"}
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

      {/* Drive Folder Selection Modal */}
      {folderModalOpen && (
        <div className="modal-backdrop">
          <div className="surface-modal folder-modal">
            <div className="modal-header">
              <h3>Google Drive Klasör Seçimi</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setFolderModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <p className="modal-desc">
              Stok videolarınızın taranacağı Google Drive klasörünü belirleyin:
            </p>

            <div className="folder-list">
              {loadingFolders ? (
                <div className="overview-loading">Klasörler getiriliyor...</div>
              ) : availableFolders.length === 0 ? (
                <p>Google Drive hesabınızda klasör bulunamadı.</p>
              ) : (
                availableFolders.map((f) => (
                  <button
                    type="button"
                    key={f.id}
                    className={`folder-item-btn ${config?.folderId === f.id ? "active" : ""}`}
                    onClick={() => selectFolder(f.id, f.name)}
                  >
                    <FolderSync size={16} />
                    <span>{f.name}</span>
                    {config?.folderId === f.id && <Check size={14} />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
