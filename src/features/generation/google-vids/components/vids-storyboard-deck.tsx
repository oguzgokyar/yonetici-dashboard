"use client";

import { useState, useRef } from "react";
import {
  Clapperboard,
  Clock,
  Pencil,
  Copy,
  Check,
  RefreshCw,
  LoaderCircle,
  Sparkles,
  Trash2,
  Upload,
  User,
  MapPin,
  Cpu,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  type StoryboardResponse,
  type VisualMoodOption,
  type NarrativeModeOption,
} from "../types";

interface VidsStoryboardDeckProps {
  storyboard: StoryboardResponse | null;
  visualMood: VisualMoodOption["key"];
  narrativeMode: NarrativeModeOption;
  generatingAnchorImg: boolean;
  generatingAnchorType?: "person" | "location" | "object" | null;
  rerollingIndex: number | null;
  revising: boolean;
  enqueueing: boolean;
  planning: boolean;
  revisionNote: string;
  setRevisionNote: (note: string) => void;
  onGenerateCharacterImage: () => void;
  onGenerateVisualAnchor?: (type: "person" | "location" | "object") => void;
  onUploadVisualAnchor?: (type: "person" | "location" | "object", file: File) => void;
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
  narrativeMode,
  generatingAnchorImg,
  generatingAnchorType,
  rerollingIndex,
  revising,
  enqueueing,
  planning,
  revisionNote,
  setRevisionNote,
  onGenerateCharacterImage,
  onGenerateVisualAnchor,
  onUploadVisualAnchor,
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
  const [showPromptAccordion, setShowPromptAccordion] = useState(false);

  // Dosya yükleme referansları
  const personFileInputRef = useRef<HTMLInputElement>(null);
  const locationFileInputRef = useRef<HTMLInputElement>(null);
  const objectFileInputRef = useRef<HTMLInputElement>(null);

  function handleCopy(text: string | undefined, key: string) {
    if (!text) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  }

  function handleFileSelected(type: "person" | "location" | "object", e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && onUploadVisualAnchor) {
      onUploadVisualAnchor(type, file);
    }
    e.target.value = "";
  }

  const visualAnchors = storyboard?.visualAnchors || {};
  const currentScene = storyboard?.scenes?.[activeSceneTabIdx];
  const currentIdx = activeSceneTabIdx;

  return (
    <section className="generation-results" style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
      <div className="results-toolbar" style={{ flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h2 style={{ fontSize: "16px", margin: 0, fontWeight: 700 }}>Senaryo &amp; Sahne Planı</h2>
          <span style={{ fontSize: "12px", color: "#64748b" }}>Türkçe sahne akışını inceleyin ve üretimi onaylayın</span>
        </div>
        {storyboard && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "999px",
                background: "rgba(97, 43, 211, 0.08)",
                color: "#612bd3",
              }}
            >
              {storyboard.scenes.length} Sahne • {storyboard.totalDurationSeconds} sn
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
                alignItems: "center",                gap: "4px",
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
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "6px 0", width: "100%" }}>
          {/* 1. Başlık & Kısa Özet Kartı */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "14.5px", color: "#0f172a" }}>{storyboard.title}</strong>
              <button
                type="button"
                onClick={() => handleCopy(`${storyboard.title}\n\n${storyboard.narrativeTr}`, "story-summary")}
                style={{
                  background: copiedKey === "story-summary" ? "#ecfdf5" : "transparent",
                  border: "none",
                  color: copiedKey === "story-summary" ? "#059669" : "#64748b",
                  cursor: "pointer",
                  padding: "4px",
                  borderRadius: "6px",
                }}
                title="Başlık ve özeti kopyala"
              >
                {copiedKey === "story-summary" ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
              {storyboard.narrativeTr}
            </p>
          </div>

          {/* 2. 3 Boyutlu Referans Çıpaları Paneli (Kişi • Mekan • Obje) */}
          <div
            style={{
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid #e0e7ff",
              background: "#faf5ff",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#581c87", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <Sparkles size={14} color="#7e22ce" />
                Referans Görseller (Google Vids Omni Çipleri)
              </span>
              <span style={{ fontSize: "11px", color: "#6b21a8", fontWeight: 500 }}>
                Kişi, ortam ve maket düzenini kilitler (Maks. 3 çip)
              </span>
            </div>

            {/* Gizli Dosya Girişleri */}
            <input type="file" ref={personFileInputRef} accept="image/*" style={{ display: "none" }} onChange={(e) => handleFileSelected("person", e)} />
            <input type="file" ref={locationFileInputRef} accept="image/*" style={{ display: "none" }} onChange={(e) => handleFileSelected("location", e)} />
            <input type="file" ref={objectFileInputRef} accept="image/*" style={{ display: "none" }} onChange={(e) => handleFileSelected("object", e)} />

            {/* 3 Sütunlu Responsive Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                gap: "10px",
                width: "100%",
              }}
            >
              {/* Kart A: Kişi / Karakter */}
              {(() => {
                const person = visualAnchors.person || (storyboard.characterAnchor ? {
                  name: storyboard.characterAnchor.name,
                  descriptionTr: storyboard.characterAnchor.archetypeTr,
                  visualPromptEn: storyboard.characterAnchor.masterVisualPromptEn,
                  imageUrl: storyboard.characterAnchor.referenceImageUrl,
                } : null);
                const isGen = generatingAnchorType === "person" || (generatingAnchorImg && !generatingAnchorType);
                return (
                  <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e9d5ff", display: "flex", gap: "10px", alignItems: "center" }}>
                    <div style={{ width: "52px", height: "52px", borderRadius: "8px", overflow: "hidden", background: "#f3e8ff", border: "1px solid #d8b4fe", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {person?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={person.imageUrl} alt="Kişi" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <User size={22} color="#9333ea" />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
                      <strong style={{ fontSize: "12px", color: "#1e1b4b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {person?.name || "Kişi / Karakter"}
                      </strong>
                      <span style={{ fontSize: "11px", color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {person?.descriptionTr || "Karakter DNA'sı"}
                      </span>
                      <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (onGenerateVisualAnchor) onGenerateVisualAnchor("person");
                            else onGenerateCharacterImage();
                          }}
                          disabled={isGen}
                          style={{ fontSize: "10.5px", padding: "2px 6px", borderRadius: "5px", border: "1px solid #c084fc", background: "#fdf4ff", color: "#7e22ce", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "3px" }}
                        >
                          {isGen ? <LoaderCircle size={10} className="spin" /> : <Sparkles size={10} />}
                          {person?.imageUrl ? "Yenile" : "Üret"}
                        </button>
                        <button
                          type="button"
                          onClick={() => personFileInputRef.current?.click()}
                          style={{ fontSize: "10.5px", padding: "2px 6px", borderRadius: "5px", border: "1px solid #cbd5e1", background: "#f8fafc", color: "#475569", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "3px" }}
                        >
                          <Upload size={10} /> Yükle
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Kart B: Mekan / Ortam */}
              {(() => {
                const loc = visualAnchors.location;
                const isGen = generatingAnchorType === "location";
                return (
                  <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e9d5ff", display: "flex", gap: "10px", alignItems: "center" }}>
                    <div style={{ width: "52px", height: "52px", borderRadius: "8px", overflow: "hidden", background: "#f3e8ff", border: "1px solid #d8b4fe", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {loc?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={loc.imageUrl} alt="Mekan" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <MapPin size={22} color="#9333ea" />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
                      <strong style={{ fontSize: "12px", color: "#1e1b4b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {loc?.name || "Mekan / Atölye"}
                      </strong>
                      <span style={{ fontSize: "11px", color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {loc?.descriptionTr || "Ortam ve Işık"}
                      </span>
                      <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                        <button
                          type="button"
                          onClick={() => onGenerateVisualAnchor && onGenerateVisualAnchor("location")}
                          disabled={isGen}
                          style={{ fontSize: "10.5px", padding: "2px 6px", borderRadius: "5px", border: "1px solid #c084fc", background: "#fdf4ff", color: "#7e22ce", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "3px" }}
                        >
                          {isGen ? <LoaderCircle size={10} className="spin" /> : <Sparkles size={10} />}
                          {loc?.imageUrl ? "Yenile" : "Üret"}
                        </button>
                        <button
                          type="button"
                          onClick={() => locationFileInputRef.current?.click()}
                          style={{ fontSize: "10.5px", padding: "2px 6px", borderRadius: "5px", border: "1px solid #cbd5e1", background: "#f8fafc", color: "#475569", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "3px" }}
                        >
                          <Upload size={10} /> Yükle
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Kart C: Obje / Maket (Fiziksel Düzenek) */}
              {(() => {
                const obj = visualAnchors.object;
                const isGen = generatingAnchorType === "object";
                return (
                  <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e9d5ff", display: "flex", gap: "10px", alignItems: "center" }}>
                    <div style={{ width: "52px", height: "52px", borderRadius: "8px", overflow: "hidden", background: "#f3e8ff", border: "1px solid #d8b4fe", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {obj?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={obj.imageUrl} alt="Maket" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <Cpu size={22} color="#9333ea" />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
                      <strong style={{ fontSize: "12px", color: "#1e1b4b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {obj?.name || "Maket / Proje"}
                      </strong>
                      <span style={{ fontSize: "11px", color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {obj?.descriptionTr || "Hatasız Fiziksel Düzenek"}
                      </span>
                      <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                        <button
                          type="button"
                          onClick={() => onGenerateVisualAnchor && onGenerateVisualAnchor("object")}
                          disabled={isGen}
                          style={{ fontSize: "10.5px", padding: "2px 6px", borderRadius: "5px", border: "1px solid #c084fc", background: "#fdf4ff", color: "#7e22ce", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "3px" }}
                        >
                          {isGen ? <LoaderCircle size={10} className="spin" /> : <Sparkles size={10} />}
                          {obj?.imageUrl ? "Yenile" : "Üret"}
                        </button>
                        <button
                          type="button"
                          onClick={() => objectFileInputRef.current?.click()}
                          style={{ fontSize: "10.5px", padding: "2px 6px", borderRadius: "5px", border: "1px solid #cbd5e1", background: "#f8fafc", color: "#475569", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "3px" }}
                        >
                          <Upload size={10} /> Yükle
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 3. Sahneler Sekmeli Gezinti */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
            {/* Sekme Butonları (Yatay Kaydırılabilir) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                overflowX: "auto",
                paddingBottom: "6px",
                borderBottom: "1px solid #e2e8f0",
                width: "100%",
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
                      padding: "7px 14px",
                      borderRadius: "8px",
                      border: isSelected ? "2px solid #612bd3" : "1px solid #cbd5e1",
                      background: isSelected ? "rgba(97, 43, 211, 0.08)" : "#ffffff",
                      color: isSelected ? "#612bd3" : "#475569",
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: "12.5px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span>Sahne {s.sceneIndex}</span>
                    <span style={{ fontSize: "11px", opacity: 0.8 }}>({s.durationSeconds}s)</span>
                  </button>
                );
              })}
            </div>

            {/* Aktif Sahne İçeriği */}
            {currentScene && (
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "16px",
                  background: "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                {/* Sahne Başlık Çubuğu */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "12px", background: "#f1f5f9", color: "#334155", fontWeight: 700, padding: "3px 8px", borderRadius: "6px" }}>
                      Sahne {currentIdx + 1} / {storyboard.scenes.length}
                    </span>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Clock size={13} color="#6366f1" />
                      <span style={{ fontSize: "12px", color: "#475569" }}>Süre:</span>
                      <select
                        value={currentScene.durationSeconds || 5}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (onUpdateSceneDuration) onUpdateSceneDuration(currentIdx, val);
                        }}
                        style={{ padding: "2px 6px", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "12px", fontWeight: 700 }}
                      >
                        {[3, 4, 5, 6, 7, 8, 9, 10].map((sec) => (
                          <option key={sec} value={sec}>{sec} sn</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRerollScene(currentScene.sceneIndex)}
                    disabled={rerollingIndex === currentScene.sceneIndex}
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#334155",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    {rerollingIndex === currentScene.sceneIndex ? <LoaderCircle size={12} className="spin" /> : <RefreshCw size={12} />}
                    {rerollingIndex === currentScene.sceneIndex ? "Yenileniyor..." : "Sahneyi Yenile"}
                  </button>
                </div>

                {/* 1. Türkçe Sahne Özeti */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                      Sahne Özeti (Türkçe)
                    </label>
                    <button
                      type="button"
                      onClick={() => handleCopy(currentScene.summaryTr, `scene-${currentIdx}-summary`)}
                      style={{ background: "transparent", border: "none", color: copiedKey === `scene-${currentIdx}-summary` ? "#059669" : "#64748b", cursor: "pointer", padding: "2px" }}
                    >
                      {copiedKey === `scene-${currentIdx}-summary` ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={currentScene.summaryTr}
                    onChange={(e) => onUpdateScenePrompt(currentIdx, "summaryTr", e.target.value)}
                    placeholder="Sahne özeti..."
                    style={{ width: "100%", padding: "8px 10px", fontSize: "13px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box", resize: "vertical" }}
                  />
                </div>

                {/* 2. Ekranda Görünecek Büyük Metin (On-Screen Hook) */}
                {(narrativeMode === "silent_captions" || currentScene.onScreenTextTr) && (
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#b45309", display: "block", marginBottom: "4px" }}>
                      📱 Ekran Metni (On-Screen Hook / Adım)
                    </label>
                    <input
                      type="text"
                      value={currentScene.onScreenTextTr || ""}
                      onChange={(e) => onUpdateScenePrompt(currentIdx, "onScreenTextTr", e.target.value)}
                      placeholder="Örn: Adım 1: Karton Gövdeyi Kes ✂️"
                      style={{ width: "100%", padding: "8px 10px", fontSize: "13px", fontWeight: 600, borderRadius: "8px", border: "1px solid #fde68a", background: "#fffbeb", boxSizing: "border-box" }}
                    />
                  </div>
                )}

                {/* 3. Eylem Sesleri (Foley / ASMR) VEYA Dış Ses */}
                {narrativeMode === "diy_asmr" ? (
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "10px", borderRadius: "8px" }}>
                    <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#166534", display: "block", marginBottom: "3px" }}>
                      🛠️ Veo Eylem Sesleri (Foley / ASMR • Konuşma Yok)
                    </span>
                    <span style={{ fontSize: "12.5px", color: "#15803d" }}>
                      {currentScene.audioCueEn || currentScene.sfxCueEn || "Karton sürtünmesi, şırınga kayması ve mekanik eylem sesleri"}
                    </span>
                  </div>
                ) : narrativeMode !== "dialogue_only" && narrativeMode !== "silent_captions" ? (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 600, color: "#0369a1" }}>
                        🎙️ Türkçe Dış Ses (Voiceover)
                      </label>
                      <button
                        type="button"
                        onClick={() => handleCopy(currentScene.voiceoverTr, `scene-${currentIdx}-vo`)}
                        style={{ background: "transparent", border: "none", color: copiedKey === `scene-${currentIdx}-vo` ? "#059669" : "#64748b", cursor: "pointer", padding: "2px" }}
                      >
                        {copiedKey === `scene-${currentIdx}-vo` ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={currentScene.voiceoverTr || ""}
                      onChange={(e) => onUpdateScenePrompt(currentIdx, "voiceoverTr", e.target.value)}
                      placeholder="Türkçe seslendirme metni..."
                      style={{ width: "100%", padding: "8px 10px", fontSize: "13px", borderRadius: "8px", border: "1px solid #bae6fd", background: "#f0f9ff", boxSizing: "border-box", resize: "vertical" }}
                    />
                  </div>
                ) : null}

                {/* 4. Google Vids Omni Promptu (İngilizce - Katlanabilir Accordion) */}
                <div style={{ marginTop: "4px", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
                  <button
                    type="button"
                    onClick={() => setShowPromptAccordion(!showPromptAccordion)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      background: "#f8fafc",
                      border: "none",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#475569",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <Pencil size={12} color="#6366f1" />
                      Teknik Omni Promptunu Düzenle (İngilizce)
                    </span>
                    <span style={{ fontSize: "11px", color: "#6366f1", display: "inline-flex", alignItems: "center", gap: "2px" }}>
                      {showPromptAccordion ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {showPromptAccordion ? "Gizle" : "Göster"}
                    </span>
                  </button>

                  {showPromptAccordion && (
                    <div style={{ padding: "10px", background: "#ffffff", borderTop: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontSize: "11px", color: "#64748b" }}>
                          {currentScene.promptEn.length} karakter
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(currentScene.promptEn, `scene-${currentIdx}-prompt`)}
                          style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "5px", padding: "2px 6px", fontSize: "11px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "3px" }}
                        >
                          {copiedKey === `scene-${currentIdx}-prompt` ? <Check size={11} color="#059669" /> : <Copy size={11} />}
                          Kopyala
                        </button>
                      </div>
                      <textarea
                        rows={5}
                        value={currentScene.promptEn}
                        onChange={(e) => onUpdateScenePrompt(currentIdx, "promptEn", e.target.value)}
                        placeholder="Google Vids Omni İngilizce promptu..."
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          fontSize: "12px",
                          fontFamily: "monospace",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          boxSizing: "border-box",
                          lineHeight: 1.45,
                          resize: "vertical",
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Sahneler Arası Gezinme Alt Butonları */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "4px" }}>
                  <button
                    type="button"
                    disabled={currentIdx === 0}
                    onClick={() => setActiveSceneTabIdx(currentIdx - 1)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      background: currentIdx === 0 ? "#f8fafc" : "#ffffff",
                      color: currentIdx === 0 ? "#94a3b8" : "#334155",
                      fontSize: "12px",
                      cursor: currentIdx === 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    ← Önceki
                  </button>
                  <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                    {currentIdx + 1} / {storyboard.scenes.length}
                  </span>
                  <button
                    type="button"
                    disabled={currentIdx === storyboard.scenes.length - 1}
                    onClick={() => setActiveSceneTabIdx(currentIdx + 1)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      background: currentIdx === storyboard.scenes.length - 1 ? "#f8fafc" : "#ffffff",
                      color: currentIdx === storyboard.scenes.length - 1 ? "#94a3b8" : "#334155",
                      fontSize: "12px",
                      cursor: currentIdx === storyboard.scenes.length - 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    Sonraki →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. Revizyon İsteme Kutusu (Mobilde %100 Uyumlu) */}
          <div
            style={{
              padding: "12px",
              borderRadius: "10px",
              border: "1px dashed #cbd5e1",
              background: "#f8fafc",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
              Senaryoda Düzeltme İste (İsteğe Bağlı)
            </label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", width: "100%" }}>
              <input
                type="text"
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                placeholder="Örn: Kamera daha yakın çekim olsun, şekerler ahşap tabağa dökülsün..."
                style={{
                  flex: 1,
                  minWidth: 0,
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: "12.5px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                className="button secondary"
                disabled={revising || !revisionNote.trim()}
                onClick={onGenerateRevision}
                style={{ whiteSpace: "nowrap" }}
              >
                {revising ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}
                {revising ? "Revize Ediliyor..." : "Revize Et"}
              </button>
            </div>
          </div>

          {/* 5. Onayla ve Kuyruğa Ekle Butonu */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "2px", width: "100%" }}>
            <button
              type="button"
              className="generate-button"
              style={{ width: "100%", maxWidth: "340px", height: "46px", padding: "0 20px" }}
              disabled={enqueueing || planning || revising}
              onClick={onConfirmAndEnqueue}
            >
              {enqueueing ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
              {enqueueing ? "Sıraya Ekleniyor..." : "Onayla ve Üretime Başla"}
              <span>{storyboard.totalDurationSeconds} sn</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="results-empty" style={{ width: "100%", minHeight: "360px" }}>
          <div className="empty-canvas" style={{ width: "180px", aspectRatio: "4/5" }}>
            <div className="canvas-glow" style={{ background: "#612bd3" }} />
            <Clapperboard size={34} />
            <span style={{ fontSize: "8.5px" }}>
              <Sparkles size={11} />
              VISUAL-SKILLS YÖNETMEN
            </span>
          </div>
          <h3 style={{ fontSize: "16px", margin: "16px 0 4px" }}>Önce senaryo ve sahneleri oluşturun</h3>
          <p style={{ fontSize: "12px", color: "#64748b", maxWidth: "340px", lineHeight: 1.5 }}>
            Soldan video konusunu ve sanat tarzını seçip &ldquo;Senaryo &amp; Sahneleri Oluştur&rdquo; butonuna tıklayın.
          </p>
        </div>
      )}
    </section>
  );
}
