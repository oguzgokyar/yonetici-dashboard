"use client";

import {
  Bookmark,
  Check,
  Globe,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Music,
  Play,
  Repeat2,
  Send,
  Share2,
  ThumbsUp,
  Volume2,
  Youtube,
} from "lucide-react";

export function TikTokIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743 2.895 2.895 0 0 1 2.31-4.643c.294 0 .579.043.848.123V9.387a6.37 6.37 0 0 0-.848-.057A6.34 6.34 0 0 0 3.14 15.67a6.34 6.34 0 0 0 6.343 6.343 6.34 6.34 0 0 0 6.343-6.343V9.213a8.163 8.163 0 0 0 4.763 1.517v-3.44a4.8 4.8 0 0 1-1-.604z" />
    </svg>
  );
}

export function FacebookIcon({ size = 14, color = "#1877f2" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

export type PreviewPlatform = "instagram" | "youtube" | "tiktok" | "facebook";

export type PreviewProps = {
  platform: PreviewPlatform;
  mediaUrl?: string;
  thumbnailUrl?: string;
  contentType?: "image" | "video";
  postType?: "post" | "reel" | "story";
  title?: string;
  caption?: string;
  hashtags?: string;
  accountName?: string;
  accountHandle?: string;
  accountPicture?: string;
  packageItemCount?: number;
};

export function MultiPlatformPreview({
  platform,
  mediaUrl,
  thumbnailUrl,
  contentType = "image",
  postType = "post",
  title = "",
  caption = "",
  hashtags = "",
  accountName = "Sosyal Hesap",
  accountHandle = "markamotoru",
  accountPicture = "",
  packageItemCount,
}: PreviewProps) {
  const isVideo = contentType === "video" || mediaUrl?.endsWith(".mp4");
  const displayTitle = title.trim();
  const displayCaption = caption.trim();
  const cleanHandle = (accountHandle || "hesap").replace(/^@+/, "");
  const formattedHashtags = hashtags
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`))
    .join(" ");

  if (platform === "youtube") {
    const isShorts = postType === "reel" || (isVideo && displayTitle.toLowerCase().includes("shorts"));

    if (isShorts) {
      return (
        <div className="preview-phone-frame">
          <div className="preview-screen yt-shorts-screen">
            <div className="preview-active-platform-tag">
              <Youtube size={12} color="#ff0000" />
              <span>YouTube Shorts Önizlemesi</span>
            </div>

            {/* Background / Video */}
            <div className="preview-media-container">
              {isVideo && mediaUrl ? (
                <video src={mediaUrl} poster={thumbnailUrl} autoPlay loop muted playsInline />
              ) : (
                <img src={thumbnailUrl || mediaUrl || "/placeholder.png"} alt="" />
              )}
            </div>

            {/* Shorts Overlay Header */}
            <div className="shorts-top-bar">
              <span className="shorts-badge">Shorts</span>
              <div className="shorts-top-icons">
                <Volume2 size={16} />
                <MoreHorizontal size={18} />
              </div>
            </div>

            {/* Shorts Right Action Buttons */}
            <div className="shorts-actions-column">
              <div className="shorts-action-btn">
                <ThumbsUp size={20} />
                <span>1.4B</span>
              </div>
              <div className="shorts-action-btn">
                <MessageCircle size={20} />
                <span>84</span>
              </div>
              <div className="shorts-action-btn">
                <Share2 size={20} />
                <span>Paylaş</span>
              </div>
              <div className="shorts-action-btn">
                <Repeat2 size={20} />
                <span>Remix</span>
              </div>
              <div className="shorts-audio-disk">
                <Music size={13} />
              </div>
            </div>

            {/* Shorts Bottom Meta */}
            <div className="shorts-bottom-meta">
              <div className="shorts-channel-row">
                {accountPicture ? (
                  <img src={accountPicture} alt="" className="shorts-avatar" />
                ) : (
                  <div className="shorts-avatar placeholder">{accountName.slice(0, 1)}</div>
                )}
                <span className="shorts-channel-name">@{cleanHandle}</span>
                <button type="button" className="shorts-sub-btn">Abone Ol</button>
              </div>

              <p className="shorts-title">
                {displayTitle || displayCaption || "YouTube Shorts Başlığı"}
                {formattedHashtags && <span className="shorts-tags"> {formattedHashtags}</span>}
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Standard YouTube Video Preview
    return (
      <div className="preview-card yt-preview-card">
        <div className="preview-active-platform-tag static">
          <Youtube size={12} color="#ff0000" />
          <span>YouTube Standart Video Önizlemesi</span>
        </div>

        <div className="yt-card-header">
          <div className="yt-logo-badge">
            <Youtube size={16} style={{ color: "#ff0000" }} />
            <span>YouTube Video</span>
          </div>
        </div>

        <div className="yt-video-box">
          {isVideo && mediaUrl ? (
            <video src={mediaUrl} poster={thumbnailUrl} controls preload="metadata" />
          ) : (
            <div className="yt-media-thumb">
              <img src={thumbnailUrl || mediaUrl || "/placeholder.png"} alt="" />
              <div className="yt-play-badge"><Play size={20} fill="white" /></div>
            </div>
          )}
        </div>

        <div className="yt-meta-box">
          <div className="yt-channel-avatar">
            {accountPicture ? (
              <img src={accountPicture} alt="" />
            ) : (
              <div className="shorts-avatar placeholder">{accountName.slice(0, 1)}</div>
            )}
          </div>
          <div className="yt-info-col">
            <h4 className="yt-video-title">{displayTitle || "Video Başlığı"}</h4>
            <div className="yt-sub-line">
              <span>{accountName || "Kanal Adı"}</span> · <span>0 görüntüleme</span> · <span>Şimdi</span>
            </div>
            {displayCaption && <p className="yt-desc-snippet">{displayCaption}</p>}
            {formattedHashtags && <p className="yt-tags-snippet">{formattedHashtags}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (platform === "tiktok") {
    return (
      <div className="preview-phone-frame">
        <div className="preview-screen tiktok-screen">
          <div className="preview-active-platform-tag">
            <TikTokIcon size={12} color="#ffffff" />
            <span>TikTok Sizin İçin Önizlemesi</span>
          </div>

          <div className="preview-media-container">
            {isVideo && mediaUrl ? (
              <video src={mediaUrl} poster={thumbnailUrl} autoPlay loop muted playsInline />
            ) : (
              <img src={thumbnailUrl || mediaUrl || "/placeholder.png"} alt="" />
            )}
          </div>

          <div className="tiktok-top-tabs">
            <span>Canlı Yayın</span>
            <span className="active">Sizin İçin</span>
          </div>

          <div className="tiktok-actions-column">
            <div className="tiktok-profile-pic">
              {accountPicture ? (
                <img src={accountPicture} alt="" />
              ) : (
                <div className="tiktok-profile-placeholder">
                  {accountName ? accountName.slice(0, 1).toUpperCase() : "T"}
                </div>
              )}
              <span className="tiktok-plus">+</span>
            </div>
            <div className="tiktok-action-btn">
              <Heart size={20} fill="#ffffff" />
              <span>4.2B</span>
            </div>
            <div className="tiktok-action-btn">
              <MessageCircle size={20} fill="#ffffff" />
              <span>128</span>
            </div>
            <div className="tiktok-action-btn">
              <Bookmark size={20} fill="#ffffff" />
              <span>56</span>
            </div>
            <div className="tiktok-action-btn">
              <Share2 size={20} fill="#ffffff" />
              <span>Paylaş</span>
            </div>
            <div className="tiktok-record-disk">
              <Music size={12} />
            </div>
          </div>

          <div className="tiktok-bottom-meta">
            <strong style={{ fontSize: "12px", color: "white" }}>@{cleanHandle}</strong>
            <p className="tiktok-caption">
              {displayCaption || displayTitle || "TikTok açıklaması"}
              {formattedHashtags && <span className="tiktok-tags"> {formattedHashtags}</span>}
            </p>
            <div className="tiktok-sound-track">
              <Music size={11} />
              <span>Orijinal Ses - {accountName}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (platform === "facebook") {
    return (
      <div className="preview-card fb-preview-card">
        <div className="preview-active-platform-tag static">
          <FacebookIcon size={12} color="#1877f2" />
          <span>Facebook Gönderi Önizlemesi</span>
        </div>

        <div className="fb-post-header">
          <div className="fb-author-row">
            {accountPicture ? (
              <img src={accountPicture} alt="" className="fb-avatar" />
            ) : (
              <div className="fb-avatar placeholder">{accountName.slice(0, 1)}</div>
            )}
            <div>
              <div className="fb-author-name">
                {accountName}
                <span className="fb-verified-badge"><Check size={9} /></span>
              </div>
              <div className="fb-post-time">
                <span>Az önce</span> · <Globe size={11} />
              </div>
            </div>
          </div>
          <MoreHorizontal size={18} className="fb-more-icon" />
        </div>

        {displayCaption && (
          <div className="fb-caption-area">
            <p>{displayCaption}</p>
            {formattedHashtags && <p className="fb-tags">{formattedHashtags}</p>}
          </div>
        )}

        <div className="fb-media-container">
          {isVideo && mediaUrl ? (
            <video src={mediaUrl} poster={thumbnailUrl} controls preload="metadata" />
          ) : (
            <img src={thumbnailUrl || mediaUrl || "/placeholder.png"} alt="" />
          )}
        </div>

        <div className="fb-post-stats">
          <span><ThumbsUp size={12} fill="#1877f2" color="#1877f2" /> 24</span>
          <span>3 yorum · 2 paylaşım</span>
        </div>

        <div className="fb-action-bar">
          <button type="button"><ThumbsUp size={15} /> Beğen</button>
          <button type="button"><MessageCircle size={15} /> Yorum Yap</button>
          <button type="button"><Share2 size={15} /> Paylaş</button>
        </div>
      </div>
    );
  }

  // Default: Instagram (Feed / Reel / Story)
  if (postType === "reel") {
    return (
      <div className="preview-phone-frame">
        <div className="preview-screen ig-reels-screen">
          <div className="preview-active-platform-tag">
            <span style={{ color: "#e1306c" }}>●</span>
            <span>Instagram Reels Önizlemesi</span>
          </div>

          <div className="preview-media-container">
            {isVideo && mediaUrl ? (
              <video src={mediaUrl} poster={thumbnailUrl} autoPlay loop muted playsInline />
            ) : (
              <img src={thumbnailUrl || mediaUrl || "/placeholder.png"} alt="" />
            )}
          </div>

          <div className="ig-reels-top-bar">
            <span>Reels</span>
          </div>

          <div className="ig-reels-actions">
            <div className="ig-reels-btn">
              <Heart size={20} />
              <span>3.8B</span>
            </div>
            <div className="ig-reels-btn">
              <MessageCircle size={20} />
              <span>42</span>
            </div>
            <div className="ig-reels-btn">
              <Send size={20} />
            </div>
            <div className="ig-reels-btn">
              <Bookmark size={20} />
            </div>
            <div className="ig-reels-btn">
              <MoreHorizontal size={20} />
            </div>
          </div>

          <div className="ig-reels-meta">
            <div className="ig-reels-author">
              {accountPicture ? (
                <img src={accountPicture} alt="" className="ig-reels-avatar" />
              ) : (
                <div className="ig-reels-avatar placeholder">{accountName.slice(0, 1)}</div>
              )}
              <strong>@{cleanHandle}</strong>
              <button type="button" className="ig-follow-btn">Takip Et</button>
            </div>

            <p className="ig-reels-caption">
              {displayCaption || displayTitle || "Instagram Reels Açıklaması"}
              {formattedHashtags && <span className="ig-tags"> {formattedHashtags}</span>}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Instagram Feed Post
  return (
    <div className="preview-card ig-preview-card">
      <div className="preview-active-platform-tag static">
        <span style={{ color: "#e1306c" }}>●</span>
        <span>Instagram Feed Gönderi Önizlemesi</span>
      </div>

      <div className="ig-header">
        <div className="ig-user-info">
          {accountPicture ? (
            <img src={accountPicture} alt="" className="ig-avatar" />
          ) : (
            <div className="ig-avatar placeholder">{accountName.slice(0, 1)}</div>
          )}
          <span className="ig-username">@{cleanHandle}</span>
        </div>
        <MoreHorizontal size={18} />
      </div>

      <div className="ig-media-box">
        {isVideo && mediaUrl ? (
          <video src={mediaUrl} poster={thumbnailUrl} autoPlay loop muted playsInline />
        ) : (
          <img src={thumbnailUrl || mediaUrl || "/placeholder.png"} alt="" />
        )}
        {packageItemCount && packageItemCount > 1 && (
          <div className="ig-carousel-badge">1/{packageItemCount}</div>
        )}
      </div>

      <div className="ig-action-bar">
        <div className="ig-left-actions">
          <Heart size={20} />
          <MessageCircle size={20} />
          <Send size={19} />
        </div>
        <Bookmark size={20} />
      </div>

      <div className="ig-content-box">
        <span className="ig-likes">182 beğenme</span>
        <div className="ig-caption-text">
          <strong>@{cleanHandle} </strong>
          <span>{displayCaption || displayTitle || "Gönderi açıklaması buraya gelecek..."}</span>
          {formattedHashtags && <div className="ig-tags">{formattedHashtags}</div>}
        </div>
        <span className="ig-time">1 saat önce</span>
      </div>
    </div>
  );
}
