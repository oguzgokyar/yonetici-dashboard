"use client";

import { LoaderCircle, ExternalLink, X } from "lucide-react";
import type { ActiveJob } from "../types";

interface VidsActiveJobBannerProps {
  activeJob: ActiveJob | null;
  lastErrorJob: { id?: string; title: string; error?: string; message?: string } | null;
  onClearError: () => void;
}

export function VidsActiveJobBanner({
  activeJob,
  lastErrorJob,
  onClearError,
}: VidsActiveJobBannerProps) {
  if (!activeJob && !lastErrorJob) return null;

  return (
    <>
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
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#3730a3",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <LoaderCircle size={14} className="spin" /> Video Üretimi Devam Ediyor
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#4338ca",
                background: "#e0e7ff",
                padding: "2px 8px",
                borderRadius: "99px",
              }}
            >
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
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#991b1b",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              ⚠️ Son Üretim Bildirimi ({lastErrorJob.title})
            </span>
            <button
              type="button"
              onClick={onClearError}
              style={{
                background: "none",
                border: "none",
                fontSize: "12px",
                color: "#b91c1c",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              ✕ Kapat
            </button>
          </div>
          <div style={{ fontSize: "12px", color: "#7f1d1d" }}>
            {lastErrorJob.error || lastErrorJob.message}
          </div>
        </div>
      )}
    </>
  );
}
