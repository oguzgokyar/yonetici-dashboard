"use client";

import { useState, useEffect } from "react";
import { Film, Play, Square, ExternalLink, Loader2, CheckCircle2, Power } from "lucide-react";

type StudioProcess = {
  running: boolean;
  pid: number | null;
  rss_mb: number;
  uptime: string;
  cpu_percent: string;
};

type StudioState = {
  ok: boolean;
  status: "running" | "stopped" | "starting" | "stopping" | "unknown";
  message?: string;
  url?: string;
  direct_url?: string;
  process?: StudioProcess;
};

export function SinematikStudioControl({ variant = "card" }: { variant?: "card" | "banner" }) {
  const [state, setState] = useState<StudioState | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  async function fetchStatus() {
    try {
      const res = await fetch("/api/system/sinematik-studio", { cache: "no-store" });
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
    const interval = setInterval(fetchStatus, 6000);
    return () => clearInterval(interval);
  }, []);

  async function handleToggle(action: "start" | "stop") {
    setLoading(true);
    setActionError("");
    try {
      const res = await fetch("/api/system/sinematik-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setState(data);
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

  const isRunning = state?.status === "running";
  const studioUrl = state?.url || "https://sinematik.43.131.47.253.sslip.io";

  if (variant === "banner") {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderRadius: "12px",
        background: isRunning ? "rgba(34, 197, 94, 0.08)" : "var(--surface-subtle, rgba(0,0,0,0.03))",
        border: `1px solid ${isRunning ? "rgba(34, 197, 94, 0.25)" : "var(--border)"}`,
        marginBottom: "16px",
        flexWrap: "wrap",
        gap: "12px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: isRunning ? "#22c55e" : "#64748b",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Film size={18} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <strong style={{ fontSize: "13px" }}>Sinematik Video Stüdyosu</strong>
              <span style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "12px",
                background: isRunning ? "#dcfce7" : "#f1f5f9",
                color: isRunning ? "#15803d" : "#64748b",
              }}>
                {isRunning ? "🟢 Çalışıyor" : "⚪ Kapalı (0 MB RAM)"}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "11.5px", color: "var(--muted)" }}>
              {isRunning
                ? `Aktif • Bellek: ${state?.process?.rss_mb || 54} MB • Port 5679`
                : "Sunucu kaynaklarını korumak için kapalı. Tek tıkla başlatabilirsiniz."}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {isRunning ? (
            <>
              <a
                href={studioUrl}
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
                  background: "#16a34a",
                  borderColor: "#16a34a"
                }}
              >
                <span>Stüdyoyu Aç</span>
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
                  color: "#dc2626"
                }}
                title="Stüdyoyu kapatıp belleği sunucuya iade eder"
              >
                {loading ? <Loader2 size={13} className="spin" /> : <Power size={13} />}
                <span>Durdur</span>
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
                padding: "0 14px"
              }}
            >
              {loading ? <Loader2 size={13} className="spin" /> : <Play size={13} />}
              <span>Stüdyoyu Başlat</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Card Variant
  return (
    <div style={{
      border: `1px solid ${isRunning ? "rgba(34, 197, 94, 0.35)" : "var(--border)"}`,
      background: isRunning ? "rgba(34, 197, 94, 0.04)" : "var(--surface)",
      borderRadius: "14px",
      padding: "18px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      gap: "14px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
      transition: "all 0.2s ease"
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <div style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: isRunning ? "#16a34a" : "rgba(97, 43, 211, 0.1)",
            color: isRunning ? "#fff" : "var(--accent, #612bd3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Film size={20} />
          </div>

          <span style={{
            fontSize: "11px",
            fontWeight: 700,
            padding: "3px 9px",
            borderRadius: "12px",
            background: isRunning ? "#dcfce7" : "#f1f5f9",
            color: isRunning ? "#15803d" : "#64748b",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px"
          }}>
            <span style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: isRunning ? "#22c55e" : "#94a3b8"
            }} />
            {isRunning ? "Çalışıyor" : "Kapalı"}
          </span>
        </div>

        <h4 style={{ margin: "0 0 6px 0", fontSize: "14px", fontWeight: 700, color: "var(--foreground)" }}>
          Sinematik Video Stüdyosu
        </h4>
        <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)", lineHeight: 1.45 }}>
          Senaryo, karakter tasarımı, çekim planı (storyboard) ve klip kurgusu. İhtiyaç duyduğunuzda açıp işiniz bitince kapatabilirsiniz.
        </p>

        {isRunning && state?.process && (
          <div style={{
            marginTop: "10px",
            padding: "6px 10px",
            background: "rgba(22, 163, 74, 0.08)",
            borderRadius: "6px",
            fontSize: "11px",
            color: "#166534",
            display: "flex",
            justifyContent: "space-between"
          }}>
            <span>RAM: <strong>{state.process.rss_mb} MB</strong></span>
            <span>Uptime: <strong>{state.process.uptime || "Yeni"}</strong></span>
            <span>Port: <strong>5679</strong></span>
          </div>
        )}

        {actionError && (
          <div style={{ marginTop: "8px", fontSize: "11.5px", color: "#dc2626" }}>
            {actionError}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "8px", paddingTop: "4px" }}>
        {isRunning ? (
          <>
            <a
              href={studioUrl}
              target="_blank"
              rel="noreferrer"
              className="button primary"
              style={{
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "12.5px",
                height: "36px",
                background: "#16a34a",
                borderColor: "#16a34a"
              }}
            >
              <span>Stüdyoyu Aç</span>
              <ExternalLink size={14} />
            </a>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleToggle("stop")}
              className="button secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                fontSize: "12px",
                height: "36px",
                padding: "0 12px",
                color: "#dc2626"
              }}
              title="Stüdyoyu kapatıp belleği boşaltır"
            >
              {loading ? <Loader2 size={14} className="spin" /> : <Square size={13} fill="#dc2626" />}
              <span>Kapat</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={() => handleToggle("start")}
            className="button primary"
            style={{
              width: "100%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              fontSize: "12.5px",
              height: "36px"
            }}
          >
            {loading ? <Loader2 size={14} className="spin" /> : <Play size={14} fill="currentColor" />}
            <span>Stüdyoyu Başlat</span>
          </button>
        )}
      </div>
    </div>
  );
}
