"use client";

import Link from "next/link";
import {
  Clapperboard,
  RefreshCw,
  LoaderCircle,
  Pencil,
  ExternalLink,
  Download,
  Send,
  Trash2,
} from "lucide-react";
import { TelegramSendButton } from "@/components/ui/telegram-send-button";
import type { RenderedVideo } from "../types";

interface VidsVideoGalleryProps {
  projectId: string;
  videos: RenderedVideo[];
  loadingVideos: boolean;
  deletingId: string | null;
  onRefresh: () => void;
  onEditVideo: (video: RenderedVideo) => void;
  onDeleteVideo: (id: string) => void;
}

export function VidsVideoGallery({
  projectId,
  videos,
  loadingVideos,
  deletingId,
  onRefresh,
  onEditVideo,
  onDeleteVideo,
}: VidsVideoGalleryProps) {
  return (
    <section className="generation-history">
      <div className="history-heading">
        <div>
          <span>
            <Clapperboard size={16} />
          </span>
          <div>
            <h2>Üretilen Google Vids Videoları</h2>
            <p>Tamamlanan AI videoları burada saklanır ve tek tıkla Paylaşım Planına aktarılır.</p>
          </div>
        </div>
        <button
          type="button"
          className="button secondary"
          onClick={onRefresh}
          disabled={loadingVideos}
        >
          {loadingVideos ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}
          Yenile
        </button>
      </div>

      {loadingVideos && !videos.length ? (
        <div className="history-loading">
          <LoaderCircle className="spin" size={20} />
          Videolar yükleniyor...
        </div>
      ) : videos.length ? (
        <div className="video-history-grid">
          {videos.map((video) => (
            <article key={video.id}>
              <video
                src={video.url}
                poster={`/api/videos/${video.id}?thumb=1`}
                controls
                preload="none"
                playsInline
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <span>
                  {video.title || "Google Vids"} • {video.durationSeconds || 30} sn
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {video.storyboard ? (
                    <button
                      type="button"
                      onClick={() => onEditVideo(video)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        color: "#4f46e5",
                        background: "#eef2ff",
                        border: "1px solid #c7d2fe",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontWeight: 600,
                        fontSize: "11px",
                        cursor: "pointer",
                      }}
                      title="Senaryoyu düzenleme paneline çağırıp yeni üretim başlat"
                    >
                      <Pencil size={12} /> Düzenle
                    </button>
                  ) : null}
                  {video.googleVidsUrl ? (
                    <a
                      href={video.googleVidsUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        color: "#1d4ed8",
                        fontWeight: 600,
                        fontSize: "11px",
                      }}
                      title="Google Vids projesini aç"
                    >
                      <ExternalLink size={13} /> Proje
                    </a>
                  ) : null}
                  <a href={video.url} download={`google-vids-${video.id}.mp4`}>
                    <Download size={14} /> İndir
                  </a>
                  <TelegramSendButton
                    mediaUrl={video.url}
                    mediaType="video"
                    variant="button"
                    label="Telegram"
                    size={13}
                  />
                  <Link
                    href={`/projects/${projectId}/publishing?assetId=${video.id}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      color: "var(--accent, #612bd3)",
                      fontWeight: 600,
                      fontSize: "11px",
                    }}
                  >
                    <Send size={13} /> Planla
                  </Link>
                  <button
                    type="button"
                    onClick={() => onDeleteVideo(video.id)}
                    disabled={deletingId === video.id}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      cursor: "pointer",
                      padding: "2px",
                    }}
                    title="Sil"
                  >
                    {deletingId === video.id ? (
                      <LoaderCircle className="spin" size={14} />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="history-empty">
          <Clapperboard size={23} />
          <span>Henüz Google Vids ile üretilmiş video bulunmuyor.</span>
        </div>
      )}
    </section>
  );
}
