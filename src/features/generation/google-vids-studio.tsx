"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Camera,
  Check,
  ChevronDown,
  Clapperboard,
  Clock,
  Download,
  ExternalLink,
  Film,
  Layers,
  LoaderCircle,
  Pencil,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Sun,
  Trash2,
  WandSparkles,
} from "lucide-react";

type VisualMoodOption = {
  key:
    | "cinematic_photoreal"
    | "golden_hour"
    | "moody_chiaroscuro"
    | "documentary_nature"
    | "retro_vintage_80s"
    | "minimal_commercial"
    | "stylized_3d";
  label: string;
  desc: string;
};

const VISUAL_MOOD_OPTIONS: VisualMoodOption[] = [
  {
    key: "cinematic_photoreal",
    label: "Sinematik & Fotogerçekçi (35mm)",
    desc: "Doğal derinlik, film greni ve gerçekçi doku",
  },
  {
    key: "golden_hour",
    label: "Sıcak Altın Saat (Golden Hour)",
    desc: "Batan güneş ışığı, sıcak amber ve bal tonları",
  },
  {
    key: "moody_chiaroscuro",
    label: "Dramatik & Kara Film (Moody)",
    desc: "Derin gölgeler, tek yönlü kontrast ve atmosferik ışık",
  },
  {
    key: "documentary_nature",
    label: "Belgesel & Doğal Çevre",
    desc: "NatGeo tarzı gerçekçi doğa, makro/telefoto detaylar",
  },
  {
    key: "retro_vintage_80s",
    label: "Retro & Vintage 80s Sinematik",
    desc: "Nostaljik film stoğu, yumuşak ışık halasyonu",
  },
  {
    key: "minimal_commercial",
    label: "Minimalist & Modern Reklam",
    desc: "Stüdyo netliği, temiz hatlar ve keskin ürün odağı",
  },
  {
    key: "stylized_3d",
    label: "Animasyon & Stilize 3D",
    desc: "Zengin hacimsel ışık ve canlı animasyon paleti",
  },
];

type CharacterAnchorSpec = {
  name: string;
  archetypeTr: string;
  masterVisualPromptEn: string;
  fixedTraitsEn: string;
  referenceImageUrl?: string;
};

type ScriptScenePlan = {
  sceneIndex: number;
  shotType: "establishing" | "action_development" | "resolution_climax";
  durationSeconds: number;
  actionType: "new_scene" | "extend";
  cameraSetup: string;
  lightingSetup: string;
  summaryTr: string;
  promptEn: string;
  voiceoverTr?: string;
  dialogueTr?: string;
  audioCueEn?: string;
  sfxCueEn?: string;
};

type MusicMoodSpec = {
  moodTr: string;
  instrumentationTr: string;
  musicPromptEn: string;
  tempoBpm?: number;
};

type StoryboardResponse = {
  title: string;
  narrativeTr: string;
  narrativeMode?: "voiceover_only" | "dialogue_only" | "hybrid";
  totalDurationSeconds: number;
  visualMood: VisualMoodOption["key"];
  aspectRatio: "9:16" | "16:9" | "1:1";
  characterAnchor?: CharacterAnchorSpec;
  musicSpec?: MusicMoodSpec;
  scenes: ScriptScenePlan[];
};

type RenderedVideo = {
  id: string;
  url: string;
  title?: string;
  isGoogleVids?: boolean;
  googleVidsUrl?: string;
  durationSeconds?: number;
  motionStyle?: string;
  storyboard?: StoryboardResponse;
  sourceTopic?: string;
  topic?: string;
  createdAt: string;
};

export function GoogleVidsStudio({ projectId }: { projectId: string }) {
  const [topic, setTopic] = useState("");
  const [visualMood, setVisualMood] = useState<VisualMoodOption["key"]>("cinematic_photoreal");
  const [targetDuration, setTargetDuration] = useState<"15s" | "30s" | "60s">("30s");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9" | "1:1">("9:16");
  const [narrativeMode, setNarrativeMode] = useState<"voiceover_only" | "dialogue_only" | "hybrid">("hybrid");
  const [includeMusic, setIncludeMusic] = useState(true);

  const [planning, setPlanning] = useState(false);
  const [revising, setRevising] = useState(false);
  const [enqueueing, setEnqueueing] = useState(false);

  const [storyboard, setStoryboard] = useState<StoryboardResponse | null>(null);
  const [activeSceneTabIdx, setActiveSceneTabIdx] = useState(0);
  const [revisionNote, setRevisionNote] = useState("");
  const [message, setMessage] = useState("");
  const [videos, setVideos] = useState<RenderedVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Karakter görseli üretimi ve tekil sahne re-roll durumu
  const [generatingAnchorImg, setGeneratingAnchorImg] = useState(false);
  const [rerollingIndex, setRerollingIndex] = useState<number | null>(null);

  // Aktif üretim görevi ve F5 kalıcılığı
  const [activeJob, setActiveJob] = useState<{
    id: string;
    status: string;
    prompt: string;
    progress?: { percent?: number; detail?: string; phase?: string; googleVidsUrl?: string };
    googleVidsUrl?: string;
  } | null>(null);

  const [lastErrorJob, setLastErrorJob] = useState<{
    id: string;
    error: string;
    title: string;
  } | null>(null);

  // Google Vids Çoklu Hesap Havuzu Durumu
  type PoolAccount = {
    id: string;
    email: string;
    authuser_index: number;
    profile_directory?: string;
    display_name: string;
    quota_status: "available" | "exhausted" | "cooldown";
    total_videos_rendered: number;
    cooldown_until: string | null;
    is_active?: number;
  };
  const [accountsPool, setAccountsPool] = useState<PoolAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | "auto">("auto");
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [syncingAccounts, setSyncingAccounts] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newAuthuser, setNewAuthuser] = useState<number>(0);
  const [accountActionMsg, setAccountActionMsg] = useState("");

  // LocalStorage kalıcılığı
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
        if (parsed.storyboard && !storyboard) setStoryboard(parsed.storyboard);
      }
    } catch {}
  }, [projectId]);

  // Hesap Havuzu İşlemleri
  async function refreshAccounts() {
    try {
      const res = await fetch("/api/system/google-vids/accounts", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.accounts) setAccountsPool(data.accounts as PoolAccount[]);
      }
    } catch {}
  }

  async function handleSyncBrowserAccounts() {
    setSyncingAccounts(true);
    setAccountActionMsg("Tarayıcıdaki oturumlar taranıyor...");
    try {
      const res = await fetch("/api/system/google-vids/accounts/sync", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setAccountActionMsg(`✓ ${data.message || "Hesaplar başarıyla eşitlendi."}`);
        await refreshAccounts();
      } else {
        setAccountActionMsg(`❌ ${data.message || "Eşitleme başarısız."}`);
      }
    } catch (e) {
      setAccountActionMsg(`❌ Hata: ${String(e)}`);
    } finally {
      setSyncingAccounts(false);
    }
  }

  async function handleAddManualAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    try {
      const res = await fetch("/api/system/google-vids/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), authuserIndex: newAuthuser }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewEmail("");
        setAccountActionMsg("✓ Yeni hesap havuza eklendi.");
        await refreshAccounts();
      } else {
        setAccountActionMsg(`❌ ${data.message}`);
      }
    } catch (e) {
      setAccountActionMsg(`❌ Hata: ${String(e)}`);
    }
  }

  async function handleDeleteAccount(id: string) {
    if (!confirm("Bu hesabı havuzdan silmek istediğinize emin misiniz?")) return;
    try {
      const res = await fetch(`/api/system/google-vids/accounts?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.ok) {
        setAccountActionMsg("✓ Hesap havuzdan silindi.");
        await refreshAccounts();
      } else {
        setAccountActionMsg(`❌ ${data.message}`);
      }
    } catch (e) {
      setAccountActionMsg(`❌ Hata: ${String(e)}`);
    }
  }

  async function handleResetQuota(id: string) {
    try {
      const res = await fetch("/api/system/google-vids/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, quotaStatus: "available" }),
      });
      const data = await res.json();
      if (data.ok) {
        setAccountActionMsg("✓ Hesap kotası sıfırlandı.");
        await refreshAccounts();
      }
    } catch {}
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    try {
      const res = await fetch("/api/system/google-vids/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !currentActive }),
      });
      const data = await res.json();
      if (data.ok) {
        await refreshAccounts();
      }
    } catch {}
  }

  // Form ve senaryo değiştikçe kaydet
  useEffect(() => {
    try {
      if (topic || storyboard) {
        localStorage.setItem(
          `google_vids_form_${projectId}`,
          JSON.stringify({
            topic,
            visualMood,
            targetDuration,
            aspectRatio,
            narrativeMode,
            includeMusic,
            storyboard,
          })
        );
      }
    } catch {}
  }, [projectId, topic, visualMood, targetDuration, aspectRatio, storyboard]);

  // Aktif Google Vids işlerini sorgula (F5 sonrası kaybolmayı önler)
  const pollActiveJobs = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/google-vids`, {
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
          // Eğer ekranda storyboard boşsa ama aktif işte varsa geri yükle
          if (data.activeJob.request?.scenes && !storyboard) {
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
          // Son başarısız olan görevi kontrol et
          const recentFailed = (data.jobs || []).find((j: { status: string; error?: string }) => j.status === "failed" && j.error);
          if (recentFailed) {
            setLastErrorJob({
              id: recentFailed.id,
              error: recentFailed.error,
              title: recentFailed.prompt || "Google Vids",
            });
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

  async function handleGenerateStoryboard(isRevision = false) {
    if (!topic.trim()) {
      setMessage("Lütfen önce videonun konusunu veya hikayesini yazın.");
      return;
    }
    if (isRevision && !revisionNote.trim()) {
      setMessage("Lütfen revizyon talebinizi yazın.");
      return;
    }

    if (isRevision) {
      setRevising(true);
    } else {
      setPlanning(true);
    }
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
      setActiveSceneTabIdx(0);
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

  function updateScenePrompt(index: number, field: "promptEn" | "summaryTr" | "voiceoverTr" | "dialogueTr" | "audioCueEn" | "sfxCueEn", value: string) {
    if (!storyboard) return;
    const nextScenes = storyboard.scenes.map((s, idx) =>
      idx === index ? { ...s, [field]: value } : s
    );
    setStoryboard({ ...storyboard, scenes: nextScenes });
  }

  function updateMusicPrompt(value: string) {
    if (!storyboard?.musicSpec) return;
    setStoryboard({
      ...storyboard,
      musicSpec: {
        ...storyboard.musicSpec,
        musicPromptEn: value,
      },
    });
  }

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
    setActiveSceneTabIdx(0);
    setMessage(`"${video.title || "Video"}" senaryosu düzenleme paneline yüklendi. Sahneleri inceleyip düzenleyebilir ve yeniden üretime gönderebilirsiniz.`);

    try {
      window.scrollTo({ top: 120, behavior: "smooth" });
    } catch {}
  }

  // Master Karakter Portresi Üret (Visual Seed) - Seçilen visualMood ile tam senkron
  async function handleGenerateCharacterImage() {
    if (!storyboard?.characterAnchor) return;
    setGeneratingAnchorImg(true);
    const targetMoodKey = storyboard.visualMood || visualMood;
    const moodLabel = VISUAL_MOOD_OPTIONS.find((m) => m.key === targetMoodKey)?.label || "Seçilen Tarz";
    setMessage(`Visual-skills motoruyla karakterin master referans portresi üretiliyor (${moodLabel})...`);
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
      setMessage("Karakter referans görseli seçilen görsel tarzla uyumlu olarak başarıyla oluşturuldu ve kilitlendi!");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Referans görseli üretilemedi.");
    } finally {
      setGeneratingAnchorImg(false);
    }
  }

  // Sahne Başına Tekil Yenileme (Per-Scene Re-roll)
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

        <div className="brand-concept-status">
          <span style={{ background: "#612bd3" }}>
            <Sparkles size={13} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>Sinematik Yönetmen & Hesap Havuzu</strong>
              <span style={{ fontSize: "11px", fontWeight: 700, color: accountsPool.some(a => a.quota_status === "available") ? "#15803d" : "#b91c1c", background: "#f8fafc", padding: "2px 8px", borderRadius: "99px", border: "1px solid #e2e8f0" }}>
                👥 {accountsPool.filter(a => a.quota_status === "available").length}/{accountsPool.length || 2} Hesap Aktif
              </span>
            </div>
            <small>
              Sahne sayısı ve kurgu ritmi visual-skills motoruyla belirlenir. Hesap kotası dolduğunda otomatik failover çalışır.
            </small>
          </div>
        </div>

        {/* Aktif Üretim Durum Kartı (F5 Dayanıklı & Canlı İlerleme) */}
        {activeJob && (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "14px",
              border: "1px solid #c7d2fe",
              background: "#eef2ff",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#3730a3", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <LoaderCircle size={14} className="spin" /> Video Üretimi Devam Ediyor
              </span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#4338ca", background: "#e0e7ff", padding: "2px 8px", borderRadius: "99px" }}>
                %{activeJob.progress?.percent || 25}
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "#312e81" }}>
              {activeJob.progress?.detail || "Google Vids Omni sahneleri üretiyor..."}
            </div>
            {activeJob.googleVidsUrl ? (
              <a
                href={activeJob.googleVidsUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#1d4ed8",
                  textDecoration: "underline",
                  marginTop: "4px",
                }}
              >
                <ExternalLink size={13} /> Google Vids Projesine Git (Canlı İzle / Düzenle) →
              </a>
            ) : null}
          </div>
        )}

        {/* Son Başarısız Görev / Kota Uyarısı */}
        {!activeJob && lastErrorJob && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "12px",
              border: "1px solid #fecaca",
              background: "#fef2f2",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#991b1b", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                ⚠️ Son Üretim Bildirimi ({lastErrorJob.title})
              </span>
              <button
                type="button"
                onClick={() => setLastErrorJob(null)}
                style={{ background: "none", border: "none", fontSize: "12px", color: "#b91c1c", cursor: "pointer", fontWeight: 600 }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: "12px", color: "#7f1d1d", lineHeight: 1.45 }}>
              {lastErrorJob.error}
            </div>
          </div>
        )}

        {/* Konu / Hikaye Alanı */}
        <div className="control-section">
          <label className="control-title" htmlFor="vids-topic-input">
            <span>Video Konusu / Hikayesi</span>
          </label>
          <textarea
            id="vids-topic-input"
            className="prompt-area"
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              setMessage("");
            }}
            placeholder="Örn: Çevik bir tavşan ve görkemli bir aslanın gün batımında altın sarısı çayırda karşılaşıp dostça yan yana yürüdüğü sinematik hikaye..."
          />
          <div className="prompt-footer">
            <span>{topic.length}/1500</span>
            <span>Otomatik İngilizce Sahneleme</span>
          </div>
        </div>

        {/* Nitelik Seçiciler */}
        <div className="attribute-grid">
          <label className="select-field">
            <span>Anlatım & Ses Formatı (Audio Mode)</span>
            <div>
              <select
                value={narrativeMode}
                onChange={(e) => setNarrativeMode(e.target.value as "voiceover_only" | "dialogue_only" | "hybrid")}
              >
                <option value="hybrid">🎭 Hibrit (Anlatıcı + Karakter Diyaloğu)</option>
                <option value="voiceover_only">🎙️ Dış Ses / Masal Anlatıcısı (Sadece Anlatım)</option>
                <option value="dialogue_only">💬 Karakter Diyalogları (Konuşmalı / Lip-Sync)</option>
              </select>
              <ChevronDown size={14} />
            </div>
          </label>

          <label className="select-field">
            <span>Sanat & Görsel Tarzı</span>
            <div>
              <select
                value={visualMood}
                onChange={(e) => setVisualMood(e.target.value as VisualMoodOption["key"])}
              >
                {VISUAL_MOOD_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </div>
          </label>

          <label className="select-field">
            <span>Ortalama Video Süresi</span>
            <div>
              <select
                value={targetDuration}
                onChange={(e) => setTargetDuration(e.target.value as "15s" | "30s" | "60s")}
              >
                <option value="15s">~10 - 15 sn (Hızlı Giriş / Hook)</option>
                <option value="30s">~20 - 30 sn (Standart Hikaye)</option>
                <option value="60s">~45 - 60 sn (Geniş Sinematik Anlatım)</option>
              </select>
              <ChevronDown size={14} />
            </div>
          </label>

          <label className="select-field">
            <span>Format / En-Boy Oranı</span>
            <div>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as "9:16" | "16:9" | "1:1")}
              >
                <option value="9:16">Dikey (9:16 • Reels / Shorts / TikTok)</option>
                <option value="16:9">Yatay (16:9 • YouTube / Sunum)</option>
                <option value="1:1">Kare (1:1 • Instagram Akış)</option>
              </select>
              <ChevronDown size={14} />
            </div>
          </label>

          <label className="select-field">
            <span>Arka Plan Müziği (Google Vids Audio)</span>
            <div>
              <select
                value={includeMusic ? "yes" : "no"}
                onChange={(e) => setIncludeMusic(e.target.value === "yes")}
              >
                <option value="yes">🎵 Müzik Aktif (visual-skills Duygu Promptu ile)</option>
                <option value="no">🔇 Müziksiz (Sadece Ses / Diyalog)</option>
              </select>
              <ChevronDown size={14} />
            </div>
          </label>

          <div className="select-field">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Google Hesap Havuzu (Multi-Account)</span>
              <button
                type="button"
                onClick={() => { setShowAccountsModal(true); setAccountActionMsg(""); }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#6366f1",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "0",
                }}
              >
                ⚙️ Hesapları Yönet
              </button>
            </div>
            <div>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
              >
                <option value="auto">
                  🔄 Otomatik Havuz Rotasyonu ({accountsPool.filter(a => a.quota_status === "available" && a.is_active !== 0).length}/{accountsPool.length || 2} Uygun)
                </option>
                {accountsPool.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.quota_status === "available" ? "🟢" : "🔴"} {acc.email} [{acc.profile_directory || "Default"}] {acc.quota_status !== "available" ? "(Kotada)" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </div>
          </div>
        </div>

        {message && (
          <div className="generation-notice">
            <Sparkles size={15} />
            <span>{message}</span>
          </div>
        )}

        <button
          type="button"
          className="generate-button"
          disabled={planning || revising || enqueueing}
          onClick={() => void handleGenerateStoryboard(false)}
        >
          {planning ? <LoaderCircle className="spin" size={18} /> : <Film size={18} />}
          {planning ? "Senaryo Kurgulanıyor..." : "Senaryo & Sahneleri Oluştur"}
          <span>{targetDuration}</span>
        </button>
      </section>

      {/* Sağ Panel: Senaryo İnceleme, Düzenleme ve Onay */}
      <section className="generation-results">
        <div className="results-toolbar">
          <div>
            <h2>Senaryo & Sahne Planı (`visual-skills`)</h2>
            <span>Üretim öncesi sahneleri inceleyin, düzenleyin veya revizyon isteyin</span>
          </div>
          {storyboard && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: "rgba(97, 43, 211, 0.1)",
                  color: "#612bd3",
                }}
              >
                {storyboard.scenes.length} Sahne • Toplam {storyboard.totalDurationSeconds} sn
              </span>
            </div>
          )}
        </div>

        {storyboard ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "4px 0" }}>
            {/* Hikaye Özeti Kartı */}
            <div
              style={{
                padding: "16px",
                borderRadius: "14px",
                border: "1px solid var(--border, #e2e8f0)",
                background: "var(--surface-subtle, #f8fafc)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <strong style={{ fontSize: "15px" }}>{storyboard.title}</strong>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  {VISUAL_MOOD_OPTIONS.find((m) => m.key === storyboard.visualMood)?.label} • {storyboard.aspectRatio}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
                {storyboard.narrativeTr}
              </p>
            </div>

            {/* Müzik ve Duygu Özeti - Prompt Tam Metin Görünümü */}
            {storyboard.musicSpec && (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "14px",
                  border: "1px solid #fed7aa",
                  background: "#fff7ed",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "18px" }}>🎵</span>
                    <div>
                      <strong style={{ fontSize: "13.5px", color: "#9a3412" }}>
                        Arka Plan Müziği: {storyboard.musicSpec.moodTr}
                      </strong>
                      <div style={{ fontSize: "11.5px", color: "#c2410c", marginTop: "2px" }}>
                        {storyboard.musicSpec.instrumentationTr}
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      background: "#ffedd5",
                      color: "#9a3412",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      fontWeight: 600,
                    }}
                  >
                    ✓ Google Vids Audio Promptu Aktif
                  </span>
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#9a3412", display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px" }}>
                    <Pencil size={11} /> Müzik Üretim Promptu (Google Vids Audio - İngilizce)
                  </label>
                  <textarea
                    rows={2}
                    value={storyboard.musicSpec.musicPromptEn}
                    onChange={(e) => updateMusicPrompt(e.target.value)}
                    placeholder="Müzik üretim promptu..."
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      fontSize: "12px",
                      fontFamily: "monospace",
                      borderRadius: "8px",
                      border: "1px solid #fdba74",
                      boxSizing: "border-box",
                      lineHeight: 1.45,
                      background: "#ffffff",
                      color: "#7c2d12",
                      resize: "vertical",
                      minHeight: "60px",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Sabit Karakter / Hero Anchor Özeti - Tarz Uyumu */}
            {storyboard.characterAnchor && (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "14px",
                  border: "1px solid #c7d2fe",
                  background: "#eef2ff",
                  display: "flex",
                  gap: "14px",
                  alignItems: "flex-start",
                }}
              >
                {/* Karakter Referans Görseli (Varsa) */}
                {storyboard.characterAnchor.referenceImageUrl ? (
                  <div style={{ flexShrink: 0, width: "72px", height: "72px", borderRadius: "10px", overflow: "hidden", border: "2px solid #6366f1", background: "#fff" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={storyboard.characterAnchor.referenceImageUrl}
                      alt={storyboard.characterAnchor.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                ) : null}

                <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#3730a3", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      👤 Sabit Karakter DNA&apos;sı: {storyboard.characterAnchor.name}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: "#4f46e5", background: "#e0e7ff", padding: "2px 8px", borderRadius: "99px" }}>
                        {storyboard.characterAnchor.archetypeTr}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleGenerateCharacterImage()}
                        disabled={generatingAnchorImg}
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: "6px",
                          border: "1px solid #818cf8",
                          background: "#ffffff",
                          color: "#4338ca",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                        title="Seçilen proje görsel tarzına uygun referans portre üret"
                      >
                        {generatingAnchorImg ? <LoaderCircle size={12} className="spin" /> : <Sparkles size={12} />}
                        {generatingAnchorImg ? "Üretiliyor..." : storyboard.characterAnchor.referenceImageUrl ? "Görseli Yenile (Tarza Uyarla)" : "Referans Görseli Üret"}
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: "12px", color: "#312e81", lineHeight: 1.45 }}>
                    <strong>Kilitlenen Fiziksel Özellikler:</strong> {storyboard.characterAnchor.fixedTraitsEn}
                  </div>
                  <div style={{ fontSize: "11px", color: "#6366f1", fontStyle: "italic" }}>
                    ✓ Tarz Uyumu: {VISUAL_MOOD_OPTIONS.find((m) => m.key === (storyboard.visualMood || visualMood))?.label} ile senkronize model üretilir.
                  </div>
                </div>
              </div>
            )}

            {/* Sahneler - Sekmeli Gezinti & Tam Okunabilir Prompt Alanları */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Sekme Çubuğu */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  overflowX: "auto",
                  paddingBottom: "6px",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                {storyboard.scenes.map((s, idx) => {
                  const isSelected = idx === activeSceneTabIdx;
                  return (
                    <button
                      key={s.sceneIndex}
                      type="button"
                      onClick={() => setActiveSceneTabIdx(idx)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "10px",
                        border: isSelected ? "2px solid #612bd3" : "1px solid #cbd5e1",
                        background: isSelected ? "rgba(97, 43, 211, 0.08)" : "#ffffff",
                        color: isSelected ? "#612bd3" : "#475569",
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: "12.5px",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        whiteSpace: "nowrap",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          background: isSelected ? "#612bd3" : "#e2e8f0",
                          color: isSelected ? "#ffffff" : "#475569",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "11px",
                          fontWeight: 700,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <span>Sahne {idx + 1}</span>
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "1px 6px",
                          borderRadius: "99px",
                          background: isSelected ? "#612bd3" : "#f1f5f9",
                          color: isSelected ? "#ffffff" : "#64748b",
                        }}
                      >
                        {s.durationSeconds} sn • {s.actionType === "extend" ? "Uzatma" : "Yeni"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Seçili Sahne İçeriği (Tam Metin Görünümü) */}
              {(() => {
                const currentIdx = Math.min(Math.max(activeSceneTabIdx, 0), storyboard.scenes.length - 1);
                const scene = storyboard.scenes[currentIdx] || storyboard.scenes[0];
                if (!scene) return null;

                return (
                  <div
                    style={{
                      padding: "18px",
                      borderRadius: "14px",
                      border: "1px solid var(--border, #e2e8f0)",
                      background: "#ffffff",
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span
                          style={{
                            background: "#612bd3",
                            color: "#fff",
                            fontSize: "12px",
                            fontWeight: 700,
                            padding: "4px 10px",
                            borderRadius: "99px",
                          }}
                        >
                          Sahne {currentIdx + 1} / {storyboard.scenes.length}
                        </span>
                        <span
                          style={{
                            fontSize: "12.5px",
                            fontWeight: 600,
                            color: "#0f172a",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <Clock size={14} /> {scene.durationSeconds} sn ({scene.actionType === "extend" ? "Kesintisiz Uzatma" : "Yeni Sahne"})
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", fontSize: "11px", color: "#64748b", marginRight: "6px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Camera size={12} /> {scene.cameraSetup}
                          </span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Sun size={12} /> {scene.lightingSetup}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleRerollScene(scene.sceneIndex)}
                          disabled={rerollingIndex === scene.sceneIndex}
                          style={{
                            background: "#f1f5f9",
                            border: "1px solid #cbd5e1",
                            padding: "4px 10px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "11.5px",
                            fontWeight: 600,
                            color: "#334155",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                          title="Bu sahneyi visual-skills kurallarıyla yeniden kurgula"
                        >
                          {rerollingIndex === scene.sceneIndex ? (
                            <LoaderCircle size={13} className="spin" />
                          ) : (
                            <RefreshCw size={13} />
                          )}
                          {rerollingIndex === scene.sceneIndex ? "Yenileniyor..." : "Sahneyi Yenile"}
                        </button>
                      </div>
                    </div>

                    {/* Türkçe Sahne Açıklaması */}
                    <div>
                      <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
                        Sahne Hikayesi (Türkçe Özet)
                      </label>
                      <textarea
                        rows={2}
                        value={scene.summaryTr}
                        onChange={(e) => updateScenePrompt(currentIdx, "summaryTr", e.target.value)}
                        placeholder="Sahne özeti..."
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          fontSize: "13px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          boxSizing: "border-box",
                          lineHeight: 1.45,
                          resize: "vertical",
                          minHeight: "56px",
                        }}
                      />
                    </div>

                    {/* Google Vids Türkçe Dış Ses (Voiceover) & Diyaloglar */}
                    <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "10px" }}>
                      {narrativeMode !== "dialogue_only" && (
                        <div>
                          <label style={{ fontSize: "11.5px", fontWeight: 700, color: "#0284c7", display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px" }}>
                            🎙️ Google Vids Yerleşik Dış Ses (Voiceover)
                          </label>
                          <textarea
                            rows={3}
                            value={scene.voiceoverTr || ""}
                            onChange={(e) => updateScenePrompt(currentIdx, "voiceoverTr", e.target.value)}
                            placeholder="Google Vids Voiceover paneline yazılacak etkili Türkçe dış ses metni..."
                            style={{
                              width: "100%",
                              padding: "9px 12px",
                              fontSize: "13px",
                              borderRadius: "8px",
                              border: "1px solid #cbd5e1",
                              boxSizing: "border-box",
                              lineHeight: 1.45,
                              background: "#ffffff",
                              resize: "vertical",
                              minHeight: "70px",
                            }}
                          />
                        </div>
                      )}

                      {narrativeMode !== "voiceover_only" && (
                        <div>
                          <label style={{ fontSize: "11.5px", fontWeight: 700, color: "#7c3aed", display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px" }}>
                            💬 Karakter Repliği / Diyalog (Veo Lip-Sync)
                          </label>
                          <textarea
                            rows={2}
                            value={scene.dialogueTr || ""}
                            onChange={(e) => updateScenePrompt(currentIdx, "dialogueTr", e.target.value)}
                            placeholder="Örn: Hoca: 'Bizim memleketin kazları hep tek ayak üstünde durur!'"
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              fontSize: "12.5px",
                              borderRadius: "8px",
                              border: "1px solid #cbd5e1",
                              boxSizing: "border-box",
                              background: "#ffffff",
                              resize: "vertical",
                              minHeight: "50px",
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* İngilizce Google Vids Omni Promptu - TAM OKUNABİLİR, SINIRLAMASIZ */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <label style={{ fontSize: "12px", fontWeight: 700, color: "#334155", display: "flex", alignItems: "center", gap: "5px" }}>
                          <Pencil size={12} /> Google Vids Omni Promptu (İngilizce - Düzenlenebilir)
                        </label>
                        <span style={{ fontSize: "11px", color: "#64748b" }}>
                          {scene.promptEn.length} karakter • Tam metin görünümü
                        </span>
                      </div>
                      <textarea
                        rows={6}
                        value={scene.promptEn}
                        onChange={(e) => updateScenePrompt(currentIdx, "promptEn", e.target.value)}
                        placeholder="Google Vids Omni İngilizce promptu..."
                        style={{
                          width: "100%",
                          padding: "12px 14px",
                          fontSize: "13px",
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                          borderRadius: "10px",
                          border: "1px solid #cbd5e1",
                          boxSizing: "border-box",
                          lineHeight: 1.55,
                          background: "#ffffff",
                          resize: "vertical",
                          minHeight: "150px",
                          whiteSpace: "pre-wrap",
                          overflowWrap: "break-word",
                        }}
                      />
                    </div>

                    {/* Sahneler Arası Gezinme Alt Çubuğu */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "6px", borderTop: "1px solid #f1f5f9" }}>
                      <button
                        type="button"
                        disabled={currentIdx === 0}
                        onClick={() => setActiveSceneTabIdx(currentIdx - 1)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          background: currentIdx === 0 ? "#f8fafc" : "#ffffff",
                          color: currentIdx === 0 ? "#94a3b8" : "#334155",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: currentIdx === 0 ? "not-allowed" : "pointer",
                        }}
                      >
                        ← Önceki Sahne
                      </button>

                      <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                        {currentIdx + 1} / {storyboard.scenes.length}
                      </span>

                      <button
                        type="button"
                        disabled={currentIdx === storyboard.scenes.length - 1}
                        onClick={() => setActiveSceneTabIdx(currentIdx + 1)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          background: currentIdx === storyboard.scenes.length - 1 ? "#f8fafc" : "#ffffff",
                          color: currentIdx === storyboard.scenes.length - 1 ? "#94a3b8" : "#334155",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: currentIdx === storyboard.scenes.length - 1 ? "not-allowed" : "pointer",
                        }}
                      >
                        Sonraki Sahne →
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Revizyon İsteme Kutusu */}
            <div
              style={{
                padding: "14px",
                borderRadius: "12px",
                border: "1px dashed #cbd5e1",
                background: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                Senaryoda Düzeltme / Revizyon İste (İsteğe Bağlı)
              </label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <input
                  type="text"
                  value={revisionNote}
                  onChange={(e) => setRevisionNote(e.target.value)}
                  placeholder="Örn: 2. sahnede kamera daha yakın çekim olsun, son sahnede nehir kenarı eklensin..."
                  style={{
                    flex: 1,
                    minWidth: "220px",
                    padding: "9px 12px",
                    fontSize: "13px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  className="button secondary"
                  disabled={revising || !revisionNote.trim()}
                  onClick={() => void handleGenerateStoryboard(true)}
                >
                  {revising ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}
                  {revising ? "Revize Ediliyor..." : "Senaryoyu Güncelle"}
                </button>
              </div>
            </div>

            {/* Onayla ve Kuyruğa Ekle Butonu */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "4px" }}>
              <button
                type="button"
                className="generate-button"
                style={{ width: "auto", padding: "0 24px" }}
                disabled={enqueueing || planning || revising}
                onClick={() => void handleConfirmAndEnqueue()}
              >
                {enqueueing ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}
                {enqueueing ? "Sıraya Ekleniyor..." : "Onayla ve Üretim Sırasına Ekle"}
                <span>{storyboard.totalDurationSeconds} sn</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="results-empty">
            <div className="empty-canvas">
              <div className="canvas-glow" style={{ background: "#612bd3" }} />
              <Clapperboard size={38} />
              <span>
                <Sparkles size={13} />
                VISUAL-SKILLS YÖNETMEN MODU
              </span>
            </div>
            <h3>Önce senaryo ve sahneleri oluşturun</h3>
            <p>
              Soldan video konusunu, sanat tarzını ve ortalama süreyi seçip &ldquo;Senaryo &amp; Sahneleri Oluştur&rdquo;
              butonuna tıklayın. Yönetmen sahne sayısını ve çekim planını burada onayınıza sunacak.
            </p>
          </div>
        )}
      </section>

      {/* Alt Bölüm: Üretilen Google Vids Videoları Arşivi */}
      <section className="generation-history">
        <div className="history-heading">
          <div>
            <span>
              <Clapperboard size={16} />
            </span>
            <div>
              <h2>Üretilen Google Vids Videoları</h2>
              <p>Tamamlanan AI videoları burada saklanır ve tek tıkla Paylaşım Planına aktarılır.</p>
            </div>
          </div>
          <button
            type="button"
            className="button secondary"
            onClick={() => void loadVideos()}
            disabled={loadingVideos}
          >
            {loadingVideos ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}
            Yenile
          </button>
        </div>

        {loadingVideos && !videos.length ? (
          <div className="history-loading">
            <LoaderCircle className="spin" size={20} />
            Videolar yükleniyor...
          </div>
        ) : videos.length ? (
          <div className="video-history-grid">
            {videos.map((video) => (
              <article key={video.id}>
                <video src={video.url} controls preload="metadata" />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span>
                    {video.title || "Google Vids"} • {video.durationSeconds || 30} sn
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {video.storyboard ? (
                      <button
                        type="button"
                        onClick={() => handleEditVideo(video)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          color: "#4f46e5",
                          background: "#eef2ff",
                          border: "1px solid #c7d2fe",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontWeight: 600,
                          fontSize: "11px",
                          cursor: "pointer",
                        }}
                        title="Senaryoyu düzenleme paneline çağırıp yeni üretim başlat"
                      >
                        <Pencil size={12} /> Düzenle
                      </button>
                    ) : null}
                    {video.googleVidsUrl ? (
                      <a
                        href={video.googleVidsUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          color: "#1d4ed8",
                          fontWeight: 600,
                          fontSize: "11px",
                        }}
                        title="Google Vids projesini aç"
                      >
                        <ExternalLink size={13} /> Proje
                      </a>
                    ) : null}
                    <a href={video.url} download={`google-vids-${video.id}.mp4`}>
                      <Download size={14} /> İndir
                    </a>
                    <Link
                      href={`/projects/${projectId}/publishing?assetId=${video.id}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        color: "var(--accent, #612bd3)",
                        fontWeight: 600,
                        fontSize: "11px",
                      }}
                    >
                      <Send size={13} /> Planla
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDeleteVideo(video.id)}
                      disabled={deletingId === video.id}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                        padding: "2px",
                      }}
                      title="Sil"
                    >
                      {deletingId === video.id ? (
                        <LoaderCircle className="spin" size={14} />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="history-empty">
            <Clapperboard size={23} />
            <span>Henüz Google Vids ile üretilmiş video bulunmuyor.</span>
          </div>
        )}
      </section>
      {/* Hesap Yönetimi Modalı */}
      {showAccountsModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              maxWidth: "600px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 22px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                  👥 Google Vids Çoklu Hesap Havuzu
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                  Google video oluşturma kotasını paylaştırmak için hesapları ekleyin ve yönetin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAccountsModal(false)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "8px",
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontSize: "14px",
                  color: "#475569",
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Eylem Butonları */}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="button secondary"
                  style={{ flex: 1, padding: "10px 14px", fontSize: "12.5px", justifyContent: "center" }}
                  disabled={syncingAccounts}
                  onClick={() => void handleSyncBrowserAccounts()}
                >
                  {syncingAccounts ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}
                  Tarayıcıdaki Hesapları Otomatik Eşitle
                </button>

                <a
                  href="http://43.131.47.253:8080/novnc/vnc_auto.html?path=novnc/websockify%3Fservice%3Dcanva"
                  target="_blank"
                  rel="noreferrer"
                  className="button"
                  style={{
                    background: "#4f46e5",
                    color: "#ffffff",
                    textDecoration: "none",
                    padding: "10px 14px",
                    fontSize: "12.5px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    borderRadius: "10px",
                  }}
                >
                  <ExternalLink size={14} /> Tarayıcıda Yeni Hesap Aç (noVNC) →
                </a>
              </div>

              {accountActionMsg && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    background: accountActionMsg.startsWith("❌") ? "#fef2f2" : "#f0fdf4",
                    color: accountActionMsg.startsWith("❌") ? "#991b1b" : "#166534",
                    border: accountActionMsg.startsWith("❌") ? "1px solid #fecaca" : "1px solid #bbf7d0",
                  }}
                >
                  {accountActionMsg}
                </div>
              )}

              {/* Hesap Kartları Listesi */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>
                  Bağlı Hesaplar ({accountsPool.length})
                </span>

                {accountsPool.map((acc) => (
                  <div
                    key={acc.id}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      background: acc.is_active === 0 ? "#f8fafc" : "#ffffff",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "10px",
                      opacity: acc.is_active === 0 ? 0.6 : 1,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "16px" }}>
                        {acc.quota_status === "available" ? "🟢" : "🔴"}
                      </span>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
                          {acc.email}{" "}
                          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 400 }}>
                            [Profil: {acc.profile_directory || "Default"}] (authuser={acc.authuser_index})
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                          Durum:{" "}
                          <strong style={{ color: acc.quota_status === "available" ? "#16a34a" : "#dc2626" }}>
                            {acc.quota_status === "available" ? "Kota Kullanılabilir" : "Kotada / Dinlenmede"}
                          </strong>{" "}
                          • Toplam Üretilen: {acc.total_videos_rendered} Video
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {acc.quota_status !== "available" && (
                        <button
                          type="button"
                          onClick={() => void handleResetQuota(acc.id)}
                          style={{
                            padding: "5px 8px",
                            fontSize: "11px",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            background: "#f8fafc",
                            cursor: "pointer",
                            color: "#0284c7",
                            fontWeight: 600,
                          }}
                        >
                          Kotayı Sıfırla
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleToggleActive(acc.id, acc.is_active !== 0)}
                        style={{
                          padding: "5px 8px",
                          fontSize: "11px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          background: "#f8fafc",
                          cursor: "pointer",
                          color: "#475569",
                        }}
                      >
                        {acc.is_active === 0 ? "Aktifleştir" : "Pasifleştir"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteAccount(acc.id)}
                        style={{
                          padding: "5px 8px",
                          fontSize: "11px",
                          borderRadius: "6px",
                          border: "1px solid #fecaca",
                          background: "#fff1f2",
                          cursor: "pointer",
                          color: "#e11d48",
                          fontWeight: 600,
                        }}
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Manuel Hesap Ekleme Formu */}
              <form
                onSubmit={(e) => void handleAddManualAccount(e)}
                style={{
                  marginTop: "8px",
                  padding: "14px",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  border: "1px dashed #cbd5e1",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>
                  Manuel Hesap Kaydı Ekle
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="email"
                    required
                    placeholder="hesap@gmail.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    style={{
                      flex: 2,
                      padding: "8px 10px",
                      fontSize: "12.5px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                    }}
                  />
                  <input
                    type="number"
                    min="0"
                    max="10"
                    placeholder="authuser (0,1,2)"
                    value={newAuthuser}
                    onChange={(e) => setNewAuthuser(Number(e.target.value))}
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      fontSize: "12.5px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                    }}
                    title="Google oturum sırası indeksi (0, 1, 2...)"
                  />
                  <button
                    type="submit"
                    className="button"
                    style={{ background: "#0f172a", color: "#ffffff", padding: "8px 14px", fontSize: "12px" }}
                  >
                    Ekle
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
