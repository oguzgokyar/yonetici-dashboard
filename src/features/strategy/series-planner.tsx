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
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  async function handleStatusToggle(episode: SeriesEpisode) {
    const nextStatus: Record<string, "pending" | "in_progress" | "completed"> = {
      pending: "in_progress",
      in_progress: "completed",
      completed: "pending",
    };
    const targetStatus = nextStatus[episode.status] || "in_progress";

    // Optimistic UI update
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
          body: JSON.stringify({ status: targetStatus }),
        }
      );
      const data = await res.json();
      if (data.success && data.series) {
        setSeries(data.series);
        // Refresh index summary list
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

  async function handleNotesBlur(episodeId: string, notes: string) {
    try {
      await fetch(`/api/projects/${projectId}/strategy/series/episodes/${episodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_notes: notes }),
      });
    } catch {}
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
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectSeries(item.id)}
                className={`series-index-item ${isSelected ? "active" : ""}`}
              >
                <span className="series-index-item-title">{item.main_topic}</span>
                <span className="series-index-item-meta">
                  {item.completed_count}/{item.episode_count} Bitti (%{pct})
                </span>
              </button>
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

        {/* Stratejik Seri Önerileri (Aktif Seri Yokken veya Boşken) */}
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

            <div className="series-episodes-list">
              {series.episodes.map((ep) => {
                const isCurrent = currentEpisode?.id === ep.id && ep.status !== "completed";
                const cardClass = [
                  "series-episode-card",
                  ep.status === "in_progress" ? "in-progress" : "",
                  ep.status === "completed" ? "completed" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                const statusIcon =
                  ep.status === "completed" ? (
                    <CheckCircle2 size={13} />
                  ) : ep.status === "in_progress" ? (
                    <PlayCircle size={13} />
                  ) : (
                    <Clock size={13} />
                  );

                const statusLabel =
                  ep.status === "completed"
                    ? "Tamamlandı"
                    : ep.status === "in_progress"
                    ? "Çalışılıyor"
                    : "Bekliyor";

                return (
                  <div key={ep.id} className={cardClass}>
                    <div className="series-episode-top">
                      <span className="series-order-tag">
                        Bölüm {String(ep.order_index).padStart(2, "0")}
                        {isCurrent && " • Aktif"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStatusToggle(ep)}
                        className={`series-status-btn status-${ep.status}`}
                        title="Durumu değiştirmek için tıklayın"
                      >
                        {statusIcon}
                        <span>{statusLabel}</span>
                      </button>
                    </div>

                    <h4 className="series-episode-title">{ep.title}</h4>

                    {ep.description && (
                      <p className="series-episode-core">{ep.description}</p>
                    )}

                    <input
                      type="text"
                      className="series-notes-input"
                      placeholder="Bu bölüm için çalışma notunuz..."
                      defaultValue={ep.user_notes || ""}
                      onBlur={(e) => handleNotesBlur(ep.id, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
