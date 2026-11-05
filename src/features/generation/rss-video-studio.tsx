"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Rss,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  LoaderCircle,
  AlertTriangle,
  X,
} from "lucide-react";
import {
  RSS_NARRATIVE_STYLES,
  type RssNarrativeStyleKey,
  type RssVisualMoodKey,
  type RssTargetDuration,
  type RssAspectRatio,
  type GeminiTtsVoice,
  type RssVoiceSpeed,
  type RssVoiceEmotion,
  type RssCaptionStyle,
  type RssCaptionColor,
  type RssMusicMood,
  type RssMusicDucking,
  type RssStoryboard,
  type RssScenePlan,
  type RssSourceItem,
  type RssFeedArticle,
  type RssActiveJob,
  type RssRenderedVideo,
} from "./rss-video/types";
import { RssBriefForm } from "./rss-video/components/rss-brief-form";
import { RssStoryboardDeck } from "./rss-video/components/rss-storyboard-deck";
import { RssVideoGallery } from "./rss-video/components/rss-video-gallery";

export function RssVideoStudio({ projectId }: { projectId: string }) {
  // Sol Panel Temel Ayarları
  const [narrativeStyle, setNarrativeStyle] = useState<RssNarrativeStyleKey>("news_bulletin");
  const [visualMood, setVisualMood] = useState<RssVisualMoodKey>("cinematic_photoreal");
  const [targetDuration, setTargetDuration] = useState<RssTargetDuration>("30s");
  const [aspectRatio, setAspectRatio] = useState<RssAspectRatio>("9:16");

  // Ses, Altyazı & Fon Müziği Ayarları
  const [voiceActor, setVoiceActor] = useState<GeminiTtsVoice>("Fenrir");
  const [voiceSpeed, setVoiceSpeed] = useState<RssVoiceSpeed>(1.0);
  const [voiceEmotion, setVoiceEmotion] = useState<RssVoiceEmotion | "auto">("auto");
  const [captionStyle, setCaptionStyle] = useState<RssCaptionStyle>("tiktok_pop");
  const [captionColor, setCaptionColor] = useState<RssCaptionColor>("yellow");
  const [includeMusic, setIncludeMusic] = useState(true);
  const [musicMood, setMusicMood] = useState<RssMusicMood>("dynamic_news");
  const [musicDucking, setMusicDucking] = useState<RssMusicDucking>("-18dB");

  // Sağ Panel Araştırma & Senaryo State'leri
  const [sourceMode, setSourceMode] = useState<"rss" | "url" | "prompt">("prompt");
  const [topicOrText, setTopicOrText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [rssSources, setRssSources] = useState<RssSourceItem[]>([]);
  const [rssArticles, setRssArticles] = useState<RssFeedArticle[]>([]);
  const [storyboard, setStoryboard] = useState<RssStoryboard | null>(null);
  const [revisionNote, setRevisionNote] = useState("");
  const [message, setMessage] = useState("");
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);

  // İşlem Durumları
  const [loadingRss, setLoadingRss] = useState(false);
  const [scrapingUrl, setScrapingUrl] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [revising, setRevising] = useState(false);
  const [enqueueing, setEnqueueing] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Kuyruk & Galeri
  const [activeJob, setActiveJob] = useState<RssActiveJob | null>(null);
  const [lastErrorJob, setLastErrorJob] = useState<{
    id: string;
    title: string;
    error: string;
  } | null>(null);
  const [videos, setVideos] = useState<RssRenderedVideo[]>([]);

  const dismissedErrorIdRef = useRef<string | null>(null);
  useEffect(() => {
    try {
      dismissedErrorIdRef.current = localStorage.getItem(`rss_video_dismissed_err_${projectId}`);
    } catch {}
  }, [projectId]);

  // LocalStorage State Geri Yükleme
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`rss_video_form_${projectId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.narrativeStyle) setNarrativeStyle(parsed.narrativeStyle);
        if (parsed.visualMood) setVisualMood(parsed.visualMood);
        if (parsed.targetDuration) setTargetDuration(parsed.targetDuration);
        if (parsed.aspectRatio) setAspectRatio(parsed.aspectRatio);
        if (parsed.voiceActor) setVoiceActor(parsed.voiceActor);
        if (parsed.topicOrText) setTopicOrText(parsed.topicOrText);
        if (parsed.sourceUrl) setSourceUrl(parsed.sourceUrl);
        if (parsed.sourceMode) setSourceMode(parsed.sourceMode);
        if (parsed.storyboard) setStoryboard(parsed.storyboard);
      }
    } catch {}
  }, [projectId]);

  // LocalStorage State Kaydetme
  useEffect(() => {
    try {
      localStorage.setItem(
        `rss_video_form_${projectId}`,
        JSON.stringify({
          narrativeStyle,
          visualMood,
          targetDuration,
          aspectRatio,
          voiceActor,
          sourceMode,
          topicOrText,
          sourceUrl,
          storyboard,
        })
      );
    } catch {}
  }, [
    projectId,
    narrativeStyle,
    visualMood,
    targetDuration,
    aspectRatio,
    voiceActor,
    sourceMode,
    topicOrText,
    sourceUrl,
    storyboard,
  ]);

  // Anlatım Stili Değiştiğinde Önerilen Gemini TTS Aktörünü Otomatik Eşle
  function handleSelectNarrativeStyle(styleKey: RssNarrativeStyleKey) {
    setNarrativeStyle(styleKey);
    const meta = RSS_NARRATIVE_STYLES.find((s) => s.key === styleKey);
    if (meta) {
      setVoiceActor(meta.defaultVoiceActor);
      if (styleKey === "fairy_tale") {
        setVisualMood("stylized_3d");
        setMusicMood("acoustic_warm");
      } else if (styleKey === "news_bulletin") {
        setVisualMood("cinematic_photoreal");
        setMusicMood("dynamic_news");
      } else if (styleKey === "info_documentary") {
        setVisualMood("documentary_nature");
        setMusicMood("cinematic_ambient");
      } else if (styleKey === "mystery_curiosity") {
        setVisualMood("moody_chiaroscuro");
        setMusicMood("cinematic_ambient");
      }
    }
  }

  // RSS Kaynaklarını Yükle
  const loadRssSources = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/rss-videos/sources`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (data.ok && Array.isArray(data.sources)) {
        setRssSources(data.sources);
      }
    } catch {}
  }, [projectId]);

  useEffect(() => {
    void loadRssSources();
  }, [loadRssSources]);

  // RSS Haberlerini Çek ve Skorla
  async function handleFetchRssFeeds(sourceId?: string) {
    setLoadingRss(true);
    setMessage("RSS kaynakları taranıyor ve içerikler 0-100 arasında skorlanıyor...");
    try {
      const query = sourceId ? `?fetch=1&sourceId=${encodeURIComponent(sourceId)}` : "?fetch=1";
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/rss-videos/sources${query}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "RSS haberleri çekilemedi.");
      }
      setRssSources(data.sources || []);
      setRssArticles(data.articles || []);
      setMessage(
        `${(data.articles || []).length} güncel haber çekildi ve puanlandı. Listeden bir habere tıklayarak seçebilirsiniz.`
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "RSS taraması başarısız.");
    } finally {
      setLoadingRss(false);
    }
  }

  async function handleAddRssSource(name: string, url: string, category: string) {
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/rss-videos/sources`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add_source", name, url, category }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "RSS kaynağı eklenemedi.");
      }
      setRssSources(data.sources || []);
      setMessage(`"${name}" RSS kaynaklarına eklendi.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Kaynak eklenemedi.");
    }
  }

  async function handleDeleteRssSource(id: string) {
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/rss-videos/sources?id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.ok && Array.isArray(data.sources)) {
        setRssSources(data.sources);
      }
    } catch {}
  }

  async function handleScrapeUrlPreview() {
    if (!sourceUrl.trim()) return;
    setScrapingUrl(true);
    setMessage("Makale içeriği bağlantısından çekiliyor...");
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/rss-videos/sources`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "scrape_url", url: sourceUrl.trim() }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.ok || !data.article) {
        throw new Error(data.message || "Makale metni çekilemedi.");
      }
      setTopicOrText(`${data.article.title}\n\n${data.article.text}`);
      setMessage(`Makale başarıyla çekildi: "${data.article.title}"`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "URL içeriği çekilemedi.");
    } finally {
      setScrapingUrl(false);
    }
  }

  function handleSelectRssArticle(article: RssFeedArticle) {
    setSourceUrl(article.url);
    setTopicOrText(`${article.title}\n\n${article.summary}`);
    setMessage(
      `"${article.title}" (${article.score} Puan) seçildi. İster senaryoyu oluşturup gözden geçirin, ister tek tıkla videoyu üretin.`
    );
  }

  // Üretilen RSS Videolarını Yükle (Tam İzole: yalnızca v.isRssVideo === true)
  const loadVideos = useCallback(async () => {
    setLoadingVideos(true);
    try {
      const res = await fetch(`/api/videos?projectId=${encodeURIComponent(projectId)}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        ok: boolean;
        videos?: Array<RssRenderedVideo & { isRssVideo?: boolean }>;
      };
      if (data.ok && Array.isArray(data.videos)) {
        setVideos(data.videos.filter((v) => v.isRssVideo === true));
      }
    } catch {
      // ignore
    } finally {
      setLoadingVideos(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadVideos();
  }, [loadVideos]);

  // Aktif İşleri Sorgula
  const prevActiveJobIdRef = useRef<string | null>(null);
  const pollActiveJobs = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/rss-videos`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.activeJob) {
        prevActiveJobIdRef.current = data.activeJob.id;
        setActiveJob(data.activeJob);
        setLastErrorJob(null);
      } else {
        if (prevActiveJobIdRef.current) {
          prevActiveJobIdRef.current = null;
          void loadVideos();
        }
        setActiveJob(null);

        const jobs = Array.isArray(data.jobs) ? data.jobs : [];
        const latestJob = jobs[0];
        if (
          latestJob &&
          latestJob.status === "failed" &&
          latestJob.id !== dismissedErrorIdRef.current
        ) {
          setLastErrorJob({
            id: latestJob.id,
            title: latestJob.request?.title || latestJob.prompt || "RSS Video Üretimi",
            error: latestJob.error || "Bilinmeyen üretim hatası.",
          });
        } else {
          setLastErrorJob(null);
        }
      }
    } catch {}
  }, [projectId, loadVideos]);

  useEffect(() => {
    void pollActiveJobs();
    const timer = setInterval(() => {
      void pollActiveJobs();
    }, 4000);
    return () => clearInterval(timer);
  }, [pollActiveJobs]);

  // 1. Araştır & Senaryo Oluştur (Gözden Geçirme Modu)
  async function handleGenerateStoryboard(isRevision = false) {
    if (!isRevision && !topicOrText.trim() && !sourceUrl.trim()) {
      setMessage("Lütfen bir konu yazın, URL yapıştırın veya RSS havuzundan haber seçin.");
      return;
    }
    if (isRevision && !revisionNote.trim()) {
      setMessage("Lütfen revizyon notunuzu yazın.");
      return;
    }

    if (isRevision) setRevising(true);
    else setPlanning(true);

    setMessage(
      isRevision
        ? "Senaryo geri bildiriminize göre yeniden kurgulanıyor..."
        : "İçerik araştırılıyor ve seçilen anlatım stiline göre sahne planı hazırlanıyor..."
    );

    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/rss-videos/storyboard`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceMode,
            topicOrText: topicOrText.trim(),
            sourceUrl: sourceUrl.trim() || undefined,
            narrativeStyle,
            visualMood,
            targetDuration,
            aspectRatio,
            revisionFeedback: isRevision ? revisionNote.trim() : undefined,
            currentStoryboard: isRevision ? storyboard : undefined,
          }),
        }
      );
      const body = await res.json();
      if (!res.ok || !body.ok || !body.storyboard) {
        throw new Error(body.message || "Senaryo oluşturulamadı.");
      }

      setStoryboard(body.storyboard);
      if (body.scrapedArticle && !topicOrText.trim()) {
        setTopicOrText(`${body.scrapedArticle.title}\n\n${body.scrapedArticle.text}`);
      }
      if (isRevision) setRevisionNote("");
      setMessage(
        `Senaryo hazır: ${body.storyboard.scenes.length} sahne (${body.storyboard.totalDurationSeconds} sn). Sahneleri inceleyip "Videoyu Üret" butonuna tıklayabilirsiniz.`
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Senaryo planlanırken hata oluştu.");
    } finally {
      setPlanning(false);
      setRevising(false);
    }
  }

  // 2. Tek Tıkla Direkt Video Üret
  async function handleOneClickProduce() {
    if (!topicOrText.trim() && !sourceUrl.trim() && !storyboard) {
      setMessage("Tek tıkla üretim için önce bir konu, RSS haberi veya makale URL'si girin.");
      return;
    }

    setEnqueueing(true);
    setMessage(
      "Tek tıkla üretim başlatıldı: Senaryo hazırlanıp doğrudan merkezi FIFO üretim kuyruğuna ekleniyor..."
    );

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/rss-videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oneClick: true,
          sourceMode,
          topicOrText: topicOrText.trim(),
          sourceUrl: sourceUrl.trim() || undefined,
          narrativeStyle,
          visualMood,
          targetDuration,
          aspectRatio,
          storyboard: storyboard || undefined,
          audioSettings: {
            voiceActor,
            voiceSpeed,
            voiceEmotion,
            captionStyle,
            captionColor,
            includeMusic,
            musicMood,
            musicDucking,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        throw new Error(body.message || "Kuyruğa eklenemedi.");
      }
      if (body.storyboard) {
        setStoryboard(body.storyboard);
      }
      setMessage(
        "RSS Video üretimi FIFO kuyruğuna eklendi! Sağ üstteki Üretim Kuyruğu çekmecesinden canlı takip edebilirsiniz."
      );
      window.dispatchEvent(
        new CustomEvent("production-queue-updated", { detail: { openDrawer: true } })
      );
      void pollActiveJobs();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Tek tıkla üretim başlatılamadı.");
    } finally {
      setEnqueueing(false);
    }
  }

  // Gözden Geçirilmiş Senaryoyu Onayla ve Kuyruğa Ekle
  async function handleConfirmAndEnqueue() {
    if (!storyboard || !storyboard.scenes.length) {
      setMessage("Önce senaryoyu oluşturun.");
      return;
    }

    setEnqueueing(true);
    setMessage("Onaylanan senaryo merkezi FIFO üretim sırasına ekleniyor...");

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/rss-videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oneClick: false,
          sourceMode,
          topicOrText: topicOrText.trim(),
          sourceUrl: sourceUrl.trim() || undefined,
          narrativeStyle,
          visualMood,
          targetDuration,
          aspectRatio,
          storyboard,
          audioSettings: {
            voiceActor,
            voiceSpeed,
            voiceEmotion,
            captionStyle,
            captionColor,
            includeMusic,
            musicMood,
            musicDucking,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        throw new Error(body.message || "Kuyruğa eklenemedi.");
      }
      setMessage(
        "RSS Video üretim sırasına eklendi! Sağ üstteki Üretim Kuyruğu çekmecesinden canlı takip edebilirsiniz."
      );
      window.dispatchEvent(
        new CustomEvent("production-queue-updated", { detail: { openDrawer: true } })
      );
      void pollActiveJobs();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Sıraya eklenirken hata oluştu.");
    } finally {
      setEnqueueing(false);
    }
  }

  function handleUpdateScene(sceneIndex: number, updates: Partial<RssScenePlan>) {
    if (!storyboard) return;
    const nextScenes = storyboard.scenes.map((sc, idx) =>
      idx === sceneIndex ? { ...sc, ...updates } : sc
    );
    const totalDurationSeconds = nextScenes.reduce((acc, s) => acc + (s.durationSeconds || 5), 0);
    setStoryboard({
      ...storyboard,
      scenes: nextScenes,
      totalDurationSeconds,
    });
  }

  function handleClearStoryboard() {
    setStoryboard(null);
    setRevisionNote("");
    setMessage("Senaryo taslağı temizlendi.");
    try {
      localStorage.removeItem(`rss_video_form_${projectId}`);
    } catch {}
  }

  function handleEditVideo(video: RssRenderedVideo) {
    if (!video.storyboard) {
      setMessage("Bu videonun senaryo detayı bulunamadı.");
      return;
    }
    setStoryboard(video.storyboard);
    if (video.storyboard.narrativeStyle) setNarrativeStyle(video.storyboard.narrativeStyle);
    if (video.storyboard.visualMood) setVisualMood(video.storyboard.visualMood);
    if (video.storyboard.aspectRatio) setAspectRatio(video.storyboard.aspectRatio);
    setMessage(`"${video.title || "RSS Video"}" senaryosu düzenleme tuvaline yüklendi.`);
    try {
      window.scrollTo({ top: 120, behavior: "smooth" });
    } catch {}
  }

  async function handleDeleteVideo(id: string) {
    if (!window.confirm("Bu videoyu kalıcı olarak silmek istediğinize emin misiniz?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
      if (res.ok) {
        setVideos((prev) => prev.filter((v) => v.id !== id));
      }
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
      <div
        className="generation-studio"
        style={{
          display: "grid",
          gridTemplateColumns: isControlsCollapsed ? "48px 1fr" : "380px 1fr",
          gap: "20px",
          transition: "grid-template-columns 0.2s ease",
        }}
      >
        {/* SOL PANEL: TEMEL AYARLAR */}
        {isControlsCollapsed ? (
          <aside
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "12px 6px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <button
              type="button"
              onClick={() => setIsControlsCollapsed(false)}
              style={{
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                padding: "8px",
                cursor: "pointer",
                color: "#334155",
              }}
              title="Ayarlar Panelini Aç"
            >
              <PanelLeftOpen size={18} />
            </button>
            <span
              style={{
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
                fontSize: "11px",
                fontWeight: 700,
                color: "#64748b",
                letterSpacing: "1px",
              }}
            >
              TEMEL AYARLAR
            </span>
          </aside>
        ) : (
          <section className="generation-controls">
            <div className="generation-control-header">
              <div>
                <span>AI GÖRSEL • GEMINI 2.0 TTS • FFMPEG KURGU</span>
                <h2>RSS &amp; Konu Videosu</h2>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => setIsControlsCollapsed(true)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: "4px",
                  }}
                  title="Sol Paneli Daralt"
                >
                  <PanelLeftClose size={18} />
                </button>
                <Rss size={20} color="#6366f1" />
              </div>
            </div>

            <div className="brand-concept-status">
              <span style={{ background: "#4f46e5" }}>
                <Sparkles size={13} />
              </span>
              <div style={{ flex: 1 }}>
                <strong>visual-skills Yönetmen &amp; Animatic Motoru</strong>
                <small>
                  CliProxy derinlikli görselleri, Gemini 2.0 TTS ve FFmpeg xfade/ASS altyazı ile
                  birleştirilir.
                </small>
              </div>
            </div>

            {/* Aktif Üretim veya Hata Durum Kartı */}
            {activeJob && (
              <div
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  background: "#eef2ff",
                  border: "1px solid #c7d2fe",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#3730a3",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <LoaderCircle className="spin" size={14} />
                    <span>Üretim Devam Ediyor (%{activeJob.progress?.percent || 10})</span>
                  </span>
                </div>
                <div
                  style={{
                    height: "6px",
                    borderRadius: "99px",
                    background: "#e0e7ff",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(5, activeJob.progress?.percent || 10))}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #4f46e5, #7c3aed)",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                <small style={{ fontSize: "11px", color: "#4338ca" }}>
                  {activeJob.progress?.detail || "FIFO sırasından işleniyor..."}
                </small>
              </div>
            )}

            {lastErrorJob && (
              <div
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#b91c1c",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <AlertTriangle size={14} />
                    <span>Üretim Başarısız Oldu</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      dismissedErrorIdRef.current = lastErrorJob.id;
                      try {
                        localStorage.setItem(
                          `rss_video_dismissed_err_${projectId}`,
                          lastErrorJob.id
                        );
                      } catch {}
                      setLastErrorJob(null);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#991b1b",
                      cursor: "pointer",
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
                <small style={{ fontSize: "11.5px", color: "#7f1d1d", lineHeight: 1.4 }}>
                  {lastErrorJob.error}
                </small>
              </div>
            )}

            <RssBriefForm
              narrativeStyle={narrativeStyle}
              onSelectNarrativeStyle={handleSelectNarrativeStyle}
              visualMood={visualMood}
              setVisualMood={setVisualMood}
              targetDuration={targetDuration}
              setTargetDuration={setTargetDuration}
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              voiceActor={voiceActor}
              setVoiceActor={setVoiceActor}
              voiceSpeed={voiceSpeed}
              setVoiceSpeed={setVoiceSpeed}
              voiceEmotion={voiceEmotion}
              setVoiceEmotion={setVoiceEmotion}
              captionStyle={captionStyle}
              setCaptionStyle={setCaptionStyle}
              captionColor={captionColor}
              setCaptionColor={setCaptionColor}
              includeMusic={includeMusic}
              setIncludeMusic={setIncludeMusic}
              musicMood={musicMood}
              setMusicMood={setMusicMood}
              musicDucking={musicDucking}
              setMusicDucking={setMusicDucking}
            />
          </section>
        )}

        {/* SAĞ PANEL: ARAŞTIRMA & SENARYO TUVALİ */}
        <RssStoryboardDeck
          sourceMode={sourceMode}
          setSourceMode={setSourceMode}
          topicOrText={topicOrText}
          setTopicOrText={setTopicOrText}
          sourceUrl={sourceUrl}
          setSourceUrl={setSourceUrl}
          rssSources={rssSources}
          rssArticles={rssArticles}
          loadingRss={loadingRss}
          scrapingUrl={scrapingUrl}
          planning={planning}
          revising={revising}
          enqueueing={enqueueing}
          message={message}
          storyboard={storyboard}
          revisionNote={revisionNote}
          setRevisionNote={setRevisionNote}
          onFetchRssFeeds={(sourceId) => void handleFetchRssFeeds(sourceId)}
          onAddRssSource={handleAddRssSource}
          onDeleteRssSource={handleDeleteRssSource}
          onScrapeUrlPreview={handleScrapeUrlPreview}
          onSelectRssArticle={handleSelectRssArticle}
          onGenerateStoryboard={(rev) => void handleGenerateStoryboard(rev)}
          onOneClickProduce={() => void handleOneClickProduce()}
          onConfirmAndEnqueue={() => void handleConfirmAndEnqueue()}
          onClearStoryboard={handleClearStoryboard}
          onUpdateScene={handleUpdateScene}
        />
      </div>

      {/* ALT BÖLÜM: ÜRETİLEN RSS VİDEOLARI GALERİSİ */}
      <RssVideoGallery
        projectId={projectId}
        videos={videos}
        loadingVideos={loadingVideos}
        deletingId={deletingId}
        onRefresh={() => void loadVideos()}
        onEditVideo={handleEditVideo}
        onDeleteVideo={(id) => void handleDeleteVideo(id)}
      />
    </div>
  );
}
