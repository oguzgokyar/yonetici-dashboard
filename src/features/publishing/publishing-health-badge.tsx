"use client";

import { useEffect, useState, useRef } from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  LoaderCircle,
  ChevronDown,
  RefreshCw,
  Trash2,
  RotateCcw,
} from "lucide-react";

export type HealthService = {
  id: string;
  name: string;
  status: "healthy" | "warning" | "error";
  latencyMs: number;
  message: string;
};

export type HealthResponse = {
  ok: boolean;
  status: "healthy" | "warning" | "error";
  timestamp: string;
  durationMs: number;
  services: HealthService[];
};

export function PublishingHealthBadge() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function checkHealth() {
    setLoading(true);
    try {
      const res = await fetch("/api/system/publishing-health", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkHealth();
    const interval = setInterval(checkHealth, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [rescueLoading, setRescueLoading] = useState<string | null>(null);
  const [rescueMsg, setRescueMsg] = useState<string | null>(null);

  async function handleRescue(action: "sync" | "purge_stuck" | "restart_service") {
    setRescueLoading(action);
    setRescueMsg(null);
    try {
      const res = await fetch("/api/system/publishing-rescue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || "İşlem başarısız");
      setRescueMsg(json.message || "İşlem tamamlandı.");
      setTimeout(() => setRescueMsg(null), 5000);
      await checkHealth();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setRescueLoading(null);
    }
  }

  const overallStatus = data?.status || "healthy";

  return (
    <div className="publishing-health-container" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`health-badge-btn ${overallStatus}`}
        title="Paylaşım Araçları & Dağıtım Motoru Durumu"
      >
        <div className={`health-pulse-dot ${overallStatus}`} />
        <Activity size={13} />
        <span>
          {loading && !data ? "Kontrol..." : overallStatus === "healthy" ? "Sistem Hazır" : overallStatus === "warning" ? "Kısmi Hazır" : "Servis Uyarısı"}
        </span>
        <ChevronDown size={12} className={`health-chevron ${open ? "rotated" : ""}`} />
      </button>

      {open && (
        <div className="health-details-popover">
          <div className="health-popover-header">
            <div>
              <strong>Paylaşım Altyapısı Durumu</strong>
              <small>
                {data?.timestamp
                  ? new Date(data.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                  : "Şimdi"}{" "}
                itibarıyla
              </small>
            </div>
            <button
              type="button"
              onClick={checkHealth}
              disabled={loading}
              className="button compact ghost"
              style={{ fontSize: "10px", height: "24px", padding: "0 6px" }}
            >
              {loading ? <LoaderCircle size={11} className="spin" /> : "Yeniden Test Et"}
            </button>
          </div>

          <div className="health-services-list">
            {(data?.services || []).map((srv) => (
              <div key={srv.id} className="health-service-row">
                <div className="health-service-icon">
                  {srv.status === "healthy" ? (
                    <CheckCircle2 size={15} color="#10b981" />
                  ) : srv.status === "warning" ? (
                    <AlertTriangle size={15} color="#f59e0b" />
                  ) : (
                    <XCircle size={15} color="#ef4444" />
                  )}
                </div>
                <div className="health-service-info">
                  <div className="health-service-title">
                    <span>{srv.name}</span>
                    <small>{srv.latencyMs}ms</small>
                  </div>
                  <p className="health-service-msg">{srv.message}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Rescue & Recovery Toolkit */}
          <div style={{ padding: "12px", borderTop: "1px solid #f0f0f5", background: "#fcfcfe" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--foreground)", display: "block", marginBottom: "8px" }}>
              🛠️ Sistem Kurtarma &amp; Sıfırlama
            </span>
            {rescueMsg && (
              <div style={{ fontSize: "11px", color: "#10b981", background: "#ecfdf5", padding: "6px 8px", borderRadius: "6px", marginBottom: "8px" }}>
                ✓ {rescueMsg}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <button
                type="button"
                onClick={() => handleRescue("sync")}
                disabled={Boolean(rescueLoading)}
                className="button secondary compact"
                style={{ justifyContent: "flex-start", fontSize: "11px", height: "28px" }}
              >
                {rescueLoading === "sync" ? <LoaderCircle size={12} className="spin" /> : <RefreshCw size={12} />}
                Tüm Gönderileri Postiz ile Senkronize Et
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm("Planlanan saati 3 saatten fazla geçmiş ve hala takılı kalmış gönderiler kuyruktan temizlenecektir. Devam edilsin mi?")) {
                    handleRescue("purge_stuck");
                  }
                }}
                disabled={Boolean(rescueLoading)}
                className="button secondary compact"
                style={{ justifyContent: "flex-start", fontSize: "11px", height: "28px", color: "#d97706" }}
              >
                {rescueLoading === "purge_stuck" ? <LoaderCircle size={12} className="spin" /> : <Trash2 size={12} />}
                Kilitli / Zamanı Geçmiş Kuyruğu Temizle
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm("Postiz dağıtım servisi ve Temporal orkestratörü yeniden başlatılacaktır. Devam edilsin mi?")) {
                    handleRescue("restart_service");
                  }
                }}
                disabled={Boolean(rescueLoading)}
                className="button secondary compact"
                style={{ justifyContent: "flex-start", fontSize: "11px", height: "28px", color: "#ef4444" }}
              >
                {rescueLoading === "restart_service" ? <LoaderCircle size={12} className="spin" /> : <RotateCcw size={12} />}
                Dağıtım Servisini Yeniden Başlat (Restart)
              </button>
            </div>
          </div>

          <div className="health-popover-footer">
            <span>Tüm bileşenler yeşil olduğunda paylaşımlar anında yayınlanır.</span>
          </div>
        </div>
      )}
    </div>
  );
}
