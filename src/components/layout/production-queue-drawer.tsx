"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Image as ImageIcon,
  Clapperboard,
  Palette,
  ExternalLink,
  Trash2,
  ArrowRight,
  Layers,
} from "lucide-react";
import type { ProductionQueueItem } from "@/app/api/projects/[projectId]/production-queue/route";

type ProductionQueueDrawerProps = {
  projectId?: string;
  isOpen: boolean;
  onClose: () => void;
  onActiveCountChange?: (count: number) => void;
};

export function ProductionQueueDrawer({
  projectId,
  isOpen,
  onClose,
  onActiveCountChange,
}: ProductionQueueDrawerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"queue" | "completed">("queue");
  const [queue, setQueue] = useState<ProductionQueueItem[]>([]);
  const [completed, setCompleted] = useState<ProductionQueueItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchQueue = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/production-queue`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (data.ok) {
        setQueue(data.queue || []);
        setCompleted(data.completed || []);
        if (onActiveCountChange) {
          onActiveCountChange((data.queue || []).length);
        }
      }
    } catch {
      // ignore background fetch errors
    } finally {
      setLoading(false);
    }
  }, [projectId, onActiveCountChange]);

  // Initial fetch & background polling
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      await fetchQueue();
    }

    const intervalMs = isOpen || queue.length > 0 ? 2500 : 8000;
    const timer = window.setInterval(() => {
      void poll();
    }, intervalMs);

    // Initial load without causing cascading renders in pure body
    const initialTimer = window.setTimeout(() => {
      void poll();
    }, 50);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(initialTimer);
    };
  }, [projectId, isOpen, queue.length, fetchQueue]);

  // Listen to custom event 'production-queue-updated' so any studio can trigger an immediate refresh
  useEffect(() => {
    function handleUpdate(e: Event) {
      void fetchQueue();
      const customEvent = e as CustomEvent<{ openDrawer?: boolean }>;
      if (customEvent.detail?.openDrawer) {
        setActiveTab("queue");
      }
    }
    window.addEventListener("production-queue-updated", handleUpdate);
    return () => window.removeEventListener("production-queue-updated", handleUpdate);
  }, [fetchQueue]);

  async function handleCancelOrRemove(jobId: string) {
    if (!projectId) return;
    try {
      await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/production-queue?jobId=${encodeURIComponent(jobId)}`,
        { method: "DELETE" }
      );
      void fetchQueue();
    } catch {
      // ignore
    }
  }

  function navigateToResult(item: ProductionQueueItem) {
    if (!projectId) return;
    onClose();
    if (item.type === "canva") {
      router.push(`/projects/${projectId}/image-generation?studio=canva`);
    } else if (item.type === "video" || item.type === "video-layer") {
      router.push(`/projects/${projectId}/video-generation`);
    } else {
      router.push(`/projects/${projectId}/image-generation`);
    }
  }

  function renderTypeIcon(type: string) {
    if (type === "canva") return <Palette size={14} />;
    if (type === "video" || type === "video-layer") return <Clapperboard size={14} />;
    return <ImageIcon size={14} />;
  }

  function formatTimeAgo(isoDate?: string | null) {
    if (!isoDate) return "";
    try {
      const past = new Date(isoDate).getTime();
      const current = Date.parse(new Date().toISOString());
      const diffSec = Math.max(0, Math.floor((current - past) / 1000));
      if (diffSec < 60) return "Az önce";
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin} dk önce`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr} sa önce`;
      return `${Math.floor(diffHr / 24)} gün önce`;
    } catch {
      return "";
    }
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="prod-drawer-backdrop" onClick={onClose} />

      {/* Slide-over Sidebar */}
      <aside className="prod-drawer-panel" aria-label="Üretim Listesi">
        {/* Header */}
        <div className="prod-drawer-header">
          <div className="prod-drawer-title-group">
            <div className="prod-drawer-icon">
              <Layers size={16} />
            </div>
            <div>
              <h3>Üretim Listesi</h3>
              <p>Arka planda çalışan ve tamamlanan içerikler</p>
            </div>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Paneli kapat"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs: Sırada | Bitti */}
        <div className="prod-drawer-tabs">
          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            className={`prod-drawer-tab-btn ${activeTab === "queue" ? "active" : ""}`}
          >
            <span>Sırada</span>
            <span className={`prod-drawer-badge ${queue.length > 0 ? "pulse" : ""}`}>
              {queue.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("completed")}
            className={`prod-drawer-tab-btn ${activeTab === "completed" ? "active" : ""}`}
          >
            <span>Bitti</span>
            <span className="prod-drawer-badge">{completed.length}</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="prod-drawer-body">
          {!projectId ? (
            <div className="prod-drawer-empty">
              <p>Üretim listesini görmek için bir proje seçin.</p>
            </div>
          ) : loading && queue.length === 0 && completed.length === 0 ? (
            <div className="prod-drawer-empty">
              <RefreshCw className="spin" size={20} />
              <p>Üretim listesi yükleniyor...</p>
            </div>
          ) : activeTab === "queue" ? (
            queue.length === 0 ? (
              <div className="prod-drawer-empty">
                <div className="prod-empty-circle">
                  <CheckCircle2 size={22} />
                </div>
                <strong>Sırada bekleyen üretim yok</strong>
                <p>
                  Görsel, Video veya Canva Stüdyosu&apos;ndan yeni bir üretim başlattığınızda
                  beklemeden burada sıraya girer.
                </p>
              </div>
            ) : (
              <div className="prod-drawer-list">
                {queue.map((item, idx) => (
                  <div key={item.id} className="prod-queue-card active-job">
                    <div className="prod-card-top">
                      <span className={`prod-type-pill ${item.type}`}>
                        {renderTypeIcon(item.type)}
                        <span>{item.typeLabel}</span>
                      </span>

                      <div className="prod-card-meta">
                        <span className="prod-order-tag">#{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleCancelOrRemove(item.id)}
                          className="prod-cancel-btn"
                          title="Üretimi İptal Et"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>

                    <p className="prod-card-prompt" title={item.prompt}>
                      {item.prompt}
                    </p>

                    {/* Progress bar */}
                    <div className="prod-progress-wrap">
                      <div className="prod-progress-info">
                        <span className="prod-progress-detail">
                          <RefreshCw className="spin" size={11} />
                          <span>{item.progressDetail}</span>
                        </span>
                        <span className="prod-progress-pct">{item.progressPercent}%</span>
                      </div>
                      <div className="prod-progress-track">
                        <div
                          className="prod-progress-fill"
                          style={{ width: `${Math.max(8, Math.min(100, item.progressPercent))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : completed.length === 0 ? (
            <div className="prod-drawer-empty">
              <div className="prod-empty-circle">
                <Clock size={22} />
              </div>
              <strong>Henüz tamamlanan üretim yok</strong>
              <p>Tamamlanan son 10 üretiminiz burada listelenecektir.</p>
            </div>
          ) : (
            <div className="prod-drawer-list">
              {completed.map((item) => {
                const isFailed = item.status === "failed";
                return (
                  <div
                    key={item.id}
                    className={`prod-queue-card ${isFailed ? "failed-job" : "done-job"}`}
                  >
                    <div className="prod-card-top">
                      <span className={`prod-type-pill ${item.type}`}>
                        {renderTypeIcon(item.type)}
                        <span>{item.typeLabel}</span>
                      </span>

                      <div className="prod-card-meta">
                        <span className="prod-time-ago">
                          {formatTimeAgo(item.completedAt || item.createdAt)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCancelOrRemove(item.id)}
                          className="prod-cancel-btn"
                          title="Listeden Kaldır"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="prod-done-content">
                      {item.previewUrl && !isFailed && (
                        <div className="prod-thumb-box" onClick={() => navigateToResult(item)}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={
                              item.previewUrl.startsWith("/api/assets/")
                                ? `${item.previewUrl}?thumb=1`
                                : item.previewUrl
                            }
                            alt="Önizleme"
                          />
                        </div>
                      )}

                      <div className="prod-done-info">
                        <p className="prod-card-prompt" title={item.prompt}>
                          {item.prompt}
                        </p>

                        {isFailed ? (
                          <div className="prod-error-line">
                            <AlertCircle size={12} />
                            <span>{item.error || "Üretim başarısız oldu."}</span>
                          </div>
                        ) : (
                          <div className="prod-success-line">
                            <CheckCircle2 size={12} />
                            <span>
                              Tamamlandı{" "}
                              {item.itemCount && item.itemCount > 1
                                ? `(${item.itemCount} parça)`
                                : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {!isFailed && (
                      <div className="prod-card-actions">
                        <button
                          type="button"
                          onClick={() => navigateToResult(item)}
                          className="prod-action-btn primary"
                        >
                          <span>Stüdyoda Gör</span>
                          <ArrowRight size={12} />
                        </button>

                        {item.canvaEditUrl && (
                          <a
                            href={item.canvaEditUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="prod-action-btn"
                          >
                            <span>Canva</span>
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="prod-drawer-footer">
          <small>Son 10 tamamlanan üretim listelenir • Otomatik senkronize</small>
        </div>
      </aside>
    </>
  );
}
