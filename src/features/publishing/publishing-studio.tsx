"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Instagram,
  LoaderCircle,
  Megaphone,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Share2,
  Sparkles,
  Trash2,
  Video,
  X,
} from "lucide-react";

type ConnectedAccount = {
  id: string;
  integrationId: string;
  name: string;
  identifier: string;
  profile: string;
  picture: string;
};

type PostRecord = {
  id: string;
  projectId: string;
  title: string;
  contentType: "image" | "video";
  mediaUrl: string;
  caption: string;
  hashtags: string;
  status: "draft" | "scheduled" | "published" | "failed";
  scheduleType: "now" | "schedule" | "draft";
  scheduledAt?: string;
  integrationId: string;
  postType: "post" | "reel" | "story";
  postizPostId?: string;
  releaseUrl?: string;
  errorMessage?: string;
  createdAt: string;
};

type RecentAsset = {
  id: string;
  type: "image" | "video";
  url: string;
  prompt?: string;
  idea?: {
    id?: string;
    title?: string;
    concept?: string;
  };
  sourceTopic?: string;
  createdAt?: string;
};

export function PublishingStudio({
  projectId,
  initialAssetId,
}: {
  projectId: string;
  initialAssetId?: string;
}) {
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "scheduled" | "published" | "draft">("all");
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [selectedIntegration, setSelectedIntegration] = useState("");
  const [postType, setPostType] = useState<"post" | "reel" | "story">("post");
  const [scheduleType, setScheduleType] = useState<"now" | "schedule" | "draft">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<RecentAsset | null>(null);
  const [customMediaUrl, setCustomMediaUrl] = useState("");
  const [mediaSourceTab, setMediaSourceTab] = useState<"recent" | "custom">("recent");

  // AI Copy Generator State
  const [aiStyle, setAiStyle] = useState<"sales" | "story" | "educational" | "punchy">("sales");
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Recent generated assets
  const [recentAssets, setRecentAssets] = useState<RecentAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [postsRes, accRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/posts`),
        fetch(`/api/projects/${projectId}/accounts`),
      ]);

      if (postsRes.ok) {
        const pJson = await postsRes.json();
        setPosts(pJson.posts || []);
      }
      if (accRes.ok) {
        const aJson = await accRes.json();
        setAccounts(aJson.connected || []);
        if (aJson.connected?.length > 0 && !selectedIntegration) {
          setSelectedIntegration(aJson.connected[0].integrationId);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function applyAssetSelection(asset: RecentAsset) {
    setSelectedMedia(asset);
    if (asset.type === "video") setPostType("reel");
    setCopyFeedback(null);

    // If an idea was chosen during generation, use it
    if (asset.idea?.title || asset.idea?.concept) {
      setTitle(asset.idea.title || "");
      setCaption(asset.idea.concept || "");
    } else if (asset.sourceTopic) {
      setTitle(asset.sourceTopic.slice(0, 50));
      setCaption(asset.sourceTopic);
    } else {
      const clean = (asset.prompt || "")
        .split("\nİçerik tipi:")[0]
        .split("\nPlatform:")[0]
        .trim();
      setTitle(clean.slice(0, 50));
      setCaption(clean);
    }
  }

  async function generateAiCopy() {
    setGeneratingCopy(true);
    setCopyFeedback(null);
    setError(null);
    try {
      const response = await fetch("/api/ai/posts/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          postType,
          style: aiStyle,
          idea: selectedMedia?.idea,
          sourceTopic: selectedMedia?.sourceTopic || caption || title,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.ok || !result.copy) {
        throw new Error(result.message || "Metin üretilemedi.");
      }

      if (result.copy.title) setTitle(result.copy.title);
      if (result.copy.caption) setCaption(result.copy.caption);
      if (result.copy.hashtags) setHashtags(result.copy.hashtags);
      setCopyFeedback("Sosyal medya metni ve etiketler AI ile başarıyla üretildi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingCopy(false);
    }
  }

  async function loadRecentAssets(targetId?: string) {
    setLoadingAssets(true);
    try {
      const [imgRes, vidRes] = await Promise.all([
        fetch(`/api/ai/images?projectId=${projectId}`).catch(() => null),
        fetch(`/api/videos?projectId=${projectId}`).catch(() => null),
      ]);

      const items: RecentAsset[] = [];
      if (imgRes && imgRes.ok) {
        const imgData = await imgRes.json();
        (imgData.assets || []).forEach(
          (a: {
            id: string;
            url: string;
            prompt?: string;
            idea?: { id?: string; title?: string; concept?: string };
            sourceTopic?: string;
            createdAt?: string;
          }) => {
            items.push({
              id: a.id,
              type: "image",
              url: a.url,
              prompt: a.prompt,
              idea: a.idea,
              sourceTopic: a.sourceTopic,
              createdAt: a.createdAt,
            });
          }
        );
      }
      if (vidRes && vidRes.ok) {
        const vidData = await vidRes.json();
        (vidData.videos || []).forEach(
          (v: {
            id: string;
            url: string;
            prompt?: string;
            idea?: { id?: string; title?: string; concept?: string };
            sourceTopic?: string;
            createdAt?: string;
          }) => {
            items.push({
              id: v.id,
              type: "video",
              url: v.url || `/api/videos/${v.id}`,
              prompt: v.prompt,
              idea: v.idea,
              sourceTopic: v.sourceTopic,
              createdAt: v.createdAt,
            });
          }
        );
      }
      setRecentAssets(items);

      const target = targetId ? items.find((i) => i.id === targetId) : null;
      if (target) {
        applyAssetSelection(target);
      } else if (items.length > 0 && !selectedMedia) {
        applyAssetSelection(items[0]);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAssets(false);
    }
  }

  useEffect(() => {
    loadData();
    if (initialAssetId) {
      setModalOpen(true);
      loadRecentAssets(initialAssetId);
      const d = new Date(Date.now() + 24 * 3600 * 1000);
      setScheduledAt(d.toISOString().slice(0, 16));
    }
  }, [projectId, initialAssetId]);

  function openCreateModal() {
    setModalOpen(true);
    setError(null);
    setSuccess(null);
    loadRecentAssets();
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    setScheduledAt(d.toISOString().slice(0, 16));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedIntegration) {
      setError("Lütfen bir sosyal medya hesabı seçin.");
      return;
    }

    const mediaUrl = mediaSourceTab === "recent" ? selectedMedia?.url : customMediaUrl;
    if (!mediaUrl) {
      setError("Lütfen paylaşılacak bir görsel veya video seçin.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const isVideo = mediaSourceTab === "recent" ? selectedMedia?.type === "video" : mediaUrl.endsWith(".mp4");
    const formattedDate = scheduleType === "schedule" && scheduledAt ? new Date(scheduledAt).toISOString() : undefined;

    try {
      const response = await fetch(`/api/projects/${projectId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || (isVideo ? "Video Paylaşımı" : "Görsel Paylaşımı"),
          contentType: isVideo ? "video" : "image",
          mediaUrl,
          assetId: mediaSourceTab === "recent" ? selectedMedia?.id : undefined,
          caption,
          hashtags,
          scheduleType,
          scheduledAt: formattedDate,
          integrationId: selectedIntegration,
          postType,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Gönderi oluşturulamadı.");

      setSuccess(result.message || "Gönderi başarıyla oluşturuldu.");
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function deletePost(id: string) {
    if (!confirm("Bu gönderiyi ve varsa Postiz kaydını silmek istediğinize emin misiniz?")) return;
    try {
      const response = await fetch(`/api/projects/${projectId}/posts?id=${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Silme işlemi başarısız.");
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  const filteredPosts = posts.filter((p) => {
    if (filter === "all") return true;
    return p.status === filter;
  });

  const countPublished = posts.filter((p) => p.status === "published").length;
  const countScheduled = posts.filter((p) => p.status === "scheduled").length;
  const countDraft = posts.filter((p) => p.status === "draft").length;

  if (loading) {
    return <div className="overview-loading" style={{ minHeight: "380px" }} />;
  }

  return (
    <>
      {/* 1. Page Intro */}
      <section className="page-intro">
        <div>
          <h2>Paylaşım Planı &amp; Dağıtım</h2>
          <p>Üretilen kreatifleri zamanlayın, Instagram ve diğer kanallara Postiz üzerinden otomatik dağıtın.</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={loadData}
            className="button secondary"
            disabled={loading}
            title="Yenile"
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            Yenile
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            disabled={accounts.length === 0}
            className="button primary"
          >
            <Plus size={15} />
            Yeni İçerik Planla
          </button>
        </div>
      </section>

      {/* Account Warning if None Connected */}
      {accounts.length === 0 && (
        <section className="setup-banner" style={{ margin: "16px 0" }}>
          <div className="setup-icon" style={{ background: "#fff2e8", color: "#d67c34" }}>
            <CircleAlert size={20} />
          </div>
          <div>
            <strong>Bağlı Sosyal Medya Hesabı Bulunamadı</strong>
            <p>İçerik planlayabilmek için bu projeye en az bir Postiz Instagram hesabı bağlamalısınız.</p>
          </div>
          <Link href={`/projects/${projectId}/accounts`} className="button secondary">
            <Share2 size={15} />
            Hesaplar Sayfasına Git
          </Link>
        </section>
      )}

      {/* Feedback Alerts */}
      {success && (
        <div className="connection-result success" style={{ margin: "12px 0" }}>
          <CheckCircle2 size={16} />
          <span><strong>Başarılı</strong><small>{success}</small></span>
        </div>
      )}
      {error && (
        <div className="connection-result error" style={{ margin: "12px 0" }}>
          <CircleAlert size={16} />
          <span><strong>Hata</strong><small>{error}</small></span>
        </div>
      )}

      {/* 2. Metrics Bar */}
      <section className="metric-grid">
        <div className="metric-card">
          <div className="metric-icon violet"><Megaphone size={19} /></div>
          <div>
            <span>Toplam Gönderi</span>
            <strong>{posts.length}</strong>
            <small>Kayıtlı İçerik</small>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon blue"><Clock size={19} /></div>
          <div>
            <span>Zamanlananlar</span>
            <strong>{countScheduled}</strong>
            <small>Kuyrukta Bekleyen</small>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon green"><CheckCircle2 size={19} /></div>
          <div>
            <span>Yayınlananlar</span>
            <strong>{countPublished}</strong>
            <small>Canlı Paylaşım</small>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon orange"><CalendarClock size={19} /></div>
          <div>
            <span>Taslaklar</span>
            <strong>{countDraft}</strong>
            <small>Hazırlık Aşamasında</small>
          </div>
        </div>
      </section>

      {/* 3. Toolbar & Filter */}
      <div className="publishing-toolbar">
        <div className="segmented-filter">
          <button
            type="button"
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            Tümü ({posts.length})
          </button>
          <button
            type="button"
            className={filter === "scheduled" ? "active" : ""}
            onClick={() => setFilter("scheduled")}
          >
            Zamanlanan ({countScheduled})
          </button>
          <button
            type="button"
            className={filter === "published" ? "active" : ""}
            onClick={() => setFilter("published")}
          >
            Yayınlanan ({countPublished})
          </button>
          <button
            type="button"
            className={filter === "draft" ? "active" : ""}
            onClick={() => setFilter("draft")}
          >
            Taslak ({countDraft})
          </button>
        </div>

        {accounts.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>Aktif Kanal:</span>
            <span className="badge-pill info">
              <Instagram size={11} /> @{accounts[0]?.profile || accounts[0]?.name}
            </span>
          </div>
        )}
      </div>

      {/* 4. Posts Grid */}
      {filteredPosts.length > 0 ? (
        <div className="publishing-grid">
          {filteredPosts.map((post) => {
            const acc = accounts.find((a) => a.integrationId === post.integrationId);
            return (
              <article key={post.id} className="publishing-card">
                {/* Media Preview Header */}
                <div className="publishing-media">
                  {post.contentType === "video" ? (
                    <video
                      src={post.mediaUrl}
                      muted
                      loop
                      playsInline
                      onMouseOver={(e) => (e.target as HTMLVideoElement).play().catch(() => undefined)}
                      onMouseOut={(e) => (e.target as HTMLVideoElement).pause()}
                    />
                  ) : (
                    <img
                      src={post.mediaUrl.startsWith("/api/assets/") ? `${post.mediaUrl}?thumb=1` : post.mediaUrl}
                      alt={post.title}
                      loading="lazy"
                    />
                  )}

                  <div className="publishing-badge-top-left">
                    <span className="badge-pill neutral" style={{ background: "#000000a6", color: "white" }}>
                      {post.contentType === "video" ? <Film size={10} /> : <ImageIcon size={10} />}
                      {post.postType === "reel" ? "Reels" : post.postType === "story" ? "Hikâye" : "Gönderi"}
                    </span>
                  </div>

                  <div className="publishing-badge-top-right">
                    <span
                      className={`badge-pill ${
                        post.status === "published"
                          ? "success"
                          : post.status === "scheduled"
                          ? "info"
                          : post.status === "draft"
                          ? "neutral"
                          : "error"
                      }`}
                      style={{ backdropFilter: "blur(4px)" }}
                    >
                      {post.status === "published"
                        ? "Yayınlandı"
                        : post.status === "scheduled"
                        ? "Zamanlandı"
                        : post.status === "draft"
                        ? "Taslak"
                        : "Hata"}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="publishing-body">
                  <div className="publishing-account-row">
                    {acc?.picture ? (
                      <img src={acc.picture} alt="" />
                    ) : (
                      <Instagram size={14} style={{ color: "#612bd3" }} />
                    )}
                    <span style={{ fontWeight: 600 }}>
                      {acc?.profile ? `@${acc.profile}` : acc?.name || "Sosyal Hesap"}
                    </span>
                  </div>

                  <h4 className="publishing-title">{post.title || "İsimsiz Gönderi"}</h4>
                  <p className="publishing-caption">
                    {post.caption || "Açıklama girilmedi."}
                  </p>
                  {post.hashtags && (
                    <p className="publishing-tags">{post.hashtags}</p>
                  )}

                  {/* Footer */}
                  <div className="publishing-footer">
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <Calendar size={12} />
                      {post.scheduledAt
                        ? new Date(post.scheduledAt).toLocaleDateString("tr-TR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : new Date(post.createdAt).toLocaleDateString("tr-TR", {
                            day: "numeric",
                            month: "short",
                          })}
                    </span>

                    <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                      {post.releaseUrl && (
                        <a
                          href={post.releaseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="icon-button"
                          style={{ width: "28px", height: "28px", color: "var(--primary)" }}
                          title="Canlı Gönderiyi Aç"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => deletePost(post.id)}
                        className="icon-button"
                        style={{ width: "28px", height: "28px", color: "#d83d45" }}
                        title="Sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="panel-empty" style={{ minHeight: "240px", marginTop: "18px" }}>
          <div><CalendarClock size={24} /></div>
          <strong>Bu filtrede gösterilecek içerik yok</strong>
          <p>"Yeni İçerik Planla" butonuna tıklayarak üretilmiş kreatiflerinizi sosyal medyada yayınlayabilir veya takvime ekleyebilirsiniz.</p>
        </div>
      )}

      {/* 5. Create / Schedule Modal */}
      {modalOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !submitting) setModalOpen(false);
          }}
        >
          <section className="modal schedule-modal">
            <button
              type="button"
              className="icon-button modal-close"
              onClick={() => setModalOpen(false)}
              disabled={submitting}
              aria-label="Kapat"
            >
              <X size={18} />
            </button>

            <div className="modal-icon">
              <Megaphone size={20} />
            </div>

            <h2>Yeni İçerik Planla / Yayınla</h2>
            <p>Kreatifinizi seçin, açıklama ve zamanlama belirleyerek doğrudan Postiz kuyruğuna gönderin.</p>

            {error && (
              <div className="connection-result error" style={{ marginBottom: "14px" }}>
                <CircleAlert size={16} />
                <span><strong>Hata</strong><small>{error}</small></span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
              {/* Media Selection */}
              <div>
                <label className="field-label">
                  1. Medya Seçimi
                  <div style={{ display: "flex", gap: "6px", margin: "4px 0 8px" }}>
                    <button
                      type="button"
                      onClick={() => setMediaSourceTab("recent")}
                      className={`button ${mediaSourceTab === "recent" ? "primary" : "secondary"}`}
                      style={{ height: "32px", fontSize: "11px", padding: "0 12px" }}
                    >
                      Üretilenlerden Seç
                    </button>
                    <button
                      type="button"
                      onClick={() => setMediaSourceTab("custom")}
                      className={`button ${mediaSourceTab === "custom" ? "primary" : "secondary"}`}
                      style={{ height: "32px", fontSize: "11px", padding: "0 12px" }}
                    >
                      Özel Medya URL
                    </button>
                  </div>
                </label>

                {mediaSourceTab === "recent" ? (
                  <div>
                    {loadingAssets ? (
                      <div className="overview-loading" style={{ minHeight: "100px" }} />
                    ) : recentAssets.length > 0 ? (
                      <div className="media-picker-grid">
                        {recentAssets.map((asset) => {
                          const isSelected = selectedMedia?.id === asset.id;
                          return (
                            <button
                              key={asset.id}
                              type="button"
                              onClick={() => applyAssetSelection(asset)}
                              className={`media-picker-item ${isSelected ? "selected" : ""}`}
                            >
                              {asset.type === "video" ? (
                                <div style={{ width: "100%", height: "100%", background: "#111", display: "grid", placeItems: "center", color: "white" }}>
                                  <Video size={18} />
                                </div>
                              ) : (
                                <img
                                  src={asset.url.startsWith("/api/assets/") ? `${asset.url}?thumb=1` : asset.url}
                                  alt=""
                                  loading="lazy"
                                />
                              )}
                              <span>{asset.type === "video" ? "MP4" : "IMG"}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="panel-empty" style={{ minHeight: "100px" }}>
                        <p>Bu projede henüz üretilmiş görsel veya video bulunamadı.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="field-label">
                    <input
                      type="url"
                      value={customMediaUrl}
                      onChange={(e) => setCustomMediaUrl(e.target.value)}
                      placeholder="https://.../video.mp4 veya görsel linki"
                    />
                  </div>
                )}
              </div>

              {/* Account Selection */}
              <div>
                <label className="field-label">
                  2. Hedef Sosyal Medya Hesabı
                </label>
                <div className="account-select-grid">
                  {accounts.map((acc) => {
                    const isSelected = selectedIntegration === acc.integrationId;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setSelectedIntegration(acc.integrationId)}
                        className={`account-select-chip ${isSelected ? "selected" : ""}`}
                      >
                        {acc.picture ? (
                          <img src={acc.picture} alt="" />
                        ) : (
                          <Instagram size={18} style={{ color: "#612bd3" }} />
                        )}
                        <div style={{ minWidth: 0 }}>
                          <strong>{acc.name}</strong>
                          <small>@{acc.profile || acc.identifier}</small>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Format & Title */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label className="field-label">
                  3. Format
                  <select
                    value={postType}
                    onChange={(e) => setPostType(e.target.value as "post" | "reel" | "story")}
                    style={{
                      width: "100%",
                      height: "40px",
                      border: "1px solid #dedfe6",
                      borderRadius: "10px",
                      padding: "0 10px",
                      background: "white",
                      fontSize: "12px",
                    }}
                  >
                    <option value="post">Instagram Gönderi (Feed)</option>
                    <option value="reel">Instagram Reels</option>
                    <option value="story">Instagram Hikâye (Story)</option>
                  </select>
                </label>

                <label className="field-label">
                  Başlık (Dahili Not)
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Örn: Hafta Sonu Kampanyası"
                  />
                </label>
              </div>

              {/* Caption & Hashtags with AI Assistant */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "6px" }}>
                  <label className="field-label" style={{ margin: 0, fontWeight: 700 }}>
                    4. Açıklama &amp; Reklam Metni
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <select
                      value={aiStyle}
                      onChange={(e) => setAiStyle(e.target.value as any)}
                      style={{
                        height: "28px",
                        border: "1px solid #dedfe6",
                        borderRadius: "8px",
                        padding: "0 8px",
                        background: "white",
                        fontSize: "11px",
                      }}
                    >
                      <option value="sales">🎯 Satış &amp; Teklif</option>
                      <option value="story">📖 Hikâye Anlatımı</option>
                      <option value="educational">💡 Eğitici &amp; Değer</option>
                      <option value="punchy">⚡ Kısa &amp; Çarpıcı</option>
                    </select>
                    <button
                      type="button"
                      onClick={generateAiCopy}
                      disabled={generatingCopy}
                      className="button secondary"
                      style={{ height: "28px", fontSize: "11px", padding: "0 10px", color: "var(--primary)" }}
                    >
                      {generatingCopy ? <LoaderCircle className="spin" size={13} /> : <Sparkles size={13} />}
                      {generatingCopy ? "Üretiliyor..." : "AI ile Metin Üret"}
                    </button>
                  </div>
                </div>

                {selectedMedia?.idea ? (
                  <div style={{ padding: "6px 10px", background: "#f3f0ff", borderRadius: "8px", border: "1px solid #e1dcff", marginBottom: "8px", fontSize: "11px", color: "#5647d7" }}>
                    <strong>Seçilen İçerik Fikri:</strong> {selectedMedia.idea.title}
                  </div>
                ) : selectedMedia?.sourceTopic ? (
                  <div style={{ padding: "6px 10px", background: "#f8f8fc", borderRadius: "8px", border: "1px solid #e2e3ea", marginBottom: "8px", fontSize: "11px", color: "#555866" }}>
                    <strong>Ana Konu:</strong> {selectedMedia.sourceTopic}
                  </div>
                ) : null}

                {copyFeedback && (
                  <div style={{ fontSize: "11px", color: "#278862", marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <CheckCircle2 size={12} /> {copyFeedback}
                  </div>
                )}

                <div className="field-label">
                  <textarea
                    rows={4}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Sosyal medyada takipçilerin göreceği açıklama metni..."
                  />
                </div>
              </div>

              <label className="field-label">
                Hashtag'ler
                <input
                  type="text"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="#marka #reels #keşfet"
                  style={{ fontFamily: "monospace" }}
                />
              </label>

              {/* Schedule Type */}
              <div>
                <label className="field-label">
                  5. Yayınlama Zamanı
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px", margin: "6px 0 10px" }}>
                  {(
                    [
                      { id: "now", label: "⚡ Hemen Paylaş" },
                      { id: "schedule", label: "📅 Zamanla" },
                      { id: "draft", label: "📝 Taslak Kaydet" },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setScheduleType(t.id)}
                      className={`button ${scheduleType === t.id ? "primary" : "secondary"}`}
                      style={{ height: "36px", fontSize: "11px", padding: "0 8px" }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {scheduleType === "schedule" && (
                  <div className="field-label">
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="button secondary"
                  disabled={submitting}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="button primary"
                >
                  {submitting ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <Send size={15} />
                  )}
                  {submitting
                    ? "Gönderiliyor..."
                    : scheduleType === "now"
                    ? "Hemen Paylaş"
                    : scheduleType === "schedule"
                    ? "Zamanla"
                    : "Taslak Olarak Kaydet"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
