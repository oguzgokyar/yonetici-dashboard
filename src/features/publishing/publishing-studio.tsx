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
  FolderOpen,
  Image as ImageIcon,
  Instagram,
  Layers,
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
  createdAt?: string;
};

export function PublishingStudio({ projectId }: { projectId: string }) {
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "published" | "scheduled" | "draft" | "failed">("all");
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

  async function loadRecentAssets() {
    setLoadingAssets(true);
    try {
      const [imgRes, vidRes] = await Promise.all([
        fetch(`/api/ai/images?projectId=${projectId}`).catch(() => null),
        fetch(`/api/videos?projectId=${projectId}`).catch(() => null),
      ]);

      const items: RecentAsset[] = [];
      if (imgRes && imgRes.ok) {
        const imgData = await imgRes.json();
        (imgData.assets || []).forEach((a: { id: string; url: string; prompt?: string; createdAt?: string }) => {
          items.push({ id: a.id, type: "image", url: a.url, prompt: a.prompt, createdAt: a.createdAt });
        });
      }
      if (vidRes && vidRes.ok) {
        const vidData = await vidRes.json();
        (vidData.videos || []).forEach((v: { id: string; url: string; prompt?: string; createdAt?: string }) => {
          items.push({ id: v.id, type: "video", url: v.url || `/api/videos/${v.id}`, prompt: v.prompt, createdAt: v.createdAt });
        });
      }
      setRecentAssets(items);
      if (items.length > 0 && !selectedMedia) {
        setSelectedMedia(items[0]);
        if (items[0].prompt) {
          setCaption(items[0].prompt);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingAssets(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [projectId]);

  function openCreateModal() {
    setModalOpen(true);
    setError(null);
    setSuccess(null);
    loadRecentAssets();
    // set default schedule date to tomorrow same time
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

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Top Bar / Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone size={20} className="text-[#612bd3]" />
            <h2 className="text-lg font-bold">Paylaşım Planı &amp; Dağıtım</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Görsel ve videolarınızı Postiz üzerinden Instagram Reels, Gönderi veya Hikâye olarak planlayın.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            className="button secondary text-xs"
            disabled={loading}
            title="Yenile"
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            Yenile
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            disabled={accounts.length === 0}
            className="button primary text-xs flex items-center gap-1.5"
          >
            <Plus size={15} />
            Yeni İçerik Planla
          </button>
        </div>
      </div>

      {/* Account Warning if None Connected */}
      {accounts.length === 0 && !loading && (
        <div className="connection-result error flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-amber-600 dark:text-amber-400">
          <CircleAlert size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <strong>Bağlı Sosyal Medya Hesabı Bulunamadı</strong>
            <p className="mt-1">
              İçerik planlayabilmek için bu projeye en az bir Postiz Instagram hesabı bağlamalısınız.
            </p>
            <Link
              href={`/projects/${projectId}/accounts`}
              className="button secondary mt-3 inline-flex text-xs"
            >
              <Share2 size={14} className="mr-1" />
              Hesaplar Sayfasına Git
            </Link>
          </div>
        </div>
      )}

      {/* 2. Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="panel flex flex-col justify-center p-4">
          <span className="text-xs text-muted-foreground font-medium">Toplam Gönderi</span>
          <strong className="text-2xl font-bold mt-1">{posts.length}</strong>
        </div>
        <div className="panel flex flex-col justify-center p-4">
          <span className="text-xs text-blue-500 font-medium flex items-center gap-1">
            <Clock size={13} /> Zamanlananlar
          </span>
          <strong className="text-2xl font-bold text-blue-500 mt-1">{countScheduled}</strong>
        </div>
        <div className="panel flex flex-col justify-center p-4">
          <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
            <CheckCircle2 size={13} /> Yayınlananlar
          </span>
          <strong className="text-2xl font-bold text-emerald-500 mt-1">{countPublished}</strong>
        </div>
        <div className="panel flex flex-col justify-center p-4">
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <CalendarClock size={13} /> Taslaklar
          </span>
          <strong className="text-2xl font-bold mt-1">{countDraft}</strong>
        </div>
      </div>

      {/* 3. Filter Tabs */}
      <div className="flex items-center gap-2 border-b pb-3">
        {(
          [
            { id: "all", label: "Tümü" },
            { id: "scheduled", label: `Zamanlanan (${countScheduled})` },
            { id: "published", label: `Yayınlanan (${countPublished})` },
            { id: "draft", label: `Taslak (${countDraft})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filter === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 4. Posts List */}
      {filteredPosts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPosts.map((post) => {
            const acc = accounts.find((a) => a.integrationId === post.integrationId);
            return (
              <div
                key={post.id}
                className="flex flex-col rounded-xl border bg-card overflow-hidden shadow-sm hover:border-primary/40 transition-colors"
              >
                {/* Media Preview Header */}
                <div className="relative aspect-video bg-muted flex items-center justify-center overflow-hidden">
                  {post.contentType === "video" ? (
                    <video
                      src={post.mediaUrl}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      playsInline
                      onMouseOver={(e) => (e.target as HTMLVideoElement).play().catch(() => undefined)}
                      onMouseOut={(e) => (e.target as HTMLVideoElement).pause()}
                    />
                  ) : (
                    <img
                      src={post.mediaUrl}
                      alt={post.title}
                      className="w-full h-full object-cover"
                    />
                  )}

                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm flex items-center gap-1">
                      {post.contentType === "video" ? <Film size={11} /> : <ImageIcon size={11} />}
                      {post.postType === "reel" ? "Reels" : post.postType === "story" ? "Hikâye" : "Gönderi"}
                    </span>
                  </div>

                  <div className="absolute top-2 right-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm ${
                        post.status === "published"
                          ? "bg-emerald-500/90 text-white"
                          : post.status === "scheduled"
                          ? "bg-blue-500/90 text-white"
                          : post.status === "draft"
                          ? "bg-neutral-600/90 text-white"
                          : "bg-red-500/90 text-white"
                      }`}
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
                <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {acc?.picture ? (
                        <img
                          src={acc.picture}
                          alt={acc.name}
                          className="w-5 h-5 rounded-full object-cover border"
                        />
                      ) : (
                        <Instagram size={14} className="text-[#612bd3]" />
                      )}
                      <span className="text-xs font-semibold text-muted-foreground truncate">
                        {acc?.profile ? `@${acc.profile}` : acc?.name || "Sosyal Hesap"}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold truncate">{post.title || "İsimsiz Gönderi"}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {post.caption || "Açıklama girilmedi."}
                    </p>
                    {post.hashtags && (
                      <p className="text-[11px] text-primary/80 line-clamp-1 mt-1 font-mono">
                        {post.hashtags}
                      </p>
                    )}
                  </div>

                  {/* Footer / Date & Actions */}
                  <div className="pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} />
                      <span>
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
                    </div>

                    <div className="flex items-center gap-1">
                      {post.releaseUrl && (
                        <a
                          href={post.releaseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="button ghost p-1.5 text-primary hover:text-primary"
                          title="Canlı Gönderiyi Aç"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => deletePost(post.id)}
                        className="button ghost p-1.5 text-red-500 hover:text-red-600"
                        title="Sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="panel-empty flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-xl">
          <CalendarClock size={36} className="text-muted-foreground/40 mb-3" />
          <strong className="text-sm">Bu filtrede gösterilecek içerik yok</strong>
          <p className="text-xs text-muted-foreground max-w-sm mt-1">
            "Yeni İçerik Planla" butonuna tıklayarak üretilmiş kreatiflerinizi sosyal medyada yayınlayabilir veya takvime ekleyebilirsiniz.
          </p>
        </div>
      )}

      {/* 5. Create / Schedule Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl text-card-foreground">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Megaphone size={20} className="text-[#612bd3]" />
              <h3 className="text-base font-bold">Yeni İçerik Planla / Yayınla</h3>
            </div>

            {error && (
              <div className="connection-result error flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500 mb-4">
                <CircleAlert size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Media Selection Tabs */}
              <div>
                <label className="text-xs font-semibold block mb-2">1. Medya Seçimi</label>
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setMediaSourceTab("recent")}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      mediaSourceTab === "recent"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    Üretilenlerden Seç
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaSourceTab("custom")}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      mediaSourceTab === "custom"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    Özel Medya URL
                  </button>
                </div>

                {mediaSourceTab === "recent" ? (
                  <div className="border rounded-xl p-3 bg-muted/20">
                    {loadingAssets ? (
                      <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                        <LoaderCircle className="spin mr-2" size={16} />
                        Kreatifler listeleniyor...
                      </div>
                    ) : recentAssets.length > 0 ? (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1">
                        {recentAssets.map((asset) => {
                          const isSelected = selectedMedia?.id === asset.id;
                          return (
                            <button
                              key={asset.id}
                              type="button"
                              onClick={() => {
                                setSelectedMedia(asset);
                                if (asset.prompt && !caption) setCaption(asset.prompt);
                                if (asset.type === "video") setPostType("reel");
                              }}
                              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                                isSelected ? "border-[#612bd3] ring-2 ring-[#612bd3]/30 scale-95" : "border-transparent opacity-75 hover:opacity-100"
                              }`}
                            >
                              {asset.type === "video" ? (
                                <div className="w-full h-full bg-black flex items-center justify-center text-white">
                                  <Video size={18} />
                                </div>
                              ) : (
                                <img src={asset.url} alt="" className="w-full h-full object-cover" />
                              )}
                              <span className="absolute bottom-1 right-1 text-[9px] bg-black/70 text-white px-1 rounded">
                                {asset.type === "video" ? "MP4" : "IMG"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Bu projede henüz üretilmiş görsel veya video bulunamadı.
                      </p>
                    )}
                  </div>
                ) : (
                  <input
                    type="url"
                    value={customMediaUrl}
                    onChange={(e) => setCustomMediaUrl(e.target.value)}
                    placeholder="https://.../video.mp4 veya görsel linki"
                    className="w-full rounded-lg border bg-background p-2.5 text-xs"
                  />
                )}
              </div>

              {/* Account Selection */}
              <div>
                <label className="text-xs font-semibold block mb-2">2. Hedef Sosyal Medya Hesabı</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {accounts.map((acc) => {
                    const isSelected = selectedIntegration === acc.integrationId;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setSelectedIntegration(acc.integrationId)}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                          isSelected
                            ? "border-[#612bd3] bg-[#612bd3]/10"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        {acc.picture ? (
                          <img
                            src={acc.picture}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover border"
                          />
                        ) : (
                          <Instagram size={18} className="text-[#612bd3]" />
                        )}
                        <div className="min-w-0">
                          <strong className="text-xs font-bold truncate block">{acc.name}</strong>
                          <span className="text-[11px] text-muted-foreground truncate block">
                            @{acc.profile || acc.identifier}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Format & Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1.5">3. Format</label>
                  <select
                    value={postType}
                    onChange={(e) => setPostType(e.target.value as "post" | "reel" | "story")}
                    className="w-full rounded-lg border bg-background p-2.5 text-xs"
                  >
                    <option value="post">Instagram Gönderi (Feed)</option>
                    <option value="reel">Instagram Reels</option>
                    <option value="story">Instagram Hikâye (Story)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1.5">Başlık (Dahili Not)</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Örn: Hafta Sonu Pergola Kampanyası"
                    className="w-full rounded-lg border bg-background p-2.5 text-xs"
                  />
                </div>
              </div>

              {/* Caption & Hashtags */}
              <div>
                <label className="text-xs font-semibold block mb-1.5">4. Açıklama &amp; Reklam Metni</label>
                <textarea
                  rows={3}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="İçerik açıklamasını girin..."
                  className="w-full rounded-lg border bg-background p-2.5 text-xs resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1.5">Hashtag'ler</label>
                <input
                  type="text"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="#pergola #tente #mimarlık"
                  className="w-full rounded-lg border bg-background p-2.5 text-xs font-mono"
                />
              </div>

              {/* Schedule Type */}
              <div>
                <label className="text-xs font-semibold block mb-2">5. Yayınlama Zamanı</label>
                <div className="grid grid-cols-3 gap-2 mb-3">
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
                      className={`text-xs py-2 rounded-lg font-medium border text-center transition-colors ${
                        scheduleType === t.id
                          ? "border-[#612bd3] bg-[#612bd3]/10 text-[#612bd3] font-bold"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {scheduleType === "schedule" && (
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full rounded-lg border bg-background p-2.5 text-xs"
                  />
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t mt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="button secondary text-xs"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="button primary text-xs flex items-center gap-1.5"
                >
                  {submitting ? (
                    <LoaderCircle className="spin" size={14} />
                  ) : (
                    <Send size={14} />
                  )}
                  {submitting ? "Gönderiliyor..." : scheduleType === "now" ? "Hemen Paylaş" : scheduleType === "schedule" ? "Zamanla" : "Taslak Olarak Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
