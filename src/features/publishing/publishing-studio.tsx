"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Instagram,
  LoaderCircle,
  Pencil,
  Pause,
  Play,
  RefreshCw,
  Send,
  Share2,
  Sparkles,
  Trash2,
  X,
  Youtube,
  Eye,
  Layers,
} from "lucide-react";
import { extractStockPublishingMetadata } from "@/lib/stock-publishing-metadata";
import { useProjects } from "@/features/projects/projects-context";
import {
  MultiPlatformPreview,
  PreviewPlatform,
  TikTokIcon,
  FacebookIcon,
} from "./platform-previews";
import { PublishingHealthBadge } from "./publishing-health-badge";

type ConnectedAccount = {
  id: string;
  integrationId: string;
  name: string;
  identifier: string; // "instagram", "youtube", "tiktok", "facebook" etc.
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
  mediaPackageId?: string;
  releaseUrl?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt?: string;
};

/**
 * Converts an ISO string (UTC) to a local YYYY-MM-DDTHH:mm string in Europe/Istanbul (TRT, UTC+3)
 */
function toIstanbulDatetimeLocal(isoOrDate?: string | Date | null): string {
  if (!isoOrDate) return "";
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(date.getTime())) return "";

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const findPart = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  const year = findPart("year");
  const month = findPart("month");
  const day = findPart("day");
  let hour = findPart("hour");
  if (hour === "24") hour = "00";
  const minute = findPart("minute");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * Converts a YYYY-MM-DDTHH:mm input in Turkey time (Europe/Istanbul, UTC+3)
 * into a canonical UTC ISO string for storage and API delivery.
 */
function parseIstanbulDatetimeLocalToUtc(val: string): string | undefined {
  if (!val) return undefined;
  const isoWithTz = `${val}:00+03:00`;
  const d = new Date(isoWithTz);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

type RecentAsset = {
  id: string;
  type: "image" | "video";
  category: "image" | "video" | "stock" | "stock_render" | "canva_package";
  url: string;
  thumbnailUrl?: string;
  packageId?: string;
  packageType?: "single" | "carousel";
  itemCount?: number;
  prompt?: string;
  idea?: {
    id?: string;
    title?: string;
    concept?: string;
  };
  sourceTopic?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

type ChannelCustomData = {
  title: string;
  caption: string;
  hashtags: string;
  postType: "post" | "reel" | "story";
};

type HashtagSet = {
  id: string;
  platform: "instagram" | "youtube" | "tiktok" | "facebook" | "twitter";
  name: string;
  hashtags: string[];
  enabled: boolean;
  isDefault: boolean;
};

type PlatformCopyResult = {
  title: string;
  caption: string;
  hashtags: string;
  tags?: string[];
  hashtagMeta?: { ai: number; savedSet: number; removedDuplicates: number; removedInvalid: number };
};

export function PublishingStudio({
  projectId,
  initialAssetId,
}: {
  projectId: string;
  initialAssetId?: string;
}) {
  const { getProject } = useProjects();
  const currentProject = getProject(projectId);

  // Main Page Navigation
  const [mainTab, setMainTab] = useState<"composer" | "schedule">(
    initialAssetId ? "composer" : "schedule"
  );

  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Status Alerts
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // -------------------------------------------------------------
  // COMPOSER STATE
  // -------------------------------------------------------------
  const [selectedIntegrationIds, setSelectedIntegrationIds] = useState<string[]>([]);
  const [activeFormTab, setActiveFormTab] = useState<string>(""); // specific integrationId or "all"
  const [channelData, setChannelData] = useState<Record<string, ChannelCustomData>>({});
  const [channelYouTubeTags, setChannelYouTubeTags] = useState<Record<string, string[]>>({});

  // Common/Global Form Values
  const [globalTitle, setGlobalTitle] = useState("");
  const [globalCaption, setGlobalCaption] = useState("");
  const [globalHashtags, setGlobalHashtags] = useState("");
  const [globalPostType, setGlobalPostType] = useState<"post" | "reel" | "story">("post");

  const [scheduleType, setScheduleType] = useState<"now" | "schedule" | "draft">("now");
  const [scheduledAt, setScheduledAt] = useState("");

  // Media Selection
  const [selectedMedia, setSelectedMedia] = useState<RecentAsset | null>(null);
  const [customMediaUrl, setCustomMediaUrl] = useState("");
  const [mediaSourceTab, setMediaSourceTab] = useState<"recent" | "custom">("recent");
  const [mediaCategoryFilter, setMediaCategoryFilter] = useState<
    "all" | "image" | "canva_package" | "video" | "stock"
  >("all");
  const [mediaPage, setMediaPage] = useState(1);
  const MEDIA_PER_PAGE = 12;
  const [recentAssets, setRecentAssets] = useState<RecentAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  // AI Copy Generation
  const [aiStyle, setAiStyle] = useState<"sales" | "story" | "educational" | "punchy">("sales");
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [hashtagSets, setHashtagSets] = useState<HashtagSet[]>([]);
  const [includeHashtagSets, setIncludeHashtagSets] = useState(true);
  const [selectedHashtagSetIds, setSelectedHashtagSetIds] = useState<Record<string, string[]>>({});
  const [newSetPlatform, setNewSetPlatform] = useState<HashtagSet["platform"]>("instagram");
  const [newSetName, setNewSetName] = useState("");
  const [newSetTags, setNewSetTags] = useState("");
  const [savingHashtagSet, setSavingHashtagSet] = useState(false);

  // Live Preview Target
  const [previewIntegrationId, setPreviewIntegrationId] = useState<string>("");

  // -------------------------------------------------------------
  // SCHEDULE / BOARD STATE
  // -------------------------------------------------------------
  const [channelSubTabs, setChannelSubTabs] = useState<Record<string, "scheduled" | "published" | "draft">>({});
  const [editingPost, setEditingPost] = useState<PostRecord | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // -------------------------------------------------------------
  // LOAD DATA
  // -------------------------------------------------------------
  async function loadData(forceSync = false) {
    setLoading(true);
    setError(null);
    try {
      if (forceSync) {
        await fetch(`/api/projects/${projectId}/posts/sync`, { method: "POST" }).catch(() => undefined);
      }

      const [postsRes, accRes, hashtagRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/posts?sync=${forceSync ? 1 : 0}`),
        fetch(`/api/projects/${projectId}/accounts`),
        fetch(`/api/projects/${projectId}/hashtag-sets`),
      ]);

      if (postsRes.ok) {
        const pJson = await postsRes.json();
        setPosts(pJson.posts || []);
      }
      if (hashtagRes.ok) {
        const hJson = await hashtagRes.json();
        const sets: HashtagSet[] = hJson.sets || [];
        setHashtagSets(sets);
        const selected: Record<string, string[]> = {};
        for (const set of sets) {
          if (set.enabled) selected[set.platform] = [...(selected[set.platform] || []), set.id];
        }
        setSelectedHashtagSetIds(selected);
      }
      if (accRes.ok) {
        const aJson = await accRes.json();
        const connectedList: ConnectedAccount[] = aJson.connected || [];
        setAccounts(connectedList);

        if (connectedList.length > 0 && selectedIntegrationIds.length === 0) {
          setSelectedIntegrationIds([connectedList[0].integrationId]);
          setActiveFormTab(connectedList[0].integrationId);
          setPreviewIntegrationId(connectedList[0].integrationId);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadRecentAssets(targetId?: string) {
    setLoadingAssets(true);
    try {
      const [imgRes, vidRes, stockRes, canvaRes] = await Promise.all([
        fetch(`/api/ai/images?projectId=${projectId}`).catch(() => null),
        fetch(`/api/videos?projectId=${projectId}`).catch(() => null),
        fetch(`/api/projects/${projectId}/stock-videos`).catch(() => null),
        fetch(`/api/projects/${projectId}/canva/packages`).catch(() => null),
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
            const thumbUrl = a.url.startsWith("/api/assets/") ? `${a.url}?thumb=1` : a.url;
            items.push({
              id: a.id,
              type: "image",
              category: "image",
              url: a.url,
              thumbnailUrl: thumbUrl,
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
            title?: string;
            isStockRender?: boolean;
            prompt?: string;
            sourceAssetId?: string;
            idea?: { id?: string; title?: string; concept?: string };
            sourceTopic?: string;
            metadata?: Record<string, unknown>;
            createdAt?: string;
          }) => {
            const isStockRender = Boolean(v.isStockRender);
            const thumbUrl = v.sourceAssetId
              ? `/api/assets/${v.sourceAssetId}?thumb=1`
              : `${v.url}?thumb=1`;
            items.push({
              id: v.id,
              type: "video",
              category: isStockRender ? "stock_render" : "video",
              url: v.url || `/api/videos/${v.id}`,
              thumbnailUrl: thumbUrl,
              prompt: v.title || v.prompt || (isStockRender ? "Stok Üretim Video" : undefined),
              idea: v.idea,
              sourceTopic: v.title || v.sourceTopic,
              metadata: v.metadata,
              createdAt: v.createdAt,
            });
          }
        );
      }

      if (stockRes && stockRes.ok) {
        const stockData = await stockRes.json();
        (stockData.videos || []).forEach(
          (s: {
            id: string;
            name: string;
            thumbnailUrl?: string;
            streamUrl: string;
            metadata?: Record<string, unknown>;
            createdAt?: string;
          }) => {
            const thumbUrl =
              s.thumbnailUrl ||
              (s.streamUrl.startsWith("/api/assets/") ? `${s.streamUrl}?thumb=1` : s.streamUrl);
            items.push({
              id: s.id,
              type: "video",
              category: "stock",
              url: s.streamUrl,
              thumbnailUrl: thumbUrl,
              prompt: `Stok Video: ${s.name}`,
              sourceTopic: s.name.replace(/\.[^/.]+$/, ""),
              metadata: s.metadata,
              createdAt: s.createdAt,
            });
          }
        );
      }

      if (canvaRes && canvaRes.ok) {
        const canvaData = await canvaRes.json();
        (canvaData.packages || []).forEach(
          (p: {
            id: string;
            title?: string;
            prompt?: string;
            packageType: "single" | "carousel";
            coverUrl: string;
            itemCount: number;
            videoAssetId?: string | null;
            videoUrl?: string | null;
            createdAt?: string;
          }) => {
            const packagePrompt =
              p.prompt ||
              p.title ||
              (p.packageType === "carousel"
                ? `Canva Carousel (${p.itemCount} sayfa)`
                : "Canva Tasarımı");
            const thumbUrl = p.coverUrl.startsWith("/api/assets/")
              ? `${p.coverUrl}?thumb=1`
              : p.coverUrl;

            items.push({
              id: p.id,
              type: "image",
              category: "canva_package",
              url: p.coverUrl,
              thumbnailUrl: thumbUrl,
              prompt: packagePrompt,
              sourceTopic: p.prompt || p.title,
              packageId: p.id,
              packageType: p.packageType,
              itemCount: p.itemCount,
              createdAt: p.createdAt,
            });

            if (p.videoUrl) {
              items.push({
                id: p.videoAssetId || `canva_video_${p.id}`,
                type: "video",
                category: "video",
                url: p.videoUrl,
                thumbnailUrl: thumbUrl,
                prompt: packagePrompt,
                sourceTopic: p.prompt || p.title,
                packageId: p.id,
                createdAt: p.createdAt,
              });
            }
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

  function applyAssetSelection(asset: RecentAsset) {
    setSelectedMedia(asset);
    if (asset.category === "canva_package" && asset.packageType === "carousel") {
      setGlobalPostType("post");
    } else if (asset.type === "video") {
      setGlobalPostType("reel");
    }
    setCopyFeedback(null);

    const brandName = currentProject?.brand.brandName || currentProject?.name;

    const fallbackTitle =
      asset.idea?.title ||
      asset.sourceTopic ||
      (asset.prompt ? asset.prompt.split("\n")[0].trim() : "");
    const fallbackDesc = asset.idea?.concept || asset.sourceTopic || fallbackTitle;

    const extracted = extractStockPublishingMetadata(asset.metadata, {
      title: fallbackTitle,
      topic: fallbackDesc,
      brandName,
    });

    const rawTitle = extracted.title || fallbackTitle;
    const rawDesc = extracted.description || fallbackDesc;

    setGlobalTitle(rawTitle.slice(0, 50));
    setGlobalCaption(rawDesc || rawTitle);

    if (extracted.hashtags) {
      setGlobalHashtags(extracted.hashtags);
    }
  }

  async function generateAiCopy(overrideAsset?: RecentAsset) {
    const targetAsset = overrideAsset || selectedMedia;
    setGeneratingCopy(true);
    setCopyFeedback(null);
    setError(null);
    try {
      const meta = targetAsset?.metadata;
      const brandName = currentProject?.brand.brandName || currentProject?.name;
      const fallbackTitle = targetAsset?.idea?.title || targetAsset?.sourceTopic || globalTitle;
      const fallbackDesc =
        targetAsset?.idea?.concept || targetAsset?.sourceTopic || globalCaption || globalTitle;

      const extracted = extractStockPublishingMetadata(meta, {
        title: fallbackTitle,
        topic: fallbackDesc,
        brandName,
      });

      const rawTitle = extracted.title || fallbackTitle;
      const rawDesc = extracted.description || fallbackDesc;
      const rawKeywords = extracted.hashtags ? extracted.hashtags.split(/\s+/) : [];

      const platformByIntegration: Record<string, HashtagSet["platform"]> = {};
      for (const intId of selectedIntegrationIds) {
        platformByIntegration[intId] = platformForAccount(accounts.find((account) => account.integrationId === intId));
      }
      const platforms = [...new Set(Object.values(platformByIntegration))];
      if (!platforms.length) platforms.push("instagram");

      const response = await fetch("/api/ai/posts/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          platforms,
          postType: globalPostType,
          style: aiStyle,
          idea: targetAsset?.idea,
          sourceTopic: rawTitle || rawDesc || globalCaption || globalTitle,
          includeHashtagSets,
          selectedHashtagSetIds,
          stockVideoMeta:
            rawTitle || rawDesc || rawKeywords.length > 0
              ? { rawTitle, rawDescription: rawDesc, keywords: Array.isArray(rawKeywords) ? rawKeywords : [] }
              : undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.ok || !result.copies) throw new Error(result.message || "Metin üretilemedi.");
      const copies = result.copies as Record<string, PlatformCopyResult>;
      setChannelData((current) => {
        const next = { ...current };
        for (const intId of selectedIntegrationIds) {
          const copy = copies[platformByIntegration[intId]];
          if (!copy) continue;
          next[intId] = {
            title: copy.title?.slice(0, 100) || globalTitle,
            caption: copy.caption || globalCaption,
            hashtags: copy.hashtags || "",
            postType: current[intId]?.postType || globalPostType,
          };
        }
        return next;
      });
      setChannelYouTubeTags((current) => {
        const next = { ...current };
        for (const intId of selectedIntegrationIds) {
          const copy = copies[platformByIntegration[intId]];
          if (platformByIntegration[intId] === "youtube" && copy?.tags) next[intId] = copy.tags;
        }
        return next;
      });
      const firstCopy = copies[platforms[0]];
      if (firstCopy) {
        setGlobalTitle(firstCopy.title?.slice(0, 100) || globalTitle);
        setGlobalCaption(firstCopy.caption || globalCaption);
        setGlobalHashtags(firstCopy.hashtags || "");
      }
      const failed = Object.keys(result.errors || {});
      setCopyFeedback(failed.length
        ? `${platforms.length - failed.length} platform hazır; ${failed.join(", ")} yeniden denenebilir.`
        : `${platforms.length} platform için özgün metin ve etiketler hazırlandı.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingCopy(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData(true);
    loadRecentAssets(initialAssetId);
    // eslint-disable-next-line react-hooks/purity
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    setScheduledAt(toIstanbulDatetimeLocal(d));

    // Check for prefill from Strategy Studio
    try {
      const prefillRaw = localStorage.getItem(`publishing_prefill_${projectId}`);
      if (prefillRaw) {
        localStorage.removeItem(`publishing_prefill_${projectId}`);
        const parsed = JSON.parse(prefillRaw);
        if (parsed.caption) {
          const lines = parsed.caption.split("\n").filter((l: string) => l.trim().length > 0);
          const firstLine = lines[0] ? lines[0].replace(/^🎯\s*/, "").trim() : "";
          if (firstLine) setGlobalTitle(firstLine.slice(0, 50));
          setGlobalCaption(parsed.caption);
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, initialAssetId]);

  // Channel Selection Toggle
  function toggleIntegrationSelection(intId: string) {
    setSelectedIntegrationIds((prev) => {
      const next = prev.includes(intId) ? prev.filter((id) => id !== intId) : [...prev, intId];
      if (next.length > 0 && (!activeFormTab || !next.includes(activeFormTab))) {
        setActiveFormTab(next[0]);
      }
      if (next.length > 0 && (!previewIntegrationId || !next.includes(previewIntegrationId))) {
        setPreviewIntegrationId(next[0]);
      }
      return next;
    });
  }

  function getChannelValue(intId: string, field: "title" | "caption" | "hashtags" | "postType") {
    const custom = channelData[intId];
    if (custom && custom[field] !== undefined) return custom[field];
    if (field === "title") return globalTitle;
    if (field === "caption") return globalCaption;
    if (field === "hashtags") return globalHashtags;
    if (field === "postType") return globalPostType;
    return "";
  }

  function setChannelValue(intId: string, field: "title" | "caption" | "hashtags" | "postType", val: string) {
    setChannelData((prev) => ({
      ...prev,
      [intId]: {
        title: prev[intId]?.title ?? globalTitle,
        caption: prev[intId]?.caption ?? globalCaption,
        hashtags: prev[intId]?.hashtags ?? globalHashtags,
        postType: prev[intId]?.postType ?? globalPostType,
        [field]: val,
      },
    }));
  }

  function applyGlobalToAll() {
    const updated: Record<string, ChannelCustomData> = {};
    for (const intId of selectedIntegrationIds) {
      updated[intId] = {
        title: globalTitle,
        caption: globalCaption,
        hashtags: globalHashtags,
        postType: globalPostType,
      };
    }
    setChannelData(updated);
    setSuccess("Genel metin ve ayarlar tüm seçili kanallara uygulandı.");
    setTimeout(() => setSuccess(null), 3000);
  }

  function platformForAccount(account?: ConnectedAccount): HashtagSet["platform"] {
    const id = account?.identifier?.toLowerCase() || "";
    if (id.includes("youtube")) return "youtube";
    if (id.includes("tiktok")) return "tiktok";
    if (id.includes("facebook")) return "facebook";
    if (id.includes("twitter") || id === "x") return "twitter";
    return "instagram";
  }

  async function createHashtagSet() {
    if (!newSetName.trim() || !newSetTags.trim()) {
      setError("Etiket kümesi adı ve etiketleri zorunludur.");
      return;
    }
    setSavingHashtagSet(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/hashtag-sets`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: newSetPlatform, name: newSetName, hashtags: newSetTags, enabled: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Etiket kümesi oluşturulamadı.");
      setHashtagSets((prev) => [...prev, result.set]);
      setSelectedHashtagSetIds((prev) => ({ ...prev, [newSetPlatform]: [...(prev[newSetPlatform] || []), result.set.id] }));
      setNewSetName(""); setNewSetTags("");
      setSuccess("Etiket kümesi kaydedildi.");
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setSavingHashtagSet(false); }
  }

  async function deleteHashtagSet(id: string) {
    const response = await fetch(`/api/projects/${projectId}/hashtag-sets/${id}`, { method: "DELETE" });
    if (!response.ok) return;
    setHashtagSets((prev) => prev.filter((set) => set.id !== id));
    setSelectedHashtagSetIds((prev) => Object.fromEntries(Object.entries(prev).map(([key, ids]) => [key, ids.filter((item) => item !== id)])));
  }

  // Submit Publishing / Schedule
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIntegrationIds.length === 0) {
      setError("Lütfen en az bir hedef sosyal medya hesabı seçin.");
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

    const isVideo =
      mediaSourceTab === "recent"
        ? selectedMedia?.type === "video"
        : mediaUrl.endsWith(".mp4");
    const formattedDate =
      scheduleType === "schedule" && scheduledAt ? parseIstanbulDatetimeLocalToUtc(scheduledAt) : undefined;
    const isPackage =
      mediaSourceTab === "recent" && selectedMedia?.category === "canva_package";

    const targets = selectedIntegrationIds.map((intId) => {
      const acc = accounts.find((a) => a.integrationId === intId);
      const isYt = Boolean(acc?.identifier?.includes("youtube"));
      const isTt = Boolean(acc?.identifier?.includes("tiktok"));

      const rawTitle = getChannelValue(intId, "title");
      const caption = getChannelValue(intId, "caption");
      let hashtags = getChannelValue(intId, "hashtags");
      const postType = getChannelValue(intId, "postType") as "post" | "reel" | "story";

      // YouTube / TikTok channel-specific hashtag cleanup
      if (isYt) {
        // Strip platform-inappropriate or random dev tags from YouTube
        hashtags = hashtags
          .split(/\s+/)
          .filter((t) => !/^#(instagram|tiktok|facebook|dd\w+|studiotoylab)/i.test(t))
          .join(" ");
      }

      return {
        integrationId: intId,
        title: rawTitle || (isPackage ? selectedMedia?.prompt : isVideo ? "Video Paylaşımı" : "Görsel Paylaşımı"),
        caption,
        hashtags,
        postType,
        scheduleType,
        scheduledAt: formattedDate,
        youtubeSettings: isYt
          ? {
              title: (rawTitle || "Video Paylaşımı").slice(0, 100),
              type: "public" as const,
              selfDeclaredMadeForKids: "no" as const,
              tags: (() => {
                const aiTags = channelYouTubeTags[intId] || [];
                const visibleTags = hashtags
                  ? hashtags.split(/\s+/).map((t) => t.replace(/^#+/, "").trim()).filter(Boolean)
                  : [];
                return [...new Set([...aiTags, ...visibleTags])].slice(0, 15);
              })(),
            }
          : undefined,
        tiktokSettings: isTt
          ? {
              title: (rawTitle || "Video Paylaşımı").slice(0, 90),
              content_posting_method: "DIRECT_POST" as const,
              privacy_level: "SELF_ONLY" as const,
              video_made_with_ai: true,
            }
          : undefined,
      };
    });

    try {
      const response = await fetch(`/api/projects/${projectId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: globalTitle,
          contentType: isVideo ? "video" : "image",
          mediaUrl,
          assetId: mediaSourceTab === "recent" && !isPackage ? selectedMedia?.id : undefined,
          mediaPackageId: isPackage ? selectedMedia?.packageId : undefined,
          caption: globalCaption,
          hashtags: globalHashtags,
          scheduleType,
          scheduledAt: formattedDate,
          targets,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Gönderi oluşturulamadı.");

      setSuccess(result.message || "Gönderiler başarıyla oluşturuldu.");
      await loadData();
      setMainTab("schedule");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Toggle Pause/Resume (Beklet / Zamanla)
  async function togglePostPause(post: PostRecord) {
    const nextStatus = post.status === "scheduled" ? "draft" : "scheduled";
    const nextScheduleType = nextStatus === "scheduled" ? "schedule" : "draft";
    try {
      const response = await fetch(`/api/projects/${projectId}/posts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: post.id,
          status: nextStatus,
          scheduleType: nextScheduleType,
        }),
      });
      if (!response.ok) throw new Error("Durum güncellenemedi.");
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  // Delete Post State & Handlers
  const [deleteTarget, setDeleteTarget] = useState<PostRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function executeDelete(target: PostRecord, scope: "single" | "all" = "single") {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/posts?id=${target.id}&scope=${scope}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Silme işlemi başarısız.");
      if (editingPost?.id === target.id) setEditingPost(null);
      setDeleteTarget(null);
      setSuccess(data.message || "Gönderi silindi.");
      setTimeout(() => setSuccess(null), 4000);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDeleting(false);
    }
  }

  // Save Edit from Modal
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPost) return;
    setSavingEdit(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/posts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingPost.id,
          title: editingPost.title,
          caption: editingPost.caption,
          hashtags: editingPost.hashtags,
          status: editingPost.status,
          scheduledAt: editingPost.scheduledAt,
          postType: editingPost.postType,
        }),
      });
      if (!response.ok) throw new Error("Güncelleme başarısız.");
      setEditingPost(null);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingEdit(false);
    }
  }

  // Filtered Assets for Picker
  const filteredAssets = recentAssets.filter((a) => {
    if (mediaCategoryFilter === "all") return true;
    if (mediaCategoryFilter === "canva_package") return a.category === "canva_package";
    if (mediaCategoryFilter === "video") return a.type === "video" && a.category !== "stock";
    if (mediaCategoryFilter === "stock") return a.category === "stock" || a.category === "stock_render";
    if (mediaCategoryFilter === "image") return a.type === "image" && a.category !== "canva_package";
    return true;
  });

  const totalMediaPages = Math.ceil(filteredAssets.length / MEDIA_PER_PAGE) || 1;
  const paginatedAssets = filteredAssets.slice((mediaPage - 1) * MEDIA_PER_PAGE, mediaPage * MEDIA_PER_PAGE);

  const previewAccount = accounts.find((a) => a.integrationId === previewIntegrationId) || accounts[0];
  const previewPlatform: PreviewPlatform =
    (previewAccount?.identifier?.includes("youtube") && "youtube") ||
    (previewAccount?.identifier?.includes("tiktok") && "tiktok") ||
    (previewAccount?.identifier?.includes("facebook") && "facebook") ||
    "instagram";

  if (loading) {
    return <div className="overview-loading" style={{ minHeight: "380px" }} />;
  }

  return (
    <>
      {/* 1. Page Header */}
      <section className="page-intro">
        <div>
          <h2>Paylaşım Planlama &amp; Çoklu Dağıtım</h2>
          <p>
            İçeriklerinizi kanallara özel canlı önizleyerek hazırlayın, planlayın ve aktif hesaplarınıza tek tıkla dağıtın.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <PublishingHealthBadge />
          <button
            type="button"
            onClick={() => {
              loadData();
              loadRecentAssets();
            }}
            className="button secondary"
            disabled={loading}
            title="Yenile"
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            Yenile
          </button>
        </div>
      </section>

      {/* Account Warning */}
      {accounts.length === 0 && (
        <section className="setup-banner" style={{ margin: "16px 0" }}>
          <div className="setup-icon" style={{ background: "#fff2e8", color: "#d67c34" }}>
            <CircleAlert size={20} />
          </div>
          <div>
            <strong>Bağlı Sosyal Medya Hesabı Bulunamadı</strong>
            <p>İçerik planlayabilmek ve kanalları yönetmek için bu projeye en az bir sosyal medya hesabı bağlamalısınız.</p>
          </div>
          <Link href={`/projects/${projectId}/accounts`} className="button secondary">
            <Share2 size={15} />
            Hesaplar Sayfasına Git
          </Link>
        </section>
      )}

      {/* Alerts */}
      {success && (
        <div className="connection-result success" style={{ margin: "12px 0" }}>
          <CheckCircle2 size={16} />
          <span><strong>Başarılı:</strong> <small>{success}</small></span>
        </div>
      )}
      {error && (
        <div className="connection-result error" style={{ margin: "12px 0" }}>
          <CircleAlert size={16} />
          <span><strong>Hata:</strong> <small>{error}</small></span>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="publishing-main-nav">
        <button
          type="button"
          className={`publishing-tab-btn ${mainTab === "composer" ? "active" : ""}`}
          onClick={() => setMainTab("composer")}
        >
          <Send size={15} />
          İçerik Yayınla
        </button>
        <button
          type="button"
          className={`publishing-tab-btn ${mainTab === "schedule" ? "active" : ""}`}
          onClick={() => setMainTab("schedule")}
        >
          <CalendarClock size={15} />
          Paylaşım Planı ({posts.length})
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: İÇERİK YAYINLA (COMPOSER + PREVIEW)                     */}
      {/* ------------------------------------------------------------- */}
      {mainTab === "composer" && (
        <div className="composer-layout">
          {/* Left Column: Form & Media Selection */}
          <form onSubmit={handleSubmit} className="composer-form-panel">
            {/* 1. Platform Multi-Selection */}
            <div className="composer-section">
              <div className="composer-section-title">
                <span>1. Hedef Platformları Seçin</span>
                <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                  {selectedIntegrationIds.length} kanal seçildi
                </small>
              </div>
              <div className="channel-multi-select-grid">
                {accounts.map((acc) => {
                  const isSelected = selectedIntegrationIds.includes(acc.integrationId);
                  const isYt = acc.identifier.includes("youtube");
                  const isTt = acc.identifier.includes("tiktok");
                  const isFb = acc.identifier.includes("facebook");
                  const cleanHandle = (acc.profile || acc.name || "").replace(/^@+/, "");

                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => toggleIntegrationSelection(acc.integrationId)}
                      className={`channel-chip-btn ${isSelected ? "selected" : ""}`}
                    >
                      {acc.picture ? (
                        <img src={acc.picture} alt="" className="channel-chip-avatar" />
                      ) : (
                        <div className="channel-chip-placeholder">
                          {isYt ? (
                            <Youtube size={12} color="#ff0000" />
                          ) : isTt ? (
                            <TikTokIcon size={12} color="#000000" />
                          ) : isFb ? (
                            <FacebookIcon size={12} />
                          ) : (
                            <Instagram size={12} color="#612bd3" />
                          )}
                        </div>
                      )}
                      <span style={{ fontWeight: 700 }}>
                        {isYt ? "YouTube" : isTt ? "TikTok" : isFb ? "Facebook" : "Instagram"}:
                      </span>
                      <span>@{cleanHandle}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Media Selector */}
            <div className="composer-section">
              <div className="composer-section-title">
                <span>2. Medya / Kreatif Seçimi</span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setMediaSourceTab("recent")}
                    className={`button compact ${mediaSourceTab === "recent" ? "primary" : "ghost"}`}
                    style={{ fontSize: "10px", height: "26px", padding: "0 8px" }}
                  >
                    Üretilenler
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaSourceTab("custom")}
                    className={`button compact ${mediaSourceTab === "custom" ? "primary" : "ghost"}`}
                    style={{ fontSize: "10px", height: "26px", padding: "0 8px" }}
                  >
                    Özel URL
                  </button>
                </div>
              </div>

              {mediaSourceTab === "recent" ? (
                <div className="composer-media-selector">
                  <div className="composer-media-tabs">
                    <button
                      type="button"
                      className={`composer-media-tab-btn ${mediaCategoryFilter === "all" ? "active" : ""}`}
                      onClick={() => { setMediaCategoryFilter("all"); setMediaPage(1); }}
                    >
                      Tümü ({recentAssets.length})
                    </button>
                    <button
                      type="button"
                      className={`composer-media-tab-btn ${mediaCategoryFilter === "image" ? "active" : ""}`}
                      onClick={() => { setMediaCategoryFilter("image"); setMediaPage(1); }}
                    >
                      Görseller
                    </button>
                    <button
                      type="button"
                      className={`composer-media-tab-btn ${mediaCategoryFilter === "canva_package" ? "active" : ""}`}
                      onClick={() => { setMediaCategoryFilter("canva_package"); setMediaPage(1); }}
                    >
                      Canva Paketleri
                    </button>
                    <button
                      type="button"
                      className={`composer-media-tab-btn ${mediaCategoryFilter === "video" ? "active" : ""}`}
                      onClick={() => { setMediaCategoryFilter("video"); setMediaPage(1); }}
                    >
                      Videolar
                    </button>
                    <button
                      type="button"
                      className={`composer-media-tab-btn ${mediaCategoryFilter === "stock" ? "active" : ""}`}
                      onClick={() => { setMediaCategoryFilter("stock"); setMediaPage(1); }}
                    >
                      Stok
                    </button>
                  </div>

                  <div
                    className="composer-media-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: "10px",
                      maxHeight: "520px",
                      overflowY: "auto",
                      padding: "10px",
                      background: "#f8fafc",
                      borderRadius: "14px",
                      border: "1px solid #e2e8f0",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    {loadingAssets ? (
                      <div style={{ width: "100%", gridColumn: "1 / -1", textAlign: "center", padding: "32px 12px", color: "var(--muted)", fontSize: "12px" }}>
                        Kreatifler yükleniyor...
                      </div>
                    ) : paginatedAssets.length > 0 ? (
                      paginatedAssets.map((asset) => {
                        const isSelected = selectedMedia?.id === asset.id;
                        return (
                          <div
                            key={asset.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => applyAssetSelection(asset)}
                            className={`composer-media-item ${isSelected ? "selected" : ""}`}
                            title={asset.prompt || asset.sourceTopic || ""}
                            style={{
                              position: "relative",
                              width: "100%",
                              aspectRatio: "4 / 5",
                              borderRadius: "12px",
                              overflow: "hidden",
                              border: isSelected ? "3px solid var(--primary, #6d5dfc)" : "1.5px solid #e2e8f0",
                              boxShadow: isSelected ? "0 0 0 3px rgba(109, 93, 252, 0.35)" : "0 1px 3px rgba(0,0,0,0.04)",
                              cursor: "pointer",
                              background: "#f1f5f9",
                              display: "block",
                              boxSizing: "border-box",
                              padding: 0,
                            }}
                          >
                            <img
                              src={asset.thumbnailUrl || asset.url}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                objectPosition: "center top",
                                display: "block",
                              }}
                            />
                            <span
                              style={{
                                position: "absolute",
                                bottom: "6px",
                                right: "6px",
                                fontSize: "9.5px",
                                fontWeight: "700",
                                background: "rgba(15, 23, 42, 0.85)",
                                backdropFilter: "blur(6px)",
                                color: "white",
                                padding: "2.5px 7px",
                                borderRadius: "6px",
                                pointerEvents: "none",
                              }}
                            >
                              {asset.category === "canva_package"
                                ? `Canva (${asset.itemCount || 1})`
                                : asset.type === "video"
                                ? "Video"
                                : "Görsel"}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ width: "100%", gridColumn: "1 / -1", textAlign: "center", padding: "32px 12px", color: "var(--muted)", fontSize: "12px" }}>
                        Bu kategoride henüz kreatif üretilmemiş.
                      </div>
                    )}
                  </div>

                  {/* Sayfalandırma Çubuğu (Pagination) */}
                  {totalMediaPages > 1 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 8px",
                        background: "#f8fafc",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        fontSize: "11px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setMediaPage((p) => Math.max(1, p - 1))}
                        disabled={mediaPage <= 1}
                        className="button compact ghost"
                        style={{ height: "26px", padding: "0 10px", fontSize: "10.5px" }}
                      >
                        ← Önceki
                      </button>

                      <span style={{ color: "#64748b", fontWeight: "600" }}>
                        Sayfa {mediaPage} / {totalMediaPages} ({filteredAssets.length} Medya)
                      </span>

                      <button
                        type="button"
                        onClick={() => setMediaPage((p) => Math.min(totalMediaPages, p + 1))}
                        disabled={mediaPage >= totalMediaPages}
                        className="button compact ghost"
                        style={{ height: "26px", padding: "0 10px", fontSize: "10.5px" }}
                      >
                        Sonraki →
                      </button>
                    </div>
                  )}

                  {/* Seçili Medya Büyük Önizleme Kartı */}
                  {selectedMedia && (
                    <div className="composer-selected-card">
                      <div className="composer-selected-card-left">
                        <img
                          src={selectedMedia.thumbnailUrl || selectedMedia.url}
                          alt=""
                          className="composer-selected-thumb"
                          onClick={() => {
                            window.open(selectedMedia.url, "_blank");
                          }}
                          title="Büyük boyutta aç"
                        />
                        <div className="composer-selected-info">
                          <span className="composer-selected-title">
                            {selectedMedia.prompt || selectedMedia.sourceTopic || "Seçilen Medya"}
                          </span>
                          <span className="composer-selected-badge">
                            {selectedMedia.category === "canva_package" ? (
                              <>
                                <Layers size={11} />
                                <span>Canva Paketi ({selectedMedia.itemCount || 1} sayfa)</span>
                              </>
                            ) : selectedMedia.type === "video" ? (
                              <>
                                <Film size={11} />
                                <span>Video Kreatifi</span>
                              </>
                            ) : (
                              <>
                                <ImageIcon size={11} />
                                <span>Görsel Kreatifi</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="composer-selected-actions">
                        <button
                          type="button"
                          onClick={() => window.open(selectedMedia.url, "_blank")}
                          className="button compact ghost"
                          style={{ fontSize: "11px", height: "28px", padding: "0 8px" }}
                          title="Tam boyutta incele"
                        >
                          <Eye size={12} />
                          <span>İncele</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedMedia(null)}
                          className="button compact ghost"
                          style={{ fontSize: "11px", height: "28px", padding: "0 6px", color: "#e11d48" }}
                          title="Seçimi Kaldır"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <input
                    type="url"
                    value={customMediaUrl}
                    onChange={(e) => setCustomMediaUrl(e.target.value)}
                    placeholder="https://... veya /kreatif.png"
                    className="custom-input"
                  />
                  <small style={{ color: "var(--muted)", fontSize: "10px" }}>
                    Doğrudan erişilebilir bir görsel veya MP4 video bağlantısı girin.
                  </small>
                </div>
              )}
            </div>

            {/* 3. Channel Tabs for Custom Content */}
            <div className="composer-section">
              <div className="composer-section-title">
                <span>3. İçerik ve Kanal Bilgileri</span>
                <button
                  type="button"
                  onClick={applyGlobalToAll}
                  className="button ghost compact"
                  style={{ fontSize: "10px", height: "24px" }}
                  title="Formdaki genel bilgileri tüm seçili kanallara kopyalar"
                >
                  <Sparkles size={11} />
                  Tüm Kanallara Uygula
                </button>
              </div>

              {/* Sub-nav for channels */}
              {selectedIntegrationIds.length > 1 && (
                <div className="channel-sub-nav">
                  <button
                    type="button"
                    onClick={() => setActiveFormTab("all")}
                    className={`channel-sub-nav-btn ${activeFormTab === "all" ? "active" : ""}`}
                  >
                    Genel Şablon
                  </button>
                  {selectedIntegrationIds.map((intId) => {
                    const acc = accounts.find((a) => a.integrationId === intId);
                    const isYt = acc?.identifier?.includes("youtube");
                    const isTt = acc?.identifier?.includes("tiktok");
                    const isFb = acc?.identifier?.includes("facebook");
                    const cleanHandle = (acc?.profile || acc?.name || "").replace(/^@+/, "");

                    return (
                      <button
                        key={intId}
                        type="button"
                        onClick={() => {
                          setActiveFormTab(intId);
                          setPreviewIntegrationId(intId);
                        }}
                        className={`channel-sub-nav-btn ${activeFormTab === intId ? "active" : ""}`}
                      >
                        {isYt ? (
                          <Youtube size={12} color="#ff0000" />
                        ) : isTt ? (
                          <TikTokIcon size={12} color="currentColor" />
                        ) : isFb ? (
                          <FacebookIcon size={12} />
                        ) : (
                          <Instagram size={12} color="#e1306c" />
                        )}
                        <span>{isYt ? "YouTube" : isTt ? "TikTok" : isFb ? "Facebook" : "Instagram"}</span>
                        <small>(@{cleanHandle})</small>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Form Fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Title */}
                <div>
                  <label className="input-label" style={{ fontSize: "11px", fontWeight: 700 }}>
                    Başlık / Konsept
                  </label>
                  <input
                    type="text"
                    value={
                      activeFormTab && activeFormTab !== "all"
                        ? getChannelValue(activeFormTab, "title")
                        : globalTitle
                    }
                    onChange={(e) => {
                      if (activeFormTab && activeFormTab !== "all") {
                        setChannelValue(activeFormTab, "title", e.target.value);
                      } else {
                        setGlobalTitle(e.target.value);
                      }
                    }}
                    placeholder="Gönderi başlığı veya kısa konu..."
                    maxLength={100}
                    className="custom-input"
                  />
                </div>

                {/* AI Copy Generator Bar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "#f7f5ff",
                    borderRadius: "10px",
                    border: "1px solid #e7e2ff",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Sparkles size={14} style={{ color: "var(--primary)" }} />
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--primary)" }}>
                      AI Metin Asistanı
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <select
                      value={aiStyle}
                      onChange={(e) => setAiStyle(e.target.value as "sales" | "story" | "educational" | "punchy")}
                      className="custom-select"
                      style={{ height: "28px", fontSize: "10px", padding: "0 8px" }}
                    >
                      <option value="sales">Satış &amp; Dönüşüm Odaklı</option>
                      <option value="story">Hikâye &amp; Samimi</option>
                      <option value="educational">Eğitici &amp; Değer Odaklı</option>
                      <option value="punchy">Vurucu &amp; Kısa</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => generateAiCopy()}
                      disabled={generatingCopy}
                      className="button primary compact"
                      style={{ height: "28px", fontSize: "10px" }}
                    >
                      {generatingCopy ? <LoaderCircle size={12} className="spin" /> : <Sparkles size={12} />}
                      Metin Üret
                    </button>
                  </div>
                </div>

                <div className="hashtag-set-panel">
                  <div className="hashtag-set-header">
                    <div>
                      <strong># Hazır Etiket Kümeleri</strong>
                      <span>Platforma özel kayıtlı etiketleri AI sonucuna ekler.</span>
                    </div>
                    <label className="hashtag-set-toggle">
                      <input type="checkbox" checked={includeHashtagSets} onChange={(e) => setIncludeHashtagSets(e.target.checked)} />
                      {includeHashtagSets ? "Açık" : "Kapalı"}
                    </label>
                  </div>
                  {hashtagSets.length > 0 && (
                    <div className="hashtag-set-chips">
                      {hashtagSets.map((set) => {
                        const selected = (selectedHashtagSetIds[set.platform] || []).includes(set.id);
                        return <button key={set.id} type="button" className={`hashtag-set-chip ${selected ? "active" : ""}`}
                          onClick={() => setSelectedHashtagSetIds((prev) => ({ ...prev, [set.platform]: selected ? (prev[set.platform] || []).filter((id) => id !== set.id) : [...(prev[set.platform] || []), set.id] }))}>
                          <span>{set.platform} · {set.name}</span><small>{set.hashtags.length}</small>
                          <X size={11} onClick={(event) => { event.stopPropagation(); void deleteHashtagSet(set.id); }} />
                        </button>;
                      })}
                    </div>
                  )}
                  <div className="hashtag-set-create">
                    <select value={newSetPlatform} onChange={(e) => setNewSetPlatform(e.target.value as HashtagSet["platform"])} className="custom-select">
                      <option value="instagram">Instagram</option><option value="youtube">YouTube</option>
                      <option value="tiktok">TikTok</option><option value="facebook">Facebook</option><option value="twitter">X</option>
                    </select>
                    <input value={newSetName} onChange={(e) => setNewSetName(e.target.value)} placeholder="Küme adı" className="custom-input" />
                    <input value={newSetTags} onChange={(e) => setNewSetTags(e.target.value)} placeholder="#AtolyeHanem #RobotikKodlama" className="custom-input" />
                    <button type="button" onClick={() => void createHashtagSet()} disabled={savingHashtagSet} className="button secondary compact">
                      {savingHashtagSet ? <LoaderCircle size={12} className="spin" /> : <span>+</span>} Kaydet
                    </button>
                  </div>
                </div>

                {copyFeedback && (
                  <div style={{ fontSize: "11px", color: "var(--primary)", background: "#f5f3ff", padding: "6px 10px", borderRadius: "8px" }}>
                    {copyFeedback}
                  </div>
                )}

                {/* Caption */}
                <div>
                  <label className="input-label" style={{ fontSize: "11px", fontWeight: 700 }}>
                    Açıklama / Metin
                  </label>
                  <textarea
                    rows={4}
                    value={
                      activeFormTab && activeFormTab !== "all"
                        ? getChannelValue(activeFormTab, "caption")
                        : globalCaption
                    }
                    onChange={(e) => {
                      if (activeFormTab && activeFormTab !== "all") {
                        setChannelValue(activeFormTab, "caption", e.target.value);
                      } else {
                        setGlobalCaption(e.target.value);
                      }
                    }}
                    placeholder="Sosyal medyada paylaşılacak açıklama metni..."
                    className="custom-textarea"
                  />
                </div>

                {/* Hashtags */}
                <div>
                  <label className="input-label" style={{ fontSize: "11px", fontWeight: 700 }}>
                    Hashtagler
                  </label>
                  <input
                    type="text"
                    value={
                      activeFormTab && activeFormTab !== "all"
                        ? getChannelValue(activeFormTab, "hashtags")
                        : globalHashtags
                    }
                    onChange={(e) => {
                      if (activeFormTab && activeFormTab !== "all") {
                        setChannelValue(activeFormTab, "hashtags", e.target.value);
                      } else {
                        setGlobalHashtags(e.target.value);
                      }
                    }}
                    placeholder="#reklam #trend #tasarım"
                    className="custom-input"
                  />
                </div>

                {/* Post Type Selector */}
                <div>
                  <label className="input-label" style={{ fontSize: "11px", fontWeight: 700 }}>
                    Gönderi Formatı
                  </label>
                  <div className="segmented-filter" style={{ width: "100%" }}>
                    <button
                      type="button"
                      className={
                        (activeFormTab && activeFormTab !== "all"
                          ? getChannelValue(activeFormTab, "postType")
                          : globalPostType) === "post"
                          ? "active"
                          : ""
                      }
                      onClick={() => {
                        if (activeFormTab && activeFormTab !== "all") {
                          setChannelValue(activeFormTab, "postType", "post");
                        } else {
                          setGlobalPostType("post");
                        }
                      }}
                      style={{ flex: 1 }}
                    >
                      <ImageIcon size={12} /> Gönderi (Feed)
                    </button>
                    <button
                      type="button"
                      className={
                        (activeFormTab && activeFormTab !== "all"
                          ? getChannelValue(activeFormTab, "postType")
                          : globalPostType) === "reel"
                          ? "active"
                          : ""
                      }
                      onClick={() => {
                        if (activeFormTab && activeFormTab !== "all") {
                          setChannelValue(activeFormTab, "postType", "reel");
                        } else {
                          setGlobalPostType("reel");
                        }
                      }}
                      style={{ flex: 1 }}
                    >
                      <Film size={12} /> Reels / Shorts
                    </button>
                    <button
                      type="button"
                      className={
                        (activeFormTab && activeFormTab !== "all"
                          ? getChannelValue(activeFormTab, "postType")
                          : globalPostType) === "story"
                          ? "active"
                          : ""
                      }
                      onClick={() => {
                        if (activeFormTab && activeFormTab !== "all") {
                          setChannelValue(activeFormTab, "postType", "story");
                        } else {
                          setGlobalPostType("story");
                        }
                      }}
                      style={{ flex: 1 }}
                    >
                      <Clock size={12} /> Hikâye
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Scheduling & Submit */}
            <div className="composer-section" style={{ borderTop: "1px solid #f0f0f4", paddingTop: "16px" }}>
              <div className="composer-section-title">
                <span>4. Yayın Zamanlaması</span>
              </div>

              <div className="segmented-filter" style={{ width: "100%", marginBottom: "12px" }}>
                <button
                  type="button"
                  className={scheduleType === "now" ? "active" : ""}
                  onClick={() => setScheduleType("now")}
                  style={{ flex: 1 }}
                >
                  Hemen Yayınla
                </button>
                <button
                  type="button"
                  className={scheduleType === "schedule" ? "active" : ""}
                  onClick={() => setScheduleType("schedule")}
                  style={{ flex: 1 }}
                >
                  Zamanla
                </button>
                <button
                  type="button"
                  className={scheduleType === "draft" ? "active" : ""}
                  onClick={() => setScheduleType("draft")}
                  style={{ flex: 1 }}
                >
                  Taslak Olarak Beklet
                </button>
              </div>

              {scheduleType === "schedule" && (
                <div style={{ marginBottom: "12px" }}>
                  <label className="input-label" style={{ fontSize: "11px", fontWeight: 700 }}>
                    Tarih &amp; Saat
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="custom-input"
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || selectedIntegrationIds.length === 0}
                className="button primary"
                style={{ width: "100%", height: "42px", fontSize: "13px" }}
              >
                {submitting ? (
                  <>
                    <LoaderCircle size={16} className="spin" />
                    Dağıtılıyor...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    {selectedIntegrationIds.length > 1
                      ? `${selectedIntegrationIds.length} Kanala Dağıtımı Başlat`
                      : scheduleType === "now"
                      ? "Şimdi Yayınla"
                      : scheduleType === "schedule"
                      ? "Paylaşımı Zamanla"
                      : "Taslak Olarak Kaydet"}
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Right Column: Live Multi-Platform Preview */}
          <div className="composer-preview-panel">
            <div className="preview-panel-header">
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ font: "700 13px 'Manrope'", color: "var(--text)" }}>
                  Canlı Platform Önizlemesi
                </span>
                <span style={{ fontSize: "11px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>Görünüm:</span>
                  <span
                    className="badge-pill info"
                    style={{
                      background:
                        previewPlatform === "tiktok"
                          ? "#00000010"
                          : previewPlatform === "youtube"
                          ? "#fee2e2"
                          : "#eff6ff",
                      color:
                        previewPlatform === "tiktok"
                          ? "#111"
                          : previewPlatform === "youtube"
                          ? "#dc2626"
                          : "#2563eb",
                      fontWeight: 700,
                    }}
                  >
                    {previewPlatform === "tiktok" ? (
                      <>
                        <TikTokIcon size={11} color="#000" /> TikTok (Sizin İçin)
                      </>
                    ) : previewPlatform === "youtube" ? (
                      <>
                        <Youtube size={11} color="#ff0000" /> YouTube ({globalPostType === "reel" ? "Shorts" : "Video"})
                      </>
                    ) : previewPlatform === "facebook" ? (
                      <>
                        <FacebookIcon size={11} /> Facebook Gönderisi
                      </>
                    ) : (
                      <>
                        <Instagram size={11} color="#e1306c" /> Instagram ({globalPostType === "reel" ? "Reels" : globalPostType === "story" ? "Hikâye" : "Feed"})
                      </>
                    )}
                  </span>
                </span>
              </div>

              {/* Platform Switcher for Preview */}
              {selectedIntegrationIds.length > 1 && (
                <div className="preview-platform-picker" style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
                  {selectedIntegrationIds.map((intId) => {
                    const acc = accounts.find((a) => a.integrationId === intId);
                    const isYt = acc?.identifier?.includes("youtube");
                    const isTt = acc?.identifier?.includes("tiktok");
                    const isFb = acc?.identifier?.includes("facebook");
                    const isAct = previewIntegrationId === intId;

                    return (
                      <button
                        key={intId}
                        type="button"
                        onClick={() => setPreviewIntegrationId(intId)}
                        className={`preview-platform-btn ${isAct ? "active" : ""}`}
                        title={acc?.name || "Kanal"}
                        style={{ flex: "1 1 auto", justifyContent: "center" }}
                      >
                        {isYt ? (
                          <Youtube size={12} color="#ff0000" />
                        ) : isTt ? (
                          <TikTokIcon size={12} color={isAct ? "var(--primary)" : "#111"} />
                        ) : isFb ? (
                          <FacebookIcon size={12} />
                        ) : (
                          <Instagram size={12} color="#e1306c" />
                        )}
                        <span>{isYt ? "YouTube" : isTt ? "TikTok" : isFb ? "Facebook" : "Instagram"}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <MultiPlatformPreview
              platform={previewPlatform}
              mediaUrl={mediaSourceTab === "recent" ? selectedMedia?.url : customMediaUrl}
              thumbnailUrl={selectedMedia?.thumbnailUrl}
              contentType={
                mediaSourceTab === "recent"
                  ? selectedMedia?.type
                  : customMediaUrl.endsWith(".mp4")
                  ? "video"
                  : "image"
              }
              postType={
                (previewIntegrationId
                  ? (getChannelValue(previewIntegrationId, "postType") as "post" | "reel" | "story")
                  : globalPostType) || "post"
              }
              title={
                previewIntegrationId ? getChannelValue(previewIntegrationId, "title") : globalTitle
              }
              caption={
                previewIntegrationId ? getChannelValue(previewIntegrationId, "caption") : globalCaption
              }
              hashtags={
                previewIntegrationId ? getChannelValue(previewIntegrationId, "hashtags") : globalHashtags
              }
              accountName={previewAccount?.name}
              accountHandle={previewAccount?.profile || previewAccount?.name}
              accountPicture={previewAccount?.picture}
              packageItemCount={selectedMedia?.itemCount}
            />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: PAYLAŞIM PLANI (KANAL BAZLI GRID & LİSTE)              */}
      {/* ------------------------------------------------------------- */}
      {mainTab === "schedule" && (
        <div>
          {accounts.length > 0 ? (
            <div className="channels-grid">
              {accounts.map((acc) => {
                const accPosts = posts.filter((p) => p.integrationId === acc.integrationId);
                const isYt = acc.identifier.includes("youtube");
                const isTt = acc.identifier.includes("tiktok");
                const isFb = acc.identifier.includes("facebook");
                const cleanHandle = (acc.profile || acc.name || "").replace(/^@+/, "");

                const currentSubTab = channelSubTabs[acc.integrationId] || "scheduled";

                const scheduledItems = accPosts
                  .filter((p) => p.status === "scheduled")
                  .sort(
                    (a, b) =>
                      new Date(a.scheduledAt || a.createdAt).getTime() -
                      new Date(b.scheduledAt || b.createdAt).getTime()
                  );
                const publishedItems = accPosts
                  .filter((p) => p.status === "published")
                  .sort(
                    (a, b) =>
                      new Date(b.scheduledAt || b.createdAt).getTime() -
                      new Date(a.scheduledAt || a.createdAt).getTime()
                  );
                const draftItems = accPosts
                  .filter((p) => p.status === "draft" || p.status === "failed")
                  .sort(
                    (a, b) =>
                      new Date(b.updatedAt || b.createdAt).getTime() -
                      new Date(a.updatedAt || a.createdAt).getTime()
                  );

                const visibleItems =
                  currentSubTab === "scheduled"
                    ? scheduledItems
                    : currentSubTab === "published"
                    ? publishedItems
                    : draftItems;

                return (
                  <div key={acc.id} className="channel-column-card">
                    {/* Header */}
                    <div className="channel-card-header">
                      <div className="channel-header-identity">
                        {acc.picture ? (
                          <img src={acc.picture} alt="" className="channel-header-avatar" />
                        ) : (
                          <div className="channel-chip-placeholder" style={{ width: "36px", height: "36px" }}>
                            {isYt ? (
                              <Youtube size={18} color="#ff0000" />
                            ) : isTt ? (
                              <TikTokIcon size={18} color="#000" />
                            ) : isFb ? (
                              <FacebookIcon size={18} />
                            ) : (
                              <Instagram size={18} color="#612bd3" />
                            )}
                          </div>
                        )}
                        <div className="channel-header-meta">
                          <strong>
                            {isYt ? "YouTube: " : isTt ? "TikTok: " : isFb ? "Facebook: " : "Instagram: "}
                            @{cleanHandle}
                          </strong>
                          <small>
                            {isYt
                              ? "YouTube Kanalı"
                              : isTt
                              ? "TikTok Hesabı"
                              : isFb
                              ? "Facebook Sayfası"
                              : "Instagram Hesabı"}{" "}
                            · {accPosts.length} gönderi
                          </small>
                        </div>
                      </div>

                      <span className="badge-pill info">
                        {isYt ? "YOUTUBE" : isTt ? "TIKTOK" : isFb ? "FACEBOOK" : "INSTAGRAM"}
                      </span>
                    </div>

                    {/* Sub-tabs: Planlanan / Yayınlanan / Bekleyen */}
                    <div className="channel-subtabs">
                      <button
                        type="button"
                        onClick={() =>
                          setChannelSubTabs((prev) => ({ ...prev, [acc.integrationId]: "scheduled" }))
                        }
                        className={`channel-subtab-btn ${
                          currentSubTab === "scheduled" ? "active scheduled" : ""
                        }`}
                      >
                        Planlanan ({scheduledItems.length})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setChannelSubTabs((prev) => ({ ...prev, [acc.integrationId]: "published" }))
                        }
                        className={`channel-subtab-btn ${
                          currentSubTab === "published" ? "active published" : ""
                        }`}
                      >
                        Yayınlanan ({publishedItems.length})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setChannelSubTabs((prev) => ({ ...prev, [acc.integrationId]: "draft" }))
                        }
                        className={`channel-subtab-btn ${
                          currentSubTab === "draft" ? "active draft" : ""
                        }`}
                      >
                        Bekleyen ({draftItems.length})
                      </button>
                    </div>

                    {/* Rows Table */}
                    <div className="channel-posts-list">
                      {visibleItems.length > 0 ? (
                        visibleItems.map((post) => {
                          const dateObj = new Date(post.scheduledAt || post.createdAt);
                          const formattedDate = dateObj.toLocaleDateString("tr-TR", {
                            day: "numeric",
                            month: "short",
                            timeZone: "Europe/Istanbul",
                          });
                          const formattedTime = dateObj.toLocaleTimeString("tr-TR", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Europe/Istanbul",
                          });
                          const thumbUrl = post.mediaUrl.startsWith("/api/assets/")
                            ? `${post.mediaUrl}?thumb=1`
                            : post.mediaUrl.startsWith("/api/videos/")
                            ? `${post.mediaUrl}?thumb=1`
                            : post.mediaUrl;

                          return (
                            <div
                              key={post.id}
                              className="channel-post-row"
                              onClick={() => setEditingPost(post)}
                            >
                              {/* Date & Time */}
                              <div className="channel-row-date">
                                <strong>{formattedDate}</strong>
                                <span>{formattedTime}</span>
                              </div>

                              {/* Thumbnail */}
                              <div className="channel-row-thumb">
                                {post.contentType === "video" ? (
                                  <img
                                    src={thumbUrl}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                    onError={(e) => {
                                      // Fallback for video if thumbnail not found
                                      (e.target as HTMLElement).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <img
                                    src={thumbUrl}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                  />
                                )}
                                <span className="channel-thumb-badge">
                                  {post.postType === "reel" ? "Reel" : post.postType === "story" ? "Hikâye" : "Post"}
                                </span>
                              </div>

                              {/* Info */}
                              <div className="channel-row-info">
                                <span className="channel-row-title">
                                  {post.title || "İsimsiz İçerik"}
                                </span>
                                <span className="channel-row-snippet">
                                  {post.caption || "Açıklama girilmedi"}
                                </span>
                              </div>

                              {/* Actions */}
                              <div
                                className="channel-row-actions"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {post.status === "scheduled" && (
                                  <button
                                    type="button"
                                    onClick={() => togglePostPause(post)}
                                    className="channel-action-btn pause"
                                    title="Beklemeye / Taslağa Al"
                                  >
                                    <Pause size={14} />
                                  </button>
                                )}
                                {post.status === "draft" && (
                                  <button
                                    type="button"
                                    onClick={() => togglePostPause(post)}
                                    className="channel-action-btn"
                                    title="Zamanlama Kuyruğuna Al"
                                  >
                                    <Play size={14} />
                                  </button>
                                )}
                                {post.releaseUrl && (
                                  <a
                                    href={post.releaseUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="channel-action-btn"
                                    title="Canlı Gönderiyi Aç"
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(post)}
                                  className="channel-action-btn delete"
                                  title="Sil"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div
                          style={{
                            padding: "36px 16px",
                            textAlign: "center",
                            color: "var(--muted)",
                            fontSize: "11px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <CalendarClock size={24} style={{ opacity: 0.5 }} />
                          <span>Bu sekmede henüz içerik bulunmuyor.</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="panel-empty" style={{ minHeight: "240px", marginTop: "18px" }}>
              <div><CalendarClock size={24} /></div>
              <strong>Bağlı Hesap Bulunmuyor</strong>
              <p>Önce bir sosyal medya hesabı bağlayarak kanallarınızı görüntüleyebilirsiniz.</p>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* POST DETAIL & EDIT MODAL                                      */}
      {/* ------------------------------------------------------------- */}
      {editingPost && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !savingEdit) setEditingPost(null);
          }}
        >
          <section className="modal post-detail-modal">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Pencil size={16} style={{ color: "var(--primary)" }} />
                <h3 style={{ margin: 0, font: "700 16px 'Manrope'" }}>
                  Gönderi Detayı &amp; Düzenleme
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                className="icon-button"
                title="Kapat"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="post-detail-grid">
                {/* Media Preview Box */}
                <div className="post-detail-media-box">
                  {editingPost.contentType === "video" ? (
                    <video
                      src={editingPost.mediaUrl}
                      controls
                      autoPlay
                      muted
                      loop
                      playsInline
                    />
                  ) : (
                    <img src={editingPost.mediaUrl} alt="" />
                  )}
                </div>

                {/* Edit Form Column */}
                <div className="post-detail-form-col">
                  <div>
                    <label className="input-label" style={{ fontSize: "11px", fontWeight: 700 }}>
                      Başlık
                    </label>
                    <input
                      type="text"
                      value={editingPost.title}
                      onChange={(e) =>
                        setEditingPost({ ...editingPost, title: e.target.value })
                      }
                      className="custom-input"
                    />
                  </div>

                  <div>
                    <label className="input-label" style={{ fontSize: "11px", fontWeight: 700 }}>
                      Açıklama
                    </label>
                    <textarea
                      rows={4}
                      value={editingPost.caption}
                      onChange={(e) =>
                        setEditingPost({ ...editingPost, caption: e.target.value })
                      }
                      className="custom-textarea"
                    />
                  </div>

                  <div>
                    <label className="input-label" style={{ fontSize: "11px", fontWeight: 700 }}>
                      Hashtagler
                    </label>
                    <input
                      type="text"
                      value={editingPost.hashtags}
                      onChange={(e) =>
                        setEditingPost({ ...editingPost, hashtags: e.target.value })
                      }
                      className="custom-input"
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label className="input-label" style={{ fontSize: "11px", fontWeight: 700 }}>
                        Durum
                      </label>
                      <select
                        value={editingPost.status}
                        onChange={(e) =>
                          setEditingPost({
                            ...editingPost,
                            status: e.target.value as "draft" | "scheduled" | "published",
                            scheduleType: e.target.value === "scheduled" ? "schedule" : "draft",
                          })
                        }
                        className="custom-select"
                      >
                        <option value="scheduled">Planlanan (Kuyrukta)</option>
                        <option value="draft">Bekleyen (Taslak)</option>
                        <option value="published">Yayınlandı</option>
                      </select>
                    </div>

                    <div>
                      <label className="input-label" style={{ fontSize: "11px", fontWeight: 700 }}>
                        Format
                      </label>
                      <select
                        value={editingPost.postType}
                        onChange={(e) =>
                          setEditingPost({
                            ...editingPost,
                            postType: e.target.value as "post" | "reel" | "story",
                          })
                        }
                        className="custom-select"
                      >
                        <option value="post">Gönderi (Feed)</option>
                        <option value="reel">Reels / Shorts</option>
                        <option value="story">Hikâye</option>
                      </select>
                    </div>
                  </div>

                  {editingPost.status === "scheduled" && (
                    <div>
                      <label className="input-label" style={{ fontSize: "11px", fontWeight: 700 }}>
                        Planlanan Zaman
                      </label>
                      <input
                        type="datetime-local"
                        value={
                          editingPost.scheduledAt
                            ? toIstanbulDatetimeLocal(editingPost.scheduledAt)
                            : ""
                        }
                        onChange={(e) =>
                          setEditingPost({
                            ...editingPost,
                            scheduledAt: e.target.value
                              ? parseIstanbulDatetimeLocalToUtc(e.target.value)
                              : undefined,
                          })
                        }
                        className="custom-input"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: "20px",
                  paddingTop: "14px",
                  borderTop: "1px solid #f0f0f5",
                }}
              >
                <button
                  type="button"
                  onClick={() => setDeleteTarget(editingPost)}
                  className="button danger ghost"
                  style={{ color: "#ef4444" }}
                >
                  <Trash2 size={15} />
                  İçeriği Sil
                </button>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setEditingPost(null)}
                    className="button secondary"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="button primary"
                  >
                    {savingEdit ? (
                      <LoaderCircle size={15} className="spin" />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    Değişiklikleri Kaydet
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DELETE CONFIRMATION MODAL                                     */}
      {/* ------------------------------------------------------------- */}
      {deleteTarget && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => !isDeleting && setDeleteTarget(null)}
        >
          <div
            className="modal-content"
            style={{ maxWidth: "480px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Trash2 size={18} color="#ef4444" />
                <strong style={{ fontSize: "15px" }}>Gönderiyi Sil</strong>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="icon-button"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: "16px 20px" }}>
              <p style={{ fontSize: "13px", color: "var(--foreground)", lineHeight: "1.5", margin: "0 0 12px 0" }}>
                <strong>&quot;{deleteTarget.title || "İsimsiz Gönderi"}&quot;</strong> başlıklı gönderiyi silmek istediğinize emin misiniz?
              </p>
              {(() => {
                const siblings = posts.filter(
                  (p) =>
                    p.id !== deleteTarget.id &&
                    ((deleteTarget.mediaPackageId && p.mediaPackageId === deleteTarget.mediaPackageId) ||
                      (p.title === deleteTarget.title && p.scheduledAt === deleteTarget.scheduledAt))
                );

                if (siblings.length > 0) {
                  return (
                    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", marginBottom: "16px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#334155", display: "block", marginBottom: "6px" }}>
                        📌 Çoklu Kanal Dağıtımı Tespit Edildi
                      </span>
                      <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
                        Bu içerik diğer {siblings.length} kanalda da planlanmış/yayınlanmış görünüyor.
                      </p>
                      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                        <button
                          type="button"
                          onClick={() => executeDelete(deleteTarget, "single")}
                          disabled={isDeleting}
                          className="button secondary compact"
                          style={{ flex: 1, fontSize: "12px" }}
                        >
                          {isDeleting ? <LoaderCircle size={12} className="spin" /> : null}
                          Yalnızca Bu Kanaldan Sil
                        </button>
                        <button
                          type="button"
                          onClick={() => executeDelete(deleteTarget, "all")}
                          disabled={isDeleting}
                          className="button danger compact"
                          style={{ flex: 1, fontSize: "12px" }}
                        >
                          {isDeleting ? <LoaderCircle size={12} className="spin" /> : null}
                          Tüm Kanallardan Sil ({siblings.length + 1})
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(null)}
                      disabled={isDeleting}
                      className="button secondary compact"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="button"
                      onClick={() => executeDelete(deleteTarget, "single")}
                      disabled={isDeleting}
                      className="button danger compact"
                    >
                      {isDeleting ? <LoaderCircle size={12} className="spin" /> : <Trash2 size={13} />}
                      Evet, Sil
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
