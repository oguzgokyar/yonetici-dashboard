"use client";

import { useCallback, useEffect, useState } from "react";
import { WandSparkles, Sparkles, Trash2, RefreshCw } from "lucide-react";
import { googleVidsFailureNotification } from "@/lib/google-vids-job-notification";

// Modüler Tipler ve Alt Bileşenler
import {
  VISUAL_MOOD_OPTIONS,
  type VisualMoodOption,
  type TargetDurationOption,
  type StoryboardResponse,
  type RenderedVideo,
  type PoolAccount,
  type ActiveJob,
} from "./google-vids/types";
import { VidsBriefForm } from "./google-vids/components/vids-brief-form";
import { VidsStoryboardDeck } from "./google-vids/components/vids-storyboard-deck";
import { VidsActiveJobBanner } from "./google-vids/components/vids-active-job-banner";
import { VidsVideoGallery } from "./google-vids/components/vids-video-gallery";

export function GoogleVidsStudio({ projectId }: { projectId: string }) {
  // Form Durumları
  const [topic, setTopic] = useState("");
  const [visualMood, setVisualMood] = useState<VisualMoodOption["key"]>("cinematic_photoreal");
  const [targetDuration, setTargetDuration] = useState<TargetDurationOption>("30s");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9" | "1:1">("9:16");
  const [narrativeMode, setNarrativeMode] = useState<"voiceover_only" | "dialogue_only" | "hybrid">("hybrid");
  const [includeMusic, setIncludeMusic] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState("auto");

  // Senaryo & İş Akışı
  const [storyboard, setStoryboard] = useState<StoryboardResponse | null>(null);
  const [revisionNote, setRevisionNote] = useState("");
  const [message, setMessage] = useState("");

  // Yükleme & İşlem Durumları
  const [planning, setPlanning] = useState(false);
  const [revising, setRevising] = useState(false);
  const [enqueueing, setEnqueueing] = useState(false);
  const [generatingAnchorImg, setGeneratingAnchorImg] = useState(false);
  const [rerollingIndex, setRerollingIndex] = useState<number | null>(null);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Havuz & Kuyruk
  const [accountsPool, setAccountsPool] = useState<PoolAccount[]>([]);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [dismissedErrorId, setDismissedErrorId] = useState<string | null>(null);
  const [lastErrorJob, setLastErrorJob] = useState<{
    id?: string;
    error?: string;
    title: string;
    message?: string;
  } | null>(null);
  const [videos, setVideos] = useState<RenderedVideo[]>([]);

  // LocalStorage Kalıcılığı & Sinematik Stüdyo Çakışma Filtresi
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(`google_vids_form_${projectId}`);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        if (parsed.topic && !topic) setTopic(parsed.topic);
        if (parsed.visualMood) setVisualMood(parsed.visualMood);
        if (parsed.targetDuration) setTargetDuration(parsed.targetDuration);
        if (parsed.aspectRatio) setAspectRatio(parsed.aspectRatio);
        if (parsed.narrativeMode) setNarrativeMode(parsed.narrativeMode);
        if (typeof parsed.includeMusic === "boolean") setIncludeMusic(parsed.includeMusic);

        // Sinematik Stüdyo'dan kalan eski taslakları tespit et ve otomatik temizle
        if (parsed.storyboard) {
          const isSinematik = Boolean(
            parsed.storyboard.origin === "sinematik_studio" ||
            parsed.storyboard.isSceneClip ||
            (parsed.storyboard.title &&
              (parsed.storyboard.title.includes("Klip:") ||
                parsed.storyboard.title.includes("Bölüm") ||
                parsed.storyboard.title.includes("Dizi") ||
                parsed.storyboard.title.includes("Karamurat")))
          );
          if (isSinematik) {
            localStorage.removeItem(`google_vids_form_${projectId}`);
          } else if (!storyboard) {
            setStoryboard(parsed.storyboard);
          }
        }
      }
    } catch {}

    function handlePrefill(e: Event) {
      const customEvent = e as CustomEvent<{ topic?: string }>;
      if (customEvent.detail?.topic) {
        setTopic(customEvent.detail.topic);
        setMessage("Seçilen içerik fikri video konusu olarak yüklendi.");
        try { window.scrollTo({ top: 100, behavior: "smooth" }); } catch {}
      }
    }
    window.addEventListener("google-vids-prefill", handlePrefill);
    return () => window.removeEventListener("google-vids-prefill", handlePrefill);
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Form Değişikliklerini LocalStorage'a Kaydet
  useEffect(() => {
    try {
      if (topic || storyboard) {
        const cleanStoryboard = storyboard?.isSceneClip ? undefined : storyboard;
        localStorage.setItem(
          `google_vids_form_${projectId}`,
          JSON.stringify({
            topic,
            visualMood,
            targetDuration,
            aspectRatio,
            narrativeMode,
            includeMusic,
            storyboard: cleanStoryboard,
          })
        );
      }
    } catch {}
  }, [projectId, topic, visualMood, targetDuration, aspectRatio, narrativeMode, includeMusic, storyboard]);

  // Aktif Google Vids İşlerini Sorgula (İzole Edilmiş & Hafifletilmiş Sorgu)
  const pollActiveJobs = useCallback(async () => {
    try {
      // origin=marka_motoru parametresi ile Sinematik Stüdyo dizi işleri filtrelenir
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/google-vids?origin=marka_motoru`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.accounts && Array.isArray(data.accounts)) {
          setAccountsPool(data.accounts as PoolAccount[]);
        }
        if (data.activeJob) {
          setActiveJob(data.activeJob);
          setLastErrorJob(null);
          // Yalnızca Marka Motoru'na ait aktif iş varsa ve ekranda senaryo boşsa geri yükle
          if (
            data.activeJob.request?.scenes &&
            !storyboard &&
            data.activeJob.request?.origin !== "sinematik_studio"
          ) {
            setStoryboard({
              title: data.activeJob.request.title || data.activeJob.prompt,
              narrativeTr: data.activeJob.request.narrativeTr || "",
              totalDurationSeconds: data.activeJob.request.durationSeconds || 30,
              visualMood: data.activeJob.request.visualMood || "cinematic_photoreal",
              aspectRatio: data.activeJob.request.aspectRatio || "9:16",
              characterAnchor: data.activeJob.request.characterAnchor,
              scenes: data.activeJob.request.scenes || [],
            });
            if (data.activeJob.request.topic) setTopic(data.activeJob.request.topic);
          }
        } else {
          setActiveJob(null);
          const failed = googleVidsFailureNotification(data.jobs || []);
          if (failed && failed.id !== dismissedErrorId) {
            setLastErrorJob(failed);
          } else if (!failed || (failed && failed.id === dismissedErrorId)) {
            setLastErrorJob(null);
          }
        }
      }
    } catch {}
  }, [projectId, storyboard]);

  useEffect(() => {
    void pollActiveJobs();
    const interval = setInterval(() => {
      void pollActiveJobs();
    }, 4000);
    return () => clearInterval(interval);
  }, [pollActiveJobs]);

  // Video Galerisini Yükle
  const loadVideos = useCallback(async () => {
    setLoadingVideos(true);
    try {
      const res = await fetch(`/api/videos?projectId=${encodeURIComponent(projectId)}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { ok: boolean; videos?: RenderedVideo[] };
      if (data.ok && data.videos) {
        setVideos(data.videos.filter((v) => v.isGoogleVids));
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

  // Form & Sahne Planını Temizle
  function handleClearStoryboard() {
    setStoryboard(null);
    setTopic("");
    setRevisionNote("");
    setMessage("Senaryo taslağı ve tuval başarıyla temizlendi.");
    try {
      localStorage.removeItem(`google_vids_form_${projectId}`);
    } catch {}
  }

  // Senaryo & Sahne Planı Oluştur / Revize Et
  async function handleGenerateStoryboard(isRevision = false) {
    if (!topic.trim() && !isRevision) {
      setMessage("Lütfen oluşturmak istediğiniz video için bir konu veya hikaye girin.");
      return;
    }
    if (isRevision && !revisionNote.trim()) {
      setMessage("Lütfen güncellemek istediğiniz sahne/kurgu notunu yazın.");
      return;
    }

    if (isRevision) setRevising(true);
    else setPlanning(true);

    setMessage(
      isRevision
        ? "visual-skills yönetmeni geri bildiriminize göre sahneleri revize ediyor..."
        : "visual-skills yönetmeni sahne sayısını, süreyi ve sinematik promptları kurguluyor..."
    );

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/google-vids/storyboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          visualMood,
          targetDuration,
          aspectRatio,
          narrativeMode,
          includeMusic,
          revisionFeedback: isRevision ? revisionNote.trim() : undefined,
          currentStoryboard: isRevision ? storyboard : undefined,
        }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        message?: string;
        storyboard?: StoryboardResponse;
      };
      if (!res.ok || !body.ok || !body.storyboard) {
        throw new Error(body.message || "Senaryo oluşturulamadı.");
      }

      setStoryboard(body.storyboard);
      if (isRevision) setRevisionNote("");
      setMessage(
        `Senaryo hazır: ${body.storyboard.scenes.length} sahne, toplam ${body.storyboard.totalDurationSeconds} sn. İnceleyip onaylayabilirsiniz.`
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Senaryo planlanırken hata oluştu.");
    } finally {
      setPlanning(false);
      setRevising(false);
    }
  }

  // Karakter Referans Portresi Üret
  async function handleGenerateCharacterImage() {
    if (!storyboard?.characterAnchor) return;
    setGeneratingAnchorImg(true);
    const targetMoodKey = storyboard.visualMood || visualMood;
    const moodLabel = VISUAL_MOOD_OPTIONS.find((m) => m.key === targetMoodKey)?.label || "Seçilen Tarz";
    setMessage(`Visual-skills motoruyla karakterin referans portresi üretiliyor (${moodLabel})...`);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/google-vids/character-anchor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterName: storyboard.characterAnchor.name,
          masterVisualPromptEn: storyboard.characterAnchor.masterVisualPromptEn,
          archetypeTr: storyboard.characterAnchor.archetypeTr,
          fixedTraitsEn: storyboard.characterAnchor.fixedTraitsEn,
          visualMood: targetMoodKey,
          aspectRatio: "1:1",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Görsel üretilemedi.");

      setStoryboard({
        ...storyboard,
        characterAnchor: {
          ...storyboard.characterAnchor,
          referenceImageUrl: data.imageUrl,
        },
      });
      setMessage("Karakter referans görseli başarıyla oluşturuldu ve kilitlendi!");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Referans görseli üretilemedi.");
    } finally {
      setGeneratingAnchorImg(false);
    }
  }

  // Tekil Sahne Yenileme (Re-roll)
  async function handleRerollScene(sceneIndex: number) {
    if (!storyboard) return;
    setRerollingIndex(sceneIndex);
    setMessage(`Sahne ${sceneIndex} visual-skills dramaturji kurallarıyla yeniden kurgulanıyor...`);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/google-vids/reroll-scene`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          sceneIndex,
          currentStoryboard: storyboard,
          visualMood,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Sahne yenilenemedi.");

      const updatedScenes = storyboard.scenes.map((s) =>
        s.sceneIndex === sceneIndex ? data.scene : s
      );
      setStoryboard({ ...storyboard, scenes: updatedScenes });
      setMessage(`Sahne ${sceneIndex} başarıyla yenilendi!`);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Sahne yenilenirken hata oluştu.");
    } finally {
      setRerollingIndex(null);
    }
  }

  // Sahne Promptu Güncelleme
  function handleUpdateScenePrompt(
    index: number,
    field: "promptEn" | "summaryTr" | "voiceoverTr" | "dialogueTr",
    value: string
  ) {
    if (!storyboard) return;
    const nextScenes = storyboard.scenes.map((s, idx) =>
      idx === index ? { ...s, [field]: value } : s
    );
    setStoryboard({ ...storyboard, scenes: nextScenes });
  }

  // Sahne Süresi Güncelleme (3s - 10s Dinamik Aralık)
  function handleUpdateSceneDuration(index: number, duration: number) {
    if (!storyboard) return;
    const dur = Math.max(3, Math.min(10, Math.round(duration)));
    const nextScenes = storyboard.scenes.map((s, idx) =>
      idx === index ? { ...s, durationSeconds: dur } : s
    );
    const nextTotal = nextScenes.reduce((sum, s) => sum + (s.durationSeconds || dur), 0);
    setStoryboard({
      ...storyboard,
      scenes: nextScenes,
      totalDurationSeconds: nextTotal,
    });
  }

  // Müzik Promptu Güncelleme
  function handleUpdateMusicPrompt(value: string) {
    if (!storyboard?.musicSpec) return;
    setStoryboard({
      ...storyboard,
      musicSpec: {
        ...storyboard.musicSpec,
        musicPromptEn: value,
      },
    });
  }

  // Üretimi Onayla ve Kuyruğa Ekle
  async function handleConfirmAndEnqueue() {
    if (!storyboard || !storyboard.scenes.length) {
      setMessage("Önce senaryo ve sahne planını oluşturun.");
      return;
    }

    setEnqueueing(true);
    setMessage("Google Vids video üretimi merkezi FIFO sırasına ekleniyor...");

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/google-vids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: "marka_motoru",
          topic: topic.trim(),
          storyboard,
          preferredAccountId: selectedAccountId === "auto" ? undefined : selectedAccountId,
        }),
      });
      const body = (await res.json()) as { ok: boolean; jobId?: string; message?: string };
      if (!res.ok || !body.ok) {
        throw new Error(body.message || "Kuyruğa eklenemedi.");
      }

      setMessage("Video üretim sırasına eklendi! Sağ üstteki Üretim Kuyruğu çekmecesinden canlı takip edebilirsiniz.");
      window.dispatchEvent(
        new CustomEvent("production-queue-updated", { detail: { openDrawer: true } })
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Sıraya eklenirken hata oluştu.");
    } finally {
      setEnqueueing(false);
    }
  }

  // Videodan Senaryoyu Düzenleme Paneline Çağır
  function handleEditVideo(video: RenderedVideo) {
    if (!video.storyboard) {
      setMessage("Bu videonun senaryo detayları bulunamadı.");
      return;
    }
    const sb = video.storyboard;
    setStoryboard(sb);
    if (video.topic || video.sourceTopic || sb.title) {
      setTopic(video.topic || video.sourceTopic || sb.title || "");
    }
    if (sb.visualMood) setVisualMood(sb.visualMood);
    if (sb.aspectRatio) setAspectRatio(sb.aspectRatio);
    if (sb.narrativeMode) setNarrativeMode(sb.narrativeMode);
    if (sb.totalDurationSeconds) {
      if (sb.totalDurationSeconds <= 15) setTargetDuration("15s");
      else if (sb.totalDurationSeconds >= 45) setTargetDuration("60s");
      else setTargetDuration("30s");
    }
    setIncludeMusic(Boolean(sb.musicSpec));
    setMessage(`"${video.title || "Video"}" senaryosu düzenleme paneline yüklendi.`);
    try { window.scrollTo({ top: 120, behavior: "smooth" }); } catch {}
  }

  // Video Silme
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
    <div className="generation-studio">
      {/* Sol Kontrol Paneli */}
      <section className="generation-controls">
        <div className="generation-control-header">
          <div>
            <span>GOOGLE VIDS OMNI + VISUAL-SKILLS</span>
            <h2>AI Sinematik Video</h2>
          </div>
          <WandSparkles size={21} />
        </div>

        {/* Sinematik Yönetmen Rozeti & Havuz Bilgisi */}
        <div className="brand-concept-status">
          <span style={{ background: "#612bd3" }}>
            <Sparkles size={13} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>Sinematik Yönetmen &amp; Hesap Havuzu</strong>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: accountsPool.some((a) => a.quota_status === "available" && a.is_active !== 0)
                    ? "#15803d"
                    : "#b91c1c",
                  background: "#f8fafc",
                  padding: "2px 8px",
                  borderRadius: "99px",
                  border: "1px solid #e2e8f0",
                }}
              >
                👥 {accountsPool.filter((a) => a.quota_status === "available" && a.is_active !== 0).length}/
                {accountsPool.filter((a) => a.is_active !== 0).length || accountsPool.length || 2} Hesap Hazır
              </span>
            </div>
            <small>
              Sahne sayısı ve kurgu ritmi visual-skills motoruyla belirlenir. Hesap kotası dolduğunda otomatik failover çalışır.
            </small>
          </div>
        </div>

        {/* Aktif İş & Hata Bannerı */}
        <VidsActiveJobBanner
          activeJob={activeJob}
          lastErrorJob={lastErrorJob}
          onClearError={() => {
            if (lastErrorJob?.id) {
              setDismissedErrorId(lastErrorJob.id);
            }
            setLastErrorJob(null);
          }}
        />

        {/* Brief & Parametre Formu */}
        <VidsBriefForm
          topic={topic}
          setTopic={setTopic}
          visualMood={visualMood}
          setVisualMood={setVisualMood}
          targetDuration={targetDuration}
          setTargetDuration={setTargetDuration}
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          narrativeMode={narrativeMode}
          setNarrativeMode={setNarrativeMode}
          includeMusic={includeMusic}
          setIncludeMusic={setIncludeMusic}
          selectedAccountId={selectedAccountId}
          setSelectedAccountId={setSelectedAccountId}
          accountsPool={accountsPool}
          planning={planning}
          revising={revising}
          enqueueing={enqueueing}
          message={message}
          setMessage={setMessage}
          hasStoryboard={Boolean(storyboard)}
          onGenerateStoryboard={() => void handleGenerateStoryboard(false)}
          onClearStoryboard={handleClearStoryboard}
        />
      </section>

      {/* Sağ Panel: Senaryo & Sahne Planı */}
      <VidsStoryboardDeck
        storyboard={storyboard}
        visualMood={visualMood}
        narrativeMode={narrativeMode}
        generatingAnchorImg={generatingAnchorImg}
        rerollingIndex={rerollingIndex}
        revising={revising}
        enqueueing={enqueueing}
        planning={planning}
        revisionNote={revisionNote}
        setRevisionNote={setRevisionNote}
        onGenerateCharacterImage={() => void handleGenerateCharacterImage()}
        onRerollScene={(idx) => void handleRerollScene(idx)}
        onUpdateScenePrompt={handleUpdateScenePrompt}
        onUpdateSceneDuration={handleUpdateSceneDuration}
        onUpdateMusicPrompt={handleUpdateMusicPrompt}
        onGenerateRevision={() => void handleGenerateStoryboard(true)}
        onConfirmAndEnqueue={() => void handleConfirmAndEnqueue()}
        onClearStoryboard={handleClearStoryboard}
      />

      {/* Alt Bölüm: Tamamlanan Videolar Galerisi */}
      <VidsVideoGallery
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
