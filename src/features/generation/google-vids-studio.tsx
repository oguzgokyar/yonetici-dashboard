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

type StoryboardResponse = {
  title: string;
  narrativeTr: string;
  totalDurationSeconds: number;
  visualMood: VisualMoodOption["key"];
  aspectRatio: "9:16" | "16:9" | "1:1";
  characterAnchor?: CharacterAnchorSpec;
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
  createdAt: string;
};

export function GoogleVidsStudio({ projectId }: { projectId: string }) {
  const [topic, setTopic] = useState("");
  const [visualMood, setVisualMood] = useState<VisualMoodOption["key"]>("cinematic_photoreal");
  const [targetDuration, setTargetDuration] = useState<"15s" | "30s" | "60s">("30s");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9" | "1:1">("9:16");

  const [planning, setPlanning] = useState(false);
  const [revising, setRevising] = useState(false);
  const [enqueueing, setEnqueueing] = useState(false);

  const [storyboard, setStoryboard] = useState<StoryboardResponse | null>(null);
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
        if (parsed.storyboard && !storyboard) setStoryboard(parsed.storyboard);
      }
    } catch {}
  }, [projectId]);

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
        if (data.activeJob) {
          setActiveJob(data.activeJob);
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

  function updateScenePrompt(index: number, field: "promptEn" | "summaryTr" | "voiceoverTr" | "dialogueTr" | "audioCueEn" | "sfxCueEn", value: string) {
    if (!storyboard) return;
    const nextScenes = storyboard.scenes.map((s, idx) =>
      idx === index ? { ...s, [field]: value } : s
    );
    setStoryboard({ ...storyboard, scenes: nextScenes });
  }

  // Master Karakter Portresi Üret (Visual Seed)
  async function handleGenerateCharacterImage() {
    if (!storyboard?.characterAnchor) return;
    setGeneratingAnchorImg(true);
    setMessage("Visual-skills motoruyla karakterin master referans portresi üretiliyor...");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/google-vids/character-anchor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterName: storyboard.characterAnchor.name,
          masterVisualPromptEn: storyboard.characterAnchor.masterVisualPromptEn,
          archetypeTr: storyboard.characterAnchor.archetypeTr,
          fixedTraitsEn: storyboard.characterAnchor.fixedTraitsEn,
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
          <div>
            <strong>Sinematik Yönetmen Aktif</strong>
            <small>
              Sahne sayısı ve kurgu ritmi seçtiğiniz süreye göre visual-skills dramaturji motoruyla belirlenir.
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

            {/* Sabit Karakter / Hero Anchor Özeti */}
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
                      👤 Sabit Karakter DNA&apos;sı (Visual Anchor): {storyboard.characterAnchor.name}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: "#4f46e5", background: "#e0e7ff", padding: "2px 8px", borderRadius: "99px" }}>
                        {storyboard.characterAnchor.archetypeTr}
                      </span>
                      {!storyboard.characterAnchor.referenceImageUrl && (
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
                        >
                          {generatingAnchorImg ? <LoaderCircle size={12} className="spin" /> : <Sparkles size={12} />}
                          {generatingAnchorImg ? "Üretiliyor..." : "Referans Görseli Üret"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: "12px", color: "#312e81", lineHeight: 1.45 }}>
                    <strong>Kilitlenen Fiziksel Özellikler:</strong> {storyboard.characterAnchor.fixedTraitsEn}
                  </div>
                  <div style={{ fontSize: "11px", color: "#6366f1", fontStyle: "italic" }}>
                    ✓ visual-skills U7 kuralı: Bu fiziksel kimlik tüm sahnelerde başlangıç kuralı olarak kilitlenir.
                  </div>
                </div>
              </div>
            )}

            {/* Sahne Kartları Listesi */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {storyboard.scenes.map((scene, idx) => (
                <div
                  key={scene.sceneIndex}
                  style={{
                    padding: "16px",
                    borderRadius: "14px",
                    border: "1px solid var(--border, #e2e8f0)",
                    background: "#ffffff",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          background: "#612bd3",
                          color: "#fff",
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "3px 9px",
                          borderRadius: "99px",
                        }}
                      >
                        Sahne {idx + 1}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#0f172a",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Clock size={13} /> {scene.durationSeconds} sn (
                        {scene.actionType === "extend" ? "Kesintisiz Uzatma" : "Yeni Sahne"})
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "11px", color: "#64748b" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Camera size={12} /> {scene.cameraSetup}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Sun size={12} /> {scene.lightingSetup}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleRerollScene(scene.sceneIndex)}
                        disabled={rerollingIndex === scene.sceneIndex}
                        style={{
                          background: "#f1f5f9",
                          border: "1px solid #cbd5e1",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#334155",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                        title="Bu sahneyi visual-skills kurallarıyla yeniden kurgula"
                      >
                        {rerollingIndex === scene.sceneIndex ? (
                          <LoaderCircle size={12} className="spin" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        {rerollingIndex === scene.sceneIndex ? "Yenileniyor..." : "Sahneyi Yenile"}
                      </button>
                    </div>
                  </div>

                  {/* Türkçe Sahne Açıklaması */}
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", display: "block", marginBottom: "4px" }}>
                      Sahne Hikayesi (Türkçe Özet)
                    </label>
                    <input
                      type="text"
                      value={scene.summaryTr}
                      onChange={(e) => updateScenePrompt(idx, "summaryTr", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        fontSize: "13px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {/* Google Vids Türkçe Dış Ses (Voiceover) & Diyaloglar */}
                  <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#0284c7", display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px" }}>
                      🎙️ Google Vids Yerleşik Türkçe Dış Ses (Voiceover Scripti)
                    </label>
                    <textarea
                      rows={2}
                      value={scene.voiceoverTr || ""}
                      onChange={(e) => updateScenePrompt(idx, "voiceoverTr", e.target.value)}
                      placeholder="Google Vids Voiceover paneline yazılacak etkili Türkçe dış ses metni..."
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        fontSize: "12.5px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        boxSizing: "border-box",
                        lineHeight: 1.45,
                        background: "#ffffff",
                      }}
                    />
                    {scene.dialogueTr ? (
                      <div style={{ marginTop: "6px", fontSize: "11px", color: "#475569" }}>
                        <strong>💬 Sahne Diyaloğu:</strong> <em>{scene.dialogueTr}</em>
                      </div>
                    ) : null}
                  </div>

                  {/* İngilizce Google Vids Omni Promptu */}
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                      <Pencil size={11} /> Google Vids Omni Promptu (İngilizce - Düzenlenebilir)
                    </label>
                    <textarea
                      rows={3}
                      value={scene.promptEn}
                      onChange={(e) => updateScenePrompt(idx, "promptEn", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        fontSize: "12.5px",
                        fontFamily: "monospace",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        boxSizing: "border-box",
                        lineHeight: 1.45,
                      }}
                    />
                  </div>
                </div>
              ))}
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
    </div>
  );
}
