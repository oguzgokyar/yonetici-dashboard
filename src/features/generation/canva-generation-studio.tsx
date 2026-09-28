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
} from "lucide-react";
import type { CanvaContentType } from "@/lib/server/hermes-canva-task";
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
  packageType: "single" | "carousel";
  title: string;
  coverAssetId: string;
  coverUrl: string;
  itemCount: number;
  canvaDesignId: string;
  canvaEditUrl: string;
  createdAt: string;
  items: CanvaPackageItem[];
}

export interface CanvaJob {
  id: string;
  status: "queued" | "dispatching" | "running" | "exporting" | "uploading" | "complete" | "failed";
  prompt: string;
  error?: string | null;
  createdAt: string;
  completedAt?: string | null;
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
  const [selectedFields, setSelectedFields] = useState<BrandKey[]>([
    "logo",
    "brandName",
    "website",
  ]);

  const [message, setMessage] = useState("");
  const [producing, setProducing] = useState(false);
  const [jobs, setJobs] = useState<CanvaJob[]>([]);
  const [packages, setPackages] = useState<CanvaPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);

  // Gallery / Lightbox state for Carousel packages
  const [activePackage, setActivePackage] = useState<CanvaPackage | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  const available = useMemo(() => project.brand || {}, [project]);

  const activeJob = jobs.find((j) =>
    ["queued", "dispatching", "running", "exporting", "uploading"].includes(j.status)
  );
  const isProducing = producing || Boolean(activeJob);

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

  const loadPackages = useCallback(async () => {
    setLoadingPackages(true);
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
      setMessage("Canva paketleri alınamadı.");
    } finally {
      setLoadingPackages(false);
    }
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadJobs();
    void loadPackages();
  }, [loadJobs, loadPackages]);

  // Polling when a job is in-flight
  useEffect(() => {
    if (!isProducing) return;
    const timer = window.setInterval(async () => {
      await loadJobs();
      await loadPackages();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [isProducing, loadJobs, loadPackages]);

  function toggleField(key: BrandKey) {
    if (!available[key]) return;
    setSelectedFields((curr) =>
      curr.includes(key) ? curr.filter((k) => k !== key) : [...curr, key]
    );
  }

  async function handleCreateJob() {
    if (!prompt.trim()) {
      setMessage("Üretime başlamak için kreatif briefinizi veya içerik fikrinizi yazın.");
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
            slideCount: contentType === "instagram_carousel" ? slideCount : 1,
            style,
            selectedBrandFields: selectedFields,
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

      setMessage("Canva üretim görevi Hermes Agent'a iletildi.");
      await loadJobs();
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
            <h2>Canva Stüdyosu</h2>
          </div>
          <WandSparkles size={21} />
        </div>

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
          <p className="control-help">Canva tasarımında korunacak marka detayları:</p>
          <div className="brand-source-grid">
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
          <label className="control-title" htmlFor="canva-prompt">
            <span>Kreatif Brief / Prompt</span>
          </label>
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
            <span>{prompt.length}/2000</span>
          </div>
        </div>

        {/* Nitelik Seçiciler */}
        <div className="attribute-grid">
          <div className="select-field">
            <span>Zorunlu İçerik Türü</span>
            <div>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value as CanvaContentType)}
              >
                <option value="instagram_carousel">Instagram Carousel (1080×1350)</option>
                <option value="instagram_post">Instagram Gönderisi (1080×1350)</option>
                <option value="instagram_story">Instagram Story (1080×1920)</option>
                <option value="square_post">Kare Gönderi (1080×1080)</option>
                <option value="pinterest_pin">Pinterest Pin (1000×1500)</option>
              </select>
              <ChevronDown size={14} />
            </div>
          </div>

          {contentType === "instagram_carousel" ? (
            <div className="select-field">
              <span>Sayfa Sayısı</span>
              <div>
                <select
                  value={slideCount}
                  onChange={(e) => setSlideCount(Number(e.target.value))}
                >
                  {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>
                      {n} sayfa
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
          disabled={isProducing}
        >
          {isProducing ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <Sparkles size={18} />
          )}
          {isProducing ? "Canva üretimi devam ediyor" : "Canva ile üret"}
          <span>
            {contentType === "instagram_carousel"
              ? `${slideCount} slayt carousel`
              : "Tek görsel"}
          </span>
        </button>
      </section>

      {/* Sağ Sonuç ve Paket Arşivi */}
      <section className="generation-results">
        <div className="results-toolbar">
          <div>
            <h2>Canva Tasarımları & Paketler</h2>
            <span>Arşive kaydedilen Canva şablon ve export paketleri</span>
          </div>
          <div className="result-tabs">
            <button type="button" className="active">
              Tüm Paketler ({packages.length})
            </button>
          </div>
        </div>

        {/* Aktif Üretim Stepper */}
        {isProducing && activeJob && (
          <CanvaProductionStepper
            job={activeJob}
            requestedSlides={slideCount}
            cancelling={cancellingJobId === activeJob.id}
            onCancel={() => void handleCancelJob(activeJob.id)}
          />
        )}

        {/* Paket Listesi */}
        {packages.length > 0 ? (
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
                onOpenGallery={() => openGallery(pkg)}
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
        ) : null}
      </section>

      {/* Carousel Lightbox / Galeri Modalı */}
      {activePackage && (
        <CanvaGalleryModal
          pkg={activePackage}
          projectId={projectId}
          currentIndex={activeSlideIndex}
          onIndexChange={setActiveSlideIndex}
          onClose={() => setActivePackage(null)}
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
  onOpenGallery,
  onDelete,
}: {
  pkg: CanvaPackage;
  projectId: string;
  deleting: boolean;
  onOpenGallery: () => void;
  onDelete: () => void;
}) {
  const isCarousel = pkg.packageType === "carousel";
  const thumbUrl = pkg.coverUrl ? `${pkg.coverUrl}?thumb=1` : "";

  return (
    <article
      className="generated-card"
      style={{
        display: "flex",
        flexDirection: "column",
        border: "1px solid #e5e7eb",
        borderRadius: "14px",
        overflow: "hidden",
        background: "white",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "4/5",
          background: "#f3f4f6",
          cursor: "pointer",
        }}
        onClick={onOpenGallery}
      >
        {thumbUrl ? (
          <Image
            src={thumbUrl}
            alt={pkg.title}
            fill
            sizes="(max-width: 760px) 100vw, 30vw"
            unoptimized
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              placeItems: "center",
              color: "#9ca3af",
            }}
          >
            <FileImage size={40} />
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

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {pkg.canvaEditUrl && (
            <a
              href={pkg.canvaEditUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Canva'da Aç"
              style={{
                display: "grid",
                placeItems: "center",
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                border: "1px solid #e5e7eb",
                color: "#4f46e5",
              }}
            >
              <ExternalLink size={14} />
            </a>
          )}

          <Link
            href={`/projects/${projectId}/publishing?packageId=${pkg.id}`}
            title="Paylaşım Planına Ekle"
            style={{
              display: "grid",
              placeItems: "center",
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              border: "1px solid #e5e7eb",
              color: "#059669",
            }}
          >
            <Send size={14} />
          </Link>

          <button
            type="button"
            className="danger"
            onClick={onDelete}
            disabled={deleting}
            title="Paketi Sil"
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
}: {
  pkg: CanvaPackage;
  projectId: string;
  currentIndex: number;
  onIndexChange: (idx: number) => void;
  onClose: () => void;
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
              }}
            >
              <ExternalLink size={13} />
              Canva&apos;da Aç
            </a>
          )}
          <Link
            href={`/projects/${projectId}/publishing?packageId=${pkg.id}`}
            className="button primary"
            style={{ height: "32px", fontSize: "12px" }}
          >
            <Send size={13} />
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
            src={currentItem.url ? `${currentItem.url}?preview=1` : ""}
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
                  src={it.url ? `${it.url}?thumb=1` : ""}
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
