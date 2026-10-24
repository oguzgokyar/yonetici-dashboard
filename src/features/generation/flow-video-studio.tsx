"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Film,
  Sparkles,
  Check,
  Download,
  LoaderCircle,
  Play,
  RefreshCw,
  Send,
  Trash2,
  AlertCircle,
  Layers,
  Wand2,
  Clock,
  Ratio,
  Sliders,
  Settings,
  MessageSquareQuote,
  ShieldCheck,
  KeyRound,
  ExternalLink,
} from "lucide-react";
import { TelegramSendButton } from "@/components/ui/telegram-send-button";
import { useProjects } from "@/features/projects/projects-context";

type CreativeAsset = { id: string; url: string; model?: string; prompt?: string; createdAt?: string };

export interface FlowVideoItem {
  id: string;
  projectId: string;
  status: "queued" | "running" | "complete" | "failed";
  prompt: string;
  model: string;
  aspectRatio: string;
  durationSeconds: number;
  sourceAssetId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string | null;
  progressPercent?: number;
  progressDetail?: string;
  createdAt: string;
  completedAt?: string | null;
}

const MODEL_OPTIONS: { value: string; label: string; detail: string }[] = [
  { value: "veo-3.1-fast", label: "Veo 3.1 Fast", detail: "Hızlı, ekonomik ve akıcı hareket" },
  { value: "veo-3.1-quality", label: "Veo 3.1 Quality", detail: "Yüksek sinematik detay ve doku" },
  { value: "veo-3.1-lite", label: "Veo 3.1 Lite", detail: "Düşük krediyle hafif denemeler" },
  { value: "omni-flash", label: "Omni Flash", detail: "Doğal diyalog ve senkron ses" },
];

const ASPECT_RATIO_OPTIONS = [
  { value: "9:16", label: "9:16 (Dikey)", icon: "📱", tip: "Reels, TikTok, Shorts" },
  { value: "16:9", label: "16:9 (Yatay)", icon: "🖥️", tip: "YouTube, Web" },
  { value: "1:1", label: "1:1 (Kare)", icon: "⏹️", tip: "Instagram Gönderi" },
] as const;

export function FlowVideoStudio({ projectId }: { projectId: string }) {
  const { getProject } = useProjects();
  const project = getProject(projectId);

  // Form states
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("veo-3.1-fast");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9" | "1:1">("9:16");
  const [duration, setDuration] = useState<4 | 6 | 8>(6);
  const [selectedAssetId, setSelectedAssetId] = useState("");

  // Data states
  const [assets, setAssets] = useState<CreativeAsset[]>([]);
  const [videos, setVideos] = useState<FlowVideoItem[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [isConfigured, setIsConfigured] = useState(true);

  // Action states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Settings modal form state
  const [configBaseUrl, setConfigBaseUrl] = useState("https://api.useapi.net/v1/google-flow");
  const [configApiKey, setConfigApiKey] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingConfig, setTestingConfig] = useState(false);
  const [configMessage, setConfigMessage] = useState("");

  // Active running job
  const activeJob = useMemo(
    () => videos.find((v) => v.status === "running" || v.status === "queued"),
    [videos]
  );

  // Selected or latest completed video
  const selectedVideo = useMemo(() => {
    if (selectedVideoId) {
      const found = videos.find((v) => v.id === selectedVideoId);
      if (found) return found;
    }
    return videos.find((v) => v.status === "complete") || videos[0] || null;
  }, [videos, selectedVideoId]);

  // Load project assets and Flow videos
  const loadStudioData = useCallback(async () => {
    try {
      const [imagesRes, flowRes] = await Promise.all([
        fetch(`/api/ai/images?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" }),
        fetch(`/api/projects/${encodeURIComponent(projectId)}/flow-videos`, { cache: "no-store" }),
      ]);

      if (imagesRes.ok) {
        const imgData = await imagesRes.json();
        setAssets(imgData.assets || []);
      }

      if (flowRes.ok) {
        const flowData = await flowRes.json();
        setVideos(flowData.videos || []);
        setIsConfigured(Boolean(flowData.configured));
        if (flowData.defaultModel) {
          setModel(flowData.defaultModel);
        }
      }
    } catch {
      setMessage("Flow video arşivi yüklenirken bağlantı sorunu oluştu.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadStudioData();
  }, [loadStudioData]);

  // Background polling for active jobs
  useEffect(() => {
    if (!activeJob) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/flow-videos`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.videos)) {
            setVideos(data.videos);
            // If the active job finished, notify user
            const updatedActive = data.videos.find((v: FlowVideoItem) => v.id === activeJob.id);
            if (updatedActive?.status === "complete") {
              setMessage("Flow video üretimi başarıyla tamamlandı.");
              setSelectedVideoId(updatedActive.id);
            } else if (updatedActive?.status === "failed") {
              setMessage(updatedActive.error || "Flow video üretimi başarısız oldu.");
            }
          }
        }
      } catch {
        // quiet retry
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeJob, projectId]);

  // Quick brand prompt enhancer
  function injectBrandContext() {
    if (!project) return;
    const brandName = project.brand?.brandName || project.name || "Markamız";
    const brandTone = project.brand?.tone || project.brandConcept?.personality || "Modern, profesyonel ve etkileyici";
    const brandCategory = project.brand?.industry || "ürün ve hizmetler";

    const addition = `${brandName} için ${brandTone} atmosferde, ${brandCategory} temalı sinematik sahne.`;
    setPrompt((prev) => (prev ? `${prev.trim()}\n${addition}` : addition));
  }

  // Handle generation submit
  async function handleGenerate() {
    if (!prompt.trim()) {
      setMessage("Lütfen bir video senaryosu veya prompt girin.");
      return;
    }

    setSubmitting(true);
    setMessage("Flow REST API'ye video üretim isteği gönderiliyor...");

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/flow-videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model,
          aspectRatio,
          durationSeconds: duration,
          sourceAssetId: selectedAssetId || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Video üretimi başlatılamadı.");
      }

      setMessage("Flow video görevi kuyruğa alındı. Durum arka planda güncelleniyor.");
      if (data.job) {
        setVideos((prev) => [data.job, ...prev]);
        setSelectedVideoId(data.job.id);
      }
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : String(err);
      setMessage(errText);
    } finally {
      setSubmitting(false);
    }
  }

  // Delete video
  async function handleDelete(jobId: string) {
    if (!window.confirm("Bu videoyu silmek istediğinize emin misiniz?")) return;
    setDeletingId(jobId);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/flow-videos/${jobId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setVideos((prev) => prev.filter((v) => v.id !== jobId));
        if (selectedVideoId === jobId) {
          setSelectedVideoId("");
        }
      }
    } catch {
      setMessage("Video silinemedi.");
    } finally {
      setDeletingId(null);
    }
  }

  // Open settings modal
  async function openConfig() {
    setShowConfigModal(true);
    setConfigMessage("");
    try {
      const res = await fetch("/api/settings/flow-provider");
      if (res.ok) {
        const data = await res.json();
        if (data.baseUrl) setConfigBaseUrl(data.baseUrl);
      }
    } catch {}
  }

  // Save settings modal
  async function handleSaveConfig() {
    setSavingConfig(true);
    setConfigMessage("");
    try {
      const res = await fetch("/api/settings/flow-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: configBaseUrl.trim(),
          apiKey: configApiKey.trim() || undefined,
          defaultModel: model,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setConfigMessage("✓ Ayarlar başarıyla kaydedildi.");
        setIsConfigured(Boolean(data.config?.hasApiKey));
        setTimeout(() => setShowConfigModal(false), 1200);
      } else {
        setConfigMessage(data.error || "Ayarlar kaydedilemedi.");
      }
    } catch {
      setConfigMessage("Sunucuya erişilemedi.");
    } finally {
      setSavingConfig(false);
    }
  }

  // Test settings modal connection
  async function handleTestConfig() {
    setTestingConfig(true);
    setConfigMessage("");
    try {
      const res = await fetch("/api/settings/flow-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          baseUrl: configBaseUrl.trim(),
          apiKey: configApiKey.trim() || undefined,
        }),
      });
      const data = await res.json();
      setConfigMessage(data.message || (data.ok ? "✓ Bağlantı başarılı" : "Bağlantı hatası"));
    } catch {
      setConfigMessage("Bağlantı test edilemedi.");
    } finally {
      setTestingConfig(false);
    }
  }

  if (!project) return <div className="overview-loading" />;

  return (
    <div className="video-studio">
      {/* SOL PANEL: KONTROLLER */}
      <section className="video-controls">
        <div className="video-section-heading">
          <span>
            <Film size={18} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2>Flow Video (Veo REST)</h2>
              <button
                type="button"
                className="icon-button"
                onClick={openConfig}
                title="Flow REST API Ayarları"
                style={{ width: "28px", height: "28px" }}
              >
                <Settings size={14} />
              </button>
            </div>
            <p>Google Flow & Veo 3.1 ile REST API üzerinden sinematik video</p>
          </div>
        </div>

        {/* API Yapılandırma Uyarısı */}
        {!isConfigured && (
          <div
            style={{
              marginTop: "14px",
              padding: "10px 12px",
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: "10px",
              fontSize: "11px",
              color: "#92400e",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              Flow REST API anahtarı girilmedi.
              <button
                type="button"
                onClick={openConfig}
                style={{
                  background: "none",
                  border: "none",
                  color: "#b45309",
                  fontWeight: 700,
                  marginLeft: "4px",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Şimdi Tanımla
              </button>
            </div>
          </div>
        )}

        {/* Kreatif Seçici (First Frame / Image-to-Video) */}
        <div className="video-control-section">
          <strong>İlk Kare / Referans Görsel (Opsiyonel)</strong>
          <small>Görsel seçilirse animasyon bu kareden başlar (Image-to-Video)</small>
          {loading ? (
            <div className="video-control-loading">
              <LoaderCircle className="spin" size={18} /> Görseller yükleniyor...
            </div>
          ) : (
            <div className="video-asset-picker">
              <button
                type="button"
                className={selectedAssetId === "" ? "selected" : ""}
                onClick={() => setSelectedAssetId("")}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  fontSize: "10px",
                  color: "#6b7280",
                  fontWeight: 600,
                }}
              >
                <Wand2 size={16} />
                <span>Saf Metin</span>
                {selectedAssetId === "" && (
                  <span>
                    <Check size={12} />
                  </span>
                )}
              </button>
              {assets.slice(0, 11).map((asset) => {
                const thumbUrl = asset.url.startsWith("/api/assets/") ? `${asset.url}?thumb=1` : asset.url;
                return (
                  <button
                    type="button"
                    key={asset.id}
                    className={selectedAssetId === asset.id ? "selected" : ""}
                    onClick={() => setSelectedAssetId(asset.id)}
                  >
                    <Image
                      src={thumbUrl}
                      alt="Referans Kare"
                      fill
                      sizes="80px"
                      loading="lazy"
                      unoptimized
                      style={{ objectFit: "cover" }}
                    />
                    {selectedAssetId === asset.id && (
                      <span>
                        <Check size={12} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Prompt Girişi */}
        <div className="video-control-section">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <strong>Video Senaryosu & Prompt</strong>
            <button
              type="button"
              onClick={injectBrandContext}
              style={{
                background: "none",
                border: "none",
                color: "var(--accent, #6366f1)",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Sparkles size={12} />
              Marka Dili Ekle
            </button>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Kamera açısı, hareket, ortam ve varsa Veo diyalog syntax'ı: Bir kadın şöyle der: &quot;Atölye Hanem ile hayallerinizi tasarlayın&quot;..."
            rows={4}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid var(--border, #e2e8f0)",
              fontSize: "12px",
              lineHeight: "1.5",
              resize: "vertical",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
          <small style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
            <MessageSquareQuote size={12} />
            Diyalog için Veo formatı: Çift tırnak içinde konuşma cümleleri yerel dudak senkronizasyonu üretir.
          </small>
        </div>

        {/* Model Seçimi */}
        <div className="video-control-section">
          <strong>Veo Model</strong>
          <small>Üretim kalitesi ve karakteri</small>
          <div style={{ display: "grid", gap: "6px", marginTop: "10px" }}>
            {MODEL_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                onClick={() => setModel(opt.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: "9px",
                  border: model === opt.value ? "1.5px solid var(--accent, #6366f1)" : "1px solid #e5e7eb",
                  background: model === opt.value ? "#f5f3ff" : "#ffffff",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div>
                  <b style={{ fontSize: "11px", display: "block", color: model === opt.value ? "#4f46e5" : "#111827" }}>
                    {opt.label}
                  </b>
                  <small style={{ fontSize: "9px", color: "#6b7280" }}>{opt.detail}</small>
                </div>
                {model === opt.value && <Check size={14} color="#4f46e5" />}
              </button>
            ))}
          </div>
        </div>

        {/* En-Boy Oranı & Süre */}
        <div className="video-control-section">
          <strong>En-Boy Oranı & Süre</strong>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px", marginTop: "10px" }}>
            {ASPECT_RATIO_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                onClick={() => setAspectRatio(opt.value)}
                style={{
                  padding: "8px 4px",
                  borderRadius: "8px",
                  border: aspectRatio === opt.value ? "1.5px solid var(--accent, #6366f1)" : "1px solid #e5e7eb",
                  background: aspectRatio === opt.value ? "#f5f3ff" : "#ffffff",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "2px",
                }}
              >
                <span style={{ fontSize: "14px" }}>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>

          <div className="video-segmented" style={{ marginTop: "10px" }}>
            {([4, 6, 8] as const).map((sec) => (
              <button
                type="button"
                key={sec}
                className={duration === sec ? "active" : ""}
                onClick={() => setDuration(sec)}
              >
                {sec} sn
              </button>
            ))}
          </div>
        </div>

        {/* Bildirim Mesajı */}
        {message && (
          <div className="generation-notice" style={{ marginTop: "12px" }}>
            <Sparkles size={14} />
            <span>{message}</span>
          </div>
        )}

        {/* Üretim Butonu */}
        <button
          type="button"
          className="generate-button"
          disabled={submitting || Boolean(activeJob)}
          onClick={handleGenerate}
          style={{ marginTop: "16px" }}
        >
          {submitting || activeJob ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <Play size={18} />
          )}
          {submitting
            ? "REST Görevi Gönderiliyor..."
            : activeJob
            ? "Flow Video İşleniyor..."
            : "Flow Video Üret"}
          <span>{duration} sn · {model.split("-")[0].toUpperCase()}</span>
        </button>
      </section>

      {/* ORTA PANEL: CANLI ÖNİZLEME & OYNATICI */}
      <section className="video-preview-panel">
        <div className="results-toolbar">
          <div>
            <h2>Video Oynatıcı & Canlı Akış</h2>
            <span>Flow REST API · Veo 3.1 MP4 Akışı</span>
          </div>
          <div className="video-preview-actions">
            <button
              type="button"
              className="icon-button"
              onClick={() => void loadStudioData()}
              title="Yenile"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Aktif İş Banner'ı */}
        {activeJob && (
          <div
            style={{
              padding: "14px 16px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "12px",
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "12px", color: "#1e40af" }}>
                <LoaderCircle className="spin" size={16} />
                <span>{activeJob.progressDetail || "Flow API video oluşturuyor..."}</span>
              </div>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#2563eb" }}>
                %{activeJob.progressPercent || 25}
              </span>
            </div>
            <div style={{ width: "100%", height: "6px", background: "#dbeafe", borderRadius: "3px", overflow: "hidden" }}>
              <div
                style={{
                  width: `${activeJob.progressPercent || 25}%`,
                  height: "100%",
                  background: "#2563eb",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <small style={{ display: "block", marginTop: "6px", fontSize: "10px", color: "#60a5fa" }}>
              Görev ID: {activeJob.id.slice(0, 12)}... · Model: {activeJob.model} · {activeJob.durationSeconds} sn
            </small>
          </div>
        )}

        {/* Video Oynatıcı */}
        <div className="video-player-shell">
          {selectedVideo && selectedVideo.status === "complete" && selectedVideo.videoUrl ? (
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <video
                key={selectedVideo.id}
                src={selectedVideo.videoUrl}
                poster={selectedVideo.thumbnailUrl}
                controls
                autoPlay
                loop
                playsInline
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  borderRadius: "12px",
                  objectFit: "contain",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
                }}
              />
            </div>
          ) : (
            <div className="video-preview-empty">
              <Film size={36} />
              <strong>Henüz gösterilecek Flow video seçilmedi</strong>
              <small>Soldaki formdan yeni bir Veo videosu üretin veya arşivden seçin.</small>
            </div>
          )}
        </div>

        {/* Seçili Video Aksiyonları */}
        {selectedVideo && selectedVideo.status === "complete" && selectedVideo.videoUrl && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              background: "#fafafd",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "12px",
              marginTop: "16px",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div style={{ fontSize: "12px", color: "#475569" }}>
              <b>{selectedVideo.model}</b> · {selectedVideo.durationSeconds} sn · {selectedVideo.aspectRatio}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <a
                href={selectedVideo.videoUrl}
                download={`flow-video-${selectedVideo.id}.mp4`}
                className="button secondary"
                style={{ height: "32px", fontSize: "11px", padding: "0 10px" }}
              >
                <Download size={13} />
                İndir
              </a>
              <TelegramSendButton
                mediaUrl={selectedVideo.videoUrl}
                mediaType="video"
                variant="button"
                label="Telegram"
                size={12}
              />
              <Link
                href={`/projects/${projectId}/publishing?assetId=${selectedVideo.id}`}
                className="button primary"
                style={{ height: "32px", fontSize: "11px", padding: "0 10px" }}
              >
                <Send size={13} />
                Planla
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ALT PANEL: FLOW VİDEO GEÇMİŞİ */}
      <section className="video-history" style={{ gridColumn: "1 / -1", marginTop: "8px" }}>
        <div className="history-heading">
          <div>
            <span>
              <Film size={16} />
            </span>
            <div>
              <h2>Üretilen Flow Videoları ({videos.length})</h2>
              <p>Google Flow & Veo REST API ile oluşturulmuş proje arşivi</p>
            </div>
          </div>
        </div>

        {videos.length ? (
          <div className="video-history-grid">
            {videos.map((vid) => {
              const isSelected = selectedVideo?.id === vid.id;
              const isComplete = vid.status === "complete";
              return (
                <article
                  key={vid.id}
                  style={{
                    border: isSelected ? "2px solid var(--accent, #6366f1)" : "1px solid var(--border, #e2e8f0)",
                    borderRadius: "12px",
                    overflow: "hidden",
                    background: "#ffffff",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      aspectRatio: vid.aspectRatio === "16:9" ? "16/9" : "9/16",
                      maxHeight: "220px",
                      background: "#0f172a",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onClick={() => setSelectedVideoId(vid.id)}
                  >
                    {isComplete && vid.videoUrl ? (
                      <video
                        src={vid.videoUrl}
                        poster={vid.thumbnailUrl}
                        preload="none"
                        playsInline
                        muted
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ textAlign: "center", color: "#94a3b8", padding: "16px" }}>
                        <LoaderCircle className="spin" size={24} style={{ margin: "0 auto 6px" }} />
                        <span style={{ fontSize: "11px", display: "block" }}>
                          {vid.status === "failed" ? "Başarısız" : "İşleniyor..."}
                        </span>
                      </div>
                    )}
                    <span
                      style={{
                        position: "absolute",
                        top: "8px",
                        left: "8px",
                        background: "rgba(15, 23, 42, 0.75)",
                        color: "#ffffff",
                        padding: "2px 6px",
                        borderRadius: "6px",
                        fontSize: "9px",
                        fontWeight: 700,
                      }}
                    >
                      {vid.model.replace("veo-", "Veo ")}
                    </span>
                    <span
                      style={{
                        position: "absolute",
                        bottom: "8px",
                        right: "8px",
                        background: "rgba(15, 23, 42, 0.75)",
                        color: "#ffffff",
                        padding: "2px 6px",
                        borderRadius: "6px",
                        fontSize: "9px",
                        fontWeight: 700,
                      }}
                    >
                      {vid.durationSeconds} sn
                    </span>
                  </div>

                  <div style={{ padding: "10px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "8px" }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "11px",
                        lineHeight: "1.4",
                        color: "#334155",
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                      title={vid.prompt}
                    >
                      {vid.prompt}
                    </p>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "6px", borderTop: "1px solid #f1f5f9" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        {isComplete && vid.videoUrl && (
                          <>
                            <a
                              href={vid.videoUrl}
                              download={`flow-${vid.id}.mp4`}
                              title="İndir"
                              style={{ color: "#475569", padding: "4px" }}
                            >
                              <Download size={13} />
                            </a>
                            <TelegramSendButton
                              mediaUrl={vid.videoUrl}
                              mediaType="video"
                              variant="icon"
                              size={13}
                            />
                            <Link
                              href={`/projects/${projectId}/publishing?assetId=${vid.id}`}
                              title="Planla"
                              style={{ color: "var(--accent, #6366f1)", padding: "4px" }}
                            >
                              <Send size={13} />
                            </Link>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDelete(vid.id)}
                        disabled={deletingId === vid.id}
                        title="Sil"
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ef4444",
                          cursor: "pointer",
                          padding: "4px",
                        }}
                      >
                        {deletingId === vid.id ? <LoaderCircle className="spin" size={13} /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="history-empty">
            <Film size={26} />
            <span>Henüz Flow ile video üretilmedi.</span>
          </div>
        )}
      </section>

      {/* REST API AYARLARI MODALI */}
      {showConfigModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: "16px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "480px",
              background: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <KeyRound size={20} color="#6366f1" />
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>Flow REST API Bağlantısı</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 16px", lineHeight: "1.5" }}>
              Google Flow ve Veo modellerine erişim sağlayan REST API servisinizin adresini ve erişim token&apos;ınızı girin.
              Bilgiler AES-256-GCM ile şifrelenerek veritabanında saklanır.
            </p>

            <div style={{ display: "grid", gap: "12px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
                  REST API Servis Adresi (Base URL)
                </label>
                <input
                  type="text"
                  value={configBaseUrl}
                  onChange={(e) => setConfigBaseUrl(e.target.value)}
                  placeholder="https://api.useapi.net/v1/google-flow veya http://127.0.0.1:8001"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
                  API Anahtarı / Token
                </label>
                <input
                  type="password"
                  value={configApiKey}
                  onChange={(e) => setConfigApiKey(e.target.value)}
                  placeholder="Bearer token veya API Key (Mevcut kalması için boş bırakın)"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {configMessage && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  fontSize: "11px",
                  marginBottom: "16px",
                  background: configMessage.startsWith("✓") ? "#effaf5" : "#fef2f2",
                  color: configMessage.startsWith("✓") ? "#15803d" : "#b91c1c",
                }}
              >
                {configMessage}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                className="button secondary"
                onClick={handleTestConfig}
                disabled={testingConfig || savingConfig}
                style={{ height: "36px", fontSize: "12px" }}
              >
                {testingConfig ? <LoaderCircle className="spin" size={14} /> : null}
                Bağlantıyı Test Et
              </button>
              <button
                type="button"
                className="button primary"
                onClick={handleSaveConfig}
                disabled={savingConfig || testingConfig}
                style={{ height: "36px", fontSize: "12px" }}
              >
                {savingConfig ? <LoaderCircle className="spin" size={14} /> : null}
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
