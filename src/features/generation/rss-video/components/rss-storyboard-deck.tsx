"use client";

import { useEffect, useState } from "react";
import {
  LoaderCircle,
  RefreshCw,
  Trash2,
  Clapperboard,
  Check,
  Copy,
  Image as ImageIcon,
  X,
} from "lucide-react";
import {
  RSS_NARRATIVE_STYLES,
  type RssFeedArticle,
  type RssScenePlan,
  type RssSourceItem,
  type RssStoryboard,
} from "../types";
import { RssResearchPanel } from "./rss-research-panel";
import { RssSceneEditorCard } from "./rss-scene-editor-card";

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
  onDeleteScene?: (sceneIndex: number) => void;
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
  onDeleteScene,
  generatingSceneImages = {},
  onGenerateSceneImage,
  onGenerateAllSceneImages,
}: RssStoryboardDeckProps) {
  const [activeSceneTabIdx, setActiveSceneTabIdx] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    title: string;
    promptEn: string;
  } | null>(null);

  useEffect(() => {
    setActiveSceneTabIdx(0);
  }, [storyboard?.title]);

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

  return (
    <section className="generation-results rss-deck-root">
      {/* 1. ÜST KUTU: URL, RSS VE PROMPT'TAN VİDEO ARAŞTIRMASI & SENARYO ÜRETİMİ */}
      <RssResearchPanel
        sourceMode={sourceMode}
        setSourceMode={setSourceMode}
        topicOrText={topicOrText}
        setTopicOrText={setTopicOrText}
        sourceUrl={sourceUrl}
        setSourceUrl={setSourceUrl}
        rssSources={rssSources}
        rssArticles={rssArticles}
        loadingRss={loadingRss}
        scrapingUrl={scrapingUrl}
        planning={planning}
        revising={revising}
        enqueueing={enqueueing}
        message={message}
        storyboard={storyboard}
        onFetchRssFeeds={onFetchRssFeeds}
        onAddRssSource={onAddRssSource}
        onDeleteRssSource={onDeleteRssSource}
        onScrapeUrlPreview={onScrapeUrlPreview}
        onSelectRssArticle={onSelectRssArticle}
        onGenerateStoryboard={onGenerateStoryboard}
        onOneClickProduce={onOneClickProduce}
        onClearStoryboard={onClearStoryboard}
      />

      {/* 2. ORTA BÖLÜM: VİDEO SENARYOSU VE SAHNE DÜZENLEME TUVALİ */}
      <div className="rss-panel-card">
        <div className="rss-panel-header">
          <div>
            <h3 className="rss-panel-title">Video Senaryosu &amp; Sahne Akışı</h3>
            <span className="rss-panel-subtitle">
              Sahnelerin dış ses metinlerini, kamera hareketlerini ve görsel promptlarını inceleyip onaylayın
            </span>
          </div>

          {storyboard && (
            <div className="rss-storyboard-toolbar">
              {onGenerateAllSceneImages && (
                <button
                  type="button"
                  onClick={onGenerateAllSceneImages}
                  disabled={isAnySceneImageGenerating || enqueueing}
                  className="rss-generate-all-btn"
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
              <span className="rss-storyboard-meta-pill">
                {styleBadge} • {storyboard.scenes.length} Sahne • {storyboard.totalDurationSeconds} sn
              </span>
              <button
                type="button"
                onClick={onClearStoryboard}
                className="rss-reset-storyboard-btn"
                title="Yeni bir video konusu girmek için mevcut senaryoyu ve formu sıfırlar"
              >
                <Trash2 size={13} />
                <span>Yeni Video Başlat (Sıfırla)</span>
              </button>
            </div>
          )}
        </div>

        {storyboard && currentScene ? (
          <div className="rss-storyboard-content">
            {/* Senaryo Başlığı ve Özeti */}
            <div className="rss-storyboard-summary-card">
              <div className="rss-storyboard-summary-top">
                <strong className="rss-storyboard-summary-title">{storyboard.title}</strong>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(`${storyboard.title}\n\n${storyboard.summaryTr}`, "sb-summary")
                  }
                  className={`rss-copy-btn ${copiedKey === "sb-summary" ? "is-copied" : ""}`}
                >
                  {copiedKey === "sb-summary" ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <p className="rss-storyboard-summary-text">{storyboard.summaryTr}</p>
            </div>

            {/* Sahne Sekmeleri */}
            <div className="rss-scene-tabs">
              {storyboard.scenes.map((sc, idx) => {
                const isActive = idx === activeSceneTabIdx;
                const hasImg = Boolean(sc.previewImageUrl);
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
                    className={`rss-scene-tab ${isActive ? "is-active" : ""}`}
                  >
                    <span>
                      {idx + 1}. {roleLabel} ({sc.durationSeconds}sn)
                    </span>
                    {hasImg && <span title="Sahne görseli hazır" className="rss-scene-ready-dot" />}
                  </button>
                );
              })}
            </div>

            {/* Seçili Sahne Düzenleme Kartı */}
            <RssSceneEditorCard
              scene={currentScene}
              sceneIdx={activeSceneTabIdx}
              totalScenes={storyboard.scenes.length}
              aspectRatio={storyboard.aspectRatio}
              isGeneratingImage={Boolean(generatingSceneImages[activeSceneTabIdx])}
              onUpdateScene={onUpdateScene}
              onDeleteScene={
                onDeleteScene && storyboard.scenes.length > 2
                  ? () => {
                      const nextIdx = Math.max(0, activeSceneTabIdx - 1);
                      onDeleteScene(activeSceneTabIdx);
                      setActiveSceneTabIdx(nextIdx);
                    }
                  : undefined
              }
              onGenerateSceneImage={onGenerateSceneImage}
              onOpenLightbox={setLightboxImage}
            />

            {/* AI Revizyon & Kuyruğa Gönderme Alanı */}
            <div className="rss-revision-bar">
              <input
                type="text"
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                placeholder="Senaryoyu revize et (Örn: Sahneleri daha masalsı yap, 2. sahneyi kısalt...)"
                className="rss-revision-input"
              />
              <button
                type="button"
                onClick={() => onGenerateStoryboard(true)}
                disabled={revising || !revisionNote.trim()}
                className="button secondary rss-revise-btn"
              >
                {revising ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}
                <span>AI ile Revize Et</span>
              </button>
              <button
                type="button"
                onClick={onConfirmAndEnqueue}
                disabled={enqueueing}
                className="button primary rss-confirm-produce-btn"
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
        ) : planning ? (
          <div className="rss-planning-banner">
            <LoaderCircle className="spin" size={32} />
            <div className="rss-planning-title">
              Yeni Video Konusu Araştırılıyor &amp; Senaryo Kurgulanıyor...
            </div>
            <div className="rss-planning-desc">
              İçerik analiz ediliyor, sahne akışı, doğal Türkçe dış ses ve sinematik görsel planı
              hazırlanıyor. Lütfen bekleyin...
            </div>
          </div>
        ) : (
          <div className="rss-empty-storyboard">
            <Clapperboard size={28} />
            <div className="rss-empty-title">Henüz aktif bir senaryo oluşturulmadı</div>
            <div className="rss-empty-desc">
              Yukarıdan RSS haberi seçin, makale URL&apos;si yapıştırın veya özel konu yazıp{" "}
              <strong>&ldquo;Araştır &amp; Senaryo Oluştur&rdquo;</strong> ya da{" "}
              <strong>&ldquo;Tek Tıkla Direkt Video Üret&rdquo;</strong> butonuna tıklayın.
            </div>
          </div>
        )}
      </div>

      {/* Sahne Görseli Tam Ekran Lightbox Modalı */}
      {lightboxImage && (
        <div onClick={() => setLightboxImage(null)} className="rss-lightbox-backdrop">
          <div onClick={(e) => e.stopPropagation()} className="rss-lightbox-dialog">
            <div className="rss-lightbox-header">
              <strong className="rss-lightbox-title">{lightboxImage.title}</strong>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="rss-lightbox-close"
              >
                <X size={16} />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxImage.url}
              alt={lightboxImage.title}
              className="rss-lightbox-img"
            />
            <small className="rss-lightbox-prompt">{lightboxImage.promptEn}</small>
          </div>
        </div>
      )}
    </section>
  );
}
