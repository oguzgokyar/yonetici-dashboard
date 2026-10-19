"use client";

import Link from "next/link";
import { X, ChevronDown, Sparkles, LoaderCircle, Film, Trash2 } from "lucide-react";
import {
  VISUAL_MOOD_OPTIONS,
  type VisualMoodOption,
  type PoolAccount,
  type ActiveJob,
} from "../types";

interface VidsBriefFormProps {
  topic: string;
  setTopic: (topic: string) => void;
  visualMood: VisualMoodOption["key"];
  setVisualMood: (mood: VisualMoodOption["key"]) => void;
  targetDuration: "15s" | "30s" | "60s";
  setTargetDuration: (dur: "15s" | "30s" | "60s") => void;
  aspectRatio: "9:16" | "16:9" | "1:1";
  setAspectRatio: (ratio: "9:16" | "16:9" | "1:1") => void;
  narrativeMode: "voiceover_only" | "dialogue_only" | "hybrid";
  setNarrativeMode: (mode: "voiceover_only" | "dialogue_only" | "hybrid") => void;
  includeMusic: boolean;
  setIncludeMusic: (inc: boolean) => void;
  selectedAccountId: string;
  setSelectedAccountId: (accId: string) => void;
  accountsPool: PoolAccount[];
  planning: boolean;
  revising: boolean;
  enqueueing: boolean;
  message: string;
  setMessage: (msg: string) => void;
  hasStoryboard: boolean;
  onGenerateStoryboard: () => void;
  onClearStoryboard: () => void;
}

export function VidsBriefForm({
  topic,
  setTopic,
  visualMood,
  setVisualMood,
  targetDuration,
  setTargetDuration,
  aspectRatio,
  setAspectRatio,
  narrativeMode,
  setNarrativeMode,
  includeMusic,
  setIncludeMusic,
  selectedAccountId,
  setSelectedAccountId,
  accountsPool,
  planning,
  revising,
  enqueueing,
  message,
  setMessage,
  hasStoryboard,
  onGenerateStoryboard,
  onClearStoryboard,
}: VidsBriefFormProps) {
  const activeAvailableCount = accountsPool.filter(
    (a) => a.quota_status === "available" && a.is_active !== 0
  ).length;
  const activeTotalCount = accountsPool.filter((a) => a.is_active !== 0).length || accountsPool.length || 2;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Konu / Hikaye Alanı */}
      <div className="control-section">
        <div className="control-title">
          <label htmlFor="vids-topic-input">
            <span>Video Konusu / Hikayesi</span>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {hasStoryboard && (
              <button
                type="button"
                onClick={onClearStoryboard}
                style={{
                  background: "none",
                  border: "none",
                  color: "#dc2626",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                title="Sahne planını ve taslağı sıfırlar"
              >
                <Trash2 size={13} />
                <span>Sahne Planını Sıfırla</span>
              </button>
            )}
            {topic.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTopic("");
                  setMessage("");
                }}
                className="prompt-clear-btn"
                title="Konu metnini temizle"
              >
                <X size={13} />
                <span>Temizle</span>
              </button>
            )}
          </div>
        </div>
        <textarea
          id="vids-topic-input"
          className="prompt-area"
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value);
            setMessage("");
          }}
          placeholder="Örn: Çocukların ekran bağımlılığı yerine robotik ve maker zanaatiyle problem çözücü bireylere dönüştüğü sıcak bir STEM atölyesi hikayesi..."
        />
        <div className="prompt-footer">
          <span>{topic.length}/1500</span>
          <span>Otomatik İngilizce Sahneleme</span>
        </div>
      </div>

      {/* Nitelik Seçiciler */}
      <div className="attribute-grid">
        <label className="select-field">
          <span>Anlatım &amp; Ses Formatı (Audio Mode)</span>
          <div>
            <select
              value={narrativeMode}
              onChange={(e) =>
                setNarrativeMode(e.target.value as "voiceover_only" | "dialogue_only" | "hybrid")
              }
            >
              <option value="hybrid">🎭 Hibrit (Anlatıcı + Karakter Diyaloğu)</option>
              <option value="voiceover_only">🎙️ Dış Ses / Masal Anlatıcısı (Sadece Anlatım)</option>
              <option value="dialogue_only">💬 Karakter Diyalogları (Konuşmalı / Lip-Sync)</option>
            </select>
            <ChevronDown size={14} />
          </div>
        </label>

        <label className="select-field">
          <span>Sanat &amp; Görsel Tarzı</span>
          <div>
            <select
              value={visualMood}
              onChange={(e) => setVisualMood(e.target.value as VisualMoodOption["key"])}
            >
              {VISUAL_MOOD_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>
        </label>

        <label className="select-field">
          <span>Ortalama Video Süresi</span>
          <div>
            <select
              value={targetDuration}
              onChange={(e) => setTargetDuration(e.target.value as "15s" | "30s" | "60s")}
            >
              <option value="15s">~10 - 15 sn (Hızlı Giriş / Hook)</option>
              <option value="30s">~20 - 30 sn (Standart Hikaye)</option>
              <option value="60s">~45 - 60 sn (Geniş Sinematik Anlatım)</option>
            </select>
            <ChevronDown size={14} />
          </div>
        </label>

        <label className="select-field">
          <span>Format / En-Boy Oranı</span>
          <div>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as "9:16" | "16:9" | "1:1")}
            >
              <option value="9:16">Dikey (9:16 • Reels / Shorts / TikTok)</option>
              <option value="16:9">Yatay (16:9 • YouTube / Sunum)</option>
              <option value="1:1">Kare (1:1 • Instagram Akış)</option>
            </select>
            <ChevronDown size={14} />
          </div>
        </label>

        <label className="select-field">
          <span>Arka Plan Müziği (Google Vids Audio)</span>
          <div>
            <select
              value={includeMusic ? "yes" : "no"}
              onChange={(e) => setIncludeMusic(e.target.value === "yes")}
            >
              <option value="yes">🎵 Müzik Aktif (visual-skills Duygu Promptu ile)</option>
              <option value="no">🔇 Müziksiz (Sadece Ses / Diyalog)</option>
            </select>
            <ChevronDown size={14} />
          </div>
        </label>

        <div className="select-field">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "4px",
            }}
          >
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
              Google Hesap Havuzu (Multi-Account)
            </span>
            <Link
              href="/settings"
              style={{
                color: "#2563eb",
                fontSize: "11px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                textDecoration: "none",
              }}
              title="Sistem Ayarları > API Yönetimi > Google Vids Havuzu sayfasına gider"
            >
              ⚙️ Havuzu Yönet (Ayarlar →)
            </Link>
          </div>
          <div>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
            >
              <option value="auto">
                🔄 Otomatik Havuz Rotasyonu ({activeAvailableCount}/{activeTotalCount} Uygun)
              </option>
              {accountsPool.map((acc) => (
                <option key={acc.id} value={acc.id} disabled={acc.is_active === 0}>
                  {acc.is_active === 0 ? "⏸️" : acc.quota_status === "available" ? "🟢" : "🔴"}{" "}
                  {acc.email} [{acc.profile_directory || "Default"}]{" "}
                  {acc.is_active === 0 ? "(Pasif - Atlanır)" : acc.quota_status !== "available" ? "(Kotada)" : ""}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>
        </div>
      </div>

      {message && (
        <div className="generation-notice">
          <Sparkles size={15} />
          <span>{message}</span>
        </div>
      )}

      <button
        type="button"
        className="generate-button"
        disabled={planning || revising || enqueueing}
        onClick={onGenerateStoryboard}
      >
        {planning ? <LoaderCircle className="spin" size={18} /> : <Film size={18} />}
        {planning ? "Senaryo Kurgulanıyor..." : "Senaryo & Sahneleri Oluştur"}
        <span>{targetDuration}</span>
      </button>
    </div>
  );
}
