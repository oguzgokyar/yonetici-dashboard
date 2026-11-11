"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, RefreshCw, Maximize2 } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";

type EmbeddedToolViewProps = {
  title: string;
  eyebrow?: string;
  iframeSrc: string;
  externalUrl?: string;
  description?: string;
};

export function EmbeddedToolView({
  title,
  eyebrow = "Geliştirici Araçları",
  iframeSrc,
  externalUrl,
  description,
}: EmbeddedToolViewProps) {
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

  const targetUrl = externalUrl || iframeSrc;

  return (
    <DashboardShell title={title} eyebrow={eyebrow}>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "100%" }}>
        {/* Tool Header Toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "white",
            padding: "10px 18px",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link
              href="/developer-tools"
              className="button ghost compact"
              style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", padding: "6px 12px" }}
              title="Geliştirici Araçlarına Dön"
            >
              <ArrowLeft size={14} />
              <span>Araçlar</span>
            </Link>
            <div style={{ height: "18px", width: "1px", background: "var(--border)" }} />
            <div>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Entegre Çalışma Alanı
              </span>
              {description && (
                <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>
                  {description}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setKey((prev) => prev + 1);
              }}
              className="button ghost compact"
              title="Yenile"
              style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Yenile</span>
            </button>

            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button primary compact"
              style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
              title="Yeni Sekmede Tam Ekran Aç"
            >
              <ExternalLink size={13} />
              <span>Yeni Sekmede Aç</span>
            </a>
          </div>
        </div>

        {/* Embedded Iframe Container */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "calc(100vh - 195px)",
            minHeight: "680px",
            background: "white",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
          }}
        >
          {loading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255, 255, 255, 0.95)",
                zIndex: 10,
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  border: "3px solid #f1f5f9",
                  borderTopColor: "var(--primary)",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 500 }}>
                {title} yükleniyor...
              </span>
            </div>
          )}

          <iframe
            key={key}
            src={iframeSrc}
            title={title}
            onLoad={() => setLoading(false)}
            allow="camera; microphone; clipboard-read; clipboard-write; display-capture; autoplay"
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              display: "block",
            }}
          />
        </div>
      </div>
    </DashboardShell>
  );
}
