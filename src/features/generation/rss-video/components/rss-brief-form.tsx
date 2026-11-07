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
    <div className="rss-brief-stack">
      {/* 1. Video Anlatım & Akış Stili Seçici */}
      <div className="control-section">
        <div className="control-title rss-control-title-spaced">
          <label className="rss-inline-label">
            <Compass size={14} className="rss-icon-indigo" />
            <span>Anlatım &amp; Kurgu Stili</span>
          </label>
          <span className="rss-style-pill">{currentStyleMeta.badge}</span>
        </div>

        <div className="rss-style-grid">
          {RSS_NARRATIVE_STYLES.map((st) => {
            const isSelected = st.key === narrativeStyle;
            return (
              <button
                key={st.key}
                type="button"
                onClick={() => onSelectNarrativeStyle(st.key)}
                className={`rss-style-card ${isSelected ? "is-selected" : ""}`}
              >
                <span className="rss-style-card-badge">{st.badge}</span>
                <small className="rss-style-card-label">{st.label}</small>
              </button>
            );
          })}
        </div>

        <div className="rss-style-summary-box">
          <strong className="rss-style-summary-title">{currentStyleMeta.label} Kurgusu:</strong>
          {currentStyleMeta.desc}
          <div className="rss-style-pacing">Ritim: {currentStyleMeta.pacingRule}</div>
        </div>
      </div>

      {/* 2. Görsel Tarz, Süre ve Boyut */}
      <div className="attribute-grid">
        <label className="select-field">
          <span className="rss-inline-label compact">
            <Palette size={12} className="rss-icon-indigo" /> Görsel Tarz (CliProxy T2I)
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
      <div className="rss-audio-accordion">
        <button
          type="button"
          onClick={() => setShowAudioSettings(!showAudioSettings)}
          className="rss-audio-accordion-trigger"
        >
          <span className="rss-inline-label">
            <Volume2 size={14} className="rss-icon-indigo" />
            <span>Gemini 2.0 TTS, Altyazı &amp; Fon Ayarları</span>
          </span>
          <span className="rss-audio-accordion-chevron">
            {showAudioSettings ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
        </button>

        {showAudioSettings && (
          <div className="rss-audio-accordion-body">
            {/* Gemini 2.0 TTS Aktör & Hız */}
            <div className="rss-two-col-grid">
              <label className="select-field">
                <span className="rss-inline-label compact">
                  <Mic size={12} className="rss-icon-violet" /> Gemini 2.0 TTS Sesi
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
            <div className="rss-two-col-grid">
              <label className="select-field">
                <span className="rss-inline-label compact">
                  <Subtitles size={12} className="rss-icon-sky" /> Altyazı Animasyonu
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
            <div className="rss-two-col-grid">
              <label className="select-field">
                <span className="rss-inline-label compact">
                  <Music size={12} className="rss-icon-emerald" /> Fon Atmosferi
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

            <div className="rss-tts-policy-note">
              🔒 <strong>Saf Gemini 2.0 TTS Kuralı:</strong> Edge-TTS yedeği kapalıdır. Ses
              üretiminde bir sorun oluşursa sistem sessizce yedek sese geçmez, doğrudan hatayı
              bildirir.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
