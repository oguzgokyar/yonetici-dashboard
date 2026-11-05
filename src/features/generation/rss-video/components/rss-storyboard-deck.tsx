"use client";

import { useState } from "react";
import {
  Rss,
  Link2,
  Sparkles,
  LoaderCircle,
  RefreshCw,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Zap,
  Check,
  Copy,
  Globe,
  FileText,
  Image as ImageIcon,
  ZoomIn,
  X,
} from "lucide-react";
import {
  RSS_CAMERA_EFFECT_LABELS,
  RSS_TRANSITION_LABELS,
  RSS_NARRATIVE_STYLES,
  type RssCameraEffect,
  type RssFeedArticle,
  type RssScenePlan,
  type RssSourceItem,
  type RssStoryboard,
  type RssTransitionType,
  type RssVoiceEmotion,
} from "../types";

interface RssStoryboardDeckProps {
  sourceMode: "rss" | "url" | "prompt";
  setSourceMode: (mode: "rss" | "url" | "prompt") => void;
  topicOrText: string;
  setTopicOrText: (val: string) => void;
  sourceUrl: string;
  setSourceUrl: (val: string) => void;
  rssSources: RssSourceItem[];
  rssArticles: RssFeedArticle[];
  loadingRss: boolean;
  scrapingUrl: boolean;
  planning: boolean;
  revising: boolean;
  enqueueing: boolean;
  message: string;
  storyboard: RssStoryboard | null;
  revisionNote: string;
  setRevisionNote: (val: string) => void;
  onFetchRssFeeds: (sourceId?: string) => void;
  onAddRssSource: (name: string, url: string, category: string) => Promise<void>;
  onDeleteRssSource: (id: string) => Promise<void>;
  onScrapeUrlPreview: () => Promise<void>;
  onSelectRssArticle: (article: RssFeedArticle) => void;
  onGenerateStoryboard: (isRevision?: boolean) => void;
  onOneClickProduce: () => void;
  onConfirmAndEnqueue: () => void;
  onClearStoryboard: () => void;
  onUpdateScene: (sceneIndex: number, updates: Partial<RssScenePlan>) => void;
  generatingSceneImages?: Record<number, boolean>;
  onGenerateSceneImage?: (sceneIndex: number) => void;
  onGenerateAllSceneImages?: () => void;
}

export function RssStoryboardDeck({
  sourceMode,
  setSourceMode,
  topicOrText,
  setTopicOrText,
  sourceUrl,
  setSourceUrl,
  rssSources,
  rssArticles,
  loadingRss,
  scrapingUrl,
  planning,
  revising,
  enqueueing,
  message,
  storyboard,
  revisionNote,
  setRevisionNote,
  onFetchRssFeeds,
  onAddRssSource,
  onDeleteRssSource,
  onScrapeUrlPreview,
  onSelectRssArticle,
  onGenerateStoryboard,
  onOneClickProduce,
  onConfirmAndEnqueue,
  onClearStoryboard,
  onUpdateScene,
  generatingSceneImages = {},
  onGenerateSceneImage,
  onGenerateAllSceneImages,
}: RssStoryboardDeckProps) {
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>("");
  const [showAddSourceForm, setShowAddSourceForm] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newSourceCategory, setNewSourceCategory] = useState("teknoloji");
  const [activeSceneTabIdx, setActiveSceneTabIdx] = useState(0);
  const [showPromptAccordion, setShowPromptAccordion] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    title: string;
    promptEn: string;
  } | null>(null);

  const isAnySceneImageGenerating = Object.values(generatingSceneImages).some(Boolean);

  const currentScene = storyboard?.scenes?.[activeSceneTabIdx] || storyboard?.scenes?.[0];
  const styleBadge =
    RSS_NARRATIVE_STYLES.find((s) => s.key === storyboard?.narrativeStyle)?.badge || "📰 Kurgu";

  function handleCopy(text: string | undefined, key: string) {
    if (!text || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  async function handleAddSourceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newSourceName.trim() || !newSourceUrl.trim()) return;
    await onAddRssSource(newSourceName.trim(), newSourceUrl.trim(), newSourceCategory);
    setNewSourceName("");
    setNewSourceUrl("");
    setShowAddSourceForm(false);
  }

  return (
    <section
      className="generation-results"
      style={{
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      {/* 1. ÜST KUTU: URL, RSS VE PROMPT'TAN VİDEO ARAŞTIRMASI & SENARYO ÜRETİMİ */}
      <div
        style={{
          padding: "16px",
          borderRadius: "14px",
          border: "1px solid #e2e8f0",
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
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
          <div>
            <h2 style={{ fontSize: "15.5px", margin: 0, fontWeight: 700, color: "#0f172a" }}>
              İçerik Araştırma &amp; Senaryo Merkezi
            </h2>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              RSS kaynağından, makale linkinden veya özel konudan araştırma yapıp senaryo ve video üretin
            </span>
          </div>

          {/* Kaynak Modu Seçici */}
          <div
            style={{
              display: "flex",
              background: "#f1f5f9",
              padding: "3px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              gap: "3px",
            }}
          >
            <button
              type="button"
              onClick={() => setSourceMode("prompt")}
              style={{
                padding: "6px 11px",
                borderRadius: "6px",
                border: "none",
                fontSize: "12px",
                fontWeight: sourceMode === "prompt" ? 700 : 500,
                background: sourceMode === "prompt" ? "#ffffff" : "transparent",
                color: sourceMode === "prompt" ? "#4338ca" : "#64748b",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                boxShadow: sourceMode === "prompt" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              <Sparkles size={13} />
              <span>Özel Konu / Prompt</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceMode("url")}
              style={{
                padding: "6px 11px",
                borderRadius: "6px",
                border: "none",
                fontSize: "12px",
                fontWeight: sourceMode === "url" ? 700 : 500,
                background: sourceMode === "url" ? "#ffffff" : "transparent",
                color: sourceMode === "url" ? "#0369a1" : "#64748b",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                boxShadow: sourceMode === "url" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              <Link2 size={13} />
              <span>URL Araştır</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceMode("rss")}
              style={{
                padding: "6px 11px",
                borderRadius: "6px",
                border: "none",
                fontSize: "12px",
                fontWeight: sourceMode === "rss" ? 700 : 500,
                background: sourceMode === "rss" ? "#ffffff" : "transparent",
                color: sourceMode === "rss" ? "#b45309" : "#64748b",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                boxShadow: sourceMode === "rss" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              <Rss size={13} />
              <span>RSS Havuzu</span>
            </button>
          </div>
        </div>

        {/* MOD 1: RSS HABER HAVUZU */}
        {sourceMode === "rss" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              padding: "12px",
              borderRadius: "10px",
              background: "#fffbeb",
              border: "1px solid #fde68a",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <select
                  value={selectedSourceFilter}
                  onChange={(e) => setSelectedSourceFilter(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid #fcd34d",
                    fontSize: "12px",
                    background: "#ffffff",
                    color: "#1e293b",
                  }}
                >
                  <option value="">Tüm RSS Kaynakları ({rssSources.length})</option>
                  {rssSources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => onFetchRssFeeds(selectedSourceFilter || undefined)}
                  disabled={loadingRss}
                  className="button secondary"
                  style={{ height: "32px", fontSize: "12px", padding: "0 12px" }}
                >
                  {loadingRss ? (
                    <LoaderCircle className="spin" size={14} />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  <span>{loadingRss ? "Taranıyor..." : "Güncel Haberleri Çek"}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowAddSourceForm(!showAddSourceForm)}
                style={{
                  background: "#ffffff",
                  border: "1px solid #f59e0b",
                  color: "#b45309",
                  padding: "5px 10px",
                  borderRadius: "6px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Plus size={13} />
                <span>RSS Kaynağı Ekle / Yönet</span>
              </button>
            </div>

            {showAddSourceForm && (
              <form
                onSubmit={(e) => void handleAddSourceSubmit(e)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  padding: "10px",
                  background: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid #fde68a",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr auto auto", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder="Kaynak adı (Örn: Webrazzi)"
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                    style={{
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "12px",
                    }}
                  />
                  <input
                    type="url"
                    placeholder="https://.../rss.xml"
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                    style={{
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "12px",
                    }}
                  />
                  <select
                    value={newSourceCategory}
                    onChange={(e) => setNewSourceCategory(e.target.value)}
                    style={{
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "12px",
                    }}
                  >
                    <option value="haber">Haber</option>
                    <option value="teknoloji">Teknoloji</option>
                    <option value="bilim">Bilim</option>
                    <option value="egitim">Eğitim</option>
                  </select>
                  <button
                    type="submit"
                    className="button primary"
                    style={{ height: "32px", fontSize: "12px", padding: "0 12px" }}
                  >
                    Ekle
                  </button>
                </div>

                {rssSources.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                    {rssSources.map((s) => (
                      <span
                        key={s.id}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "11px",
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          padding: "3px 8px",
                          borderRadius: "99px",
                        }}
                      >
                        <strong>{s.name}</strong>
                        <button
                          type="button"
                          onClick={() => void onDeleteRssSource(s.id)}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#dc2626",
                            cursor: "pointer",
                            padding: 0,
                          }}
                          title="Kaynağı sil"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </form>
            )}

            {/* Çekilen RSS Haber Listesi */}
            {rssArticles.length > 0 ? (
              <div
                style={{
                  maxHeight: "210px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  paddingRight: "4px",
                }}
              >
                {rssArticles.map((art) => {
                  const isSelected = sourceUrl === art.url;
                  return (
                    <div
                      key={art.id}
                      onClick={() => onSelectRssArticle(art)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "8px",
                        background: isSelected ? "#eef2ff" : "#ffffff",
                        border: isSelected ? "1.5px solid #6366f1" : "1px solid #fde68a",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "12.5px",
                            fontWeight: 600,
                            color: "#0f172a",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {art.title}
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>
                          {art.sourceName} • {art.summary.slice(0, 95)}...
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: "99px",
                          background: art.score >= 75 ? "#dcfce7" : "#fef3c7",
                          color: art.score >= 75 ? "#15803d" : "#b45309",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {art.score} Puan
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: "12px", color: "#92400e", padding: "4px 2px" }}>
                Haber havuzunu doldurmak için <strong>&ldquo;Güncel Haberleri Çek&rdquo;</strong> butonuna tıklayın.
              </div>
            )}
          </div>
        )}

        {/* MOD 2: URL'DEN MAKALE / HABER ARAŞTIRMA */}
        {sourceMode === "url" && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://... (Haber, blog yazısı veya makale adresini yapıştırın)"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => void onScrapeUrlPreview()}
              disabled={scrapingUrl || !sourceUrl.trim()}
              className="button secondary"
              style={{ height: "38px", fontSize: "12px", padding: "0 14px", whiteSpace: "nowrap" }}
            >
              {scrapingUrl ? <LoaderCircle className="spin" size={15} /> : <Globe size={15} />}
              <span>{scrapingUrl ? "Çekiliyor..." : "Makaleyi Çek"}</span>
            </button>
          </div>
        )}

        {/* ORTAK KONU / ARAŞTIRMA ÖZETİ METİN ALANI */}
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
              htmlFor="rss-topic-textarea"
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#334155",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <FileText size={13} color="#6366f1" />
              <span>
                {sourceMode === "prompt"
                  ? "Video Konusu / Masal / Bilgi Brifi"
                  : "Seçilen Haberin / Makalenin Araştırma Metni"}
              </span>
            </label>
            {topicOrText.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTopicOrText("");
                  setSourceUrl("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#64748b",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                Metni Temizle
              </button>
            )}
          </div>
          <textarea
            id="rss-topic-textarea"
            value={topicOrText}
            onChange={(e) => setTopicOrText(e.target.value)}
            rows={3}
            placeholder="Örn: Çocukların kendi oyuncaklarını tasarlamasının problem çözme becerisine etkisi hakkında bilimsel araştırmalar... (Veya yukarıdan RSS haberi seçin / URL yapıştırın)"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              fontSize: "13px",
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
        </div>

        {/* ÇİFT AKSİYON BUTONU: 1) SENARYO OLUŞTUR (GÖZDEN GEÇİR)  2) TEK TIKLA DİREKT ÜRET */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
          }}
        >
          <button
            type="button"
            onClick={() => onGenerateStoryboard(false)}
            disabled={planning || revising || enqueueing}
            className="button secondary"
            style={{
              height: "40px",
              fontSize: "12.5px",
              fontWeight: 700,
              justifyContent: "center",
              border: "1.5px solid #6366f1",
              color: "#4338ca",
              background: "#eef2ff",
            }}
          >
            {planning ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
            <span>
              {planning
                ? "Araştırılıyor & Senaryolaştırılıyor..."
                : "1. Araştır & Senaryo Oluştur (Gözden Geçir)"}
            </span>
          </button>

          <button
            type="button"
            onClick={onOneClickProduce}
            disabled={planning || revising || enqueueing}
            className="button primary"
            style={{
              height: "40px",
              fontSize: "12.5px",
              fontWeight: 700,
              justifyContent: "center",
              background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
              border: "none",
            }}
          >
            {enqueueing ? <LoaderCircle className="spin" size={16} /> : <Zap size={16} />}
            <span>
              {enqueueing ? "FIFO Kuyruğuna Ekleniyor..." : "⚡ Tek Tıkla Direkt Video Üret"}
            </span>
          </button>
        </div>

        {message && (
          <div className="generation-notice" style={{ margin: 0 }}>
            <Sparkles size={15} />
            <span>{message}</span>
          </div>
        )}
      </div>

      {/* 2. ORTA BÖLÜM: VİDEO SENARYOSU VE SAHNE DÜZENLEME TUVALİ (Önizleme Player YOK) */}
      <div
        style={{
          padding: "16px",
          borderRadius: "14px",
          border: "1px solid #e2e8f0",
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
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
          <div>
            <h3 style={{ fontSize: "15px", margin: 0, fontWeight: 700, color: "#0f172a" }}>
              Video Senaryosu &amp; Sahne Akışı
            </h3>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Sahnelerin dış ses metinlerini, kamera hareketlerini ve görsel promptlarını inceleyip onaylayın
            </span>
          </div>

          {storyboard && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              {onGenerateAllSceneImages && (
                <button
                  type="button"
                  onClick={onGenerateAllSceneImages}
                  disabled={isAnySceneImageGenerating || enqueueing}
                  style={{
                    fontSize: "11.5px",
                    fontWeight: 700,
                    padding: "5px 11px",
                    borderRadius: "8px",
                    border: "1px solid #c7d2fe",
                    background: "#eef2ff",
                    color: "#4338ca",
                    cursor: isAnySceneImageGenerating ? "wait" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                  title="Tüm sahnelerin görsellerini CliProxy ile üretip sağ önizleme kutusunda gösterir"
                >
                  {isAnySceneImageGenerating ? (
                    <LoaderCircle className="spin" size={13} />
                  ) : (
                    <ImageIcon size={13} />
                  )}
                  <span>
                    {isAnySceneImageGenerating
                      ? "Sahne Görselleri Üretiliyor..."
                      : "✨ Tüm Sahne Görsellerini Üret"}
                  </span>
                </button>
              )}
              <span
                style={{
                  fontSize: "11.5px",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "99px",
                  background: "#eef2ff",
                  color: "#4338ca",
                }}
              >
                {styleBadge} • {storyboard.scenes.length} Sahne • {storyboard.totalDurationSeconds} sn
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
                }}
              >
                <Trash2 size={13} />
                <span>Sıfırla</span>
              </button>
            </div>
          )}
        </div>

        {storyboard && currentScene ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Senaryo Başlığı ve Özeti */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "10px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "14px", color: "#0f172a" }}>{storyboard.title}</strong>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(`${storyboard.title}\n\n${storyboard.summaryTr}`, "sb-summary")
                  }
                  style={{
                    background: "transparent",
                    border: "none",
                    color: copiedKey === "sb-summary" ? "#059669" : "#64748b",
                    cursor: "pointer",
                  }}
                >
                  {copiedKey === "sb-summary" ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#475569", lineHeight: 1.45 }}>
                {storyboard.summaryTr}
              </p>
            </div>

            {/* Sahne Sekmeleri */}
            <div
              style={{
                display: "flex",
                gap: "6px",
                overflowX: "auto",
                paddingBottom: "4px",
              }}
            >
              {storyboard.scenes.map((sc, idx) => {
                const isActive = idx === activeSceneTabIdx;
                const roleLabel =
                  sc.role === "hook"
                    ? "Kanca"
                    : sc.role === "outro"
                    ? "Kapanış"
                    : sc.role === "climax"
                    ? "Zirve"
                    : `Sahne ${idx + 1}`;
                return (
                  <button
                    key={sc.sceneIndex}
                    type="button"
                    onClick={() => setActiveSceneTabIdx(idx)}
                    style={{
                      padding: "7px 12px",
                      borderRadius: "8px",
                      border: isActive ? "1.5px solid #6366f1" : "1px solid #e2e8f0",
                      background: isActive ? "#eef2ff" : "#f8fafc",
                      color: isActive ? "#3730a3" : "#475569",
                      fontSize: "12px",
                      fontWeight: isActive ? 700 : 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {idx + 1}. {roleLabel} ({sc.durationSeconds}sn)
                  </button>
                );
              })}
            </div>

            {/* Seçili Sahne Düzenleme Kartı (Sol: Sahne Kurgu Özeti & Metinler | Sağ: Üretilen Sahne Görseli Önizleme) */}
            <div
              style={{
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                display: "grid",
                gridTemplateColumns: "1fr 210px",
                gap: "16px",
                alignItems: "start",
              }}
            >
              {/* Sol Sütun: Sahne Kurgu Özeti, Dış Ses, Efektler ve Görsel Promptu */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "10px" }}>
                  <div>
                    <label
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 700,
                        color: "#334155",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      Sahne {currentScene.sceneIndex} Kurgu Özeti
                    </label>
                    <input
                      type="text"
                      value={currentScene.summaryTr}
                      onChange={(e) =>
                        onUpdateScene(activeSceneTabIdx, { summaryTr: e.target.value })
                      }
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "12.5px",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 700,
                        color: "#334155",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      Ekran Üst Başlığı (Kısa Kanca)
                    </label>
                    <input
                      type="text"
                      value={currentScene.onScreenTextTr}
                      onChange={(e) =>
                        onUpdateScene(activeSceneTabIdx, { onScreenTextTr: e.target.value })
                      }
                      placeholder="Örn: ŞAŞIRTICI GERÇEK"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "12.5px",
                      }}
                    />
                  </div>
                </div>

                {/* Türkçe Dış Ses Metni (Gemini 2.0 TTS) */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "4px",
                    }}
                  >
                    <label style={{ fontSize: "11.5px", fontWeight: 700, color: "#4338ca" }}>
                      🎙️ Gemini 2.0 TTS Dış Ses Metni (Türkçe)
                    </label>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      {currentScene.voiceoverTr.split(/\s+/).filter(Boolean).length} kelime (~
                      {Math.max(
                        2,
                        Math.round(
                          currentScene.voiceoverTr.split(/\s+/).filter(Boolean).length / 2.2
                        )
                      )}{" "}
                      sn okuma)
                    </span>
                  </div>
                  <textarea
                    value={currentScene.voiceoverTr}
                    onChange={(e) =>
                      onUpdateScene(activeSceneTabIdx, { voiceoverTr: e.target.value })
                    }
                    rows={2}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid #a5b4fc",
                      background: "#fafaff",
                      fontSize: "13px",
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                {/* Kamera Hareketi, Geçiş ve Ses Duygusu */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                  <div>
                    <label
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#475569",
                        display: "block",
                        marginBottom: "3px",
                      }}
                    >
                      Kamera Hareketi (FFmpeg)
                    </label>
                    <select
                      value={currentScene.cameraEffect}
                      onChange={(e) =>
                        onUpdateScene(activeSceneTabIdx, {
                          cameraEffect: e.target.value as RssCameraEffect,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "12px",
                      }}
                    >
                      {Object.entries(RSS_CAMERA_EFFECT_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#475569",
                        display: "block",
                        marginBottom: "3px",
                      }}
                    >
                      Sahne Geçişi (xfade)
                    </label>
                    <select
                      value={currentScene.transition}
                      onChange={(e) =>
                        onUpdateScene(activeSceneTabIdx, {
                          transition: e.target.value as RssTransitionType,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "12px",
                      }}
                    >
                      {Object.entries(RSS_TRANSITION_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#475569",
                        display: "block",
                        marginBottom: "3px",
                      }}
                    >
                      Sahne Ses Duygusu
                    </label>
                    <select
                      value={currentScene.voiceEmotion}
                      onChange={(e) =>
                        onUpdateScene(activeSceneTabIdx, {
                          voiceEmotion: e.target.value as RssVoiceEmotion,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "12px",
                      }}
                    >
                      <option value="urgent">Acil / Sıcak Haber</option>
                      <option value="serious">Ciddi / Analitik</option>
                      <option value="calm">Sakin / Belgesel</option>
                      <option value="warm_storyteller">Sıcak Masal Anlatıcısı</option>
                      <option value="dramatic">Derin / Sinematik</option>
                      <option value="mysterious">Gizemli / Merak</option>
                      <option value="excited">Enerjik / Rehber</option>
                    </select>
                  </div>
                </div>

                {/* Açılır Akordeon: İngilizce CLIProxy Görsel Promptu */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowPromptAccordion(!showPromptAccordion)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#475569",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: 0,
                    }}
                  >
                    {showPromptAccordion ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    <span>
                      ⚙️ Teknik CliProxy Görsel Promptunu Düzenle (İngilizce • FG/MG/BG Derinlikli)
                    </span>
                  </button>
                  {showPromptAccordion && (
                    <textarea
                      value={currentScene.promptEn}
                      onChange={(e) =>
                        onUpdateScene(activeSceneTabIdx, { promptEn: e.target.value })
                      }
                      rows={3}
                      style={{
                        marginTop: "6px",
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "12px",
                        fontFamily: "monospace",
                        background: "#f8fafc",
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Sağ Sütun: Sahne Görseli Önizleme Kutusu */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  padding: "10px",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#334155" }}>
                    🖼️ Sahne {currentScene.sceneIndex} Görseli
                  </span>
                  <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 600 }}>
                    {storyboard.aspectRatio}
                  </span>
                </div>

                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio:
                      storyboard.aspectRatio === "16:9"
                        ? "16 / 9"
                        : storyboard.aspectRatio === "1:1"
                        ? "1 / 1"
                        : "9 / 16",
                    maxHeight: "240px",
                    borderRadius: "8px",
                    overflow: "hidden",
                    background: "#e2e8f0",
                    border: "1px solid #cbd5e1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {generatingSceneImages[activeSceneTabIdx] ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "6px",
                        color: "#4338ca",
                        padding: "12px",
                        textAlign: "center",
                      }}
                    >
                      <LoaderCircle className="spin" size={22} />
                      <span style={{ fontSize: "11px", fontWeight: 600 }}>
                        CliProxy ile üretiliyor...
                      </span>
                    </div>
                  ) : currentScene.previewImageUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={currentScene.previewImageUrl}
                        alt={`Sahne ${currentScene.sceneIndex}`}
                        onClick={() =>
                          setLightboxImage({
                            url: currentScene.previewImageUrl!,
                            title: `Sahne ${currentScene.sceneIndex}: ${currentScene.summaryTr}`,
                            promptEn: currentScene.promptEn,
                          })
                        }
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          cursor: "zoom-in",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxImage({
                            url: currentScene.previewImageUrl!,
                            title: `Sahne ${currentScene.sceneIndex}: ${currentScene.summaryTr}`,
                            promptEn: currentScene.promptEn,
                          })
                        }
                        style={{
                          position: "absolute",
                          top: "6px",
                          right: "6px",
                          background: "rgba(15, 23, 42, 0.72)",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "6px",
                          padding: "4px 6px",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                          fontSize: "10px",
                        }}
                        title="Tam ekran büyüt"
                      >
                        <ZoomIn size={12} />
                      </button>
                    </>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "6px",
                        color: "#64748b",
                        padding: "12px",
                        textAlign: "center",
                      }}
                    >
                      <ImageIcon size={22} style={{ opacity: 0.55 }} />
                      <span style={{ fontSize: "11px", lineHeight: 1.3 }}>
                        İster şimdi önizleyin, ister video üretilirken otomatik oluşturulsun
                      </span>
                    </div>
                  )}
                </div>

                {onGenerateSceneImage && (
                  <button
                    type="button"
                    onClick={() => onGenerateSceneImage(activeSceneTabIdx)}
                    disabled={Boolean(generatingSceneImages[activeSceneTabIdx])}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: "1px solid #c7d2fe",
                      background: "#eef2ff",
                      color: "#4338ca",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: generatingSceneImages[activeSceneTabIdx] ? "wait" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                    }}
                  >
                    {generatingSceneImages[activeSceneTabIdx] ? (
                      <LoaderCircle className="spin" size={12} />
                    ) : (
                      <RefreshCw size={12} />
                    )}
                    <span>
                      {currentScene.previewImageUrl ? "Görseli Yeniden Üret" : "Sahne Görselini Üret"}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* AI Revizyon & Kuyruğa Gönderme Alanı */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="text"
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                placeholder="Senaryoyu revize et (Örn: Sahneleri daha masalsı yap, 2. sahneyi kısalt...)"
                style={{
                  flex: 1,
                  minWidth: "220px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "12.5px",
                }}
              />
              <button
                type="button"
                onClick={() => onGenerateStoryboard(true)}
                disabled={revising || !revisionNote.trim()}
                className="button secondary"
                style={{ height: "36px", fontSize: "12px", padding: "0 14px" }}
              >
                {revising ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}
                <span>AI ile Revize Et</span>
              </button>
              <button
                type="button"
                onClick={onConfirmAndEnqueue}
                disabled={enqueueing}
                className="button primary"
                style={{
                  height: "38px",
                  fontSize: "13px",
                  fontWeight: 700,
                  padding: "0 18px",
                  background: "#16a34a",
                  border: "none",
                }}
              >
                {enqueueing ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Clapperboard size={16} />
                )}
                <span>2. Senaryoyu Onayla &amp; Videoyu Üret (FIFO)</span>
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              color: "#64748b",
              background: "#f8fafc",
              borderRadius: "10px",
              border: "1px dashed #cbd5e1",
            }}
          >
            <Clapperboard size={28} style={{ margin: "0 auto 8px", opacity: 0.6 }} />
            <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#334155" }}>
              Henüz aktif bir senaryo oluşturulmadı
            </div>
            <div style={{ fontSize: "12px", marginTop: "4px" }}>
              Yukarıdan RSS haberi seçin, makale URL&apos;si yapıştırın veya özel konu yazıp{" "}
              <strong>&ldquo;Araştır &amp; Senaryo Oluştur&rdquo;</strong> ya da{" "}
              <strong>&ldquo;Tek Tıkla Direkt Video Üret&rdquo;</strong> butonuna tıklayın.
            </div>
          </div>
        )}
      </div>

      {/* Sahne Görseli Tam Ekran Lightbox Modalı */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.82)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              maxWidth: "560px",
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "14px", color: "#0f172a" }}>{lightboxImage.title}</strong>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  cursor: "pointer",
                }}
              >
                <X size={16} />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxImage.url}
              alt={lightboxImage.title}
              style={{
                width: "100%",
                maxHeight: "68vh",
                objectFit: "contain",
                borderRadius: "10px",
                background: "#0f172a",
              }}
            />
            <small style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>
              {lightboxImage.promptEn}
            </small>
          </div>
        </div>
      )}
    </section>
  );
}
