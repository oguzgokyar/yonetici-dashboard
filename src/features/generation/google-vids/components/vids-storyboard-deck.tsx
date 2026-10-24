"use client";

import { useState } from "react";
import {
  Clapperboard,
  Clock,
  Camera,
  Sun,
  Pencil,
  Copy,
  Check,
  RefreshCw,
  LoaderCircle,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  VISUAL_MOOD_OPTIONS,
  type StoryboardResponse,
  type ScriptScenePlan,
  type VisualMoodOption,
  type NarrativeModeOption,
} from "../types";

interface VidsStoryboardDeckProps {
  storyboard: StoryboardResponse | null;
  visualMood: VisualMoodOption["key"];
  narrativeMode: NarrativeModeOption;
  generatingAnchorImg: boolean;
  rerollingIndex: number | null;
  revising: boolean;
  enqueueing: boolean;
  planning: boolean;
  revisionNote: string;
  setRevisionNote: (note: string) => void;
  onGenerateCharacterImage: () => void;
  onRerollScene: (sceneIndex: number) => void;
  onUpdateScenePrompt: (
    sceneIndex: number,
    field: "summaryTr" | "voiceoverTr" | "dialogueTr" | "promptEn" | "onScreenTextTr",
    value: string
  ) => void;
  onUpdateSceneDuration?: (sceneIndex: number, durationSeconds: number) => void;
  onUpdateMusicPrompt: (value: string) => void;
  onGenerateRevision: () => void;
  onConfirmAndEnqueue: () => void;
  onClearStoryboard: () => void;
}

export function VidsStoryboardDeck({
  storyboard,
  visualMood,
  narrativeMode,
  generatingAnchorImg,
  rerollingIndex,
  revising,
  enqueueing,
  planning,
  revisionNote,
  setRevisionNote,
  onGenerateCharacterImage,
  onRerollScene,
  onUpdateScenePrompt,
  onUpdateSceneDuration,
  onUpdateMusicPrompt,
  onGenerateRevision,
  onConfirmAndEnqueue,
  onClearStoryboard,
}: VidsStoryboardDeckProps) {
  const [activeSceneTabIdx, setActiveSceneTabIdx] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  function handleCopy(text: string | undefined, key: string) {
    if (!text) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  }

  return (
    <section className="generation-results">
      <div className="results-toolbar">
        <div>
          <h2>Senaryo &amp; Sahne Planı (visual-skills)</h2>
          <span>Üretim öncesi sahneleri inceleyin, düzenleyin veya onaylayın</span>
        </div>
        {storyboard && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: "999px",
                background: "rgba(97, 43, 211, 0.1)",
                color: "#612bd3",
              }}
            >
              {storyboard.scenes.length} Sahne • Toplam {storyboard.totalDurationSeconds} sn
            </span>
            <button
              type="button"
              onClick={onClearStoryboard}
              style={{
                background: "none",
                border: "none",
                color: "#dc2626",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 8px",
                borderRadius: "6px",
              }}
              title="Mevcut senaryoyu tuvalden temizler"
            >
              <Trash2 size={13} />
              <span>Sıfırla</span>
            </button>
          </div>
        )}
      </div>

      {storyboard ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "4px 0" }}>
          {/* Hikaye Özeti Kartı */}
          <div
            style={{
              padding: "16px",
              borderRadius: "14px",
              border: "1px solid var(--border, #e2e8f0)",
              background: "var(--surface-subtle, #f8fafc)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "6px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <strong style={{ fontSize: "15px" }}>{storyboard.title}</strong>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(`${storyboard.title}\n\n${storyboard.narrativeTr}`, "story-summary")
                  }
                  style={{
                    background: copiedKey === "story-summary" ? "#ecfdf5" : "#f1f5f9",
                    border:
                      copiedKey === "story-summary" ? "1px solid #6ee7b7" : "1px solid #cbd5e1",
                    color: copiedKey === "story-summary" ? "#059669" : "#64748b",
                    padding: "4px 6px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Hikaye özetini panoya kopyala"
                >
                  {copiedKey === "story-summary" ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                {VISUAL_MOOD_OPTIONS.find((m) => m.key === storyboard.visualMood)?.label} •{" "}
                {storyboard.aspectRatio}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
              {storyboard.narrativeTr}
            </p>
          </div>

          {/* Müzik ve Duygu Özeti */}
          {storyboard.musicSpec && (
            <div
              style={{
                padding: "16px",
                borderRadius: "14px",
                border: "1px solid #fed7aa",
                background: "#fff7ed",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "18px" }}>🎵</span>
                  <div>
                    <strong style={{ fontSize: "13.5px", color: "#9a3412" }}>
                      Arka Plan Müziği: {storyboard.musicSpec.moodTr}
                    </strong>
                    <div style={{ fontSize: "11.5px", color: "#c2410c", marginTop: "2px" }}>
                      {storyboard.musicSpec.instrumentationTr}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "11px",
                    background: "#ffedd5",
                    color: "#9a3412",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    fontWeight: 600,
                  }}
                >
                  ✓ Google Vids Audio Promptu Aktif
                </span>
              </div>

              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "4px",
                  }}
                >
                  <label
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#9a3412",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <Pencil size={11} /> Müzik Üretim Promptu (Google Vids Audio - İngilizce)
                  </label>
                  <button
                    type="button"
                    onClick={() => handleCopy(storyboard.musicSpec?.musicPromptEn, "music-prompt")}
                    style={{
                      background: copiedKey === "music-prompt" ? "#ecfdf5" : "#ffedd5",
                      border:
                        copiedKey === "music-prompt" ? "1px solid #6ee7b7" : "1px solid #fdba74",
                      color: copiedKey === "music-prompt" ? "#059669" : "#9a3412",
                      padding: "3px 6px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title="Müzik promptunu kopyala"
                  >
                    {copiedKey === "music-prompt" ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={storyboard.musicSpec.musicPromptEn}
                  onChange={(e) => onUpdateMusicPrompt(e.target.value)}
                  placeholder="Müzik üretim promptu..."
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: "12px",
                    fontFamily: "monospace",
                    borderRadius: "8px",
                    border: "1px solid #fdba74",
                    boxSizing: "border-box",
                    lineHeight: 1.45,
                    background: "#ffffff",
                    color: "#7c2d12",
                    resize: "vertical",
                    minHeight: "60px",
                  }}
                />
              </div>
            </div>
          )}

          {/* Sabit Karakter / Hero Anchor Özeti */}
          {storyboard.characterAnchor && (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: "14px",
                border: "1px solid #c7d2fe",
                background: "#eef2ff",
                display: "flex",
                gap: "14px",
                alignItems: "flex-start",
              }}
            >
              {storyboard.characterAnchor.referenceImageUrl ? (
                <div
                  style={{
                    flexShrink: 0,
                    width: "72px",
                    height: "72px",
                    borderRadius: "10px",
                    overflow: "hidden",
                    border: "2px solid #6366f1",
                    background: "#fff",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={storyboard.characterAnchor.referenceImageUrl}
                    alt={storyboard.characterAnchor.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              ) : null}

              <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "6px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#3730a3",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    👤 Sabit Karakter DNA&apos;sı: {storyboard.characterAnchor.name}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          `${storyboard.characterAnchor?.name}: ${storyboard.characterAnchor?.fixedTraitsEn}\n\nMaster Prompt: ${storyboard.characterAnchor?.masterVisualPromptEn}`,
                          "char-dna"
                        )
                      }
                      style={{
                        background: copiedKey === "char-dna" ? "#ecfdf5" : "#ffffff",
                        border: copiedKey === "char-dna" ? "1px solid #6ee7b7" : "1px solid #c7d2fe",
                        color: copiedKey === "char-dna" ? "#059669" : "#3730a3",
                        padding: "3px 6px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title="Karakter DNA ve promptunu kopyala"
                    >
                      {copiedKey === "char-dna" ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#4f46e5",
                        background: "#e0e7ff",
                        padding: "2px 8px",
                        borderRadius: "99px",
                      }}
                    >
                      {storyboard.characterAnchor.archetypeTr}
                    </span>
                    <button
                      type="button"
                      onClick={onGenerateCharacterImage}
                      disabled={generatingAnchorImg}
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "3px 8px",
                        borderRadius: "6px",
                        border: "1px solid #818cf8",
                        background: "#ffffff",
                        color: "#4338ca",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      title="Seçilen proje görsel tarzına uygun referans portre üret"
                    >
                      {generatingAnchorImg ? (
                        <LoaderCircle size={12} className="spin" />
                      ) : (
                        <Sparkles size={12} />
                      )}
                      {generatingAnchorImg
                        ? "Üretiliyor..."
                        : storyboard.characterAnchor.referenceImageUrl
                          ? "Görseli Yenile (Tarza Uyarla)"
                          : "Referans Görseli Üret"}
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: "12px", color: "#312e81", lineHeight: 1.45 }}>
                  <strong>Kilitlenen Fiziksel Özellikler:</strong>{" "}
                  {storyboard.characterAnchor.fixedTraitsEn}
                </div>
                <div style={{ fontSize: "11px", color: "#6366f1", fontStyle: "italic" }}>
                  ✓ Tarz Uyumu:{" "}
                  {VISUAL_MOOD_OPTIONS.find((m) => m.key === (storyboard.visualMood || visualMood))?.label}{" "}
                  ile senkronize model üretilir.
                </div>
              </div>
            </div>
          )}

          {/* Sahneler - Sekmeli Gezinti */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {/* Sekme Çubuğu */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                overflowX: "auto",
                paddingBottom: "6px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              {storyboard.scenes.map((s, idx) => {
                const isSelected = idx === activeSceneTabIdx;
                return (
                  <button
                    key={s.sceneIndex}
                    type="button"
                    onClick={() => setActiveSceneTabIdx(idx)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "10px",
                      border: isSelected ? "2px solid #612bd3" : "1px solid #cbd5e1",
                      background: isSelected ? "rgba(97, 43, 211, 0.08)" : "#ffffff",
                      color: isSelected ? "#612bd3" : "#475569",
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: "12.5px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      whiteSpace: "nowrap",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        background: isSelected ? "#612bd3" : "#e2e8f0",
                        color: isSelected ? "#ffffff" : "#475569",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span>Sahne {idx + 1}</span>
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "1px 6px",
                        borderRadius: "99px",
                        background: isSelected ? "#612bd3" : "#f1f5f9",
                        color: isSelected ? "#ffffff" : "#64748b",
                      }}
                    >
                      {s.durationSeconds} sn • {s.actionType === "extend" ? "Uzatma" : "Yeni"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Seçili Sahne İçeriği */}
            {(() => {
              const currentIdx = Math.min(
                Math.max(activeSceneTabIdx, 0),
                storyboard.scenes.length - 1
              );
              const scene = storyboard.scenes[currentIdx] || storyboard.scenes[0];
              if (!scene) return null;

              return (
                <div
                  style={{
                    padding: "18px",
                    borderRadius: "14px",
                    border: "1px solid var(--border, #e2e8f0)",
                    background: "#ffffff",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          background: "#e0e7ff",
                          color: "#3730a3",
                          fontWeight: 700,
                          padding: "4px 10px",
                          borderRadius: "99px",
                        }}
                      >
                        Sahne {currentIdx + 1} / {storyboard.scenes.length}
                      </span>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          background: "#f8fafc",
                          padding: "2px 8px",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <Clock size={13} color="#6366f1" />
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                          Süre:
                        </span>
                        <select
                          value={scene.durationSeconds || 5}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (onUpdateSceneDuration) {
                              onUpdateSceneDuration(currentIdx, val);
                            }
                          }}
                          style={{
                            padding: "2px 6px",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            fontSize: "12px",
                            fontWeight: 700,
                            background: "#ffffff",
                            color: "#0f172a",
                            cursor: "pointer",
                          }}
                          title="Google Vids Omni klip üretim süresi (3-10 sn)"
                        >
                          {[3, 4, 5, 6, 7, 8, 9, 10].map((sec) => (
                            <option key={sec} value={sec}>
                              {sec} saniye
                            </option>
                          ))}
                        </select>
                        <span style={{ fontSize: "11px", color: "#64748b" }}>(Omni Klip)</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "10px",
                          fontSize: "11px",
                          color: "#64748b",
                          marginRight: "6px",
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Camera size={12} /> {scene.cameraSetup}
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Sun size={12} /> {scene.lightingSetup}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRerollScene(scene.sceneIndex)}
                        disabled={rerollingIndex === scene.sceneIndex}
                        style={{
                          background: "#f1f5f9",
                          border: "1px solid #cbd5e1",
                          padding: "4px 10px",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontSize: "11.5px",
                          fontWeight: 600,
                          color: "#334155",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                        title="Bu sahneyi visual-skills kurallarıyla yeniden kurgula"
                      >
                        {rerollingIndex === scene.sceneIndex ? (
                          <LoaderCircle size={13} className="spin" />
                        ) : (
                          <RefreshCw size={13} />
                        )}
                        {rerollingIndex === scene.sceneIndex ? "Yenileniyor..." : "Sahneyi Yenile"}
                      </button>
                    </div>
                  </div>

                  {/* Türkçe Sahne Açıklaması */}
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "4px",
                      }}
                    >
                      <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                        Sahne Hikayesi (Türkçe Özet)
                      </label>
                      <button
                        type="button"
                        onClick={() => handleCopy(scene.summaryTr, `scene-${currentIdx}-summary`)}
                        style={{
                          background:
                            copiedKey === `scene-${currentIdx}-summary` ? "#ecfdf5" : "#f1f5f9",
                          border:
                            copiedKey === `scene-${currentIdx}-summary`
                              ? "1px solid #6ee7b7"
                              : "1px solid #cbd5e1",
                          color:
                            copiedKey === `scene-${currentIdx}-summary` ? "#059669" : "#64748b",
                          padding: "3px 6px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        title="Sahne özetini panoya kopyala"
                      >
                        {copiedKey === `scene-${currentIdx}-summary` ? (
                          <Check size={12} />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={scene.summaryTr}
                      onChange={(e) => onUpdateScenePrompt(currentIdx, "summaryTr", e.target.value)}
                      placeholder="Sahne özeti..."
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        fontSize: "13px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        boxSizing: "border-box",
                        lineHeight: 1.45,
                        resize: "vertical",
                        minHeight: "56px",
                      }}
                    />
                  </div>

                  {/* Dış Ses (Voiceover) & Diyaloglar & ASMR & Ekran Metni */}
                  <div
                    style={{
                      background: "#f8fafc",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {/* A Modu: DIY ASMR Eylem Sesleri */}
                    {narrativeMode === "diy_asmr" && (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <label style={{ fontSize: "11.5px", fontWeight: 700, color: "#059669", display: "flex", alignItems: "center", gap: "5px" }}>
                            🛠️ Veo Yerleşik Fiziksel Sesler (Foley / ASMR • Konuşma Yok)
                          </label>
                          <span style={{ fontSize: "11px", color: "#059669", fontWeight: 600 }}>
                            Fiziksel Materyal Sesleri
                          </span>
                        </div>
                        <div style={{ padding: "8px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", fontSize: "12.5px", color: "#166534" }}>
                          {scene.audioCueEn || scene.sfxCueEn || "Veo fiziksel montaj, karton kesme ve motor sesleri"}
                        </div>
                      </div>
                    )}

                    {/* E Modu: Sessiz Video & Ekran Metni */}
                    {(narrativeMode === "silent_captions" || scene.onScreenTextTr) && (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <label style={{ fontSize: "11.5px", fontWeight: 700, color: "#d97706", display: "flex", alignItems: "center", gap: "5px" }}>
                            📱 Ekranda Görünecek Büyük Metin (On-Screen Hook / Adım)
                          </label>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>
                            Sessiz izleyenler için görsel metin
                          </span>
                        </div>
                        <input
                          type="text"
                          value={scene.onScreenTextTr || ""}
                          onChange={(e) => {
                            if (onUpdateScenePrompt) {
                              onUpdateScenePrompt(currentIdx, "onScreenTextTr" as any, e.target.value);
                            }
                          }}
                          placeholder="Örn: Adım 1: Karton Gövdeyi Kes • 10 Dakikalık Proje"
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            fontSize: "13px",
                            fontWeight: 600,
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            boxSizing: "border-box",
                            background: "#ffffff",
                          }}
                        />
                      </div>
                    )}

                    {narrativeMode !== "dialogue_only" && narrativeMode !== "diy_asmr" && narrativeMode !== "silent_captions" && (
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "4px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              flexWrap: "wrap",
                            }}
                          >
                            <label
                              style={{
                                fontSize: "11.5px",
                                fontWeight: 700,
                                color: "#0284c7",
                                display: "flex",
                                alignItems: "center",
                                gap: "5px",
                              }}
                            >
                              🎙️ Google Vids Yerleşik Dış Ses (Voiceover)
                            </label>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color:
                                  (scene.voiceoverTr || "").trim().split(/\s+/).filter(Boolean)
                                    .length > 20
                                    ? "#e11d48"
                                    : "#64748b",
                              }}
                            >
                              (
                              {(scene.voiceoverTr || "").trim().split(/\s+/).filter(Boolean).length}
                              /20 kelime • ~7s)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(scene.voiceoverTr, `scene-${currentIdx}-vo`)}
                            style={{
                              background:
                                copiedKey === `scene-${currentIdx}-vo` ? "#ecfdf5" : "#e0f2fe",
                              border:
                                copiedKey === `scene-${currentIdx}-vo`
                                  ? "1px solid #6ee7b7"
                                  : "1px solid #bae6fd",
                              color:
                                copiedKey === `scene-${currentIdx}-vo` ? "#059669" : "#0369a1",
                              padding: "3px 6px",
                              borderRadius: "6px",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            title="Dış ses metnini panoya kopyala"
                          >
                            {copiedKey === `scene-${currentIdx}-vo` ? (
                              <Check size={12} />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          value={scene.voiceoverTr || ""}
                          onChange={(e) =>
                            onUpdateScenePrompt(currentIdx, "voiceoverTr", e.target.value)
                          }
                          placeholder="Google Vids Voiceover paneline yazılacak etkili Türkçe dış ses metni..."
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            fontSize: "13px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            boxSizing: "border-box",
                            lineHeight: 1.45,
                            background: "#ffffff",
                            resize: "vertical",
                            minHeight: "70px",
                          }}
                        />
                      </div>
                    )}

                    {narrativeMode !== "voiceover_only" && narrativeMode !== "diy_asmr" && narrativeMode !== "silent_captions" && (
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "4px",
                          }}
                        >
                          <label
                            style={{
                              fontSize: "11.5px",
                              fontWeight: 700,
                              color: "#7c3aed",
                              display: "flex",
                              alignItems: "center",
                              gap: "5px",
                            }}
                          >
                            💬 Karakter Repliği / Diyalog (Veo Lip-Sync)
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(scene.dialogueTr, `scene-${currentIdx}-dialogue`)
                            }
                            style={{
                              background:
                                copiedKey === `scene-${currentIdx}-dialogue`
                                  ? "#ecfdf5"
                                  : "#f3e8ff",
                              border:
                                copiedKey === `scene-${currentIdx}-dialogue`
                                  ? "1px solid #6ee7b7"
                                  : "1px solid #e9d5ff",
                              color:
                                copiedKey === `scene-${currentIdx}-dialogue`
                                  ? "#059669"
                                  : "#6d28d9",
                              padding: "3px 6px",
                              borderRadius: "6px",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            title="Diyalog repliğini panoya kopyala"
                          >
                            {copiedKey === `scene-${currentIdx}-dialogue` ? (
                              <Check size={12} />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={scene.dialogueTr || ""}
                          onChange={(e) =>
                            onUpdateScenePrompt(currentIdx, "dialogueTr", e.target.value)
                          }
                          placeholder="Örn: 'Bizim atölyede robotlar sadece kodlanmaz, hayata geçirilir!'"
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            fontSize: "12.5px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            boxSizing: "border-box",
                            background: "#ffffff",
                            resize: "vertical",
                            minHeight: "50px",
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* İngilizce Google Vids Omni Promptu */}
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "6px",
                      }}
                    >
                      <label
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#334155",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <Pencil size={12} /> Google Vids Omni Promptu (İngilizce - Düzenlenebilir)
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "11px", color: "#64748b" }}>
                          {scene.promptEn.length} karakter
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(scene.promptEn, `scene-${currentIdx}-prompt`)}
                          style={{
                            background:
                              copiedKey === `scene-${currentIdx}-prompt` ? "#ecfdf5" : "#612bd3",
                            border:
                              copiedKey === `scene-${currentIdx}-prompt`
                                ? "1px solid #6ee7b7"
                                : "1px solid #612bd3",
                            color:
                              copiedKey === `scene-${currentIdx}-prompt` ? "#059669" : "#ffffff",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                          }}
                          title="İngilizce Omni promptunu panoya kopyala"
                        >
                          {copiedKey === `scene-${currentIdx}-prompt` ? (
                            <Check size={13} />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={6}
                      value={scene.promptEn}
                      onChange={(e) => onUpdateScenePrompt(currentIdx, "promptEn", e.target.value)}
                      placeholder="Google Vids Omni İngilizce promptu..."
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        fontSize: "13px",
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        borderRadius: "10px",
                        border: "1px solid #cbd5e1",
                        boxSizing: "border-box",
                        lineHeight: 1.55,
                        background: "#ffffff",
                        resize: "vertical",
                        minHeight: "150px",
                        whiteSpace: "pre-wrap",
                        overflowWrap: "break-word",
                      }}
                    />
                  </div>

                  {/* Sahneler Arası Gezinme Alt Çubuğu */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingTop: "6px",
                      borderTop: "1px solid #f1f5f9",
                    }}
                  >
                    <button
                      type="button"
                      disabled={currentIdx === 0}
                      onClick={() => setActiveSceneTabIdx(currentIdx - 1)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        background: currentIdx === 0 ? "#f8fafc" : "#ffffff",
                        color: currentIdx === 0 ? "#94a3b8" : "#334155",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: currentIdx === 0 ? "not-allowed" : "pointer",
                      }}
                    >
                      ← Önceki Sahne
                    </button>

                    <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                      {currentIdx + 1} / {storyboard.scenes.length}
                    </span>

                    <button
                      type="button"
                      disabled={currentIdx === storyboard.scenes.length - 1}
                      onClick={() => setActiveSceneTabIdx(currentIdx + 1)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        background:
                          currentIdx === storyboard.scenes.length - 1 ? "#f8fafc" : "#ffffff",
                        color:
                          currentIdx === storyboard.scenes.length - 1 ? "#94a3b8" : "#334155",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor:
                          currentIdx === storyboard.scenes.length - 1 ? "not-allowed" : "pointer",
                      }}
                    >
                      Sonraki Sahne →
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Revizyon İsteme Kutusu */}
          <div
            style={{
              padding: "14px",
              borderRadius: "12px",
              border: "1px dashed #cbd5e1",
              background: "#f8fafc",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
              Senaryoda Düzeltme / Revizyon İste (İsteğe Bağlı)
            </label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                type="text"
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                placeholder="Örn: 2. sahnede kamera daha yakın çekim olsun, son sahnede logo ve atölye masası eklensin..."
                style={{
                  flex: 1,
                  minWidth: "220px",
                  padding: "9px 12px",
                  fontSize: "13px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                className="button secondary"
                disabled={revising || !revisionNote.trim()}
                onClick={onGenerateRevision}
              >
                {revising ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}
                {revising ? "Revize Ediliyor..." : "Senaryoyu Güncelle"}
              </button>
            </div>
          </div>

          {/* Onayla ve Kuyruğa Ekle Butonu */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              marginTop: "4px",
            }}
          >
            <button
              type="button"
              className="generate-button"
              style={{ width: "auto", padding: "0 24px" }}
              disabled={enqueueing || planning || revising}
              onClick={onConfirmAndEnqueue}
            >
              {enqueueing ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}
              {enqueueing ? "Sıraya Ekleniyor..." : "Onayla ve Üretim Sırasına Ekle"}
              <span>{storyboard.totalDurationSeconds} sn</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="results-empty">
          <div className="empty-canvas">
            <div className="canvas-glow" style={{ background: "#612bd3" }} />
            <Clapperboard size={38} />
            <span>
              <Sparkles size={13} />
              VISUAL-SKILLS YÖNETMEN MODU
            </span>
          </div>
          <h3>Önce senaryo ve sahneleri oluşturun</h3>
          <p>
            Soldan video konusunu, sanat tarzını ve ortalama süreyi seçip &ldquo;Senaryo &amp;
            Sahneleri Oluştur&rdquo; butonuna tıklayın. Yönetmen sahne sayısını ve çekim planını
            burada onayınıza sunacak.
          </p>
        </div>
      )}
    </section>
  );
}
