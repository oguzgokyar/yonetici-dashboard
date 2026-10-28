"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  LoaderCircle,
  Maximize2,
  Send,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
  AlertCircle,
  FileImage,
  StopCircle,
  Video,
  Play,
  Download,
  Film,
  RefreshCw,
  Palette,
  CalendarPlus,
  Clapperboard,
  RotateCcw,
} from "lucide-react";
import { TelegramSendButton } from "@/components/ui/telegram-send-button";
import { CANVA_CONTENT_TYPES, type CanvaContentType } from "@/lib/server/hermes-canva-task";
import type { Project } from "@/features/projects/projects-context";

type BrandKey = "logo" | "brandName" | "phone" | "email" | "address" | "website";

const brandFields: { key: BrandKey; label: string }[] = [
  { key: "logo", label: "Logo" },
  { key: "brandName", label: "Marka adı" },
  { key: "phone", label: "Telefon" },
  { key: "email", label: "E-posta" },
  { key: "address", label: "Adres" },
  { key: "website", label: "Web sitesi" },
];

export interface CanvaPackageItem {
  id: string;
  assetId: string;
  position: number;
  mimeType: string;
  width: number;
  height: number;
  url: string;
}

export interface CanvaPackage {
  id: string;
  projectId: string;
  generationJobId: string;
  source: string;
  packageType: "single" | "carousel" | "video";
  title: string;
  coverAssetId: string;
  coverUrl: string;
  itemCount: number;
  canvaDesignId: string;
  canvaEditUrl: string;
  videoAssetId?: string | null;
  videoUrl?: string | null;
  videoDuration?: number | null;
  videoStatus?: "idle" | "rendering" | "ready" | "failed" | string | null;
  createdAt: string;
  updatedAt?: string;
  items: CanvaPackageItem[];
}

export interface CanvaJob {
  id: string;
  status: "queued" | "dispatching" | "running" | "exporting" | "uploading" | "complete" | "failed";
  prompt: string;
  error?: string | null;
  createdAt: string;
  completedAt?: string | null;
  request?: {
    contentType?: CanvaContentType;
    slideCount?: number;
    prompt?: string;
    style?: string;
  };
  progress: {
    phase?: string;
    percent?: number;
    completed?: number;
    total?: number;
    detail?: string;
    updatedAt?: string;
  };
}

export function CanvaGenerationStudio({
  projectId,
  project,
}: {
  projectId: string;
  project: Project;
}) {
  const [prompt, setPrompt] = useState("");
  const [contentType, setContentType] = useState<CanvaContentType>("instagram_carousel");
  const [slideCount, setSlideCount] = useState(6);
  const [style, setStyle] = useState("Modern ve minimalist");
  const [applyBrandStyle, setApplyBrandStyle] = useState(true);
  const [selectedFields, setSelectedFields] = useState<BrandKey[]>([
    "logo",
    "brandName",
    "website",
  ]);

  const [message, setMessage] = useState("");
  const [producing, setProducing] = useState(false);
  const [isRefiningPrompt, setIsRefiningPrompt] = useState(false);
  const [originalPrompt, setOriginalPrompt] = useState<string | null>(null);
  const [showPrefillRefineTip, setShowPrefillRefineTip] = useState(false);
  const [jobs, setJobs] = useState<CanvaJob[]>([]);
  const [packages, setPackages] = useState<CanvaPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [dismissedFailedJobIds, setDismissedFailedJobIds] = useState<Set<string>>(new Set());
  const [archiveTab, setArchiveTab] = useState<"packages" | "videos">("packages");

  // Video conversion and playback state
  const [convertingVideoPkgId, setConvertingVideoPkgId] = useState<string | null>(null);
  const [videoModalPkg, setVideoModalPkg] = useState<CanvaPackage | null>(null);
  const [durationPerSlide, setDurationPerSlide] = useState<number>(3.5);
  const [activeVideoPlayerPkg, setActiveVideoPlayerPkg] = useState<CanvaPackage | null>(null);
  const [useMagicAnimate, setUseMagicAnimate] = useState<boolean>(true);
  const [videoConvertError, setVideoConvertError] = useState<string | null>(null);

  // Gallery / Lightbox state for Carousel packages
  const [syncingPkgId, setSyncingPkgId] = useState<string | null>(null);
  const [refiningPkgId, setRefiningPkgId] = useState<string | null>(null);
  const [activePackage, setActivePackage] = useState<CanvaPackage | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Canva API Quota / Status State
  const [quotaInfo, setQuotaInfo] = useState<{
    ok: boolean;
    status: "normal" | "quota_exceeded" | "auth_required";
    statusLabel: string;
    hasAuthOutage?: boolean;
    authStatus?: string;
    reconnectUrl?: string;
    authMessage?: string | null;
    dailyExportsCount: number;
    totalDailyCapacity?: number;
    availableAccounts?: number;
    activeAccounts?: number;
    totalAccounts?: number;
    resetTimeFormatted: string;
    hoursUntilReset: number;
    minutesUntilReset: number;
    lastError?: string | null;
  } | null>(null);
  const [showQuotaDropdown, setShowQuotaDropdown] = useState(false);
  const [probingQuota, setProbingQuota] = useState(false);

  const available = useMemo(() => project.brand || {}, [project]);

  // Form persistence in localStorage & Pre-fill from Strategy Studio
  useEffect(() => {
    try {
      const storedDismissed = localStorage.getItem(`canva_dismissed_failed_${projectId}`);
      if (storedDismissed) {
        const parsed = JSON.parse(storedDismissed);
        if (Array.isArray(parsed)) {
          setDismissedFailedJobIds(new Set(parsed));
        }
      }
    } catch {}
  }, [projectId]);

  function handleDismissFailedJob(jobId: string) {
    setDismissedFailedJobIds((prev) => {
      const updated = new Set(prev).add(jobId);
      try {
        localStorage.setItem(`canva_dismissed_failed_${projectId}`, JSON.stringify(Array.from(updated)));
      } catch {}
      return updated;
    });

    // Also delete/remove the failed record from backend so it never resurfaces in jobs or queue
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    void fetch(`/api/projects/${encodeURIComponent(projectId)}/canva/jobs`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    }).catch(() => {});
  }

  // Form persistence in localStorage & Pre-fill from Strategy Studio / Quick Ideas Drawer
  useEffect(() => {
    try {
      // Check for incoming prefill first
      const prefill = localStorage.getItem(`canva_prefill_${projectId}`);
      if (prefill) {
        localStorage.removeItem(`canva_prefill_${projectId}`); // consume once
        const parsedPrefill = JSON.parse(prefill);
        if (parsedPrefill.prompt) setPrompt(parsedPrefill.prompt);
        if (parsedPrefill.contentType) setContentType(parsedPrefill.contentType);
        if (parsedPrefill.slideCount) setSlideCount(parsedPrefill.slideCount);
        if (parsedPrefill.style) setStyle(parsedPrefill.style);
        if (parsedPrefill.isPrefilledFromIdea) {
          setShowPrefillRefineTip(true);
        }
        setMessage("✓ Aktarılan kreatif fikir prompt alanına yerleştirildi.");
        try {
          const el = document.getElementById("canva-prompt");
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.focus();
          }
        } catch {}
        return;
      }

      const saved = localStorage.getItem(`canva_form_${projectId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.prompt) setPrompt(parsed.prompt);
        if (parsed.contentType) setContentType(parsed.contentType);
        if (parsed.slideCount) setSlideCount(parsed.slideCount);
        if (parsed.style) setStyle(parsed.style);
      }
    } catch {}
  }, [projectId]);

  // Listen for live canva-prefill events (when Canva studio is already mounted)
  useEffect(() => {
    function handlePrefillEvent(e: Event) {
      const customEvent = e as CustomEvent<{
        prompt?: string;
        contentType?: CanvaContentType;
        slideCount?: number;
        style?: string;
        isPrefilledFromIdea?: boolean;
      }>;
      const detail = customEvent.detail;
      if (!detail) return;
      if (detail.prompt) setPrompt(detail.prompt);
      if (detail.contentType) setContentType(detail.contentType);
      if (detail.slideCount) setSlideCount(detail.slideCount);
      if (detail.style) setStyle(detail.style);
      if (detail.isPrefilledFromIdea) {
        setShowPrefillRefineTip(true);
      }
      try {
        localStorage.removeItem(`canva_prefill_${projectId}`);
      } catch {}
      setMessage("✓ Aktarılan kreatif fikir prompt alanına yerleştirildi.");
      try {
        const el = document.getElementById("canva-prompt");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
        }
      } catch {}
    }

    window.addEventListener("canva-prefill", handlePrefillEvent);
    return () => window.removeEventListener("canva-prefill", handlePrefillEvent);
  }, [projectId]);

  useEffect(() => {
    if (!prompt) return; // Prevent overwriting stored form with empty initial state
    try {
      localStorage.setItem(
        `canva_form_${projectId}`,
        JSON.stringify({ prompt, contentType, slideCount, style })
      );
    } catch {}
  }, [projectId, prompt, contentType, slideCount, style]);

  const activeJob = jobs.find((j) =>
    ["queued", "dispatching", "running", "exporting", "uploading"].includes(j.status)
  );
  // Also track any package that is currently rendering video or AI layout refining in background
  const activeRenderingPackage = packages.find(
    (p) => p.videoStatus === "rendering" || p.videoStatus === "refining" || p.id === syncingPkgId
  );

  const latestFailedJob = jobs.find(
    (j) => j.status === "failed" && !dismissedFailedJobIds.has(j.id)
  );
  const isProducing = producing || Boolean(activeJob) || Boolean(activeRenderingPackage);

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/canva/jobs`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        jobs?: CanvaJob[];
      };
      if (data.ok && Array.isArray(data.jobs)) {
        setJobs(data.jobs);
      }
    } catch {
      // ignore
    }
  }, [projectId]);

  const loadPackages = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoadingPackages(true);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/canva/packages`,
        { cache: "no-store" }
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        packages?: CanvaPackage[];
      };
      if (data.ok && Array.isArray(data.packages)) {
        setPackages(data.packages);
      }
    } catch {
      if (!isBackground) setMessage("Canva paketleri alınamadı.");
    } finally {
      if (!isBackground) setLoadingPackages(false);
    }
  }, [projectId]);

  const loadQuotaStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/canva/status`);
      if (res.ok) {
        const data = await res.json();
        setQuotaInfo(data);
      }
    } catch {}
  }, [projectId]);

  async function handleProbeQuota() {
    setProbingQuota(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/canva/status`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setQuotaInfo(data);
      }
    } catch {} finally {
      setProbingQuota(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadJobs();
    void loadPackages(false);
    void loadQuotaStatus();
  }, [loadJobs, loadPackages, loadQuotaStatus]);

  // Periodic quota check
  useEffect(() => {
    const t = setInterval(() => {
      void loadQuotaStatus();
    }, 45000);
    return () => clearInterval(t);
  }, [loadQuotaStatus]);

  // Polling when a job is in-flight or when packages have pending videos/refining
  useEffect(() => {
    const hasPendingActivity =
      isProducing ||
      packages.some(
        (p) =>
          p.videoStatus === "rendering" ||
          p.videoStatus === "refining" ||
          (p.packageType === "video" && !p.videoUrl)
      );
    if (!hasPendingActivity) return;
    const timer = window.setInterval(async () => {
      await loadJobs();
      await loadPackages(true);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [isProducing, packages, loadJobs, loadPackages]);

  function toggleField(key: BrandKey) {
    if (!available[key]) return;
    setSelectedFields((curr) =>
      curr.includes(key) ? curr.filter((k) => k !== key) : [...curr, key]
    );
  }

  async function handleRefinePrompt() {
    if (!prompt.trim() || isRefiningPrompt) return;
    setIsRefiningPrompt(true);
    setMessage("");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/canva/refine-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          contentType,
          slideCount:
            CANVA_CONTENT_TYPES[contentType]?.packageType === "carousel" ? slideCount : 1,
          style,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        refinedPrompt?: string;
        originalPrompt?: string;
        slideCount?: number;
        message?: string;
      };
      if (!res.ok || !data.ok || !data.refinedPrompt) {
        throw new Error(data.message || "Prompt optimize edilemedi.");
      }
      setOriginalPrompt(prompt);
      setPrompt(data.refinedPrompt);
      if (data.slideCount && CANVA_CONTENT_TYPES[contentType]?.packageType === "carousel") {
        setSlideCount(data.slideCount);
      }
      setShowPrefillRefineTip(false);
      setMessage("✓ Prompt Canva slayt formatına optimize edildi.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Prompt optimize edilirken bir sorun oluştu.");
    } finally {
      setIsRefiningPrompt(false);
    }
  }

  function handleUndoRefine() {
    if (originalPrompt) {
      setPrompt(originalPrompt);
      setOriginalPrompt(null);
      setMessage("Orijinal prompt metnine geri dönüldü.");
    }
  }

  async function handleCreateJob() {
    if (!prompt.trim()) {
      setMessage("Üretime başlamak için kreatif briefinizi veya içerik fikrinizi yazın.");
      return;
    }

    if (quotaInfo && (quotaInfo.status === "auth_required" || quotaInfo.hasAuthOutage)) {
      setMessage("⚠️ Canva oturumunun süresi dolmuş veya bağlı hesap yok. Lütfen Sistem Ayarları'ndan hesabı yeniden bağlayın.");
      return;
    }

    setProducing(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/canva/jobs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: prompt.trim(),
            contentType,
            slideCount:
              CANVA_CONTENT_TYPES[contentType]?.packageType === "carousel" ? slideCount : 1,
            style,
            selectedBrandFields: selectedFields,
            applyBrandStyle,
            idempotencyKey: crypto.randomUUID(),
          }),
        }
      );

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        jobId?: string;
      };

      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Canva işi başlatılamadı.");
      }

      setMessage("✓ Canva üretim görevi sıraya alındı.");
      await loadJobs();
      // Notify production queue drawer to refresh and open
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("production-queue-updated", { detail: { openDrawer: true } }));
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Görev oluşturulamadı.");
    } finally {
      setProducing(false);
    }
  }

  async function handleDeletePackage(packageId: string) {
    if (!window.confirm("Bu Canva tasarım paketini ve tüm slaytlarını silmek istediğinize emin misiniz?")) {
      return;
    }
    setDeletingId(packageId);
    setMessage("");
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/canva/packages/${encodeURIComponent(
          packageId
        )}`,
        { method: "DELETE" }
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Paket silinemedi.");
      }
      setPackages((curr) => curr.filter((p) => p.id !== packageId));
      if (activePackage?.id === packageId) {
        setActivePackage(null);
      }
      setMessage("Paket başarıyla silindi.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Paket silinemedi.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSyncPackage(packageId: string) {
    if (syncingPkgId) return; // Concurrency guard: only one sync at a time
    setSyncingPkgId(packageId);
    setMessage("");
    // Üretim listesi çekmecesini canlı olarak aç ve kuyruğu uyar
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("production-queue-updated", { detail: { openDrawer: true } }));
    }
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/canva/packages/${encodeURIComponent(
          packageId
        )}/sync`,
        { method: "POST" }
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Canva'dan güncellenemedi.");
      }
      setMessage(data.message || "Canva'dan başarıyla güncellendi.");
      await loadPackages();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Canva'dan güncellenemedi.");
    } finally {
      setSyncingPkgId(null);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("production-queue-updated", { detail: { openDrawer: false } }));
      }
    }
  }

  async function handleRefinePackage(packageId: string, slideIndex?: number) {
    if (refiningPkgId) return;
    setRefiningPkgId(packageId);
    setMessage("");
    // Üretim listesi çekmecesini canlı olarak aç ve kuyruğu uyar
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("production-queue-updated", { detail: { openDrawer: true } }));
    }
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/canva/packages/${encodeURIComponent(packageId)}/refine`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slideIndex }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Tasarım düzeni onarılamadı.");
      }
      setMessage(data.message || "🪄 AI düzen onarımı başlatıldı! Üretim listesinden takip edebilirsiniz.");
      await loadPackages(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Onarım işlemi gerçekleştirilemedi.");
    } finally {
      setRefiningPkgId(null);
    }
  }

  async function handleCancelJob(jobId: string) {
    if (!window.confirm("Devam eden Canva tasarım üretimini durdurup iptal etmek istediğinize emin misiniz?")) {
      return;
    }
    setCancellingJobId(jobId);
    setMessage("");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/canva/jobs`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "İşlem iptal edilemedi.");
      }
      setJobs((curr) =>
        curr.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: "failed",
                progress: {
                  ...j.progress,
                  phase: "failed",
                  detail: "Kullanıcı tarafından iptal edildi.",
                },
              }
            : j
        )
      );
      setProducing(false);
      setMessage("Tasarım üretimi başarıyla durduruldu ve iptal edildi.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "İşlem iptal edilemedi.");
    } finally {
      setCancellingJobId(null);
    }
  }

  async function handleConvertVideo(packageId: string, durationSec: number, magicAnimate: boolean) {
    setConvertingVideoPkgId(packageId);
    setVideoConvertError(null);
    setMessage("");

    // 1. Modalı kullanıcıyı bekletmeden hemen kapat
    setVideoModalPkg(null);

    // 2. İlgili paketin durumunu rendering yap
    setPackages((curr) =>
      curr.map((p) =>
        p.id === packageId
          ? {
              ...p,
              videoStatus: "rendering",
            }
          : p
      )
    );

    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/canva/packages/${encodeURIComponent(
          packageId
        )}/export-video`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ durationPerSlide: durationSec, useMagicAnimate: magicAnimate }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        queued?: boolean;
        message?: string;
        videoUrl?: string;
        videoAssetId?: string;
        duration?: number;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Video oluşturulamadı.");
      }

      // 3. Üretim çekmecesini otomatik aç ve güncelle
      window.dispatchEvent(new CustomEvent("production-queue-updated", { detail: { openDrawer: true } }));
      setMessage("Canva Sihirli Video üretimi başlatıldı ve üretim listesine eklendi! Çekmeceden takip edebilirsiniz.");
    } catch (err) {
      const errText = err instanceof Error ? err.message : "Video dönüştürme başarısız.";
      setVideoConvertError(errText);
      setMessage(errText);
    } finally {
      setConvertingVideoPkgId(null);
    }
  }

  function openGallery(pkg: CanvaPackage) {
    setActivePackage(pkg);
    setActiveSlideIndex(0);
  }

  return (
    <div className="generation-studio">
      {/* Sol Kontrol Paneli */}
      <section className="generation-controls">
        <div className="generation-control-header">
          <div>
            <span>HERMES + CODEX + CANVA MCP</span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", position: "relative" }}>
              <h2>Canva Stüdyosu</h2>
              {quotaInfo && (
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => setShowQuotaDropdown((v) => !v)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "3px 8px",
                      borderRadius: "12px",
                      fontSize: "11px",
                      fontWeight: 600,
                      border:
                        quotaInfo.status === "quota_exceeded" || quotaInfo.status === "auth_required" || quotaInfo.hasAuthOutage
                          ? "1px solid #fca5a5"
                          : "1px solid #86efac",
                      background:
                        quotaInfo.status === "quota_exceeded" || quotaInfo.status === "auth_required" || quotaInfo.hasAuthOutage
                          ? "#fef2f2"
                          : "#f0fdf4",
                      color:
                        quotaInfo.status === "quota_exceeded" || quotaInfo.status === "auth_required" || quotaInfo.hasAuthOutage
                          ? "#b91c1c"
                          : "#15803d",
                      cursor: "pointer",
                      lineHeight: 1.2,
                    }}
                    title="Canva API Kota ve Durum Detayı için tıklayın"
                  >
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background:
                          quotaInfo.status === "quota_exceeded" || quotaInfo.status === "auth_required" || quotaInfo.hasAuthOutage
                            ? "#dc2626"
                            : "#16a34a",
                        display: "inline-block",
                      }}
                    />
                    {quotaInfo.status === "auth_required" || quotaInfo.hasAuthOutage
                      ? "Oturum Düştü"
                      : quotaInfo.status === "quota_exceeded"
                      ? "Kota Doldu"
                      : quotaInfo.statusLabel || "API Aktif"}
                  </button>

                  {/* Dropdown Popover */}
                  {showQuotaDropdown && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        marginTop: "6px",
                        width: "250px",
                        background: "white",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                        padding: "12px",
                        zIndex: 100,
                        fontSize: "12px",
                        color: "#334155",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "8px",
                          borderBottom: "1px solid #f1f5f9",
                          paddingBottom: "6px",
                        }}
                      >
                        <strong style={{ fontSize: "12px", color: "#0f172a" }}>Canva Hesap Havuzu</strong>
                        <span style={{ fontSize: "10px", color: "#64748b" }}>24s Kota</span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "#64748b" }}>Durum:</span>
                          <strong style={{ color: quotaInfo.status === "quota_exceeded" ? "#dc2626" : "#16a34a" }}>
                            {quotaInfo.statusLabel}
                          </strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "#64748b" }}>Bugünkü İşlemler:</span>
                          <strong>{quotaInfo.dailyExportsCount} / {quotaInfo.totalDailyCapacity || 500}</strong>
                        </div>
                        {quotaInfo.status === "quota_exceeded" ? (
                          <div style={{ display: "flex", justifyContent: "space-between", color: "#b45309" }}>
                            <span>Sıfırlanma:</span>
                            <strong>Gece 03:00 TSİ ({quotaInfo.hoursUntilReset}s {quotaInfo.minutesUntilReset}d)</strong>
                          </div>
                        ) : (
                          <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                            <span>Yenilenme:</span>
                            <span>Gece 03:00 TSİ</span>
                          </div>
                        )}
                      </div>

                      <Link
                        href="/settings"
                        style={{
                          display: "block",
                          marginBottom: "8px",
                          textAlign: "center",
                          fontSize: "11px",
                          color: "#6366f1",
                          fontWeight: 600,
                          textDecoration: "none",
                          padding: "4px 0",
                          borderRadius: "4px",
                          background: "#eef2ff",
                        }}
                      >
                        ⚙️ Hesap Havuzunu Yönet ➔
                      </Link>

                      <button
                        type="button"
                        onClick={handleProbeQuota}
                        disabled={probingQuota}
                        style={{
                          width: "100%",
                          padding: "6px 0",
                          borderRadius: "6px",
                          border: "1px solid #e2e8f0",
                          background: probingQuota ? "#f8fafc" : "#f1f5f9",
                          color: "#1e293b",
                          fontWeight: 500,
                          fontSize: "11px",
                          cursor: probingQuota ? "wait" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "5px",
                        }}
                      >
                        <RefreshCw className={probingQuota ? "spin" : ""} size={12} />
                        {probingQuota ? "Kontrol ediliyor..." : "Durumu Test Et"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <WandSparkles size={21} />
        </div>

        {/* Canva Kesinti / Oturum Uyarısı Bandı */}
        {quotaInfo && (quotaInfo.status === "auth_required" || quotaInfo.hasAuthOutage) && (
          <div
            style={{
              margin: "10px 0 14px 0",
              padding: "10px 14px",
              background: "#fef2f2",
              border: "1px solid #f87171",
              borderRadius: "10px",
              fontSize: "12px",
              color: "#991b1b",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertCircle size={16} color="#dc2626" />
              <span>
                <strong>Canva Oturumu Kapalı:</strong> Yeni görsel üretimi için hesabınızı yeniden bağlayın.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {quotaInfo.reconnectUrl && (
                <a
                  href={quotaInfo.reconnectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: "4px 10px",
                    background: "#dc2626",
                    color: "white",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 600,
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <ExternalLink size={11} />
                  Yeniden Yetkilendir
                </a>
              )}
              <Link
                href="/settings"
                style={{
                  padding: "4px 10px",
                  background: "#fee2e2",
                  color: "#991b1b",
                  border: "1px solid #fca5a5",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 600,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Ayarlar →
              </Link>
            </div>
          </div>
        )}

        <div className="brand-concept-status">
          <span style={{ background: project.brand?.primaryColor || "#7a6deb" }}>
            <Sparkles size={13} />
          </span>
          <div>
            <strong>Marka kuralları devrede</strong>
            <small>
              {project.brandConcept.summary || "Doğrulanmış font, logo ve güvenli alan sözleşmesi."}
            </small>
          </div>
          <Link href={`/projects/${projectId}/settings`}>Düzenle</Link>
        </div>

        {/* Marka Kaynakları */}
        <div className="control-section">
          <div className="control-title">
            <span>Marka kaynakları</span>
            <Link href={`/projects/${projectId}/settings`}>Düzenle</Link>
          </div>
          <div className="brand-source-grid" style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {/* Marka Stili - Brand Guardian Seçeneği Çipi */}
            <button
              type="button"
              className={`source-chip ${applyBrandStyle ? "selected" : ""}`}
              onClick={() => setApplyBrandStyle(!applyBrandStyle)}
              title={applyBrandStyle ? "Marka Stili Aktif: 60-30-10 renk dengesi ve sabit tipografi uygulanır" : "Marka Stili Devre Dışı: Serbest tasarım"}
              style={{
                borderColor: applyBrandStyle ? "#10b981" : undefined,
                background: applyBrandStyle ? "#ecfdf5" : undefined,
                color: applyBrandStyle ? "#065f46" : undefined,
                fontWeight: 600,
              }}
            >
              <span>{applyBrandStyle ? <Check size={12} /> : <Sparkles size={12} />}</span>
              Marka stili
            </button>

            {/* Diğer Marka Detay Çipleri */}
            {brandFields.map(({ key, label }) => {
              const exists = Boolean(available[key]);
              const selected = selectedFields.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!exists}
                  className={`source-chip ${selected ? "selected" : ""}`}
                  onClick={() => toggleField(key)}
                  title={!exists ? "Bu bilgi proje ayarlarında tanımlı değil" : label}
                >
                  <span>{selected && <Check size={12} />}</span>
                  {label}
                  {!exists && <small>Eksik</small>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Prompt Alanı */}
        <div className="control-section">
          <div className="control-title">
            <label htmlFor="canva-prompt">
              <span>Kreatif Brief / Prompt</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {prompt.trim().length > 0 && (
                <button
                  type="button"
                  onClick={handleRefinePrompt}
                  disabled={isRefiningPrompt}
                  className="prompt-refine-btn"
                  title="Promptu Canva slayt formatına optimize et"
                >
                  {isRefiningPrompt ? (
                    <>
                      <LoaderCircle size={13} className="spin" />
                      <span>İyileştiriliyor...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} />
                      <span>AI ile İyileştir</span>
                    </>
                  )}
                </button>
              )}
              {prompt.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setPrompt("");
                    setOriginalPrompt(null);
                    setShowPrefillRefineTip(false);
                    setMessage("");
                  }}
                  className="prompt-clear-btn"
                  title="Prompt metnini temizle"
                >
                  <X size={13} />
                  <span>Temizle</span>
                </button>
              )}
            </div>
          </div>

          {showPrefillRefineTip && (
            <div className="prompt-refine-tip-banner">
              <Sparkles size={14} className="tip-icon" />
              <span>
                Bu fikir strateji kütüphanesinden aktarıldı. Canva slaytlarına kusursuz oturması için optimize edebilirsiniz.
              </span>
              <button
                type="button"
                onClick={handleRefinePrompt}
                disabled={isRefiningPrompt}
                className="tip-action-btn"
              >
                {isRefiningPrompt ? "İyileştiriliyor..." : "Optimize Et"}
              </button>
              <button
                type="button"
                onClick={() => setShowPrefillRefineTip(false)}
                className="tip-close-btn"
                title="Kapat"
              >
                <X size={12} />
              </button>
            </div>
          )}

          <textarea
            id="canva-prompt"
            className="prompt-area"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setMessage("");
            }}
            placeholder="Örn: Yapay zekayı iş süreçlerine entegre etmenin 5 somut adımı. Giriş kancası güçlü, her sayfada tek bir ana aksiyon olan, koyu mor ve beyaz tonlarında profesyonel carousel..."
          />
          <div className="prompt-footer">
            <div>
              {originalPrompt && (
                <button
                  type="button"
                  onClick={handleUndoRefine}
                  className="prompt-undo-btn"
                  title="İyileştirme öncesindeki orijinal metne dön"
                >
                  <RotateCcw size={12} />
                  <span>Orijinal Metne Dön</span>
                </button>
              )}
            </div>
            <span className={prompt.length > 2000 ? "text-red-500 font-semibold" : ""}>
              {prompt.length}/2000
            </span>
          </div>
        </div>

        {/* Nitelik Seçiciler */}
        <div className="attribute-grid">
          <div className="select-field">
            <span>Zorunlu İçerik Türü</span>
            <div>
              <select
                value={contentType}
                onChange={(e) => {
                  const newType = e.target.value as CanvaContentType;
                  setContentType(newType);
                  const meta = CANVA_CONTENT_TYPES[newType];
                  if (meta && meta.packageType === "carousel") {
                    setSlideCount((prev) => Math.max(meta.minSlides, Math.min(meta.maxSlides, prev || meta.defaultSlides)));
                  }
                }}
              >
                <optgroup label="📸 Carousel (Çoklu Slayt)">
                  <option value="instagram_carousel">Instagram Portre Carousel (1080×1350 • 4:5)</option>
                  <option value="square_carousel">Kare Carousel (1080×1080 • 1:1)</option>
                  <option value="story_carousel">Dikey / Story Carousel (1080×1920 • 9:16)</option>
                  <option value="landscape_carousel">Yatay Sunum / LinkedIn (1920×1080 • 16:9)</option>
                </optgroup>
                <optgroup label="🎬 Video (Reels & Animasyon)">
                  <option value="reels_video">Instagram Reels / TikTok Video (1080×1920 • 9:16)</option>
                  <option value="square_video">Kare Akış Videosu (1080×1080 • 1:1)</option>
                  <option value="portrait_video">Portre Akış Videosu (1080×1350 • 4:5)</option>
                  <option value="landscape_video">Yatay Video / YouTube (1920×1080 • 16:9)</option>
                </optgroup>
                <optgroup label="🖼️ Tekil Görsel">
                  <option value="instagram_post">Instagram Portre Gönderi (1080×1350 • 4:5)</option>
                  <option value="square_post">Kare Gönderi (1080×1080 • 1:1)</option>
                  <option value="instagram_story">Instagram Story (1080×1920 • 9:16)</option>
                  <option value="pinterest_pin">Pinterest Pin (1000×1500 • 2:3)</option>
                </optgroup>
              </select>
              <ChevronDown size={14} />
            </div>
          </div>

          {(CANVA_CONTENT_TYPES[contentType]?.packageType === "carousel") ? (
            <div className="select-field">
              <span>
                {CANVA_CONTENT_TYPES[contentType]?.category === "video" ? "Sahne / Sayfa Sayısı" : "Sayfa Sayısı"}
              </span>
              <div>
                <select
                  value={slideCount}
                  onChange={(e) => setSlideCount(Number(e.target.value))}
                >
                  {Array.from(
                    {
                      length:
                        (CANVA_CONTENT_TYPES[contentType]?.maxSlides || 10) -
                        (CANVA_CONTENT_TYPES[contentType]?.minSlides || 3) +
                        1,
                    },
                    (_, i) => (CANVA_CONTENT_TYPES[contentType]?.minSlides || 3) + i
                  ).map((n) => (
                    <option key={n} value={n}>
                      {n} {CANVA_CONTENT_TYPES[contentType]?.category === "video" ? "sahne" : "sayfa"}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            </div>
          ) : (
            <div className="select-field">
              <span>Sayfa Sayısı</span>
              <div>
                <select disabled value="1">
                  <option value="1">1 sayfa (Tek görsel)</option>
                </select>
                <ChevronDown size={14} />
              </div>
            </div>
          )}

          <div className="select-field">
            <span>Görsel Stil</span>
            <div>
              <select value={style} onChange={(e) => setStyle(e.target.value)}>
                <option value="Modern ve minimalist">Modern ve minimalist</option>
                <option value="Güçlü ve cesur">Güçlü ve cesur</option>
                <option value="Premium ve lüks">Premium ve lüks</option>
                <option value="Canlı ve enerjik">Canlı ve enerjik</option>
                <option value="Editoryal ve şık">Editoryal ve şık</option>
              </select>
              <ChevronDown size={14} />
            </div>
          </div>

          <div className="select-field">
            <span>Üretim Motoru</span>
            <div>
              <select disabled value="hermes">
                <option value="hermes">Hermes Agent + Canva MCP</option>
              </select>
              <ChevronDown size={14} />
            </div>
          </div>
        </div>

        {message && (
          <div className="generation-notice">
            <AlertCircle size={15} />
            <span>{message}</span>
          </div>
        )}

        <button
          type="button"
          className="generate-button"
          onClick={handleCreateJob}
          disabled={producing}
        >
          {producing ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <Sparkles size={18} />
          )}
          {producing ? "Sıraya ekleniyor..." : (isProducing ? "Sıraya Yeni Üretim Ekle" : "Canva ile üret")}
          <span>
            {CANVA_CONTENT_TYPES[contentType]?.packageType === "carousel"
              ? `${slideCount} ${CANVA_CONTENT_TYPES[contentType]?.category === "video" ? "sahne video" : "slayt carousel"}`
              : "Tekil görsel"}
          </span>
        </button>
      </section>

      {/* Sağ Sonuç ve Paket Arşivi */}
      <section className="generation-results">
        <div className="results-toolbar">
          <div>
            <h2>Canva Stüdyosu Arşivi</h2>
            <span>Arşive kaydedilen Canva görsel şablonları ve üretilen videolar</span>
          </div>
          <div className="result-tabs">
            <button
              type="button"
              className={archiveTab === "packages" ? "active" : ""}
              onClick={() => setArchiveTab("packages")}
            >
              <FileImage size={14} style={{ marginRight: "6px", verticalAlign: "middle" }} />
              Tasarımlar & Paketler ({packages.length})
            </button>
            <button
              type="button"
              className={archiveTab === "videos" ? "active" : ""}
              onClick={() => setArchiveTab("videos")}
            >
              <Video size={14} style={{ marginRight: "6px", verticalAlign: "middle" }} />
              Üretilen Videolar ({packages.filter((p) => Boolean(p.videoUrl)).length})
            </button>
          </div>
        </div>

        {/* Başarısız Görev Uyarısı */}
        {!isProducing && latestFailedJob && (
          <div
            style={{
              padding: "14px 18px",
              borderRadius: "12px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              marginBottom: "16px",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <AlertCircle size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 700, color: "#991b1b" }}>
                  Üretim Başarısız Oldu
                </h4>
                <p style={{ margin: 0, fontSize: "12px", color: "#b91c1c", lineHeight: 1.45 }}>
                  {(() => {
                    const detail = latestFailedJob.progress?.detail || latestFailedJob.error || "";
                    if (detail.includes("quota_cooldown") || detail.includes("quota_exceeded")) {
                      return "Canva hesabı yapay zeka tasarım üretme kredisini (%100) doldurdu veya kısa süreli bekleme (cooldown) modunda. Canva AI üretimi için kota periyodunun sıfırlanmasını bekleyebilir veya Canva panelinden kredinizi kontrol edebilirsiniz.";
                    }
                    return detail || "Canva üretimi sırasında bir hata oluştu.";
                  })()}
                </p>
                <div style={{ marginTop: "6px", fontSize: "11px", color: "#7f1d1d" }}>
                  Prompt: &quot;{latestFailedJob.prompt.slice(0, 80)}...&quot;
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleDismissFailedJob(latestFailedJob.id)}
              style={{
                background: "none",
                border: "none",
                color: "#991b1b",
                cursor: "pointer",
                padding: "2px",
                flexShrink: 0,
              }}
              title="Kapat"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Aktif Üretim Stepper */}
        {activeJob ? (
          <CanvaProductionStepper
            job={activeJob}
            requestedSlides={activeJob.request?.slideCount || slideCount}
            cancelling={cancellingJobId === activeJob.id}
            onCancel={() => void handleCancelJob(activeJob.id)}
          />
        ) : activeRenderingPackage ? (
          <div
            style={{
              padding: "16px 20px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
              color: "white",
              marginBottom: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 4px 14px rgba(49, 46, 129, 0.25)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <RefreshCw className="spin" size={26} color="#a5b4fc" />
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1px", color: "#a5b4fc" }}>
                  {activeRenderingPackage.videoStatus === "refining"
                    ? "CANVA AI DÜZEN ONARIMI YAPILIYOR"
                    : "CANVA SİHİRLİ ANİMASYONLU VİDEO RENDER EDİLİYOR"}
                </div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#f8fafc", marginTop: "2px" }}>
                  {activeRenderingPackage.videoStatus === "refining"
                    ? `"${activeRenderingPackage.title}" AI ile cerrahi olarak düzenleniyor...`
                    : `"${activeRenderingPackage.title}" bulutta işleniyor, MP4 hazırlanıyor...`}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "11px",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  background: "rgba(255, 255, 255, 0.15)",
                  color: "#e0e7ff",
                  fontWeight: 600,
                }}
              >
                Arka Planda Devam Ediyor
              </span>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                style={{
                  color: "#fca5a5",
                  border: "1px solid rgba(252, 165, 165, 0.4)",
                  fontSize: "11px",
                  padding: "3px 8px",
                  cursor: "pointer",
                }}
                title={
                  activeRenderingPackage.videoStatus === "refining"
                    ? "Askıda kalan düzenleme durumunu sıfırla"
                    : "Askıda kalan render durumunu sıfırla"
                }
                onClick={async () => {
                  try {
                    await fetch(`/api/projects/${encodeURIComponent(projectId)}/canva/packages/${activeRenderingPackage.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        videoStatus: activeRenderingPackage.videoStatus === "refining" ? "idle" : "failed",
                      }),
                    });
                    await loadPackages(false);
                  } catch {}
                }}
              >
                Sıfırla ✕
              </button>
            </div>
          </div>
        ) : null}

        {/* Sekme 1: Tasarımlar & Paketler */}
        {archiveTab === "packages" && (
          packages.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "16px",
                marginTop: "16px",
              }}
            >
              {packages.map((pkg) => (
                <CanvaPackageCard
                  key={pkg.id}
                  pkg={pkg}
                  projectId={projectId}
                  deleting={deletingId === pkg.id}
                  convertingVideo={convertingVideoPkgId === pkg.id}
                  syncing={syncingPkgId === pkg.id}
                  refining={refiningPkgId === pkg.id}
                  isAnySyncing={Boolean(syncingPkgId || refiningPkgId)}
                  onOpenGallery={() => openGallery(pkg)}
                  onOpenVideoModal={() => {
                    setVideoConvertError(null);
                    setVideoModalPkg(pkg);
                  }}
                  onWatchVideo={() => setActiveVideoPlayerPkg(pkg)}
                  onSync={() => void handleSyncPackage(pkg.id)}
                  onRefine={() => void handleRefinePackage(pkg.id)}
                  onDelete={() => void handleDeletePackage(pkg.id)}
                />
              ))}
            </div>
          ) : !isProducing && !loadingPackages ? (
            <div className="results-empty">
              <div className="empty-canvas">
                <div
                  className="canvas-glow"
                  style={{ background: available.primaryColor || "#7a6deb" }}
                />
                <Layers size={38} />
                <span>CANVA AGENT STÜDYOSU</span>
              </div>
              <h3>Henüz Canva paketi yok</h3>
              <p>
                Soldaki briefi oluşturup &quot;Canva ile üret&quot; butonuna tıklayın.
                Üretilen çoklu sayfalar tek galeri paketi olarak burada listelenecektir.
              </p>
            </div>
          ) : null
        )}

        {/* Sekme 2: Üretilen Videolar */}
        {archiveTab === "videos" && (
          packages.filter((p) => Boolean(p.videoUrl)).length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "16px",
                marginTop: "16px",
              }}
            >
              {packages
                .filter((p) => Boolean(p.videoUrl))
                .map((pkg) => (
                  <CanvaVideoCard
                    key={pkg.id}
                    pkg={pkg}
                    projectId={projectId}
                    syncing={syncingPkgId === pkg.id}
                    isAnySyncing={Boolean(syncingPkgId)}
                    onPlay={() => setActiveVideoPlayerPkg(pkg)}
                    onSync={() => void handleSyncPackage(pkg.id)}
                  />
                ))}
            </div>
          ) : (
            <div className="results-empty">
              <div className="empty-canvas">
                <div
                  className="canvas-glow"
                  style={{ background: available.primaryColor || "#7a6deb" }}
                />
                <Film size={38} />
                <span>CANVA REELS VİDEOLARI</span>
              </div>
              <h3>Henüz üretilmiş video yok</h3>
              <p>
                &quot;Tasarımlar & Paketler&quot; sekmesindeki bir carousel paketinin üzerindeki
                &quot;Videoya Dönüştür&quot; butonuna basarak sihirli animasyonlu MP4 video türetebilirsiniz.
              </p>
            </div>
          )
        )}

        {/* Global Keyframes Style for Card Pulse */}
        <style jsx global>{`
          @keyframes pulseGlow {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.45);
              border-color: #3b82f6;
            }
            50% {
              box-shadow: 0 0 0 10px rgba(59, 130, 246, 0.15);
              border-color: #60a5fa;
            }
          }
        `}</style>
      </section>

        {/* Carousel Lightbox / Galeri Modalı */}
        {activePackage && (
          <CanvaGalleryModal
            pkg={activePackage}
            projectId={projectId}
            currentIndex={activeSlideIndex}
            onIndexChange={setActiveSlideIndex}
            onClose={() => setActivePackage(null)}
            onSync={() => void handleSyncPackage(activePackage.id)}
            syncing={syncingPkgId === activePackage.id}
            onRefine={(slideIdx?: number) => void handleRefinePackage(activePackage.id, slideIdx)}
            refining={refiningPkgId === activePackage.id}
          />
        )}

        {/* Videoya Dönüştür Modalı */}
        {videoModalPkg && (
          <CanvaVideoConvertModal
            pkg={videoModalPkg}
            converting={convertingVideoPkgId === videoModalPkg.id}
            error={videoConvertError}
            durationPerSlide={durationPerSlide}
            useMagicAnimate={useMagicAnimate}
            onDurationChange={setDurationPerSlide}
            onMagicAnimateChange={setUseMagicAnimate}
            onConvert={() => void handleConvertVideo(videoModalPkg.id, durationPerSlide, useMagicAnimate)}
            onClose={() => setVideoModalPkg(null)}
          />
        )}

        {/* Video Oynatıcı Modalı */}
        {activeVideoPlayerPkg && (
          <CanvaVideoPlayerModal
            pkg={activeVideoPlayerPkg}
            projectId={projectId}
            onClose={() => setActiveVideoPlayerPkg(null)}
          />
        )}
      </div>
    );
  }

function CanvaProductionStepper({
  job,
  requestedSlides,
  cancelling,
  onCancel,
}: {
  job: CanvaJob;
  requestedSlides: number;
  cancelling?: boolean;
  onCancel?: () => void;
}) {
  const phase = job.progress.phase || job.status || "queued";
  const percent = job.progress.percent ?? 15;
  const detail = job.progress.detail || "Hermes Agent görevi yürütüyor...";

  const steps = [
    { key: "queued", label: "Kuyrukta" },
    { key: "dispatching", label: "Hermes Dispatch" },
    { key: "running", label: "Canva & Codex" },
    { key: "exporting", label: "Sayfa Export" },
    { key: "uploading", label: "Arşivleme" },
  ];

  const currentStepIndex =
    phase === "queued"
      ? 0
      : phase === "dispatching"
      ? 1
      : phase === "running"
      ? 2
      : phase === "exporting"
      ? 3
      : phase === "uploading"
      ? 4
      : 2;

  return (
    <div className="production-status" style={{ marginBottom: "18px" }}>
      <div className="production-visual">
        <div className="production-orbit">
          <Layers size={25} />
        </div>
        <span className="production-scan" />
      </div>
      <div className="production-copy">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>CANVA ÜRETİMİ DEVAM EDİYOR</span>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={cancelling}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "3px 8px",
                fontSize: "11px",
                fontWeight: 600,
                color: "#dc2626",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "6px",
                cursor: "pointer",
              }}
              title="İşlemi durdur ve iptal et"
            >
              {cancelling ? <LoaderCircle className="spin" size={12} /> : <StopCircle size={12} />}
              {cancelling ? "İptal Ediliyor..." : "İşlemi Durdur"}
            </button>
          )}
        </div>
        <h3>{detail}</h3>
        <p>
          Sayfadan ayrılsanız da üretim arka planda devam eder. Tasarım tamamlandığında ve
          tüm slaytlar dışa aktarıldığında paket arşive eklenecektir.
        </p>

        <div className="production-steps">
          {steps.map((step, idx) => (
            <span
              key={step.key}
              className={
                idx < currentStepIndex
                  ? "done"
                  : idx === currentStepIndex
                  ? "active"
                  : ""
              }
            >
              <i>{idx < currentStepIndex ? <Check size={10} /> : idx + 1}</i>
              {step.label}
            </span>
          ))}
        </div>

        <div className="production-progress">
          <span style={{ width: `${Math.max(10, Math.min(100, percent))}%` }} />
        </div>
        <small>
          {job.progress.completed || 0}/{job.progress.total || requestedSlides} sayfa işlendi
          • Hermes Agent (canva-carousel-director)
        </small>
      </div>
    </div>
  );
}

function CanvaPackageCard({
  pkg,
  projectId,
  deleting,
  convertingVideo,
  syncing,
  refining,
  isAnySyncing,
  onOpenGallery,
  onOpenVideoModal,
  onWatchVideo,
  onSync,
  onRefine,
  onDelete,
}: {
  pkg: CanvaPackage;
  projectId: string;
  deleting: boolean;
  convertingVideo: boolean;
  syncing?: boolean;
  refining?: boolean;
  isAnySyncing?: boolean;
  onOpenGallery: () => void;
  onOpenVideoModal?: () => void;
  onWatchVideo?: () => void;
  onSync?: () => void;
  onRefine?: () => void;
  onDelete: () => void;
}) {
  const isCarousel = pkg.packageType === "carousel";
  const thumbUrl = pkg.coverUrl ? `${pkg.coverUrl}?thumb=1&v=${new Date(pkg.updatedAt || pkg.createdAt).getTime()}` : "";
  const hasVideo = Boolean(pkg.videoUrl);
  const cardAspectRatio =
    pkg.items?.[0]?.width && pkg.items?.[0]?.height
      ? `${pkg.items[0].width}/${pkg.items[0].height}`
      : "4/5";

  const isCardSyncing = syncing || pkg.videoStatus === "rendering";
  const isCardRefining = refining || pkg.videoStatus === "refining";
  const isBusy = isCardSyncing || isCardRefining;

  return (
    <article
      className={`generated-card ${isCardSyncing ? "syncing-card-pulse" : isCardRefining ? "refining-card-pulse" : ""}`}
      style={{
        display: "flex",
        flexDirection: "column",
        border: isCardRefining
          ? "2px solid #a855f7"
          : isCardSyncing
          ? "2px solid #3b82f6"
          : "1px solid #e5e7eb",
        borderRadius: "14px",
        overflow: "hidden",
        background: "white",
        position: "relative",
        boxShadow: isCardRefining
          ? "0 0 16px rgba(168, 85, 247, 0.45)"
          : isCardSyncing
          ? "0 0 16px rgba(59, 130, 246, 0.45)"
          : undefined,
        animation: isBusy ? "pulseGlow 1.4s ease-in-out infinite" : undefined,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: cardAspectRatio,
          background: "#f3f4f6",
          cursor: isBusy ? "wait" : "pointer",
        }}
        onClick={isBusy ? undefined : onOpenGallery}
      >
        {thumbUrl ? (
          <Image
            src={thumbUrl}
            alt={pkg.title || "Canva Tasarım"}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            unoptimized
            style={{ objectFit: "cover", opacity: isBusy ? 0.35 : 1 }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "#9ca3af",
            }}
          >
            <FileImage size={40} />
          </div>
        )}

        {/* Refining Overlay Feedback */}
        {isCardRefining && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(88, 28, 135, 0.75)",
              backdropFilter: "blur(3px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              color: "white",
              zIndex: 10,
              padding: "16px",
              textAlign: "center",
            }}
          >
            <WandSparkles className="spin" size={28} color="#c084fc" />
            <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.3px" }}>
              🪄 AI Düzeni Onarıyor...
            </span>
            <span style={{ fontSize: "10px", color: "#e9d5ff" }}>
              Binişmeler ve yazı boyutları ferahlatılıyor
            </span>
          </div>
        )}

        {/* Syncing Overlay Feedback */}
        {isCardSyncing && !isCardRefining && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(3px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              color: "white",
              zIndex: 10,
              padding: "16px",
              textAlign: "center",
            }}
          >
            <RefreshCw className="spin" size={28} color="#60a5fa" />
            <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.3px" }}>
              Canva&apos;dan Güncelleniyor...
            </span>
            <span style={{ fontSize: "10px", color: "#93c5fd" }}>
              Eski dosyalar temizlenip yenileniyor
            </span>
          </div>
        )}

        {/* Carousel Badge */}
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            color: "white",
            padding: "4px 8px",
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          {isCarousel ? <Layers size={13} /> : <FileImage size={13} />}
          {isCarousel ? `Carousel • ${pkg.itemCount} sayfa` : "Tek Görsel"}
        </div>

        {/* Overlay hover prompt */}
        <div
          style={{
            position: "absolute",
            bottom: "10px",
            right: "10px",
            background: "rgba(255, 255, 255, 0.9)",
            borderRadius: "6px",
            padding: "4px 8px",
            fontSize: "11px",
            fontWeight: 600,
            color: "#374151",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <Maximize2 size={13} />
          Slaytları Gör
        </div>
      </div>

      <div
        className="creative-card-footer"
        style={{
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "1px solid #f3f4f6",
        }}
      >
        <span style={{ fontSize: "11px", color: "#6b7280" }}>
          {new Date(pkg.createdAt).toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "short",
          })}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          {/* 1. 🪄 AI ile Düzeni Onar (İsteğe Bağlı) */}
          {pkg.canvaDesignId && onRefine && (
            <button
              type="button"
              onClick={onRefine}
              disabled={isAnySyncing}
              title="🪄 AI ile Düzeni Onar (Nesne binişmelerini ve metin yerleşimini düzelt)"
              style={{
                display: "grid",
                placeItems: "center",
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                border: "1px solid #e9d5ff",
                color: "#9333ea",
                background: "#faf5ff",
                cursor: isAnySyncing ? "not-allowed" : "pointer",
                opacity: isAnySyncing && !refining ? 0.5 : 1,
              }}
            >
              {refining ? <LoaderCircle className="spin" size={13} /> : <WandSparkles size={13} />}
            </button>
          )}

          {/* 2. 🎨 Canva'da Canlı Aç & Düzenle (Tasarım Paleti İkonu) */}
          {pkg.canvaEditUrl && (
            <a
              href={pkg.canvaEditUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="🎨 Canva'da Canlı Aç & Düzenle"
              style={{
                display: "grid",
                placeItems: "center",
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                border: "1px solid #bae6fd",
                color: "#0284c7",
                background: "#f0f9ff",
              }}
            >
              <Palette size={13} />
            </a>
          )}

          {/* 3. 🔄 Canva'dan Güncelle / Eşitle */}
          {pkg.canvaDesignId && onSync && (
            <button
              type="button"
              onClick={onSync}
              disabled={isAnySyncing}
              title="🔄 Canva'da yaptığınız son değişiklikleri indirip eşitleyin"
              style={{
                display: "grid",
                placeItems: "center",
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                color: isAnySyncing ? "#94a3b8" : "#0ea5e9",
                background: isAnySyncing ? "#f1f5f9" : "#f0f9ff",
                cursor: isAnySyncing ? "not-allowed" : "pointer",
                opacity: isAnySyncing && !syncing ? 0.5 : 1,
              }}
            >
              {syncing ? <LoaderCircle className="spin" size={13} /> : <RefreshCw size={13} />}
            </button>
          )}

          {/* 4. 🎬 Videoya Dönüştür / İzle */}
          {hasVideo ? (
            <button
              type="button"
              onClick={onWatchVideo}
              title="▶️ Videoyu İzle (MP4)"
              style={{
                display: "grid",
                placeItems: "center",
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                border: "1px solid #c7d2fe",
                color: "#4f46e5",
                background: "#eef2ff",
                cursor: "pointer",
              }}
            >
              <Play size={13} fill="#4f46e5" />
            </button>
          ) : isCarousel && onOpenVideoModal ? (
            <button
              type="button"
              onClick={onOpenVideoModal}
              disabled={convertingVideo}
              title="🎬 Videoya Dönüştür (MP4)"
              style={{
                display: "grid",
                placeItems: "center",
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                border: "1px solid #e0e7ff",
                color: "#4338ca",
                background: "#faf5ff",
                cursor: "pointer",
              }}
            >
              {convertingVideo ? (
                <LoaderCircle className="spin" size={13} />
              ) : (
                <Clapperboard size={13} />
              )}
            </button>
          ) : null}

          {/* 5. 📅 Paylaşım Takvimine Ekle (Takvim İkonu - Kağıt Uçak Karışıklığını Önler) */}
          <Link
            href={`/projects/${projectId}/publishing?packageId=${pkg.id}`}
            title="📅 Paylaşım Takvimine Ekle"
            style={{
              display: "grid",
              placeItems: "center",
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              border: "1px solid #a7f3d0",
              color: "#059669",
              background: "#ecfdf5",
            }}
          >
            <CalendarPlus size={13} />
          </Link>

          {/* 6. ✈️ Telegram'a Gönder (Tek Kağıt Uçak Simgesi) */}
          {pkg.coverUrl && (
            <TelegramSendButton
              mediaUrl={pkg.coverUrl}
              mediaType="image"
              caption={`📸 ${pkg.title || "Canva Tasarımı"}`}
              title="✈️ Telegram'a Gönder"
              size={13}
            />
          )}

          {/* 7. 🗑️ Paketi Sil */}
          <button
            type="button"
            className="danger"
            onClick={onDelete}
            disabled={deleting}
            title="🗑️ Paketi Sil"
            style={{
              display: "grid",
              placeItems: "center",
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              border: "1px solid #fecaca",
              color: "#dc2626",
              background: "none",
              cursor: "pointer",
            }}
          >
            {deleting ? <LoaderCircle className="spin" size={14} /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>
    </article>
  );
}

function CanvaGalleryModal({
  pkg,
  projectId,
  currentIndex,
  onIndexChange,
  onClose,
  onSync,
  syncing,
  onRefine,
  refining,
}: {
  pkg: CanvaPackage;
  projectId: string;
  currentIndex: number;
  onIndexChange: (idx: number) => void;
  onClose: () => void;
  onSync?: () => void;
  syncing?: boolean;
  onRefine?: (slideIdx?: number) => void;
  refining?: boolean;
}) {
  const items = pkg.items || [];
  const currentItem = items[currentIndex] || items[0];

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        onIndexChange(Math.max(0, currentIndex - 1));
      } else if (e.key === "ArrowRight") {
        onIndexChange(Math.min(items.length - 1, currentIndex + 1));
      } else if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, items.length, onIndexChange, onClose]);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Header */}
      <div
        style={{
          width: "100%",
          maxWidth: "800px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "white",
          marginBottom: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Layers size={18} />
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
            {pkg.title}
          </h3>
          <span style={{ fontSize: "12px", color: "#9ca3af" }}>
            (Sayfa {currentIndex + 1} / {items.length})
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {pkg.canvaDesignId && onRefine && (
            <button
              type="button"
              onClick={() => onRefine(currentIndex)}
              disabled={refining}
              className="button secondary"
              style={{
                height: "32px",
                fontSize: "12px",
                background: refining ? "rgba(255, 255, 255, 0.1)" : "rgba(168, 85, 247, 0.25)",
                color: "#c084fc",
                border: "1px solid rgba(168, 85, 247, 0.4)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: refining ? "wait" : "pointer",
              }}
              title="Bu slayttaki obje binişmelerini ve metin yerleşimini yapay zekayla onar"
            >
              {refining ? <LoaderCircle className="spin" size={13} /> : <WandSparkles size={13} />}
              {refining ? "Onarılıyor..." : "🪄 AI ile Düzeni Onar"}
            </button>
          )}
          {pkg.canvaEditUrl && (
            <a
              href={pkg.canvaEditUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button secondary"
              style={{
                height: "32px",
                fontSize: "12px",
                background: "#ffffff20",
                color: "white",
                border: "none",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
              title="Tasarımı Canva'da açıp objeleri serbestçe taşıyın veya düzenleyin"
            >
              <Palette size={13} />
              Canva&apos;da Aç &amp; Düzenle
            </a>
          )}
          {onSync && (
            <button
              type="button"
              onClick={onSync}
              disabled={syncing}
              className="button secondary"
              style={{
                height: "32px",
                fontSize: "12px",
                background: syncing ? "rgba(255, 255, 255, 0.1)" : "rgba(56, 189, 248, 0.2)",
                color: "#38bdf8",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: syncing ? "wait" : "pointer",
              }}
              title="Canva'da yaptığınız yerleşim ve nesne değişikliklerini anında galeriye senkronize edin"
            >
              {syncing ? <LoaderCircle className="spin" size={13} /> : <RefreshCw size={13} />}
              {syncing ? "Eşitleniyor..." : "Canva'dan Güncelle"}
            </button>
          )}
          <Link
            href={`/projects/${projectId}/publishing?packageId=${pkg.id}`}
            className="button primary"
            style={{
              height: "32px",
              fontSize: "12px",
              background: "#10b981",
              color: "white",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <CalendarPlus size={13} />
            Paylaşım Planına Ekle
          </Link>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "white",
              cursor: "pointer",
            }}
            aria-label="Kapat"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      {/* Main Slide Display */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "600px",
          aspectRatio: "4/5",
          borderRadius: "12px",
          overflow: "hidden",
          background: "#111",
          boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
        }}
      >
        {currentItem ? (
          <Image
            src={currentItem.url ? `${currentItem.url}?preview=1&v=${new Date(pkg.updatedAt || pkg.createdAt).getTime()}` : ""}
            alt={`Slide ${currentIndex + 1}`}
            fill
            sizes="600px"
            unoptimized
            style={{ objectFit: "contain" }}
          />
        ) : null}

        {/* Prev / Next buttons */}
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={() => onIndexChange(currentIndex - 1)}
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(0,0,0,0.6)",
              color: "white",
              border: "none",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            <ChevronLeft size={20} />
          </button>
        )}

        {currentIndex < items.length - 1 && (
          <button
            type="button"
            onClick={() => onIndexChange(currentIndex + 1)}
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(0,0,0,0.6)",
              color: "white",
              border: "none",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {/* Bottom Filmstrip */}
      {items.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginTop: "16px",
            maxWidth: "600px",
            overflowX: "auto",
            padding: "4px",
          }}
        >
          {items.map((it, idx) => {
            const isSelected = idx === currentIndex;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => onIndexChange(idx)}
                style={{
                  position: "relative",
                  width: "56px",
                  height: "70px",
                  borderRadius: "6px",
                  overflow: "hidden",
                  border: isSelected ? "2px solid #6366f1" : "2px solid transparent",
                  opacity: isSelected ? 1 : 0.6,
                  cursor: "pointer",
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                <Image
                  src={it.url ? `${it.url}?thumb=1&v=${new Date(pkg.updatedAt || pkg.createdAt).getTime()}` : ""}
                  alt={`Thumb ${idx + 1}`}
                  fill
                  sizes="56px"
                  unoptimized
                  style={{ objectFit: "cover" }}
                />
                <span
                  style={{
                    position: "absolute",
                    bottom: "2px",
                    right: "2px",
                    background: "rgba(0,0,0,0.7)",
                    color: "white",
                    fontSize: "9px",
                    fontWeight: 700,
                    padding: "1px 3px",
                    borderRadius: "3px",
                  }}
                >
                  {idx + 1}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CanvaVideoCard({
  pkg,
  projectId,
  syncing,
  isAnySyncing,
  onPlay,
  onSync,
}: {
  pkg: CanvaPackage;
  projectId: string;
  syncing?: boolean;
  isAnySyncing?: boolean;
  onPlay: () => void;
  onSync?: () => void;
}) {
  const thumbUrl = pkg.coverUrl ? `${pkg.coverUrl}?thumb=1&v=${new Date(pkg.updatedAt || pkg.createdAt).getTime()}` : "";
  const videoAspectRatio =
    pkg.items?.[0]?.width && pkg.items?.[0]?.height
      ? `${pkg.items[0].width}/${pkg.items[0].height}`
      : "4/5";

  const isCardSyncing = syncing || pkg.videoStatus === "rendering";

  return (
    <article
      className={`generated-card ${isCardSyncing ? "syncing-card-pulse" : ""}`}
      style={{
        display: "flex",
        flexDirection: "column",
        border: isCardSyncing ? "2px solid #3b82f6" : "1px solid #e0e7ff",
        borderRadius: "14px",
        overflow: "hidden",
        background: "white",
        boxShadow: isCardSyncing ? "0 0 16px rgba(59, 130, 246, 0.45)" : "0 2px 8px rgba(79, 70, 229, 0.06)",
        position: "relative",
        animation: isCardSyncing ? "pulseGlow 1.4s ease-in-out infinite" : undefined,
      }}
    >
      <div
        className="creative-card-media"
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: videoAspectRatio,
          background: "#0f172a",
          cursor: isCardSyncing ? "wait" : "pointer",
          overflow: "hidden",
        }}
        onClick={isCardSyncing ? undefined : onPlay}
      >
        {thumbUrl ? (
          <Image
            src={thumbUrl}
            alt={pkg.title || "Canva Video"}
            fill
            sizes="(max-width: 768px) 100vw, 320px"
            unoptimized
            style={{ objectFit: "cover", opacity: isCardSyncing ? 0.35 : 0.8 }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "#94a3b8",
            }}
          >
            <Film size={36} />
          </div>
        )}

        {/* Syncing Overlay Feedback */}
        {isCardSyncing && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(15, 23, 42, 0.75)",
              backdropFilter: "blur(3px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              color: "white",
              zIndex: 10,
              padding: "16px",
              textAlign: "center",
            }}
          >
            <RefreshCw className="spin" size={30} color="#60a5fa" />
            <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.3px" }}>
              Video Canva&apos;dan Yenileniyor...
            </span>
            <span style={{ fontSize: "10px", color: "#93c5fd" }}>
              Sihirli animasyon render ediliyor, eski video siliniyor
            </span>
          </div>
        )}

        {/* Video Oynat İkonu (Merkez) */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "52px",
            height: "52px",
            borderRadius: "50%",
            background: "rgba(79, 70, 229, 0.9)",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 4px 14px rgba(0, 0, 0, 0.35)",
            backdropFilter: "blur(4px)",
            color: "white",
          }}
        >
          <Play size={24} fill="white" style={{ marginLeft: "3px" }} />
        </div>

        {/* Süre Rozeti */}
        <span
          style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 8px",
            borderRadius: "6px",
            background: "rgba(15, 23, 42, 0.8)",
            backdropFilter: "blur(4px)",
            color: "#f8fafc",
            fontSize: "11px",
            fontWeight: 600,
          }}
        >
          <Film size={11} />
          {pkg.videoDuration ? `${pkg.videoDuration} sn` : "Reels"}
        </span>

        {/* MP4 Rozeti */}
        <span
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            display: "inline-flex",
            alignItems: "center",
            padding: "4px 7px",
            borderRadius: "6px",
            background: "rgba(99, 102, 241, 0.9)",
            color: "white",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.5px",
          }}
        >
          MP4
        </span>

        {/* Hover İzle Butonu */}
        <div
          className="preview-hover-overlay"
          style={{
            position: "absolute",
            bottom: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(15, 23, 42, 0.85)",
            color: "white",
            fontSize: "11px",
            fontWeight: 500,
            padding: "5px 12px",
            borderRadius: "20px",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            pointerEvents: "none",
          }}
        >
          <Play size={11} fill="white" />
          Videoyu İzle
        </div>
      </div>

      <div
        className="creative-card-body"
        style={{
          padding: "12px 14px 8px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        <h4
          style={{
            margin: 0,
            fontSize: "13px",
            fontWeight: 600,
            color: "#1e293b",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={pkg.title}
        >
          {pkg.title || "Canva Video"}
        </h4>
        <span style={{ fontSize: "11px", color: "#64748b" }}>
          {pkg.itemCount} Slayt • Canva Bulut Animasyonu
        </span>
      </div>

      <div
        className="creative-card-footer"
        style={{
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "1px solid #f1f5f9",
          marginTop: "auto",
        }}
      >
        <span style={{ fontSize: "11px", color: "#64748b" }}>
          {new Date(pkg.createdAt).toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "short",
          })}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {/* Canva'dan Yeniden İndir / Eşitle Butonu */}
          {pkg.canvaDesignId && onSync && (
            <button
              type="button"
              onClick={onSync}
              disabled={isAnySyncing}
              title={
                isAnySyncing
                  ? "Başka bir güncelleme işlemi devam ediyor..."
                  : "Canva'da yapılan son düzeltmeleri (metin, animasyon) yeniden indir ve güncelle"
              }
              style={{
                display: "grid",
                placeItems: "center",
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                color: isAnySyncing ? "#94a3b8" : "#0284c7",
                background: isAnySyncing ? "#f1f5f9" : "#f0f9ff",
                cursor: isAnySyncing ? "not-allowed" : "pointer",
                opacity: isAnySyncing && !syncing ? 0.5 : 1,
              }}
            >
              {syncing ? <LoaderCircle className="spin" size={13} /> : <RefreshCw size={13} />}
            </button>
          )}

          {/* İndir Butonu */}
          {pkg.videoUrl && (
            <a
              href={pkg.videoUrl}
              download={`${pkg.title || "canva-video"}.mp4`}
              title="MP4 İndir"
              style={{
                display: "grid",
                placeItems: "center",
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                color: "#475569",
                background: "#f8fafc",
              }}
            >
              <Download size={14} />
            </a>
          )}

          {/* Telegram Gönder */}
          {pkg.videoUrl && (
            <TelegramSendButton
              mediaUrl={pkg.videoUrl}
              mediaType="video"
              caption={`🎬 ${pkg.title || "Canva Video"}`}
              title="Telegram'a Gönder"
              size={13}
            />
          )}

          {/* Reels Olarak Planla */}
          <Link
            href={`/projects/${projectId}/publishing?packageId=${pkg.id}&mediaType=video`}
            title="Reels Olarak Planla"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              height: "28px",
              padding: "0 10px",
              borderRadius: "6px",
              background: "#4f46e5",
              color: "white",
              fontSize: "11px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <Send size={12} />
            Reels Planla
          </Link>
        </div>
      </div>
    </article>
  );
}

function CanvaVideoConvertModal({
  pkg,
  converting,
  error,
  durationPerSlide,
  useMagicAnimate,
  onDurationChange,
  onMagicAnimateChange,
  onConvert,
  onClose,
}: {
  pkg: CanvaPackage;
  converting: boolean;
  error?: string | null;
  durationPerSlide: number;
  useMagicAnimate: boolean;
  onDurationChange: (v: number) => void;
  onMagicAnimateChange: (v: boolean) => void;
  onConvert: () => void;
  onClose: () => void;
}) {
  const slideCount = pkg.itemCount || 1;
  const totalDuration = Math.round(slideCount * durationPerSlide);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "grid",
        placeItems: "center",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !converting) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "white",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#eef2ff",
                color: "#4f46e5",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Video size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#1e293b" }}>
                Sihirli Animasyonlu Videoya Dönüştür
              </h3>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Canva bulut motoru ile MP4 Reels üretimi
              </span>
            </div>
          </div>
          {!converting && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "12px 14px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
            Hedef Tasarım:
          </div>
          <div style={{ fontSize: "13px", color: "#0f172a", fontWeight: 500 }}>
            {pkg.title || "Canva Tasarımı"} ({slideCount} Slayt)
          </div>
        </div>

        {/* Süre Belirleme */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <label style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
            Slayt Başına Süre Seçimi:
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
            {[
              { val: 2, label: "2.0 sn", desc: "Hızlı / Dinamik" },
              { val: 3.5, label: "3.5 sn", desc: "Dengeli (İdeal)" },
              { val: 5, label: "5.0 sn", desc: "Detaylı Okuma" },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => onDurationChange(opt.val)}
                disabled={converting}
                style={{
                  padding: "10px 8px",
                  borderRadius: "10px",
                  border: durationPerSlide === opt.val ? "2px solid #4f46e5" : "1px solid #e2e8f0",
                  background: durationPerSlide === opt.val ? "#eef2ff" : "white",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "2px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: durationPerSlide === opt.val ? "#4f46e5" : "#1e293b",
                  }}
                >
                  {opt.label}
                </span>
                <span style={{ fontSize: "10px", color: "#64748b" }}>{opt.desc}</span>
              </button>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              background: "#faf5ff",
              borderRadius: "8px",
              border: "1px solid #f3e8ff",
              fontSize: "12px",
              color: "#6b21a8",
            }}
          >
            <span>Toplam Video Süresi:</span>
            <strong>
              {slideCount} Slayt × {durationPerSlide} sn = {totalDuration} Saniye
            </strong>
          </div>
        </div>

        {/* Bilgilendirme ve Animasyon Notu */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            padding: "10px 12px",
            borderRadius: "10px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
          }}
        >
          <Sparkles size={18} style={{ color: "#16a34a", flexShrink: 0, marginTop: "2px" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#166534" }}>
              Canva Animasyonları Doğrudan Korunur
            </span>
            <span style={{ fontSize: "11px", color: "#15803d", lineHeight: 1.4 }}>
              Canva editöründe tasarımınıza eklediğiniz Sihirli Animasyon, sayfa geçişleri veya metin efektleri doğrudan bulutta render edilerek MP4 videonuza aktarılır.
            </span>
          </div>
        </div>

        {/* Bilgilendirme */}
        <div style={{ fontSize: "11px", color: "#64748b", lineHeight: 1.5 }}>
          💡 Video render işlemi doğrudan Canva Cloud üzerinde gerçekleştirilir; seçtiğiniz süreye göre yerel olarak optimize edilir. Tamamlandığında &quot;Üretilen Videolar&quot; sekmesine eklenecektir.
        </div>

        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              padding: "10px 12px",
              borderRadius: "10px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: "12px",
              lineHeight: 1.4,
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "6px" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={converting}
            style={{
              padding: "9px 16px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              background: "white",
              color: "#475569",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConvert}
            disabled={converting}
            style={{
              padding: "9px 20px",
              borderRadius: "8px",
              border: "none",
              background: "#4f46e5",
              color: "white",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {converting && <LoaderCircle className="spin" size={14} />}
            {converting ? "Canva Render Ediyor (~20-40 sn)..." : "Videoyu Başlat"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CanvaVideoPlayerModal({
  pkg,
  projectId,
  onClose,
}: {
  pkg: CanvaPackage;
  projectId: string;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.88)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "white" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>
              {pkg.title || "Canva Video"}
            </h3>
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
              {pkg.videoDuration ? `${pkg.videoDuration} sn • ` : ""}Instagram Reels Formatı (MP4)
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "grid",
              placeItems: "center",
              color: "white",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Video Oynatıcı */}
        <div
          style={{
            position: "relative",
            width: "100%",
            borderRadius: "14px",
            overflow: "hidden",
            background: "#000",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          }}
        >
          {pkg.videoUrl ? (
            <video
              src={pkg.videoUrl}
              controls
              autoPlay
              loop
              playsInline
              style={{
                width: "100%",
                maxHeight: "75vh",
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: "white" }}>
              Video dosyası bulunamadı.
            </div>
          )}
        </div>

        {/* Aksiyon Butonları */}
        <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
          {pkg.videoUrl && (
            <a
              href={pkg.videoUrl}
              download={`${pkg.title || "canva-video"}.mp4`}
              style={{
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                height: "38px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.12)",
                color: "white",
                fontSize: "12px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              <Download size={14} />
              MP4 İndir
            </a>
          )}

          <Link
            href={`/projects/${projectId}/publishing?packageId=${pkg.id}&mediaType=video`}
            style={{
              flex: 1.4,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              height: "38px",
              borderRadius: "8px",
              background: "#4f46e5",
              color: "white",
              fontSize: "12px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <Send size={14} />
            Reels Olarak Planla
          </Link>
        </div>
      </div>
    </div>
  );
}
