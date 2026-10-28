"use client";

import { useState } from "react";
import { Send, LoaderCircle, Check, AlertCircle } from "lucide-react";

interface TelegramSendButtonProps {
  mediaUrl?: string;
  mediaUrls?: string[];
  mediaType?: "image" | "video" | "auto";
  caption?: string;
  title?: string;
  className?: string;
  size?: number;
  variant?: "icon" | "badge" | "button";
  label?: string;
}

export function TelegramSendButton({
  mediaUrl,
  mediaUrls,
  mediaType = "auto",
  caption,
  title,
  className = "",
  size = 14,
  variant = "icon",
  label = "Telegram",
}: TelegramSendButtonProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isMultiple = Array.isArray(mediaUrls) && mediaUrls.length > 1;
  const defaultTitle = isMultiple
    ? `Telegram'a Gönder (${mediaUrls.length} Görsel)`
    : "Telegram'a Gönder";
  const computedTitle = title || defaultTitle;

  async function handleSend(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const targetUrls = Array.isArray(mediaUrls) && mediaUrls.length > 0
      ? mediaUrls.filter((u) => typeof u === "string" && u.trim().length > 0)
      : (mediaUrl && typeof mediaUrl === "string" && mediaUrl.trim().length > 0 ? [mediaUrl.trim()] : []);

    if (targetUrls.length === 0) return;
    if (status === "sending") return;

    setStatus("sending");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/integrations/telegram/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(targetUrls.length > 1 ? { mediaUrls: targetUrls } : { mediaUrl: targetUrls[0] }),
          mediaType,
          caption: caption || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Telegram'a gönderilemedi.");
      }

      setStatus("success");
      setTimeout(() => {
        setStatus("idle");
      }, 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gönderim başarısız";
      setStatus("error");
      setErrorMessage(msg);
      setTimeout(() => {
        setStatus("idle");
        setErrorMessage(null);
      }, 3500);
    }
  }

  // 1. Textli Buton Varyantı (Örn: Video detay veya araç çubuğu)
  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={handleSend}
        disabled={status === "sending"}
        className={`tg-send-btn tg-variant-button ${status} ${className}`}
        title={errorMessage || computedTitle}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          padding: "5px 10px",
          fontSize: "11.5px",
          fontWeight: 600,
          borderRadius: "8px",
          border: status === "success" ? "1px solid #86efac" : "1px solid #e2e8f0",
          background: status === "success" ? "#f0fdf4" : status === "error" ? "#fef2f2" : "#ffffff",
          color: status === "success" ? "#16a34a" : status === "error" ? "#dc2626" : "#475569",
          cursor: status === "sending" ? "wait" : "pointer",
          transition: "all 0.18s ease",
        }}
      >
        {status === "sending" ? (
          <LoaderCircle size={size} className="spin" style={{ color: "#0284c7" }} />
        ) : status === "success" ? (
          <Check size={size} style={{ color: "#16a34a" }} />
        ) : status === "error" ? (
          <AlertCircle size={size} style={{ color: "#dc2626" }} />
        ) : (
          <Send size={size} style={{ color: "#0284c7" }} />
        )}
        <span>{status === "success" ? "İletildi" : status === "error" ? "Hata" : label}</span>
      </button>
    );
  }

  // 2. Minimalist İkon Buton Varyantı (CreativeCard vb. kart içi eylemler)
  return (
    <button
      type="button"
      onClick={handleSend}
      disabled={status === "sending"}
      className={`tg-send-icon-btn ${status} ${className}`}
      title={errorMessage ? `Hata: ${errorMessage}` : status === "success" ? "Telegram'a İletildi!" : computedTitle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "28px",
        height: "28px",
        borderRadius: "7px",
        border: "none",
        background: status === "success" ? "#dcfce7" : status === "error" ? "#fee2e2" : "transparent",
        color: status === "success" ? "#16a34a" : status === "error" ? "#dc2626" : "#0284c7",
        cursor: status === "sending" ? "wait" : "pointer",
        transition: "all 0.15s ease",
      }}
    >
      {status === "sending" ? (
        <LoaderCircle size={size} className="spin" />
      ) : status === "success" ? (
        <Check size={size} />
      ) : status === "error" ? (
        <AlertCircle size={size} />
      ) : (
        <Send size={size} />
      )}
    </button>
  );
}
