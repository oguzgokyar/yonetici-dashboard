"use client";

import { useState } from "react";
import Link from "next/link";
import { X, ChevronDown, ChevronUp, Sparkles, LoaderCircle, Film, Trash2, Settings2, Volume2, Subtitles, Music, Mic } from "lucide-react";
import {
  VISUAL_MOOD_OPTIONS,
  type VisualMoodOption,
  type TargetDurationOption,
  type NarrativeModeOption,
  type PoolAccount,
  type ActiveJob,
  type CaptionStyleOption,
  type CaptionColorOption,
  type VoiceActorOption,
  type VoiceSpeedOption,
  type VoiceEmotionOption,
  type MusicDuckingOption,
  type MusicMoodOption,
} from "../types";

interface VidsBriefFormProps {
  topic: string;
  setTopic: (topic: string) => void;
  visualMood: VisualMoodOption["key"];
  setVisualMood: (mood: VisualMoodOption["key"]) => void;
  targetDuration: TargetDurationOption;
  setTargetDuration: (dur: TargetDurationOption) => void;
  aspectRatio: "9:16" | "16:9" | "1:1";
  setAspectRatio: (ratio: "9:16" | "16:9" | "1:1") => void;
  narrativeMode: NarrativeModeOption;
  setNarrativeMode: (mode: NarrativeModeOption) => void;
  engine?: "vids" | "flow";
  setEngine?: (engine: "vids" | "flow") => void;
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
  // Ses, Müzik & Altyazı Ayarları
  captionStyle?: CaptionStyleOption;
  setCaptionStyle?: (style: CaptionStyleOption) => void;
  captionColor?: CaptionColorOption;
  setCaptionColor?: (color: CaptionColorOption) => void;
  voiceActor?: VoiceActorOption;
  setVoiceActor?: (actor: VoiceActorOption) => void;
  voiceSpeed?: VoiceSpeedOption;
  setVoiceSpeed?: (speed: VoiceSpeedOption) => void;
  voiceEmotion?: VoiceEmotionOption;
  setVoiceEmotion?: (emotion: VoiceEmotionOption) => void;
  musicDucking?: MusicDuckingOption;
  setMusicDucking?: (ducking: MusicDuckingOption) => void;
  musicMood?: MusicMoodOption;
  setMusicMood?: (mood: MusicMoodOption) => void;
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
  engine = "vids",
  setEngine,
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
  captionStyle = "tiktok",
  setCaptionStyle,
  captionColor = "yellow",
  setCaptionColor,
  voiceActor = "gemini_actor",
  setVoiceActor,
  voiceSpeed = 1.0,
  setVoiceSpeed,
  voiceEmotion = "auto",
  setVoiceEmotion,
  musicDucking = "-18dB",
  setMusicDucking,
  musicMood = "dynamic_maker",
  setMusicMood,
}: VidsBriefFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(true);
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

      {/* Model & Motor Seçici (Sade Segmented Control) */}
      {setEngine && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>Video Üretim Motoru</span>
          <div
            style={{
              display: "flex",
              background: "#f1f5f9",
              borderRadius: "8px",
              padding: "3px",
              gap: "3px",
              border: "1px solid #e2e8f0",
            }}
          >
            <button
              type="button"
              onClick={() => setEngine("flow")}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "6px",
                border: "none",
                background: engine === "flow" ? "#ffffff" : "transparent",
                color: engine === "flow" ? "#6d28d9" : "#64748b",
                fontWeight: engine === "flow" ? 700 : 500,
                boxShadow: engine === "flow" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                fontSize: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
            >
              <Sparkles size={13} color={engine === "flow" ? "#7c3aed" : "#94a3b8"} />
              <span>Google Flow</span>
            </button>
            <button
              type="button"
              onClick={() => setEngine("vids")}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "6px",
                border: "none",
                background: engine === "vids" ? "#ffffff" : "transparent",
                color: engine === "vids" ? "#1e40af" : "#64748b",
                fontWeight: engine === "vids" ? 700 : 500,
                boxShadow: engine === "vids" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                fontSize: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
            >
              <Film size={13} color={engine === "vids" ? "#2563eb" : "#94a3b8"} />
              <span>Google Vids</span>
            </button>
          </div>
        </div>
      )}

      {/* Nitelik Seçiciler */}
      <div className="attribute-grid">
        <label className="select-field">
          <span>Seslendirme &amp; Anlatım</span>
          <div>
            <select
              value={narrativeMode}
              onChange={(e) =>
                setNarrativeMode(e.target.value as NarrativeModeOption)
              }
            >
              <option value="diy_asmr">Masaüstü DIY ASMR (Eylem Sesleri &amp; Foley)</option>
              <option value="silent_captions">Sessiz Mod (Büyük Ekran Metinleri)</option>
              <option value="hybrid">Hibrit (Anlatıcı Dış Ses + Karakter Konuşması)</option>
              <option value="voiceover_only">Dış Ses / Anlatıcı (Gemini TTS)</option>
              <option value="dialogue_only">Karakter Diyaloğu (Flow Omni Lip-Sync)</option>
            </select>
            <ChevronDown size={14} />
          </div>
        </label>

        <label className="select-field">
          <span>Görsel Tarz</span>
          <div>
            <select
              value={visualMood}
              onChange={(e) => setVisualMood(e.target.value as VisualMoodOption["key"])}
            >
              {VISUAL_MOOD_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label.replace(/^[^\w\sğüşöçıİĞÜŞÖÇ]+/, "").trim()}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>
        </label>

        <label className="select-field">
          <span>Video Süresi</span>
          <div>
            <select
              value={targetDuration}
              onChange={(e) => setTargetDuration(e.target.value as TargetDurationOption)}
            >
              <option value="3s">3 sn (Viral Döngü)</option>
              <option value="10s">10 sn (Tek Vuruş Kanca)</option>
              <option value="15s">15 sn (Dinamik Montaj)</option>
              <option value="30s">30 sn (Standart Kurgu)</option>
              <option value="60s">60 sn (Kapsamlı Hikaye)</option>
            </select>
            <ChevronDown size={14} />
          </div>
        </label>

        <label className="select-field">
          <span>En-Boy Oranı</span>
          <div>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as "9:16" | "16:9" | "1:1")}
            >
              <option value="9:16">Dikey (9:16 • Reels / Shorts / TikTok)</option>
              <option value="16:9">Yatay (16:9 • YouTube / Web)</option>
              <option value="1:1">Kare (1:1 • Instagram)</option>
            </select>
            <ChevronDown size={14} />
          </div>
        </label>

        <label className="select-field">
          <span>Arka Plan Müziği</span>
          <div>
            <select
              value={includeMusic ? "yes" : "no"}
              onChange={(e) => setIncludeMusic(e.target.value === "yes")}
            >
              <option value="yes">Müzik Aktif (Duyguya Uygun Enstrümantal)</option>
              <option value="no">Müziksiz (Yalnızca Ses &amp; Efekt)</option>
            </select>
            <ChevronDown size={14} />
          </div>
        </label>
      </div>

      {/* Ses, Müzik & Altyazı Ayarları - Modern & Sade Kontrol Paneli */}
      <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", background: "#f8fafc" }}>
        <button
          type="button"
          onClick={() => setShowAudioSettings(!showAudioSettings)}
          style={{
            width: "100%",
            padding: "9px 12px",
            background: "transparent",
            border: "none",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 600,
            color: "#334155",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Volume2 size={14} color="#6366f1" />
            <span>Altyazı, Dış Ses &amp; Müzik Ayarları</span>
          </span>
          <span style={{ fontSize: "11px", color: "#64748b" }}>
            {showAudioSettings ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
        </button>

        {showAudioSettings && (
          <div style={{ padding: "12px", background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "10px" }}>
            {/* 1. Altyazı Stili & Vurgu Rengi */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <label className="select-field">
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <Subtitles size={12} color="#0284c7" /> Altyazı Stili
                </span>
                <div>
                  <select
                    value={captionStyle}
                    onChange={(e) => setCaptionStyle && setCaptionStyle(e.target.value as CaptionStyleOption)}
                  >
                    <option value="tiktok">TikTok (Kelime Vurgulu)</option>
                    <option value="classic">Klasik Alt Yazı</option>
                    <option value="off">Altyazı Kapalı</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
              </label>

              <label className="select-field">
                <span>Vurgu Rengi</span>
                <div>
                  <select
                    value={captionColor}
                    onChange={(e) => setCaptionColor && setCaptionColor(e.target.value as CaptionColorOption)}
                    disabled={captionStyle === "off"}
                  >
                    <option value="yellow">Canlı Sarı (TikTok)</option>
                    <option value="green">Neon Yeşil</option>
                    <option value="cyan">Gökyüzü Mavisi</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
              </label>
            </div>

            {/* 2. Dış Ses Aktörü & Konuşma Temposu */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <label className="select-field">
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <Mic size={12} color="#7c3aed" /> Dış Ses Aktörü
                </span>
                <div>
                  <select
                    value={voiceActor}
                    onChange={(e) => setVoiceActor && setVoiceActor(e.target.value as VoiceActorOption)}
                  >
                    <option value="gemini_actor">Gemini 2.0 (Duygu Aktörü)</option>
                    <option value="edge_ahmet">Ahmet (Tok Erkek)</option>
                    <option value="edge_emel">Emel (Sıcak Kadın)</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
              </label>

              <label className="select-field">
                <span>Konuşma Hızı</span>
                <div>
                  <select
                    value={String(voiceSpeed)}
                    onChange={(e) => setVoiceSpeed && setVoiceSpeed(parseFloat(e.target.value) as VoiceSpeedOption)}
                  >
                    <option value="1.0">Normal (%100 Doğal)</option>
                    <option value="1.15">Hızlı (%115 TikTok)</option>
                    <option value="0.9">Sakin (%90 Eğitici)</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
              </label>
            </div>

            {/* 3. Müzik Türü & Ducking (Kısılma) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <label className="select-field">
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <Music size={12} color="#059669" /> Müzik Tarzı
                </span>
                <div>
                  <select
                    value={musicMood}
                    onChange={(e) => setMusicMood && setMusicMood(e.target.value as MusicMoodOption)}
                    disabled={!includeMusic}
                  >
                    <option value="dynamic_maker">Dinamik Maker &amp; Ritim</option>
                    <option value="acoustic_warm">Sıcak Akustik &amp; İlham</option>
                    <option value="cinematic_ambient">Sinematik Ambiyans</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
              </label>

              <label className="select-field">
                <span>Müzik Ducking (Kısılma)</span>
                <div>
                  <select
                    value={musicDucking}
                    onChange={(e) => setMusicDucking && setMusicDucking(e.target.value as MusicDuckingOption)}
                    disabled={!includeMusic}
                  >
                    <option value="-18dB">Standart (-18dB • Net Ses)</option>
                    <option value="-12dB">Hafif (-12dB • Müzik Ön Planda)</option>
                    <option value="-24dB">Derin (-24dB • Fısıltı Seviyesi)</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Gelişmiş Ayarlar (Hesap Havuzu) - Sade Akordeon */}
      <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", background: "#f8fafc" }}>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            width: "100%",
            padding: "8px 12px",
            background: "transparent",
            border: "none",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 600,
            color: "#64748b",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Settings2 size={13} color="#64748b" />
            <span>Gelişmiş Hesap &amp; Havuz Ayarları</span>
          </span>
          <span style={{ fontSize: "11px", color: "#64748b" }}>
            {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
        </button>

        {showAdvanced && (
          <div style={{ padding: "12px", background: "#ffffff", borderTop: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#475569" }}>
                Google Hesap Havuzu ({activeAvailableCount}/{activeTotalCount} Hazır)
              </span>
              <Link
                href="/settings"
                style={{
                  color: "#2563eb",
                  fontSize: "11px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Havuzu Yönet →
              </Link>
            </div>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "12px",
                color: "#334155",
              }}
            >
              <option value="auto">
                Otomatik Havuz Rotasyonu ({activeAvailableCount}/{activeTotalCount} Uygun)
              </option>
              {accountsPool.map((acc) => (
                <option key={acc.id} value={acc.id} disabled={acc.is_active === 0}>
                  {acc.email} [{acc.profile_directory || "Default"}] {acc.is_active === 0 ? "(Pasif)" : acc.quota_status !== "available" ? "(Kotada)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
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
