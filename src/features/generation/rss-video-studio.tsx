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
  const [generatingSceneImages, setGeneratingSceneImages] = useState<Record<number, boolean>>({});
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
        // Arka planda üretilen sahne görsellerini canlı olarak sağ önizleme kutusuna yansıt
        const activeSb = data.activeJob.request?.storyboard as RssStoryboard | undefined;
        if (activeSb?.scenes?.length) {
          setStoryboard((prev) => {
            if (!prev) return null;
            // Ekranda farklı bir senaryo varsa (kullanıcı yeni bir konu araştırdıysa veya taslak hazırlıyorsa)
            // aktif işin senaryosuyla ekrandaki yeni senaryoyu ezme!
            if (prev.title && activeSb.title && prev.title !== activeSb.title) {
              return prev;
            }
            let changed = false;
            const mergedScenes = prev.scenes.map((sc, idx) => {
              const incomingUrl = activeSb.scenes?.[idx]?.previewImageUrl;
              if (incomingUrl && incomingUrl !== sc.previewImageUrl) {
                changed = true;
                return { ...sc, previewImageUrl: incomingUrl };
              }
              return sc;
            });
            return changed ? { ...prev, scenes: mergedScenes } : prev;
          });
        }
      } else {
        if (prevActiveJobIdRef.current) {
          prevActiveJobIdRef.current = null;
          void loadVideos();
        }
        setActiveJob(null);

        const jobs = Array.isArray(data.jobs) ? data.jobs : [];
        const latestJob = jobs[0];
        if (latestJob?.request?.storyboard?.scenes?.length) {
          const latestSb = latestJob.request.storyboard as RssStoryboard;
          setStoryboard((prev) => {
            if (!prev) return null;
            if (prev.title !== latestSb.title || prev.scenes.length !== latestSb.scenes.length) {
              return prev;
            }
            let changed = false;
            const mergedScenes = prev.scenes.map((sc, idx) => {
              const incomingUrl = latestSb.scenes?.[idx]?.previewImageUrl;
              if (incomingUrl && incomingUrl !== sc.previewImageUrl) {
                changed = true;
                return { ...sc, previewImageUrl: incomingUrl };
              }
              return sc;
            });
            return changed ? { ...prev, scenes: mergedScenes } : prev;
          });
        }
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

    if (isRevision) {
      setRevising(true);
    } else {
      setPlanning(true);
      setStoryboard(null);
      setGeneratingSceneImages({});
    }

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

  function handleDeleteScene(sceneIndex: number) {
    if (!storyboard || storyboard.scenes.length <= 2) return;
    const filtered = storyboard.scenes
      .filter((_, idx) => idx !== sceneIndex)
      .map((sc, idx) => ({ ...sc, sceneIndex: idx + 1 }));
    const totalDurationSeconds = filtered.reduce((acc, s) => acc + (s.durationSeconds || 5), 0);
    setStoryboard({
      ...storyboard,
      scenes: filtered,
      totalDurationSeconds,
    });
    setMessage(`Sahne ${sceneIndex + 1} senaryodan çıkarıldı (${filtered.length} sahne kaldı).`);
  }

  async function handleGenerateSceneImage(sceneIndex: number): Promise<boolean> {
    if (!storyboard || !storyboard.scenes[sceneIndex]) return false;
    if (generatingSceneImages[sceneIndex]) return false;

    const targetScene = storyboard.scenes[sceneIndex];
    setGeneratingSceneImages((prev) => ({ ...prev, [sceneIndex]: true }));
    setMessage(`Sahne ${sceneIndex + 1} görseli CliProxy ile üretiliyor...`);

    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/rss-videos/scene-image`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sceneIndex: sceneIndex + 1,
            promptEn: targetScene.promptEn,
            aspectRatio: storyboard.aspectRatio || aspectRatio,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.ok || !data.imageUrl) {
        throw new Error(data.message || "Sahne görseli üretilemedi.");
      }

      setStoryboard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          scenes: prev.scenes.map((sc, idx) =>
            idx === sceneIndex ? { ...sc, previewImageUrl: data.imageUrl } : sc
          ),
        };
      });
      setMessage(`Sahne ${sceneIndex + 1} görseli hazır.`);
      return true;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Sahne görseli üretilemedi.");
      return false;
    } finally {
      setGeneratingSceneImages((prev) => ({ ...prev, [sceneIndex]: false }));
    }
  }

  async function handleGenerateAllSceneImages() {
    if (!storyboard || !storyboard.scenes.length) return;
    const total = storyboard.scenes.length;
    setMessage(`Sahne görselleri kontrollü eşzamanlılıkla (2'şerli grup) üretiliyor (0/${total})...`);

    const indices = storyboard.scenes.map((_, i) => i);
    const concurrency = 2;
    let cursor = 0;
    let completedCount = 0;

    async function worker() {
      while (cursor < indices.length) {
        const idx = indices[cursor++];
        const ok = await handleGenerateSceneImage(idx);
        if (ok) completedCount++;
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(concurrency, indices.length) }, () => worker())
    );

    if (completedCount === total) {
      setMessage(
        `Tüm sahne görselleri (${completedCount}/${total}) başarıyla üretildi! Sağ önizleme alanından inceleyebilirsiniz.`
      );
    } else {
      setMessage(
        `${completedCount}/${total} sahne görseli üretildi. Eksik kalan sahneleri tekil olarak yeniden üretebilirsiniz.`
      );
    }
  }

  function handleClearStoryboard() {
    setStoryboard(null);
    setTopicOrText("");
    setSourceUrl("");
    setRevisionNote("");
    setGeneratingSceneImages({});
    setMessage("Yeni video üretimi için senaryo ve konu temizlendi.");
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
    <div className="rss-studio-root">
      <div className={`generation-studio rss-studio-grid ${isControlsCollapsed ? "is-collapsed" : ""}`}>
        {/* SOL PANEL: TEMEL AYARLAR */}
        {isControlsCollapsed ? (
          <aside className="rss-collapsed-rail">
            <button
              type="button"
              onClick={() => setIsControlsCollapsed(false)}
              className="rss-rail-expand-btn"
              title="Ayarlar Panelini Aç"
            >
              <PanelLeftOpen size={18} />
            </button>
            <span className="rss-rail-vertical-label">TEMEL AYARLAR</span>
          </aside>
        ) : (
          <section className="generation-controls">
            <div className="generation-control-header">
              <div>
                <span>AI GÖRSEL • GEMINI 2.0 TTS • FFMPEG KURGU</span>
                <h2>RSS &amp; Konu Videosu</h2>
              </div>
              <div className="rss-header-actions">
                <button
                  type="button"
                  onClick={() => setIsControlsCollapsed(true)}
                  className="rss-collapse-btn"
                  title="Sol Paneli Daralt"
                >
                  <PanelLeftClose size={18} />
                </button>
                <Rss size={20} />
              </div>
            </div>

            <div className="brand-concept-status">
              <span className="rss-concept-badge">
                <Sparkles size={13} />
              </span>
              <div className="rss-concept-copy">
                <strong>visual-skills Yönetmen &amp; Animatic Motoru</strong>
                <small>
                  CliProxy derinlikli görselleri, Gemini 2.0 TTS ve FFmpeg xfade/ASS altyazı ile
                  birleştirilir.
                </small>
              </div>
            </div>

            {/* Aktif Üretim veya Hata Durum Kartı */}
            {activeJob && (
              <div className="rss-job-banner active">
                <div className="rss-job-banner-top">
                  <span className="rss-job-banner-title">
                    <LoaderCircle className="spin" size={14} />
                    <span>Üretim Devam Ediyor (%{activeJob.progress?.percent || 10})</span>
                  </span>
                </div>
                <progress
                  className="rss-job-progress-bar"
                  max={100}
                  value={Math.min(100, Math.max(5, activeJob.progress?.percent || 10))}
                />
                <small className="rss-job-detail">
                  {activeJob.progress?.detail || "FIFO sırasından işleniyor..."}
                </small>
              </div>
            )}

            {lastErrorJob && (
              <div className="rss-job-banner error">
                <div className="rss-job-banner-top">
                  <span className="rss-job-banner-title">
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
                    className="rss-job-dismiss-btn"
                  >
                    <X size={14} />
                  </button>
                </div>
                <small className="rss-job-error-text">{lastErrorJob.error}</small>
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
          onDeleteScene={handleDeleteScene}
          generatingSceneImages={generatingSceneImages}
          onGenerateSceneImage={(idx) => void handleGenerateSceneImage(idx)}
          onGenerateAllSceneImages={() => void handleGenerateAllSceneImages()}
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
