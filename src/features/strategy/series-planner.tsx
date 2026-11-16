"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Sparkles,
  CheckCircle2,
  Clock,
  PlayCircle,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  Pencil,
  FileText,
  X,
} from "lucide-react";
import type {
  ContentSeries,
  SeriesEpisode,
  SeriesSummary,
  StrategicSuggestion,
} from "@/lib/server/series-researcher";

interface SeriesPlannerProps {
  projectId: string;
}

export function SeriesPlanner({ projectId }: SeriesPlannerProps) {
  const [topicInput, setTopicInput] = useState("");
  const [series, setSeries] = useState<ContentSeries | null>(null);
  const [allSeries, setAllSeries] = useState<SeriesSummary[]>([]);
  const [suggestions, setSuggestions] = useState<StrategicSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Modals and feedback state
  const [editingEpisode, setEditingEpisode] = useState<SeriesEpisode | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const [notingEpisode, setNotingEpisode] = useState<SeriesEpisode | null>(null);
  const [noteContent, setNoteContent] = useState("");

  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadInitialData() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/projects/${projectId}/strategy/series`);
        const data = await res.json();
        if (isMounted && data.success) {
          setSeries(data.series || null);
          setAllSeries(data.allSeries || []);
          if (data.series?.main_topic) {
            setTopicInput(data.series.main_topic);
          }
        }
      } catch {
        if (isMounted) setError("Seri verileri yüklenirken hata oluştu.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  async function handleSelectSeries(seriesId: string) {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(
        `/api/projects/${projectId}/strategy/series?seriesId=${encodeURIComponent(seriesId)}`
      );
      const data = await res.json();
      if (data.success && data.series) {
        setSeries(data.series);
        setTopicInput(data.series.main_topic);
        setSuggestions([]);
      }
    } catch {
      setError("Seçilen seri yüklenemedi.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleStartNewSeries() {
    setSeries(null);
    setTopicInput("");
    setError(null);
    if (suggestions.length === 0) {
      void fetchSuggestions();
    }
  }

  async function fetchSuggestions() {
    try {
      setIsSuggesting(true);
      const res = await fetch(`/api/projects/${projectId}/strategy/series/suggest`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
      }
    } catch {
      // Non-blocking
    } finally {
      setIsSuggesting(false);
    }
  }

  function runResearchWithTopic(topic: string) {
    const clean = topic.trim();
    if (!clean) return;

    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/strategy/series`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mainTopic: clean }),
        });
        const data = await res.json();
        if (data.success) {
          setSeries(data.series);
          setAllSeries(data.allSeries || []);
          setTopicInput(data.series.main_topic);
          setSuggestions([]);
        } else {
          setError(data.error || "Araştırma tamamlanamadı.");
        }
      } catch {
        setError("Sunucuyla bağlantı kurulamadı.");
      }
    });
  }

  function handleResearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    runResearchWithTopic(topicInput);
  }

  async function handleDeleteSeries(seriesId: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (!confirm("Bu seriyi ve alt konularını silmek istediğinize emin misiniz?")) return;

    try {
      const res = await fetch(
        `/api/projects/${projectId}/strategy/series?seriesId=${encodeURIComponent(seriesId)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success) {
        setAllSeries(data.allSeries || []);
        if (series?.id === seriesId) {
          setSeries(data.series || null);
          setTopicInput(data.series?.main_topic || "");
        }
      }
    } catch {
      setError("Seri silinirken hata oluştu.");
    }
  }

  async function handleUpdateSeriesTitle(newTitle: string) {
    if (!series || !newTitle.trim() || newTitle.trim() === series.main_topic) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/strategy/series`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId: series.id, mainTopic: newTitle.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.series) setSeries(data.series);
        if (data.allSeries) setAllSeries(data.allSeries);
      }
    } catch {}
  }

  async function handleStatusToggle(episode: SeriesEpisode) {
    const nextStatus: Record<string, "pending" | "in_progress" | "completed"> = {
      pending: "in_progress",
      in_progress: "completed",
      completed: "pending",
    };
    const targetStatus = nextStatus[episode.status] || "in_progress";

    setSeries((prev) => {
      if (!prev) return null;
      const updatedEpisodes = prev.episodes.map((ep) =>
        ep.id === episode.id ? { ...ep, status: targetStatus } : ep
      );
      return { ...prev, episodes: updatedEpisodes };
    });

    try {
      const res = await fetch(
        `/api/projects/${projectId}/strategy/series/episodes/${episode.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus, seriesId: series?.id }),
        }
      );
      const data = await res.json();
      if (data.success && data.series) {
        setSeries(data.series);
        const listRes = await fetch(`/api/projects/${projectId}/strategy/series`);
        const listData = await listRes.json();
        if (listData.allSeries) setAllSeries(listData.allSeries);
      }
    } catch {
      const res = await fetch(`/api/projects/${projectId}/strategy/series`);
      const data = await res.json();
      if (data.success) setSeries(data.series);
    }
  }

  async function handleDeleteEpisode(episodeId: string) {
    if (!confirm("Bu alt konuyu silmek istediğinize emin misiniz?")) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/strategy/series/episodes/${episodeId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success && data.series) {
        setSeries(data.series);
        const listRes = await fetch(`/api/projects/${projectId}/strategy/series`);
        const listData = await listRes.json();
        if (listData.allSeries) setAllSeries(listData.allSeries);
      }
    } catch {
      setError("Alt konu silinirken hata oluştu.");
    }
  }

  async function handleAddEpisode() {
    if (!series) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/strategy/series/episodes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seriesId: series.id }),
        }
      );
      const data = await res.json();
      if (data.success && data.series) {
        setSeries(data.series);
        const listRes = await fetch(`/api/projects/${projectId}/strategy/series`);
        const listData = await listRes.json();
        if (listData.allSeries) setAllSeries(listData.allSeries);
      }
    } catch {
      setError("Yeni alt konu eklenemedi.");
    }
  }

  async function handleExpandSeries() {
    if (!series) return;
    try {
      setIsExpanding(true);
      setError(null);
      const res = await fetch(
        `/api/projects/${projectId}/strategy/series/expand`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seriesId: series.id }),
        }
      );
      const data = await res.json();
      if (data.success && data.series) {
        setSeries(data.series);
        const listRes = await fetch(`/api/projects/${projectId}/strategy/series`);
        const listData = await listRes.json();
        if (listData.allSeries) setAllSeries(listData.allSeries);
      } else {
        setError(data.error || "Seri uzatılamadı.");
      }
    } catch {
      setError("Seri uzatılırken bağlantı hatası oluştu.");
    } finally {
      setIsExpanding(false);
    }
  }

  function handleCopyEpisode(episode: SeriesEpisode) {
    const textToCopy = `${episode.title}\n${episode.description}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(episode.id);
    setTimeout(() => {
      setCopiedId(null);
    }, 1800);
  }

  function openEditModal(episode: SeriesEpisode) {
    setEditingEpisode(episode);
    setEditTitle(episode.title);
    setEditDesc(episode.description);
  }

  async function handleSaveEdit() {
    if (!editingEpisode || !editTitle.trim()) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/strategy/series/episodes/${editingEpisode.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editTitle.trim(),
            description: editDesc.trim(),
            seriesId: series?.id,
          }),
        }
      );
      const data = await res.json();
      if (data.success && data.series) {
        setSeries(data.series);
      }
    } catch {}
    setEditingEpisode(null);
  }

  function openNoteModal(episode: SeriesEpisode) {
    setNotingEpisode(episode);
    setNoteContent(episode.user_notes || "");
  }

  async function handleSaveNote() {
    if (!notingEpisode) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/strategy/series/episodes/${notingEpisode.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_notes: noteContent.trim(),
            seriesId: series?.id,
          }),
        }
      );
      const data = await res.json();
      if (data.success && data.series) {
        setSeries(data.series);
      }
    } catch {}
    setNotingEpisode(null);
  }

  const completedCount = series?.episodes.filter((e) => e.status === "completed").length || 0;
  const totalCount = series?.episodes.length || 0;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const currentEpisode =
    series?.episodes.find((e) => e.status === "in_progress") ||
    series?.episodes.find((e) => e.status === "pending") ||
    (series?.episodes ? series.episodes[series.episodes.length - 1] : undefined);

  return (
    <div className="series-layout-grid">
      {/* Sol Kolon: Dar İndeks Sidebar */}
      <aside className="series-index-sidebar">
        <div className="series-index-header">
          <span>Kayıtlı Konular ({allSeries.length})</span>
        </div>

        <button
          type="button"
          onClick={handleStartNewSeries}
          className="series-index-new-btn"
        >
          <Plus size={14} />
          <span>Yeni Seri Başlat</span>
        </button>

        <div className="series-index-list">
          {allSeries.map((item) => {
            const isSelected = series?.id === item.id;
            const pct =
              item.episode_count > 0
                ? Math.round((item.completed_count / item.episode_count) * 100)
                : 0;

            return (
              <div key={item.id} className="series-index-item-row">
                <button
                  type="button"
                  onClick={() => handleSelectSeries(item.id)}
                  className={`series-index-item ${isSelected ? "active" : ""}`}
                >
                  <span className="series-index-item-title">{item.main_topic}</span>
                  <span className="series-index-item-meta">
                    {item.completed_count}/{item.episode_count} Bitti (%{pct})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteSeries(item.id, e)}
                  className="series-index-del-btn"
                  title="Seriyi Sil"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Sağ Kolon: Ana Çalışma Alanı */}
      <main className="series-main-workspace">
        <form onSubmit={handleResearchSubmit} className="series-search-form">
          <input
            type="text"
            className="series-search-input"
            placeholder="İçerik serisi oluşturmak istediğiniz ana konuyu girin..."
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            disabled={isPending}
          />
          <button
            type="submit"
            className="series-search-btn"
            disabled={isPending || !topicInput.trim()}
          >
            {isPending ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Araştırılıyor...</span>
              </>
            ) : (
              <>
                <Sparkles size={15} />
                <span>Derin Araştır & Böl</span>
              </>
            )}
          </button>
        </form>

        {error && <div className="series-rationale-card">{error}</div>}

        {/* Stratejik Seri Önerileri (Aktif Seri Yokken) */}
        {!series && (
          <section className="series-suggestions-panel">
            <div className="series-suggestions-header">
              <h4 className="series-suggestions-title">Stratejik Seri Önerileri</h4>
              <button
                type="button"
                onClick={fetchSuggestions}
                disabled={isSuggesting}
                className="series-refresh-btn"
              >
                <RefreshCw size={12} className={isSuggesting ? "animate-spin" : ""} />
                <span>Yeni Öneriler</span>
              </button>
            </div>

            {isSuggesting ? (
              <div className="series-empty-placeholder">
                <Loader2 size={20} className="animate-spin" />
                <span>Marka stratejiniz taranarak seri önerileri hazırlanıyor...</span>
              </div>
            ) : suggestions.length > 0 ? (
              <div className="series-suggestions-grid">
                {suggestions.map((sug, idx) => (
                  <div key={idx} className="series-suggestion-card">
                    <div>
                      <h5 className="series-suggestion-card-title">{sug.title}</h5>
                      <p className="series-suggestion-card-desc">{sug.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => runResearchWithTopic(sug.title)}
                      className="series-suggestion-pick-btn"
                    >
                      <Sparkles size={11} />
                      <span>Bu Konuyla Başlat</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="series-empty-placeholder">
                <span>Yeni bir konu yazabilir veya yukarıdaki butona tıklayarak marka stratejinize uygun seri önerileri alabilirsiniz.</span>
              </div>
            )}
          </section>
        )}

        {isLoading ? (
          <div className="series-empty-placeholder">
            <Loader2 size={24} className="animate-spin" />
            <span>Seri bilgileri yükleniyor...</span>
          </div>
        ) : series ? (
          <>
            <div className="series-main-header-row">
              <input
                type="text"
                className="series-title-edit-input"
                defaultValue={series.main_topic}
                key={series.id + series.main_topic}
                onBlur={(e) => handleUpdateSeriesTitle(e.target.value)}
                title="Seri başlığını düzenlemek için tıklayın"
              />
              <button
                type="button"
                onClick={() => handleDeleteSeries(series.id)}
                className="series-delete-series-btn"
              >
                <Trash2 size={12} />
                <span>Seriyi Sil</span>
              </button>
            </div>

            <div className="series-tracker-bar">
              <div className="series-tracker-header">
                <span>
                  İlerleme: {completedCount}/{totalCount} Tamamlandı (%{progressPercent})
                </span>
                {currentEpisode && (
                  <span className="series-tracker-current">
                    Kaldığınız Yer: Bölüm {currentEpisode.order_index}
                  </span>
                )}
              </div>
              <progress
                value={progressPercent}
                max={100}
                className="series-progress-element"
              />
            </div>

            {series.rationale && (
              <div className="series-rationale-card">{series.rationale}</div>
            )}

            {/* Yüksek Bilgi Yoğunluklu, Tam Görünür Kompakt Satır Listesi */}
            <div className="series-compact-list">
              {series.episodes.map((ep) => {
                const isCurrent = currentEpisode?.id === ep.id && ep.status !== "completed";
                const rowClass = [
                  "series-compact-row",
                  ep.status === "in_progress" ? "in-progress" : "",
                  ep.status === "completed" ? "completed" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                const statusIcon =
                  ep.status === "completed" ? (
                    <CheckCircle2 size={12} />
                  ) : ep.status === "in_progress" ? (
                    <PlayCircle size={12} />
                  ) : (
                    <Clock size={12} />
                  );

                const statusLabel =
                  ep.status === "completed"
                    ? "Tamam"
                    : ep.status === "in_progress"
                    ? "Aktif"
                    : "Bekliyor";

                return (
                  <div key={ep.id} className={rowClass}>
                    <span className="series-compact-order">
                      {String(ep.order_index).padStart(2, "0")}
                    </span>

                    {/* Düz Metin - Tam Görünür & Alt Satıra Kayar */}
                    <div className="series-compact-main">
                      <h4 className="series-compact-title">
                        {ep.title}
                        {isCurrent && " •"}
                      </h4>
                      {ep.description && (
                        <p className="series-compact-desc">{ep.description}</p>
                      )}
                    </div>

                    {/* Simge Eylemleri: Durum, Kopyala, Düzenle, Not, Sil */}
                    <div className="series-compact-actions">
                      <button
                        type="button"
                        onClick={() => handleStatusToggle(ep)}
                        className={`series-status-btn status-${ep.status}`}
                        title="Durumu değiştirmek için tıklayın"
                      >
                        {statusIcon}
                        <span>{statusLabel}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyEpisode(ep)}
                        className={`series-icon-btn ${copiedId === ep.id ? "copied" : ""}`}
                        title={copiedId === ep.id ? "Kopyalandı!" : "Metni Kopyala"}
                      >
                        {copiedId === ep.id ? <Check size={12} /> : <Copy size={12} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(ep)}
                        className="series-icon-btn"
                        title="Başlık ve Açıklamayı Düzenle"
                      >
                        <Pencil size={12} />
                      </button>

                      <button
                        type="button"
                        onClick={() => openNoteModal(ep)}
                        className={`series-icon-btn ${ep.user_notes?.trim() ? "has-note" : ""}`}
                        title={ep.user_notes?.trim() ? "Notu Görüntüle / Düzenle" : "Not Ekle"}
                      >
                        <FileText size={12} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteEpisode(ep.id)}
                        className="series-episode-del-btn"
                        title="Bu alt konuyu sil"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="series-bottom-actions-row">
                <button
                  type="button"
                  onClick={handleExpandSeries}
                  disabled={isExpanding}
                  className="series-expand-btn"
                >
                  {isExpanding ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Araştırılarak Uzatılıyor...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} />
                      <span>Seriyi Araştırarak Uzat (+3-5 Konu)</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleAddEpisode}
                  className="series-add-blank-btn"
                >
                  <Plus size={13} />
                  <span>Boş Konu Ekle</span>
                </button>
              </div>
            </div>
          </>
        ) : null}
      </main>

      {/* DÜZENLEME MODALI */}
      {editingEpisode && (
        <div className="series-modal-backdrop" onClick={() => setEditingEpisode(null)}>
          <div className="series-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="series-modal-header">
              <h4 className="series-modal-title">Alt Konuyu Düzenle</h4>
              <button
                type="button"
                onClick={() => setEditingEpisode(null)}
                className="series-modal-close"
              >
                <X size={15} />
              </button>
            </div>
            <div className="series-modal-body">
              <span className="series-modal-label">Başlık</span>
              <input
                type="text"
                className="series-modal-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Konu başlığı..."
                autoFocus
              />
              <span className="series-modal-label">Açıklama</span>
              <textarea
                className="series-modal-textarea"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Kısa açıklama..."
              />
            </div>
            <div className="series-modal-footer">
              <button
                type="button"
                onClick={() => setEditingEpisode(null)}
                className="series-modal-cancel-btn"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="series-modal-save-btn"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NOT MODALI */}
      {notingEpisode && (
        <div className="series-modal-backdrop" onClick={() => setNotingEpisode(null)}>
          <div className="series-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="series-modal-header">
              <h4 className="series-modal-title">Çalışma Notu ({notingEpisode.title})</h4>
              <button
                type="button"
                onClick={() => setNotingEpisode(null)}
                className="series-modal-close"
              >
                <X size={15} />
              </button>
            </div>
            <div className="series-modal-body">
              <span className="series-modal-label">Notunuz</span>
              <textarea
                className="series-modal-textarea"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Bu konuyla ilgili kişisel hatırlatmalarınız, örnekler veya notlarınız..."
                autoFocus
              />
            </div>
            <div className="series-modal-footer">
              <button
                type="button"
                onClick={() => setNotingEpisode(null)}
                className="series-modal-cancel-btn"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                className="series-modal-save-btn"
              >
                Notu Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
