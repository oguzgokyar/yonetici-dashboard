"use client";

import { useState } from "react";
import {
  Rss,
  Link2,
  Sparkles,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Plus,
  Zap,
  Globe,
  FileText,
} from "lucide-react";
import type { RssFeedArticle, RssSourceItem, RssStoryboard } from "../types";

export interface RssResearchPanelProps {
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
  onFetchRssFeeds: (sourceId?: string) => void;
  onAddRssSource: (name: string, url: string, category: string) => Promise<void>;
  onDeleteRssSource: (id: string) => Promise<void>;
  onScrapeUrlPreview: () => Promise<void>;
  onSelectRssArticle: (article: RssFeedArticle) => void;
  onGenerateStoryboard: (isRevision?: boolean) => void;
  onOneClickProduce: () => void;
  onClearStoryboard: () => void;
}

export function RssResearchPanel({
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
  onFetchRssFeeds,
  onAddRssSource,
  onDeleteRssSource,
  onScrapeUrlPreview,
  onSelectRssArticle,
  onGenerateStoryboard,
  onOneClickProduce,
  onClearStoryboard,
}: RssResearchPanelProps) {
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>("");
  const [showAddSourceForm, setShowAddSourceForm] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newSourceCategory, setNewSourceCategory] = useState("teknoloji");

  async function handleAddSourceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newSourceName.trim() || !newSourceUrl.trim()) return;
    await onAddRssSource(newSourceName.trim(), newSourceUrl.trim(), newSourceCategory);
    setNewSourceName("");
    setNewSourceUrl("");
    setShowAddSourceForm(false);
  }

  return (
    <div className="rss-panel-card">
      <div className="rss-panel-header">
        <div>
          <h2 className="rss-panel-title">İçerik Araştırma &amp; Senaryo Merkezi</h2>
          <span className="rss-panel-subtitle">
            RSS kaynağından, makale linkinden veya özel konudan araştırma yapıp senaryo ve video üretin
          </span>
        </div>

        <div className="rss-mode-tabs">
          <button
            type="button"
            onClick={() => {
              setSourceMode("prompt");
              setSourceUrl("");
            }}
            className={`rss-mode-tab mode-prompt ${sourceMode === "prompt" ? "is-active" : ""}`}
          >
            <Sparkles size={13} />
            <span>Özel Konu / Prompt</span>
          </button>
          <button
            type="button"
            onClick={() => setSourceMode("url")}
            className={`rss-mode-tab mode-url ${sourceMode === "url" ? "is-active" : ""}`}
          >
            <Link2 size={13} />
            <span>URL Araştır</span>
          </button>
          <button
            type="button"
            onClick={() => setSourceMode("rss")}
            className={`rss-mode-tab mode-rss ${sourceMode === "rss" ? "is-active" : ""}`}
          >
            <Rss size={13} />
            <span>RSS Havuzu</span>
          </button>
        </div>
      </div>

      {/* MOD 1: RSS HABER HAVUZU */}
      {sourceMode === "rss" && (
        <div className="rss-pool-box">
          <div className="rss-pool-toolbar">
            <div className="rss-pool-filter-group">
              <select
                value={selectedSourceFilter}
                onChange={(e) => setSelectedSourceFilter(e.target.value)}
                className="rss-pool-select"
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
                className="button secondary rss-btn-compact"
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
              className="rss-add-source-toggle"
            >
              <Plus size={13} />
              <span>RSS Kaynağı Ekle / Yönet</span>
            </button>
          </div>

          {showAddSourceForm && (
            <form onSubmit={(e) => void handleAddSourceSubmit(e)} className="rss-add-source-form">
              <div className="rss-add-source-grid">
                <input
                  type="text"
                  placeholder="Kaynak adı (Örn: Webrazzi)"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  className="rss-input-sm"
                />
                <input
                  type="url"
                  placeholder="https://.../rss.xml"
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  className="rss-input-sm"
                />
                <select
                  value={newSourceCategory}
                  onChange={(e) => setNewSourceCategory(e.target.value)}
                  className="rss-input-sm"
                >
                  <option value="haber">Haber</option>
                  <option value="teknoloji">Teknoloji</option>
                  <option value="bilim">Bilim</option>
                  <option value="egitim">Eğitim</option>
                </select>
                <button type="submit" className="button primary rss-btn-compact">
                  Ekle
                </button>
              </div>

              {rssSources.length > 0 && (
                <div className="rss-source-chips">
                  {rssSources.map((s) => (
                    <span key={s.id} className="rss-source-chip">
                      <strong>{s.name}</strong>
                      <button
                        type="button"
                        onClick={() => void onDeleteRssSource(s.id)}
                        className="rss-source-chip-remove"
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

          {rssArticles.length > 0 ? (
            <div className="rss-article-list">
              {rssArticles.map((art) => {
                const isSelected = sourceUrl === art.url;
                return (
                  <div
                    key={art.id}
                    onClick={() => onSelectRssArticle(art)}
                    className={`rss-article-item ${isSelected ? "is-selected" : ""}`}
                  >
                    <div className="rss-article-body">
                      <div className="rss-article-title">{art.title}</div>
                      <div className="rss-article-meta">
                        {art.sourceName} • {art.summary.slice(0, 95)}...
                      </div>
                    </div>
                    <span className={`rss-score-badge ${art.score >= 75 ? "high" : "medium"}`}>
                      {art.score} Puan
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rss-pool-empty-hint">
              Haber havuzunu doldurmak için <strong>&ldquo;Güncel Haberleri Çek&rdquo;</strong>{" "}
              butonuna tıklayın.
            </div>
          )}
        </div>
      )}

      {/* MOD 2: URL'DEN MAKALE / HABER ARAŞTIRMA */}
      {sourceMode === "url" && (
        <div className="rss-url-scrape-row">
          <div className="rss-url-input-wrap">
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://... (Haber, blog yazısı veya makale adresini yapıştırın)"
              className="rss-url-input"
            />
          </div>
          <button
            type="button"
            onClick={() => void onScrapeUrlPreview()}
            disabled={scrapingUrl || !sourceUrl.trim()}
            className="button secondary rss-scrape-btn"
          >
            {scrapingUrl ? <LoaderCircle className="spin" size={15} /> : <Globe size={15} />}
            <span>{scrapingUrl ? "Çekiliyor..." : "Makaleyi Çek"}</span>
          </button>
        </div>
      )}

      {/* ORTAK KONU / ARAŞTIRMA ÖZETİ METİN ALANI */}
      <div>
        <div className="rss-topic-header">
          <label htmlFor="rss-topic-textarea" className="rss-topic-label">
            <FileText size={13} className="rss-icon-indigo" />
            <span>
              {sourceMode === "prompt"
                ? "Video Konusu / Masal / Bilgi Brifi"
                : "Seçilen Haberin / Makalenin Araştırma Metni"}
            </span>
          </label>
          <div className="rss-topic-actions">
            {storyboard && (
              <button
                type="button"
                onClick={onClearStoryboard}
                className="rss-reset-mini-btn"
                title="Ekrandaki mevcut senaryoyu sıfırlayıp yeni video üretimine başlar"
              >
                <RotateCcw size={11} />
                <span>Yeni Video / Sıfırla</span>
              </button>
            )}
            {topicOrText.length > 0 && !storyboard && (
              <button
                type="button"
                onClick={() => {
                  setTopicOrText("");
                  setSourceUrl("");
                }}
                className="rss-clear-text-btn"
              >
                Metni Temizle
              </button>
            )}
          </div>
        </div>
        <textarea
          id="rss-topic-textarea"
          value={topicOrText}
          onChange={(e) => setTopicOrText(e.target.value)}
          rows={3}
          placeholder="Örn: Çocukların kendi oyuncaklarını tasarlamasının problem çözme becerisine etkisi hakkında bilimsel araştırmalar... (Veya yukarıdan RSS haberi seçin / URL yapıştırın)"
          className="rss-topic-textarea"
        />
      </div>

      {/* ÇİFT AKSİYON BUTONU */}
      <div className="rss-primary-cta-grid">
        <button
          type="button"
          onClick={() => onGenerateStoryboard(false)}
          disabled={planning || revising || enqueueing}
          className="button secondary rss-cta-plan-btn"
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
          className="button primary rss-cta-oneclick-btn"
        >
          {enqueueing ? <LoaderCircle className="spin" size={16} /> : <Zap size={16} />}
          <span>
            {enqueueing ? "FIFO Kuyruğuna Ekleniyor..." : "⚡ Tek Tıkla Direkt Video Üret"}
          </span>
        </button>
      </div>

      {message && (
        <div className="generation-notice rss-notice-compact">
          <Sparkles size={15} />
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}
