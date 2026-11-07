"use client";

import Link from "next/link";
import {
  Clapperboard,
  RefreshCw,
  LoaderCircle,
  Pencil,
  Download,
  Send,
  Trash2,
} from "lucide-react";
import { TelegramSendButton } from "@/components/ui/telegram-send-button";
import { RSS_NARRATIVE_STYLES, type RssRenderedVideo } from "../types";

interface RssVideoGalleryProps {
  projectId: string;
  videos: RssRenderedVideo[];
  loadingVideos: boolean;
  deletingId: string | null;
  onRefresh: () => void;
  onEditVideo: (video: RssRenderedVideo) => void;
  onDeleteVideo: (id: string) => void;
}

export function RssVideoGallery({
  projectId,
  videos,
  loadingVideos,
  deletingId,
  onRefresh,
  onEditVideo,
  onDeleteVideo,
}: RssVideoGalleryProps) {
  return (
    <section className="generation-history">
      <div className="history-heading">
        <div>
          <span>
            <Clapperboard size={16} />
          </span>
          <div>
            <h2>Üretilen RSS &amp; Konu Videoları</h2>
            <p>
              CliProxy görselleri, Gemini 2.0 TTS ve FFmpeg xfade/ASS altyazı ile üretilen videolar
            </p>
          </div>
        </div>
        <button
          type="button"
          className="button secondary"
          onClick={onRefresh}
          disabled={loadingVideos}
        >
          {loadingVideos ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <RefreshCw size={15} />
          )}
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
          {videos.map((video) => {
            const styleBadge =
              RSS_NARRATIVE_STYLES.find((s) => s.key === video.narrativeStyle)?.badge ||
              "📰 RSS Video";
            return (
              <article key={video.id}>
                <video
                  src={video.url}
                  poster={`/api/videos/${video.id}?thumb=1`}
                  controls
                  preload="none"
                  playsInline
                />
                <div className="rss-gallery-card-footer">
                  <span>
                    {styleBadge} • {video.title || "RSS Video"} • {video.durationSeconds || 30} sn
                  </span>
                  <div className="rss-gallery-card-actions">
                    {video.storyboard ? (
                      <button
                        type="button"
                        onClick={() => onEditVideo(video)}
                        className="rss-gallery-load-btn"
                        title="Senaryoyu düzenleme paneline yükle"
                      >
                        <Pencil size={12} /> Senaryoyu Yükle
                      </button>
                    ) : null}
                    <a href={video.url} download={`rss-video-${video.id}.mp4`}>
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
                      className="rss-gallery-plan-link"
                    >
                      <Send size={13} /> Planla
                    </Link>
                    <button
                      type="button"
                      onClick={() => onDeleteVideo(video.id)}
                      disabled={deletingId === video.id}
                      className="rss-gallery-delete-btn"
                      title="Videoyu sil"
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
            );
          })}
        </div>
      ) : (
        <div className="history-empty">
          <Clapperboard size={23} />
          <span>Henüz RSS veya konu videosu üretilmedi.</span>
        </div>
      )}
    </section>
  );
}
