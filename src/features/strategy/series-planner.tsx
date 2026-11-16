"use client";

import { useEffect, useState, useTransition } from "react";
import { Sparkles, CheckCircle2, Clock, PlayCircle, Loader2 } from "lucide-react";
import type { ContentSeries, SeriesEpisode } from "@/lib/server/series-researcher";

interface SeriesPlannerProps {
  projectId: string;
}

export function SeriesPlanner({ projectId }: SeriesPlannerProps) {
  const [topicInput, setTopicInput] = useState("");
  const [series, setSeries] = useState<ContentSeries | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadSeries() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/projects/${projectId}/strategy/series`);
        const data = await res.json();
        if (isMounted && data.success) {
          setSeries(data.series || null);
          if (data.series?.main_topic) {
            setTopicInput(data.series.main_topic);
          }
        }
      } catch {
        if (isMounted) setError("Seri yüklenirken hata oluştu.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadSeries();
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  function handleResearch(e: React.FormEvent) {
    e.preventDefault();
    const clean = topicInput.trim();
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
        } else {
          setError(data.error || "Araştırma tamamlanamadı.");
        }
      } catch {
        setError("Sunucuyla bağlantı kurulamadı.");
      }
    });
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
      }
    } catch {
      // Revert if error
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
    series?.episodes[series.episodes.length - 1];

  return (
    <div className="series-planner-wrapper">
      <form onSubmit={handleResearch} className="series-search-form">
        <input
          type="text"
          className="series-search-input"
          placeholder="İçerik serisi oluşturmak istediğiniz ana konuyu girin..."
          value={topicInput}
          onChange={(e) => setTopicInput(e.target.value)}
          disabled={isPending}
        />
        <button type="submit" className="series-search-btn" disabled={isPending || !topicInput.trim()}>
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

      {isLoading ? (
        <div className="series-empty-placeholder">
          <Loader2 size={24} className="animate-spin" />
          <span>Seri bilgileri yükleniyor...</span>
        </div>
      ) : !series || series.episodes.length === 0 ? (
        <div className="series-empty-placeholder">
          <span>Bu proje için henüz bir içerik serisi oluşturulmadı.</span>
          <span>Yukarıdaki alana bir ana konu yazarak derin araştırmayı başlatabilirsiniz.</span>
        </div>
      ) : (
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

                  {ep.core_message && (
                    <p className="series-episode-core">{ep.core_message}</p>
                  )}

                  {ep.key_points && ep.key_points.length > 0 && (
                    <ul className="series-episode-points">
                      {ep.key_points.map((pt, idx) => (
                        <li key={idx}>{pt}</li>
                      ))}
                    </ul>
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
      )}
    </div>
  );
}
