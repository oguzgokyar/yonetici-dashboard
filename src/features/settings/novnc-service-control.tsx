"use client";

import { useState, useEffect } from "react";
import { Monitor, Play, Square, ExternalLink, Loader2, Power, RefreshCw, CheckCircle2 } from "lucide-react";

type NovncProcess = {
  running: boolean;
  pid: number | null;
  rss_mb: number;
  pids?: number[];
};

type NovncState = {
  ok: boolean;
  status: "running" | "stopped" | "starting" | "stopping" | "unknown";
  running?: boolean;
  message?: string;
  url?: string;
  vnc_port?: number;
  cdp_port?: number;
  process?: NovncProcess;
};

export function NovncServiceControl({ variant = "banner" }: { variant?: "card" | "banner" }) {
  const [state, setState] = useState<NovncState | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState("");

  async function fetchStatus() {
    try {
      const res = await fetch("/api/system/novnc", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setState(data);
        setActionError("");
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleToggle(action: "start" | "stop") {
    setLoading(true);
    setActionError("");
    setActionMsg("");
    try {
      const res = await fetch("/api/system/novnc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setState(data);
        setActionMsg(action === "start" ? "✓ noVNC ekranı hazırlandı." : "✓ noVNC kapatıldı, RAM serbest bırakıldı.");
        if (action === "start" && data.url) {
          try {
            window.open(data.url, "_blank");
          } catch {}
        } else if (action === "stop") {
          // Oturum kapatıldığında hesap havuzunu arka planda otomatik eşitle
          try {
            await fetch("/api/system/google-vids/accounts/sync", { method: "POST" });
          } catch {}
        }
      } else {
        setActionError(data.message || "İşlem gerçekleştirilemedi.");
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Bağlantı hatası");
    } finally {
      setLoading(false);
      fetchStatus();
    }
  }

  const isRunning = state?.status === "running" || state?.running === true;
  const novncUrl =
    state?.url || "http://43.131.47.253:8080/novnc/vnc_auto.html?path=novnc/websockify%3Fservice%3Dcanva";

  if (variant === "banner") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderRadius: "12px",
          background: isRunning ? "rgba(79, 70, 229, 0.08)" : "var(--surface-subtle, rgba(0,0,0,0.03))",
          border: `1px solid ${isRunning ? "rgba(79, 70, 229, 0.3)" : "var(--border)"}`,
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: isRunning ? "#4f46e5" : "#64748b",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Monitor size={18} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <strong style={{ fontSize: "13px" }}>noVNC Uzak Masaüstü (Giriş &amp; Oturum)</strong>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "12px",
                  background: isRunning ? "#e0e7ff" : "#f1f5f9",
                  color: isRunning ? "#4338ca" : "#64748b",
                }}
              >
                {isRunning ? "🟢 Çalışıyor" : "⚪ Kapalı (0 MB RAM)"}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "11.5px", color: "var(--muted)" }}>
              {isRunning
                ? `Aktif • Bellek: ${state?.process?.rss_mb || 450} MB • Port ${state?.vnc_port || 5901}`
                : "Hesap havuzu girişleri için kapalıdır. İhtiyaç olduğunda başlatıp, iş bitince kapatabilirsiniz."}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {isRunning ? (
            <>
              <a
                href={novncUrl}
                target="_blank"
                rel="noreferrer"
                className="button primary compact"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  height: "32px",
                  padding: "0 14px",
                  background: "#4f46e5",
                  borderColor: "#4f46e5",
                }}
              >
                <span>noVNC Ekranını Aç</span>
                <ExternalLink size={13} />
              </a>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleToggle("stop")}
                className="button secondary compact"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  height: "32px",
                  padding: "0 12px",
                  color: "#dc2626",
                }}
                title="noVNC ve Chromium oturumunu kapatıp belleği sunucuya iade eder"
              >
                {loading ? <Loader2 size={13} className="spin" /> : <Power size={13} />}
                <span>Durdur &amp; RAM'i Boşalt</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={() => handleToggle("start")}
              className="button primary compact"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                height: "32px",
                padding: "0 14px",
                background: "#4f46e5",
                borderColor: "#4f46e5",
              }}
              title="Hesap girişi için noVNC ve Chromium'u başlatır"
            >
              {loading ? <Loader2 size={13} className="spin" /> : <Play size={13} />}
              <span>noVNC Servisini Başlat</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchStatus}
            className="button ghost compact"
            style={{ width: "32px", height: "32px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
            title="Durumu Yenile"
          >
            <RefreshCw size={13} />
          </button>
        </div>

        {(actionMsg || actionError) && (
          <div
            style={{
              width: "100%",
              marginTop: "4px",
              padding: "6px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 600,
              background: actionError ? "#fef2f2" : "#f0fdf4",
              color: actionError ? "#991b1b" : "#166534",
              border: `1px solid ${actionError ? "#fecaca" : "#bbf7d0"}`,
            }}
          >
            {actionError || actionMsg}
          </div>
        )}
      </div>
    );
  }

  // Card variant
  return (
    <div
      style={{
        padding: "16px",
        borderRadius: "14px",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Monitor size={18} color="#4f46e5" />
          <strong style={{ fontSize: "14px", color: "#0f172a" }}>noVNC Uzak Masaüstü</strong>
        </div>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: "12px",
            background: isRunning ? "#e0e7ff" : "#f1f5f9",
            color: isRunning ? "#4338ca" : "#64748b",
          }}
        >
          {isRunning ? "🟢 Çalışıyor" : "⚪ Kapalı"}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: "12px", color: "#64748b", lineHeight: 1.4 }}>
        {isRunning
          ? `Port ${state?.vnc_port || 5901} üzerinden bağlı. Bellek: ${state?.process?.rss_mb || 450} MB.`
          : "Hesap havuzuna yeni hesap eklemek ve Google/Canva girişi yapmak için oturumu başlatabilirsiniz."}
      </p>

      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
        {isRunning ? (
          <>
            <a
              href={novncUrl}
              target="_blank"
              rel="noreferrer"
              className="button primary"
              style={{ flex: 1, justifyContent: "center", fontSize: "12px", padding: "8px 12px", background: "#4f46e5" }}
            >
              <ExternalLink size={14} />
              <span>noVNC Ekranını Aç</span>
            </a>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleToggle("stop")}
              className="button secondary"
              style={{ fontSize: "12px", padding: "8px 12px", color: "#dc2626" }}
              title="Oturumu kapat ve RAM'i sıfırla"
            >
              {loading ? <Loader2 size={14} className="spin" /> : <Power size={14} />}
              <span>Kapat</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={() => handleToggle("start")}
            className="button primary"
            style={{ width: "100%", justifyContent: "center", fontSize: "12px", padding: "8px 12px", background: "#4f46e5" }}
          >
            {loading ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
            <span>noVNC Servisini Başlat</span>
          </button>
        )}
      </div>
    </div>
  );
}
