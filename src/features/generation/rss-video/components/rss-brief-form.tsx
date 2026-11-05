"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Volume2,
  Subtitles,
  Music,
  Mic,
  Compass,
  Palette,
} from "lucide-react";
import {
  RSS_NARRATIVE_STYLES,
  RSS_VISUAL_MOODS,
  GEMINI_TTS_VOICE_OPTIONS,
  type RssNarrativeStyleKey,
  type RssVisualMoodKey,
  type RssTargetDuration,
  type RssAspectRatio,
  type GeminiTtsVoice,
  type RssVoiceSpeed,
  type RssVoiceEmotion,
  type RssCaptionStyle,
  type RssCaptionColor,
  type RssMusicMood,
  type RssMusicDucking,
} from "../types";

interface RssBriefFormProps {
  narrativeStyle: RssNarrativeStyleKey;
  onSelectNarrativeStyle: (style: RssNarrativeStyleKey) => void;
  visualMood: RssVisualMoodKey;
  setVisualMood: (mood: RssVisualMoodKey) => void;
  targetDuration: RssTargetDuration;
  setTargetDuration: (dur: RssTargetDuration) => void;
  aspectRatio: RssAspectRatio;
  setAspectRatio: (ratio: RssAspectRatio) => void;
  voiceActor: GeminiTtsVoice;
  setVoiceActor: (voice: GeminiTtsVoice) => void;
  voiceSpeed: RssVoiceSpeed;
  setVoiceSpeed: (speed: RssVoiceSpeed) => void;
  voiceEmotion: RssVoiceEmotion | "auto";
  setVoiceEmotion: (emotion: RssVoiceEmotion | "auto") => void;
  captionStyle: RssCaptionStyle;
  setCaptionStyle: (style: RssCaptionStyle) => void;
  captionColor: RssCaptionColor;
  setCaptionColor: (color: RssCaptionColor) => void;
  includeMusic: boolean;
  setIncludeMusic: (inc: boolean) => void;
  musicMood: RssMusicMood;
  setMusicMood: (mood: RssMusicMood) => void;
  musicDucking: RssMusicDucking;
  setMusicDucking: (ducking: RssMusicDucking) => void;
}

export function RssBriefForm({
  narrativeStyle,
  onSelectNarrativeStyle,
  visualMood,
  setVisualMood,
  targetDuration,
  setTargetDuration,
  aspectRatio,
  setAspectRatio,
  voiceActor,
  setVoiceActor,
  voiceSpeed,
  setVoiceSpeed,
  voiceEmotion,
  setVoiceEmotion,
  captionStyle,
  setCaptionStyle,
  captionColor,
  setCaptionColor,
  includeMusic,
  setIncludeMusic,
  musicMood,
  setMusicMood,
  musicDucking,
  setMusicDucking,
}: RssBriefFormProps) {
  const [showAudioSettings, setShowAudioSettings] = useState(true);
  const currentStyleMeta =
    RSS_NARRATIVE_STYLES.find((s) => s.key === narrativeStyle) || RSS_NARRATIVE_STYLES[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* 1. Video Anlatım & Akış Stili Seçici */}
      <div className="control-section">
        <div className="control-title" style={{ marginBottom: "8px" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Compass size={14} color="#6366f1" />
            <span>Anlatım &amp; Kurgu Stili</span>
          </label>
          <span style={{ fontSize: "11px", color: "#6366f1", fontWeight: 600 }}>
            {currentStyleMeta.badge}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px",
          }}
        >
          {RSS_NARRATIVE_STYLES.map((st) => {
            const isSelected = st.key === narrativeStyle;
            return (
              <button
                key={st.key}
                type="button"
                onClick={() => onSelectNarrativeStyle(st.key)}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: isSelected ? "1.5px solid #6366f1" : "1px solid #e2e8f0",
                  background: isSelected ? "#eef2ff" : "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  transition: "all 0.15s ease",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: isSelected ? "#3730a3" : "#1e293b",
                  }}
                >
                  {st.badge}
                </span>
                <small
                  style={{
                    fontSize: "10.5px",
                    color: isSelected ? "#4338ca" : "#64748b",
                    lineHeight: 1.25,
                  }}
                >
                  {st.label}
                </small>
              </button>
            );
          })}
        </div>

        <div
          style={{
            marginTop: "8px",
            padding: "8px 10px",
            borderRadius: "8px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            fontSize: "11.5px",
            color: "#475569",
            lineHeight: 1.4,
          }}
        >
          <strong style={{ color: "#1e293b", display: "block", marginBottom: "2px" }}>
            {currentStyleMeta.label} Kurgusu:
          </strong>
          {currentStyleMeta.desc}
          <div style={{ marginTop: "4px", fontSize: "10.5px", color: "#6366f1", fontWeight: 600 }}>
            Ritim: {currentStyleMeta.pacingRule}
          </div>
        </div>
      </div>

      {/* 2. Görsel Tarz, Süre ve Boyut */}
      <div className="attribute-grid">
        <label className="select-field">
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <Palette size={12} color="#6366f1" /> Görsel Tarz (CliProxy T2I)
          </span>
          <div>
            <select
              value={visualMood}
              onChange={(e) => setVisualMood(e.target.value as RssVisualMoodKey)}
            >
              {RSS_VISUAL_MOODS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>
        </label>

        <label className="select-field">
          <span>Hedef Video Süresi</span>
          <div>
            <select
              value={targetDuration}
              onChange={(e) => setTargetDuration(e.target.value as RssTargetDuration)}
            >
              <option value="15s">15 sn (Hızlı Özet • 3 Sahne)</option>
              <option value="30s">30 sn (Standart • 5 Sahne)</option>
              <option value="45s">45 sn (Detaylı Anlatım • 7 Sahne)</option>
              <option value="60s">60 sn (Kapsamlı Hikâye • 9 Sahne)</option>
            </select>
            <ChevronDown size={14} />
          </div>
        </label>

        <label className="select-field">
          <span>En-Boy Oranı</span>
          <div>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as RssAspectRatio)}
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
              <option value="yes">Fon Müziği Aktif (Otomatik Ducking)</option>
              <option value="no">Müziksiz (Yalnızca Gemini 2.0 TTS)</option>
            </select>
            <ChevronDown size={14} />
          </div>
        </label>
      </div>

      {/* 3. Gemini 2.0 TTS, Altyazı & Müzik Ayarları */}
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          overflow: "hidden",
          background: "#f8fafc",
        }}
      >
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
            <span>Gemini 2.0 TTS, Altyazı &amp; Fon Ayarları</span>
          </span>
          <span style={{ fontSize: "11px", color: "#64748b" }}>
            {showAudioSettings ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
        </button>

        {showAudioSettings && (
          <div
            style={{
              padding: "12px",
              background: "#ffffff",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {/* Gemini 2.0 TTS Aktör & Hız */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <label className="select-field">
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <Mic size={12} color="#7c3aed" /> Gemini 2.0 TTS Sesi
                </span>
                <div>
                  <select
                    value={voiceActor}
                    onChange={(e) => setVoiceActor(e.target.value as GeminiTtsVoice)}
                  >
                    {GEMINI_TTS_VOICE_OPTIONS.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </div>
              </label>

              <label className="select-field">
                <span>Konuşma Hızı</span>
                <div>
                  <select
                    value={String(voiceSpeed)}
                    onChange={(e) => setVoiceSpeed(parseFloat(e.target.value) as RssVoiceSpeed)}
                  >
                    <option value="1">Normal (%100 Doğal)</option>
                    <option value="1.15">Dinamik (%115 Shorts)</option>
                    <option value="0.9">Dingin (%90 Masal/Belgesel)</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
              </label>
            </div>

            <label className="select-field">
              <span>Dış Ses Duygu Tonlaması</span>
              <div>
                <select
                  value={voiceEmotion}
                  onChange={(e) => setVoiceEmotion(e.target.value as RssVoiceEmotion | "auto")}
                >
                  <option value="auto">Sahneye Göre Otomatik Duygu (Önerilen)</option>
                  <option value="urgent">Acil &amp; Vurgulu (Sıcak Haber)</option>
                  <option value="calm">Berrak &amp; Sakin (Belgesel)</option>
                  <option value="warm_storyteller">Sıcak &amp; Samimi (Masal Anlatıcısı)</option>
                  <option value="dramatic">Derin &amp; Sinematik (Hikâye)</option>
                  <option value="mysterious">Gizemli &amp; Merak Uyandıran</option>
                  <option value="excited">Enerjik &amp; Heyecanlı</option>
                </select>
                <ChevronDown size={14} />
              </div>
            </label>

            {/* Altyazı Stili & Vurgu Rengi */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <label className="select-field">
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <Subtitles size={12} color="#0284c7" /> Altyazı Animasyonu
                </span>
                <div>
                  <select
                    value={captionStyle}
                    onChange={(e) => setCaptionStyle(e.target.value as RssCaptionStyle)}
                  >
                    <option value="tiktok_pop">Pop-in Kelime Vurgulu (.ass)</option>
                    <option value="bold_box">Kutu Arka Planlı Kalın</option>
                    <option value="cinema_clean">Sinematik Sade Alt Yazı</option>
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
                    onChange={(e) => setCaptionColor(e.target.value as RssCaptionColor)}
                    disabled={captionStyle === "off"}
                  >
                    <option value="yellow">Canlı Sarı (#FFE600)</option>
                    <option value="green">Neon Yeşil (#00FF88)</option>
                    <option value="cyan">Gökyüzü Mavisi (#00E5FF)</option>
                    <option value="white">Saf Beyaz</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
              </label>
            </div>

            {/* Fon Müziği & Ducking */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <label className="select-field">
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <Music size={12} color="#059669" /> Fon Atmosferi
                </span>
                <div>
                  <select
                    value={musicMood}
                    onChange={(e) => setMusicMood(e.target.value as RssMusicMood)}
                    disabled={!includeMusic}
                  >
                    <option value="dynamic_news">Dinamik Haber &amp; Ritim</option>
                    <option value="acoustic_warm">Sıcak Akustik &amp; Masal</option>
                    <option value="cinematic_ambient">Sinematik Derin Ambiyans</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
              </label>

              <label className="select-field">
                <span>Fon Ses Seviyesi (Ducking)</span>
                <div>
                  <select
                    value={musicDucking}
                    onChange={(e) => setMusicDucking(e.target.value as RssMusicDucking)}
                    disabled={!includeMusic}
                  >
                    <option value="-18dB">Standart (-18dB • Net Dış Ses)</option>
                    <option value="-12dB">Dengeli (-12dB • Belirgin Fon)</option>
                    <option value="-24dB">Derin (-24dB • Hafif Atmosfer)</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
              </label>
            </div>

            <div
              style={{
                fontSize: "10.5px",
                color: "#64748b",
                background: "#f8fafc",
                padding: "6px 8px",
                borderRadius: "6px",
                border: "1px dashed #cbd5e1",
              }}
            >
              🔒 <strong>Saf Gemini 2.0 TTS Kuralı:</strong> Edge-TTS yedeği kapalıdır. Ses üretiminde
              bir sorun oluşursa sistem sessizce yedek sese geçmez, doğrudan hatayı bildirir.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
