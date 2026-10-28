"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Compass,
  Sparkles,
  RefreshCw,
  Video,
  Layers,
  FileText,
  MessageCircle,
  Eye,
  EyeOff,
  Plus,
  Palette,
  CheckCircle2,
  Copy,
  Building2,
  Tag,
  Swords,
  Target,
  TrendingUp,
  HelpCircle,
  Zap,
  CalendarDays,
  Hash,
  Clapperboard,
  X,
  RotateCcw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  type ColumnType,
  type IdeaType,
  IDEA_TYPE_LABELS,
} from "@/lib/strategy-constants";

import type { StrategyOverview, StrategyIdea } from "@/lib/strategy-types";
import { PlatformGrowthPanel } from "./platform-growth-panel";

type ColumnData = {
  suggested: StrategyIdea[];
  hidden: StrategyIdea[];
};

type StrategyResponse = {
  success: boolean;
  hasStrategy: boolean;
  strategy?: {
    brandName: string;
    brandDescription: string;
    socialChannels: string[];
    competitors: string[];
    brandIdentity: StrategyOverview["brandIdentity"];
    competitorAnalysis: StrategyOverview["competitorAnalysis"];
    audienceVoc: StrategyOverview["audienceVoc"];
    growthStrategy: StrategyOverview["growthStrategy"];
    generationStatus?: "idle" | "generating" | "completed" | "failed";
    currentRunId?: string;
    engineType?: string;
    skillsUsed?: Array<{ skill: string; role: string }>;
    updatedAt: string;
  };
  initialData?: {
    brandName: string;
    brandDescription: string;
    socialChannels: string[];
    competitors: string[];
  };
  columns: Record<ColumnType, ColumnData>;
  error?: string;
};

const COLUMN_CONFIG: Record<
  ColumnType,
  {
    title: string;
    subtitle: string;
    agentBadge: string;
    agentSlug: string;
    icon: LucideIcon;
    iconBg: string;
    iconColor: string;
    defaultTarget: string;
  }
> = {
  vertical_video: {
    title: "Dikey Video",
    subtitle: "Reels / TikTok (9:16)",
    agentBadge: "Agency TikTok Strategist",
    agentSlug: "marketing-tiktok-strategist",
    icon: Video,
    iconBg: "#fdf2f8",
    iconColor: "#db2777",
    defaultTarget: "Reels / TikTok",
  },
  carousel: {
    title: "Karosel Seri",
    subtitle: "Canva Carousel (5-7 Slayt)",
    agentBadge: "Agency Carousel Engine",
    agentSlug: "marketing-carousel-growth-engine",
    icon: Layers,
    iconBg: "#eef2ff",
    iconColor: "#4f46e5",
    defaultTarget: "Instagram Carousel",
  },
  single_post: {
    title: "Tekil / İnfografik",
    subtitle: "Vurgu, Alıntı & Haber",
    agentBadge: "Agency Content Creator",
    agentSlug: "marketing-content-creator",
    icon: FileText,
    iconBg: "#ecfeff",
    iconColor: "#0891b2",
    defaultTarget: "Instagram / LinkedIn",
  },
  engagement: {
    title: "Etkileşim & Story",
    subtitle: "Anket, İkilem & DM",
    agentBadge: "Agency Community Engager",
    agentSlug: "marketing-twitter-engager",
    icon: MessageCircle,
    iconBg: "#ecfdf5",
    iconColor: "#059669",
    defaultTarget: "Instagram Story",
  },
};

type MainTab = "cockpit" | "content_ideas";
type CockpitTabId = "brand_input" | "brand_identity" | "competitor_analysis" | "target_audience" | "growth_plan" | "platform_growth";

export function StrategyStudio({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<number>(1);
  const [savingBrand, setSavingBrand] = useState(false);
  const [data, setData] = useState<StrategyResponse | null>(null);

  // Form inputs
  const [brandName, setBrandName] = useState("");
  const [brandDescription, setBrandDescription] = useState("");
  const [socialChannels, setSocialChannels] = useState<string[]>([
    "Instagram",
    "TikTok",
    "YouTube",
  ]);
  const [competitorsText, setCompetitorsText] = useState("");

  // Primary 2-Tab Navigation: "Strateji Kokpiti" vs "İçerik Önerileri"
  const [mainTab, setMainTab] = useState<MainTab>("cockpit");

  // Cockpit Subtab: 5 tabs (max 2 words each)
  const [activeTab, setActiveTab] = useState<CockpitTabId>("brand_input");

  // Column Subtabs: 'suggested' or 'hidden' per column
  const [colTabs, setColTabs] = useState<Record<ColumnType, "suggested" | "hidden">>({
    vertical_video: "suggested",
    carousel: "suggested",
    single_post: "suggested",
    engagement: "suggested",
  });

  // Mobile active format selector (Quick Ideas Drawer style: 1 active column at a time on mobile)
  const [mobileActiveCol, setMobileActiveCol] = useState<ColumnType>("vertical_video");

  // Column generation loading states
  const [colLoading, setColLoading] = useState<Record<ColumnType, boolean>>({
    vertical_video: false,
    carousel: false,
    single_post: false,
    engagement: false,
  });

  // Specific topic idea generation loading
  const [topicLoading, setTopicLoading] = useState<string | null>(null);

  // Selected story step index per engagement card
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<Record<string, number>>({});

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedHashtags, setCopiedHashtags] = useState(false);

  // Fikir Makinesi Modal State
  const [ideaModalOpen, setIdeaModalOpen] = useState(false);
  const [modalTargetCol, setModalTargetCol] = useState<ColumnType | "all">("all");
  const [modalIdeaType, setModalIdeaType] = useState<IdeaType | "">("");
  const [modalTopic, setModalTopic] = useState("");
  const [modalResetFirst, setModalResetFirst] = useState(false);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [resettingIdeas, setResettingIdeas] = useState(false);

  async function loadStrategy() {
    try {
      const res = await fetch(`/api/projects/${projectId}/strategy`, {
        cache: "no-store",
      });
      const json: StrategyResponse = await res.json();
      setData(json);
      if (json.hasStrategy && json.strategy) {
        setBrandName(json.strategy.brandName || "");
        setBrandDescription(json.strategy.brandDescription || "");
        setSocialChannels(json.strategy.socialChannels || ["Instagram", "TikTok", "YouTube"]);
        setCompetitorsText((json.strategy.competitors || []).join(", "));
        if (json.strategy.generationStatus === "generating") {
          setGenerating(true);
        } else if (json.strategy.generationStatus === "completed" || json.strategy.generationStatus === "failed") {
          setGenerating(false);
        }
      } else if (json.initialData) {
        setBrandName(json.initialData.brandName || "");
        setBrandDescription(json.initialData.brandDescription || "");
        setSocialChannels(json.initialData.socialChannels || ["Instagram", "TikTok", "YouTube"]);
      }
      return json;
    } catch (e) {
      console.error("Load strategy error:", e);
      return null;
    }
  }

  useEffect(() => {
    let ignore = false;
    fetch(`/api/projects/${projectId}/strategy`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json: StrategyResponse) => {
        if (ignore) return;
        setData(json);
        if (json.hasStrategy && json.strategy) {
          setBrandName(json.strategy.brandName || "");
          setBrandDescription(json.strategy.brandDescription || "");
          setSocialChannels(json.strategy.socialChannels || ["Instagram", "TikTok", "YouTube"]);
          setCompetitorsText((json.strategy.competitors || []).join(", "));
          if (json.strategy.generationStatus === "generating") {
            setGenerating(true);
          }
        } else if (json.initialData) {
          setBrandName(json.initialData.brandName || "");
          setBrandDescription(json.initialData.brandDescription || "");
          setSocialChannels(json.initialData.socialChannels || ["Instagram", "TikTok", "YouTube"]);
        }
      })
      .catch((e) => {
        console.error("Load strategy error:", e);
      });

    const handleIdeaAdded = (e: Event) => {
      const customEvent = e as CustomEvent<{ idea?: StrategyIdea }>;
      if (customEvent.detail?.idea) {
        const addedIdea = customEvent.detail.idea;
        const col = addedIdea.columnType;
        setData((prev) => {
          if (!prev?.columns?.[col]) return prev;
          return {
            ...prev,
            columns: {
              ...prev.columns,
              [col]: {
                ...prev.columns[col],
                suggested: [addedIdea, ...prev.columns[col].suggested],
              },
            },
          };
        });
      }
    };

    window.addEventListener("hermes_strategy_idea_added", handleIdeaAdded);

    return () => {
      ignore = true;
      window.removeEventListener("hermes_strategy_idea_added", handleIdeaAdded);
    };
  }, [projectId]);

  // Polling loop when generation is in-flight (survives page refresh)
  useEffect(() => {
    if (!generating) return;
    const interval = setInterval(async () => {
      const json = await loadStrategy();
      if (json?.strategy?.generationStatus === "completed") {
        setGenerating(false);
        setActiveTab("brand_identity");
      } else if (json?.strategy?.generationStatus === "failed") {
        setGenerating(false);
      }
    }, 3500);

    const phaseTimer = setInterval(() => {
      setGenerationPhase((p) => (p % 3) + 1);
    }, 7000);

    return () => {
      clearInterval(interval);
      clearInterval(phaseTimer);
    };
  }, [generating, projectId]);

  async function handleGenerateFullStrategy(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (generating) return;
    if (!brandName.trim()) {
      alert("Lütfen bir marka / proje adı girin.");
      return;
    }

    setGenerating(true);
    setGenerationPhase(1);
    try {
      const competitors = competitorsText
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      const res = await fetch(`/api/projects/${projectId}/strategy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName,
          brandDescription,
          socialChannels,
          competitors,
        }),
      });

      const json = await res.json();
      if (json.success) {
        await loadStrategy();
        setActiveTab("brand_identity");
      } else if (res.status === 409) {
        // Zaten üretim devam ediyor, arka plan polling'e devam etsin
        await loadStrategy();
      } else {
        alert("Hata: " + (json.error || "Strateji üretilemedi."));
        await loadStrategy();
      }
    } catch (e: unknown) {
      console.warn("Strateji isteği askıda kaldı veya koptu, arka plan kontrolü devrede:", e);
      await loadStrategy();
    }
  }

  async function handleSaveBrandOnly() {
    if (!brandName.trim()) {
      alert("Lütfen marka adı girin.");
      return;
    }

    setSavingBrand(true);
    try {
      const competitors = competitorsText
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      const res = await fetch(`/api/projects/${projectId}/strategy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName,
          brandDescription,
          socialChannels,
          competitors,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            strategy: prev.strategy
              ? {
                  ...prev.strategy,
                  brandName,
                  brandDescription,
                  socialChannels,
                  competitors,
                }
              : undefined,
          };
        });
      } else {
        alert("Hata: " + (json.error || "Bilgiler kaydedilemedi."));
      }
    } catch (e: unknown) {
      alert("Hata: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSavingBrand(false);
    }
  }

  async function handleToggleHideIdea(ideaId: string) {
    // 1. Optimistic instant local state update
    setData((prev) => {
      if (!prev) return prev;
      const nextCols = { ...prev.columns };
      for (const key of Object.keys(nextCols) as ColumnType[]) {
        const col = { ...nextCols[key] };
        const foundSug = col.suggested.find((i) => i.id === ideaId);
        const foundHid = col.hidden.find((i) => i.id === ideaId);
        if (foundSug) {
          col.suggested = col.suggested.filter((i) => i.id !== ideaId);
          col.hidden = [{ ...foundSug, status: "hidden" }, ...col.hidden];
        } else if (foundHid) {
          col.hidden = col.hidden.filter((i) => i.id !== ideaId);
          col.suggested = [{ ...foundHid, status: "suggested" }, ...col.suggested];
        }
        nextCols[key] = col;
      }
      return { ...prev, columns: nextCols };
    });

    // 2. Persist to server via PATCH
    try {
      await fetch(`/api/projects/${projectId}/strategy/ideas`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId, action: "toggle_hide" }),
      });
    } catch (e) {
      console.error("Toggle hide idea error:", e);
    }
  }

  function openIdeaMachineModal(target: ColumnType | "all" = "all", initialTopic: string = "") {
    setModalTargetCol(target);
    setModalTopic(initialTopic);
    setModalIdeaType("");
    setModalResetFirst(false);
    setIdeaModalOpen(true);
  }

  async function handleResetAllIdeas() {
    let proceed = true;
    try {
      proceed = typeof window !== "undefined" ? window.confirm("Tüm içerik önerileri temizlenecektir. Emin misiniz?") : true;
    } catch {
      proceed = true;
    }
    if (!proceed) return;

    setResettingIdeas(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/strategy/ideas?scope=all`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "all" }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.success || res.ok) {
        setData((prev) => {
          if (!prev) return prev;
          const nextCols = { ...prev.columns };
          for (const col of ["vertical_video", "carousel", "single_post", "engagement"] as ColumnType[]) {
            nextCols[col] = { suggested: [], hidden: [] };
          }
          return { ...prev, columns: nextCols };
        });
      } else {
        alert(json.error || "Öneriler temizlenemedi.");
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Öneriler temizlenemedi.");
    } finally {
      setResettingIdeas(false);
    }
  }

  async function handleResetColumnIdeas(colType: ColumnType) {
    let proceed = true;
    try {
      proceed = typeof window !== "undefined" ? window.confirm(`${COLUMN_CONFIG[colType].title} kolonundaki tüm fikirler temizlenecektir. Emin misiniz?`) : true;
    } catch {
      proceed = true;
    }
    if (!proceed) return;

    setColLoading((prev) => ({ ...prev, [colType]: true }));
    try {
      const res = await fetch(`/api/projects/${projectId}/strategy/ideas?scope=single_column&columnType=${colType}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "single_column", columnType: colType }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.success || res.ok) {
        setData((prev) => {
          if (!prev) return prev;
          const nextCols = { ...prev.columns };
          nextCols[colType] = { suggested: [], hidden: [] };
          return { ...prev, columns: nextCols };
        });
      } else {
        alert(json.error || "Kolon temizlenemedi.");
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Kolon temizlenemedi.");
    } finally {
      setColLoading((prev) => ({ ...prev, [colType]: false }));
    }
  }

  async function handleIdeaMachineSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (modalSubmitting) return;

    setModalSubmitting(true);
    try {
      const isAll = modalTargetCol === "all";
      const payload: Record<string, unknown> = {
        scope: isAll ? "all_columns" : "single_column",
        columnType: isAll ? undefined : modalTargetCol,
        focusTopic: modalTopic.trim(),
        ideaType: modalIdeaType || undefined,
        resetBeforeGenerate: modalResetFirst,
      };

      const res = await fetch(`/api/projects/${projectId}/strategy/ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        if (isAll && json.ideasByColumn) {
          setData((prev) => {
            if (!prev) return prev;
            const nextCols = { ...prev.columns };
            for (const col of Object.keys(json.ideasByColumn) as ColumnType[]) {
              const newItems = json.ideasByColumn[col] || [];
              nextCols[col] = {
                suggested: modalResetFirst ? newItems : [...newItems, ...nextCols[col].suggested],
                hidden: modalResetFirst ? [] : nextCols[col].hidden,
              };
            }
            return { ...prev, columns: nextCols };
          });
          setMainTab("content_ideas");
        } else if (!isAll && json.ideas) {
          const colType = modalTargetCol as ColumnType;
          setData((prev) => {
            if (!prev) return prev;
            const nextCols = { ...prev.columns };
            nextCols[colType] = {
              suggested: modalResetFirst ? json.ideas : [...json.ideas, ...nextCols[colType].suggested],
              hidden: modalResetFirst ? [] : nextCols[colType].hidden,
            };
            return { ...prev, columns: nextCols };
          });
          setColTabs((prev) => ({ ...prev, [colType]: "suggested" }));
          setMainTab("content_ideas");
        }
        setIdeaModalOpen(false);
      } else {
        alert("Hata: " + (json.error || "Fikir üretilemedi."));
      }
    } catch (e: unknown) {
      alert("Hata: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setModalSubmitting(false);
    }
  }

  function handleSendToGoogleVids(idea: StrategyIdea) {
    if (idea.nativeFormat === 'long_video') {
      window.alert('YouTube uzun video mevcut Vids kısa-video aktarımında desteklenmiyor. Fikri Kopyala ile bölüm akışını alın ve uzun video düzenleyicinizde kullanın; kısa video için ayrı Shorts fikri üretin.');
      return;
    }
    if (!window.confirm(`"${idea.title}" konsepti Google Vids AI Video Stüdyosu'na aktarılacak ve kart 'Gizlenmiş' sekmesine taşınacak.\n\nOnaylıyor musunuz?`)) {
      return;
    }

    if (idea.id && idea.status !== "hidden") {
      void handleToggleHideIdea(idea.id);
    }

    try {
      const cleanHook = (idea.hook || "").replace(/^["'“”]+|["'“”]+$/g, "");
      const topicText = `${idea.title}: ${idea.description}${cleanHook ? `. Kanca: "${cleanHook}"` : ""}`;
      localStorage.setItem(
        `google_vids_form_${projectId}`,
        JSON.stringify({
          topic: topicText,
        })
      );
      window.dispatchEvent(new CustomEvent("google-vids-prefill", { detail: { topic: topicText } }));
      router.push(`/projects/${projectId}/video-generation?studio=vids`);
    } catch {
      router.push(`/projects/${projectId}/video-generation?studio=vids`);
    }
  }

  async function handleGenerateMoreForColumn(columnType: ColumnType) {
    openIdeaMachineModal(columnType, "");
  }

  // Generate targeted ideas directly from a specific gap/pain point in Strateji Kokpiti
  async function handleGenerateFromTopic(topic: string, targetCol: ColumnType = "vertical_video") {
    setTopicLoading(topic);
    try {
      const res = await fetch(`/api/projects/${projectId}/strategy/ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnType: targetCol, focusTopic: topic }),
      });
      const json = await res.json();
      if (json.success && json.ideas) {
        setData((prev) => {
          if (!prev) return prev;
          const nextCols = { ...prev.columns };
          nextCols[targetCol].suggested = [
            ...json.ideas,
            ...nextCols[targetCol].suggested,
          ];
          return { ...prev, columns: nextCols };
        });
        // Switch to "İçerik Önerileri" so the user directly sees the newly generated cards!
        setMainTab("content_ideas");
        setColTabs((prev) => ({ ...prev, [targetCol]: "suggested" }));
      } else {
        alert("Hata: " + (json.error || "Fikir üretilemedi."));
      }
    } catch (e: unknown) {
      alert("Hata: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setTopicLoading(null);
    }
  }

  function buildEngagementStoryPrompt(idea: StrategyIdea, selectedStepText: string) {
    const cleanHook = (idea.hook || "").replace(/^["'“”]+|["'“”]+$/g, "");
    const isInteractive = /anket|poll|soru|quiz|ikilem|test|seçenek|doğru mu|yanlış mı/i.test(selectedStepText);

    const storyGuidelines = isInteractive
      ? `[INSTAGRAM STORY İNTERAKTİF ÇIKARTMA (STICKER) YERLEŞİM KURALI]:
- Format: 1080×1920 (9:16), TEK SAYFA Instagram Story görseli.
- ÜST GÜVENLİ ALAN: Üstten 250px boşluk bırak (profil adı, kapatma ikonu ve hikaye çizgileri için).
- ALT GÜVENLİ ALAN: Alttan 250px boşluk bırak (Instagram DM mesaj yazma çubuğu ve yanıt butonları için).
- METİN VE BAŞLIK ALANI: Ana soru ve kancayı sadece üst-orta bölgeye (y: 260px - 650px) büyük, okunaklı ve vurucu yerleştir.
- ÇIKARTMA (STICKER) ALANI: Ekranın orta ve orta-alt bölgesinde (y: 650px - 1400px) Instagram'da Anket / Soru Kutusu çıkartması yapıştırılabilmesi için EN AZ 450px yüksekliğinde temiz, metinsiz boşluk (Sticker Safe Zone) bırak! Çıkartma seçeneklerini görselin üstüne düz metin olarak yazma, çıkartma için ferah alan aç.`
      : `[INSTAGRAM STORY YERLEŞİM KURALI]:
- Format: 1080×1920 (9:16), TEK SAYFA Instagram Story görseli.
- ÜST & ALT GÜVENLİ ALAN: Üstten 250px ve alttan 250px boşluk bırak.
- ODAK NOKTASI: Ana mesajı ve yönlendirici DM aksiyonunu ekranın merkezinde temiz, yüksek kontrastlı ve okunaklı bir odak kutusuyla vurgula.`;

    return [
      `Başlık: ${idea.title}`,
      `Seçilen Story Kurgusu: ${selectedStepText}`,
      cleanHook ? `Kanca / Giriş: "${cleanHook}"` : "",
      idea.description ? `Genel Konu Özeti: ${idea.description}` : "",
      `\n${storyGuidelines}`,
    ].filter(Boolean).join("\n\n").trim();
  }

  async function handleSendToCanva(idea: StrategyIdea) {
    if (idea.nativeFormat === 'long_video') {
      window.alert('YouTube uzun video Canva Reels aktarımında desteklenmiyor. Fikri Kopyala ile bölüm akışını alın ve uzun video düzenleyicinizde kullanın; kısa video için ayrı Shorts fikri üretin.');
      return;
    }
    const cardKey = idea.id || idea.title;
    const isEngagement = idea.columnType === "engagement";
    const selectedStepIndex = selectedStoryIndex[cardKey] ?? 0;
    const selectedStepText = isEngagement && idea.structure && idea.structure.length > 0
      ? idea.structure[selectedStepIndex] || idea.description
      : "";

    const confirmMsg = isEngagement && selectedStepText
      ? `"${idea.title}" kartındaki Seçili Story (${selectedStepIndex + 1}. Adım) tekil 9:16 Story tasarımı olarak Canva Stüdyosu'na aktarılacak ve kart 'Gizlenmiş' sekmesine taşınacak.\n\nOnaylıyor musunuz?`
      : `"${idea.title}" fikri Canva Tasarım Stüdyosu'na aktarılacak ve 'Gizlenmiş' sekmesine taşınacak.\n\nOnaylıyor musunuz?`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    // 1. Automatically move idea to 'hidden' (consumed) if it has an id
    if (idea.id && idea.status !== "hidden") {
      await handleToggleHideIdea(idea.id);
    }

    // 2. Build full rich creative brief / prompt from card details
    let fullPrompt = "";
    let targetContentType = "instagram_post";
    let targetSlideCount = 1;

    if (isEngagement) {
      targetContentType = "instagram_story";
      targetSlideCount = 1; // Exactly 1 single 9:16 story
      fullPrompt = buildEngagementStoryPrompt(idea, selectedStepText || idea.description);
    } else {
      const cleanHook = (idea.hook || "").replace(/^["'“”]+|["'“”]+$/g, "");
      const structureText = idea.structure && idea.structure.length > 0
        ? `\nAkış ve Slayt Planı:\n${idea.structure.map((s, idx) => `${idx + 1}. ${s}`).join("\n")}`
        : "";

      fullPrompt = [
        `Başlık: ${idea.title}`,
        idea.targetChannel ? `Hedef Kanal: ${idea.targetChannel}` : "",
        cleanHook ? `\nKanca (Hook):\n"${cleanHook}"` : "",
        idea.description ? `\nKonu & İçerik Özeti:\n${idea.description}` : "",
        structureText,
      ].filter(Boolean).join("\n").trim();

      if (idea.columnType === "vertical_video") {
        targetContentType = "reels_video";
        targetSlideCount = 6;
      } else if (idea.columnType === "carousel") {
        targetContentType = "instagram_carousel";
        targetSlideCount = Math.max(3, Math.min(10, idea.structure?.length || 5));
      } else {
        targetContentType = "instagram_post";
        targetSlideCount = 1;
      }
    }

    try {
      const formPayload = {
        prompt: fullPrompt,
        contentType: targetContentType,
        slideCount: targetSlideCount,
        style: "minimalist_modern",
        isPrefilledFromIdea: true,
        timestamp: Date.now(),
      };
      localStorage.setItem(`canva_form_${projectId}`, JSON.stringify(formPayload));
      localStorage.setItem(`canva_prefill_${projectId}`, JSON.stringify(formPayload));
      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        window.dispatchEvent(new CustomEvent("canva-prefill", { detail: formPayload }));
      }

      router.push(`/projects/${projectId}/image-generation?studio=canva`);
    } catch {
      router.push(`/projects/${projectId}/image-generation?studio=canva`);
    }
  }

  function copyIdeaText(idea: StrategyIdea) {
    let text = "";
    if (idea.columnType === "engagement") {
      const cardKey = idea.id || idea.title;
      const selectedStepIndex = selectedStoryIndex[cardKey] ?? 0;
      const selectedStepText = idea.structure && idea.structure.length > 0
        ? idea.structure[selectedStepIndex] || idea.description
        : idea.description;
      text = buildEngagementStoryPrompt(idea, selectedStepText);
    } else {
      const structureItems = (idea.structure || [])
        .map((step, idx) => `  ${idx + 1}. ${step}`)
        .join("\n");
      const structureBlock = structureItems ? `\n📋 Akış / Slayt Planı:\n${structureItems}` : "";
      text = `📌 ${idea.title}\n⚡ Kanca: ${idea.hook}\n📝 Açıklama: ${idea.description}${structureBlock}\n🎯 Hedef Kanal: ${idea.targetChannel || "Instagram / TikTok"}`;
    }

    navigator.clipboard.writeText(text);
    setCopiedId(idea.id || idea.title);
    setTimeout(() => setCopiedId(null), 2500);
  }

  function getCanvaPresetBadge(colType: ColumnType, idea: StrategyIdea) {
    if (colType === "vertical_video") {
      return { label: "Reels 9:16", detail: "6 Sahne", color: "#ec4899", bg: "#fdf2f8", border: "#fbcfe8" };
    }
    if (colType === "carousel") {
      const count = Math.max(3, Math.min(10, idea.structure?.length || 5));
      return { label: "Karusel 4:5", detail: `${count} Slayt`, color: "#4f46e5", bg: "#eef2ff", border: "#c7d2fe" };
    }
    if (colType === "engagement") {
      return { label: "Story 9:16", detail: "1-5 Adım", color: "#d97706", bg: "#fffbeb", border: "#fde68a" };
    }
    return { label: "Post 1:1", detail: "Tek Kare", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" };
  }

  const overview = data?.strategy;
  const hasCompletedStrategy = Boolean(
    overview?.brandIdentity?.valueProposition ||
    (data?.hasStrategy && overview?.generationStatus === "completed")
  );
  const columns = data?.columns;

  // Total count of active suggested ideas across all 4 columns
  const totalSuggestedIdeas = columns
    ? Object.values(columns).reduce((acc, col) => acc + (col.suggested?.length || 0), 0)
    : 0;

  const tabsConfig: Array<{ id: CockpitTabId; label: string; icon: LucideIcon; badge?: string }> = [
    { id: "brand_input", label: "Marka & Girdi", icon: Building2 },
    { id: "brand_identity", label: "Marka Kimliği", icon: Tag, badge: overview?.brandIdentity?.tone ? "Aktif" : undefined },
    { id: "competitor_analysis", label: "Rakip Analizi", icon: Swords, badge: overview?.competitorAnalysis ? "Fırsat" : undefined },
    { id: "target_audience", label: "Hedef Kitle", icon: Target, badge: overview?.audienceVoc ? "Persona" : undefined },
    { id: "growth_plan", label: "Genel Ritim", icon: TrendingUp, badge: overview?.growthStrategy ? "Haftalık" : undefined },
    { id: "platform_growth", label: "Platform Büyümesi", icon: TrendingUp, badge: "Agency" },
  ];

  // Helper hook categories
  const hookCategories = [
    { category: "İkilem / Ters Köşe", color: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe" },
    { category: "Sert Gerçek / FOMO", color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
    { category: "Pratik Çözüm / Taktik", color: "#047857", bg: "#ecfdf5", border: "#a7f3d0" },
    { category: "Gelecek & Vizyon", color: "#0284c7", bg: "#f0f9ff", border: "#bae6fd" },
  ];

  // Helper default weekly schedule
  const defaultWeeklySchedule = [
    { day: "Pazartesi", format: "🎬 Dikey Video", focus: "Acı Noktası & Ekran Bağımlılığı Kancası (Reels)" },
    { day: "Salı", format: "💬 Story / Anket", focus: "Ebeveyn İkilemi & Soru-Cevap Etkileşimi" },
    { day: "Çarşamba", format: "📑 Canva Karosel", focus: "Adım Adım Mini STEM Deneyi (Kaydetmelik Rehber)" },
    { day: "Perşembe", format: "⚡ Hikâye / DM", focus: "Atölyeden Canlı Üretim Anı & Kayıt Çağrısı" },
    { day: "Cuma", format: "📢 Tekil / İnfografik", focus: "Yeni Nesil 2030 Becerileri & Sektörel Gerçek" },
    { day: "Cumartesi", format: "🎬 Kısa Video", focus: "Öğrenci / Proje Başarısı (Sosyal Kanıt)" },
    { day: "Pazar", format: "🧭 İlham & Vizyon", focus: "Haftalık Özet & Ebeveyne İlham Verici Mesaj" },
  ];

  // Helper hashtag groups
  const brandSlug = (brandName || "marka").toLowerCase().replace(/[^a-z0-9]/g, "");
  const hashtagGroups = [
    {
      title: "Geniş Kitle (Keşfet)",
      tags: ["#robotikkodlama", "#stemturkiye", "#cocukgelisimi", "#yapayzeka", "#egitim"],
    },
    {
      title: "Niş & Topluluk (Hedef Anne-Baba)",
      tags: ["#ekransızetkinlik", "#yaraticicocuk", "#oyunlatasarim", "#kodlayanminikler", "#montessoriturkiye"],
    },
    {
      title: "Marka & Seri Etiketleri",
      tags: [`#${brandSlug}`, `#${brandSlug}atolyesi`, `#geleceginbecerileri`],
    },
  ];

  function copyAllHashtags() {
    const allTags = hashtagGroups.flatMap((g) => g.tags).join(" ");
    navigator.clipboard.writeText(allTags);
    setCopiedHashtags(true);
    setTimeout(() => setCopiedHashtags(false), 2000);
  }

  return (
    <div className="strategy-container w-full">
      {/* ========================================================
          ANA 2 SEKME: 1. STRATEJİ KOKPİTİ | 2. İÇERİK ÖNERİLERİ
      ======================================================== */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
        <div className="strategy-main-nav-bar">
          <button
            type="button"
            onClick={() => setMainTab("cockpit")}
            className={`strategy-main-nav-btn ${mainTab === "cockpit" ? "active" : ""}`}
          >
            <Compass size={17} />
            <span>Strateji Kokpiti</span>
          </button>

          <button
            type="button"
            onClick={() => setMainTab("content_ideas")}
            className={`strategy-main-nav-btn ${mainTab === "content_ideas" ? "active" : ""}`}
          >
            <Sparkles size={17} />
            <span>İçerik Önerileri</span>
            <span className="strategy-main-nav-badge">
              {totalSuggestedIdeas}
            </span>
          </button>
        </div>

        {/* Bilgilendirme Rozeti & Fikir Makinesi Butonu */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {mainTab === "content_ideas" && (
            <>
              <button
                type="button"
                onClick={() => openIdeaMachineModal("all", "")}
                className="button primary text-xs"
                style={{
                  height: "34px",
                  padding: "0 13px",
                  gap: "6px",
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                  boxShadow: "0 2px 8px rgba(99, 102, 241, 0.25)",
                }}
                title="4 kolonda aynı anda tematik içerik fikirleri üretir"
              >
                <Zap size={14} style={{ color: "#fef08a" }} />
                <span>⚡ Fikir Makinesi</span>
              </button>

              {totalSuggestedIdeas > 0 && (
                <button
                  type="button"
                  onClick={handleResetAllIdeas}
                  disabled={resettingIdeas}
                  className="button secondary text-xs"
                  style={{
                    height: "34px",
                    padding: "0 10px",
                    gap: "5px",
                    fontWeight: 600,
                    fontSize: "11.5px",
                    color: "#64748b",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                  }}
                  title="Tüm içerik önerilerini temizler"
                >
                  {resettingIdeas ? <RefreshCw size={13} className="spin" /> : <RotateCcw size={13} />}
                  <span>{resettingIdeas ? "Temizleniyor..." : "Önerileri Temizle"}</span>
                </button>
              )}
            </>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "var(--muted)" }}>
            {mainTab === "cockpit" ? (
              <span>Marka girdileri, rakip açıkları ve haftalık büyüme rehberi</span>
            ) : (
              <span>4 formatlık içerik fikirleri matrisi (Reels, Karosel, Tekil, Story)</span>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================
          1. ANA SEKME: STRATEJİ KOKPİTİ
      ======================================================== */}
      {mainTab === "cockpit" && (
        <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Kokpit Alt Sekmeler (Maksimum 2 Kelime) */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
            <div className="cockpit-tabs-bar">
              {tabsConfig.map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`cockpit-tab-btn ${isActive ? "active" : ""}`}
                  >
                    <TabIcon size={14} />
                    <span>{tab.label}</span>
                    {tab.badge && <span className="cockpit-tab-badge">{tab.badge}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Alt Sekme 1: Marka & Girdi (Form İçeriği) */}
          {activeTab === "brand_input" && (
            <div className="cockpit-tab-content-panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px", paddingBottom: "14px", borderBottom: "1px solid #f0f0f5" }}>
                <div>
                  <h4 style={{ margin: 0, font: "700 14px 'Manrope'", color: "var(--text)" }}>Marka ve Analiz Girdileri</h4>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                    Sosyal kanalları, rakipleri ve değer vaadini girin; yapay zeka stratejiyi bu temele göre üretsin.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleSaveBrandOnly}
                    disabled={savingBrand || !brandName.trim()}
                    className="button secondary text-xs"
                    style={{ height: "36px", padding: "0 13px", fontWeight: "700" }}
                    title="Marka vaadi ve niş özetini kaydeder"
                  >
                    {savingBrand ? <RefreshCw className="spin" size={13} /> : <CheckCircle2 size={13} style={{ color: "#10b981" }} />}
                    <span>{savingBrand ? "Kaydediliyor..." : "Bilgileri Kaydet"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerateFullStrategy}
                    disabled={generating || !brandName.trim()}
                    className="button primary text-xs"
                    style={{ height: "36px", padding: "0 14px" }}
                  >
                    {generating ? (
                      <>
                        <RefreshCw className="spin" size={13} />
                        <span>Strateji Üretiliyor...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} />
                        <span>{hasCompletedStrategy ? "Stratejiyi Yeniden Üret" : "Stratejiyi Başlat"}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {generating && (
                <div style={{
                  margin: "0 0 16px 0",
                  padding: "16px 18px",
                  background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)",
                  border: "1px solid rgba(99, 102, 241, 0.25)",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <RefreshCw className="spin" size={17} style={{ color: "#6366f1" }} />
                      <span style={{ fontWeight: "700", fontSize: "14px", color: "#1e1b4b" }}>
                        Hermes Agent Strateji & Pazar Araştırması Yürütüyor...
                      </span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#6366f1", fontWeight: "700", background: "rgba(99, 102, 241, 0.12)", padding: "2px 8px", borderRadius: "6px" }}>
                      Aşama {generationPhase} / 3
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                    <div style={{
                      padding: "8px 10px",
                      borderRadius: "8px",
                      background: generationPhase >= 1 ? "rgba(99, 102, 241, 0.14)" : "rgba(0,0,0,0.03)",
                      border: generationPhase === 1 ? "1px solid #6366f1" : "1px solid transparent",
                      fontSize: "11px",
                      color: generationPhase >= 1 ? "#312e81" : "#94a3b8",
                      fontWeight: generationPhase === 1 ? "700" : "500"
                    }}>
                      1. Pazar & Rakip Taraması
                    </div>
                    <div style={{
                      padding: "8px 10px",
                      borderRadius: "8px",
                      background: generationPhase >= 2 ? "rgba(99, 102, 241, 0.14)" : "rgba(0,0,0,0.03)",
                      border: generationPhase === 2 ? "1px solid #6366f1" : "1px solid transparent",
                      fontSize: "11px",
                      color: generationPhase >= 2 ? "#312e81" : "#94a3b8",
                      fontWeight: generationPhase === 2 ? "700" : "500"
                    }}>
                      2. Değer Vaadi & Kitle (VOC)
                    </div>
                    <div style={{
                      padding: "8px 10px",
                      borderRadius: "8px",
                      background: generationPhase >= 3 ? "rgba(99, 102, 241, 0.14)" : "rgba(0,0,0,0.03)",
                      border: generationPhase === 3 ? "1px solid #6366f1" : "1px solid transparent",
                      fontSize: "11px",
                      color: generationPhase >= 3 ? "#312e81" : "#94a3b8",
                      fontWeight: generationPhase === 3 ? "700" : "500"
                    }}>
                      3. 4 Formatta 12 Viral Fikir
                    </div>
                  </div>

                  <div style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Sparkles size={13} style={{ color: "#6366f1", flexShrink: 0 }} />
                    <span>
                      İşlem arka planda kesintisiz çalışmaktadır. Sayfayı yenileseniz dahi devam eder ve tamamlandığında paneller otomatik güncellenir.
                    </span>
                  </div>
                </div>
              )}

              <form onSubmit={handleGenerateFullStrategy}>
                <div className="strategy-form-grid">
                  <div className="strategy-field">
                    <label className="strategy-field-label">Marka / Proje Adı *</label>
                    <input
                      type="text"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="Örn: Atölye Hanem"
                      className="strategy-input"
                      required
                    />
                  </div>

                  <div className="strategy-field">
                    <label className="strategy-field-label">Hedef Sosyal Kanallar</label>
                    <div className="channel-tag-group" style={{ height: "40px", alignItems: "center" }}>
                      {["Instagram", "TikTok", "YouTube"].map((ch) => {
                        const isActive = socialChannels.includes(ch);
                        return (
                          <div
                            key={ch}
                            onClick={() => {
                              if (isActive) setSocialChannels(socialChannels.filter((c) => c !== ch));
                              else setSocialChannels([...socialChannels, ch]);
                            }}
                            className={`channel-tag-chip ${isActive ? "active" : ""}`}
                          >
                            {isActive && <CheckCircle2 size={12} />}
                            <span>{ch}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="strategy-field">
                    <label className="strategy-field-label">Rakipler / Örnek Hesaplar</label>
                    <input
                      type="text"
                      value={competitorsText}
                      onChange={(e) => setCompetitorsText(e.target.value)}
                      placeholder="@rakip1, @rakip2, @sektor_hesabi"
                      className="strategy-input"
                    />
                  </div>
                </div>

                <div className="strategy-field" style={{ marginTop: "14px" }}>
                  <label className="strategy-field-label">Marka Değer Vaadi &amp; Niş Özeti</label>
                  <textarea
                    value={brandDescription}
                    onChange={(e) => setBrandDescription(e.target.value)}
                    placeholder="Örn: Çocuklar ve gençler için ahşap STEM ve robotik atölyesi. Ebeveynlerin ekran bağımlılığı endişesine pratik üretkenlik çözümü sunuyoruz."
                    className="strategy-textarea"
                    rows={3}
                  />
                </div>
              </form>
            </div>
          )}

          {/* Alt Sekme 2: Marka Kimliği */}
          {activeTab === "brand_identity" && (
            <div className="cockpit-tab-content-panel">
              {overview?.brandIdentity ? (
                <div className="cockpit-detail-grid">
                  <div className="cockpit-detail-card highlight">
                    <div className="cockpit-detail-title">
                      <Tag size={15} style={{ color: "var(--primary)" }} />
                      <span>İletişim Tonu &amp; Üslup</span>
                    </div>
                    <div className="cockpit-detail-body">
                      <span className="cockpit-pill-tag" style={{ background: "#eef2ff", color: "#4338ca", borderColor: "#c7d2fe", fontWeight: "700" }}>
                        {overview.brandIdentity.tone}
                      </span>
                    </div>
                  </div>

                  <div className="cockpit-detail-card">
                    <div className="cockpit-detail-title">
                      <span>💡</span>
                      <span>Temel Değer Vaadi</span>
                    </div>
                    <div className="cockpit-detail-body">
                      {overview.brandIdentity.valueProposition}
                    </div>
                  </div>

                  <div className="cockpit-detail-card">
                    <div className="cockpit-detail-title">
                      <span>📍</span>
                      <span>Stratejik Konumlandırma</span>
                    </div>
                    <div className="cockpit-detail-body">
                      {overview.brandIdentity.positioning || "Belirtilmedi"}
                    </div>
                  </div>

                  <div className="cockpit-detail-card" style={{ gridColumn: "1 / -1", background: "#f8fafc" }}>
                    <div className="cockpit-detail-title">
                      <span>📢</span>
                      <span>Kilit Mesaj &amp; Slogan</span>
                    </div>
                    <div className="cockpit-detail-body" style={{ fontStyle: "italic", fontWeight: "600", color: "#1e293b" }}>
                      &ldquo;{overview.brandIdentity.keyMessaging}&rdquo;
                    </div>
                  </div>

                  {overview.brandIdentity.brandArchetype && (
                    <div className="cockpit-detail-card highlight" style={{ background: "#fefce8", borderColor: "#fef08a" }}>
                      <div className="cockpit-detail-title" style={{ color: "#854d0e" }}>
                        <span>🛡️</span>
                        <span>Marka Arketipi (Agency Brand Guardian)</span>
                      </div>
                      <div className="cockpit-detail-body" style={{ color: "#713f12", fontWeight: 700, fontSize: "13px" }}>
                        {overview.brandIdentity.brandArchetype}
                      </div>
                    </div>
                  )}

                  {overview.brandIdentity.visualDirectives && (
                    <div className="cockpit-detail-card" style={{ gridColumn: "1 / -1", background: "#f8fafc" }}>
                      <div className="cockpit-detail-title">
                        <span>🎨</span>
                        <span>Görsel Kimlik &amp; Tasarım Direktifleri</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px", marginTop: "4px" }}>
                        <div>
                          <strong>Estetik Yaklaşım:</strong> {overview.brandIdentity.visualDirectives.primaryAesthetic}
                        </div>
                        <div>
                          <strong>Fotoğrafik Stil:</strong> {overview.brandIdentity.visualDirectives.photoStyle}
                        </div>
                        {overview.brandIdentity.visualDirectives.forbiddenCliches?.length > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
                            <span style={{ fontSize: "11px", color: "#dc2626", fontWeight: 700 }}>⛔ Kaçınılacak Klişeler:</span>
                            {overview.brandIdentity.visualDirectives.forbiddenCliches.map((cliche, cIdx) => (
                              <span key={cIdx} style={{ fontSize: "10.5px", background: "#fee2e2", color: "#991b1b", padding: "1px 6px", borderRadius: "4px", border: "1px solid #fecaca" }}>
                                {cliche}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-gray-500">
                  Henüz strateji üretilmedi. Lütfen <strong>Marka &amp; Girdi</strong> sekmesinden stratejiyi başlatın.
                </div>
              )}
            </div>
          )}

          {/* Alt Sekme 3: Rakip Analizi (⚡ Fikir Üret Destekli) */}
          {activeTab === "competitor_analysis" && (
            <div className="cockpit-tab-content-panel">
              {overview?.competitorAnalysis ? (
                <div className="cockpit-detail-grid">
                  {/* Rakip Açıkları */}
                  <div className="cockpit-detail-card">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                      <div className="cockpit-detail-title">
                        <Swords size={15} style={{ color: "#7c3aed" }} />
                        <span>Sektör &amp; Rakip İçerik Açıkları</span>
                      </div>
                      {overview.competitorAnalysis.liveOutlierCount ? (
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "99px", background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" }}>
                          ✓ {overview.competitorAnalysis.liveOutlierCount} Canlı Kazıyıcı Analizi
                        </span>
                      ) : null}
                    </div>
                    {overview.competitorAnalysis.liveOutlierSummary && (
                      <p style={{ margin: "4px 0 8px", fontSize: "11px", color: "#64748b", fontStyle: "italic" }}>
                        {overview.competitorAnalysis.liveOutlierSummary}
                      </p>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {(overview.competitorAnalysis.contentGaps || []).map((gap, i) => (
                        <div key={i} className="cockpit-interactive-item">
                          <span style={{ fontSize: "11.5px", color: "#334155" }}>• {gap}</span>
                          <button
                            type="button"
                            disabled={topicLoading === gap}
                            onClick={() => openIdeaMachineModal("vertical_video", gap)}
                            className="btn-topic-generate"
                            title="Bu açığa özel Fikir Makinesi'ni aç"
                          >
                            <Zap size={10} />
                            <span>Fikir Üret</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Uyarlanacak Viral Modeller */}
                  <div className="cockpit-detail-card">
                    <div className="cockpit-detail-title">
                      <Zap size={15} style={{ color: "#d97706" }} />
                      <span>Uyarlanacak Viral Modeller</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {(overview.competitorAnalysis.viralPatternsToAdapt || []).length > 0 ? (
                        overview.competitorAnalysis.viralPatternsToAdapt.map((pat, i) => (
                          <div key={i} className="cockpit-interactive-item">
                            <span style={{ fontSize: "11.5px", color: "#334155" }}>✦ {pat}</span>
                            <button
                              type="button"
                              onClick={() => openIdeaMachineModal("carousel", pat)}
                              className="btn-topic-generate"
                              title="Bu viral modeli kullanarak Fikir Makinesi'ni aç"
                            >
                              <Zap size={10} />
                              <span>Fikir Üret</span>
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-gray-500">Ters köşe kancalar ve adım adım dönüşüm formatları.</div>
                      )}
                    </div>
                  </div>

                  {/* Farklılaşma Açısı */}
                  <div className="cockpit-detail-card highlight" style={{ gridColumn: "1 / -1", background: "#faf5ff", borderColor: "#f3e8ff" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <div className="cockpit-detail-title" style={{ color: "#6d28d9" }}>
                        <span>✦</span>
                        <span>Markanın Farklılaşma Açısı (Unfair Advantage)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openIdeaMachineModal("single_post", overview.competitorAnalysis.differentiationAngle)}
                        className="btn-topic-generate"
                        title="Bu farklılaşma açısıyla Fikir Makinesi'ni aç"
                      >
                        <Zap size={10} />
                        <span>Bu Açıyla Fikir Üret</span>
                      </button>
                    </div>
                    <div className="cockpit-detail-body" style={{ color: "#5b21b6", fontWeight: "600", fontSize: "13px" }}>
                      {overview.competitorAnalysis.differentiationAngle}
                    </div>
                  </div>

                  {overview.competitorAnalysis.competitorWeaknesses && overview.competitorAnalysis.competitorWeaknesses.length > 0 && (
                    <div className="cockpit-detail-card" style={{ gridColumn: "1 / -1", background: "#fff1f2", borderColor: "#fecdd3" }}>
                      <div className="cockpit-detail-title" style={{ color: "#9f1239" }}>
                        <span>⚠️</span>
                        <span>Rakiplerin En Çok Eleştirilen Eksiklikleri (Comment Mining)</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "4px" }}>
                        {overview.competitorAnalysis.competitorWeaknesses.map((weakness, wIdx) => (
                          <div key={wIdx} style={{ fontSize: "12px", color: "#881337" }}>
                            • {weakness}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-gray-500">
                  Henüz rakip analizi üretilmedi. Lütfen <strong>Marka &amp; Girdi</strong> sekmesinden stratejiyi başlatın.
                </div>
              )}
            </div>
          )}

          {/* Alt Sekme 4: Hedef Kitle (VOC, Acı Noktaları & Kanca Laboratuvarı) */}
          {activeTab === "target_audience" && (
            <div className="cockpit-tab-content-panel">
              {overview?.audienceVoc ? (
                <div className="cockpit-detail-grid">
                  {/* Persona */}
                  <div className="cockpit-detail-card highlight" style={{ background: "#fffdfa", borderColor: "#fef3c7" }}>
                    <div className="cockpit-detail-title" style={{ color: "#b45309" }}>
                      <Target size={15} />
                      <span>Hedef Persona Profili</span>
                    </div>
                    <div className="cockpit-detail-body" style={{ color: "#78350f" }}>
                      {overview.audienceVoc.targetPersona}
                    </div>
                  </div>

                  {/* Acı Noktaları (VOC) */}
                  <div className="cockpit-detail-card">
                    <div className="cockpit-detail-title">
                      <span>⚡</span>
                      <span>Müşteri Acı Noktaları (VOC)</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {(overview.audienceVoc.painPoints || []).map((pain, i) => (
                        <div key={i} className="cockpit-interactive-item">
                          <span style={{ fontSize: "11.5px", color: "#334155" }}>• {pain}</span>
                          <button
                            type="button"
                            onClick={() => openIdeaMachineModal("vertical_video", pain)}
                            className="btn-topic-generate"
                            title="Bu acı noktasına çözüm getiren Fikir Makinesi'ni aç"
                          >
                            <Zap size={10} />
                            <span>Fikir Üret</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sıkça Sorulan Sorular / İtirazlar */}
                  <div className="cockpit-detail-card" style={{ gridColumn: "1 / -1" }}>
                    <div className="cockpit-detail-title">
                      <HelpCircle size={15} style={{ color: "#0284c7" }} />
                      <span>Sıkça Sorulan Sorular / İtirazlar</span>
                    </div>
                    <ul className="cockpit-bullet-list">
                      {(overview.audienceVoc.frequentQuestions || []).length > 0 ? (
                        overview.audienceVoc.frequentQuestions.map((q, i) => (
                          <li key={i}>{q}</li>
                        ))
                      ) : (
                        <li>Eğitim/atölye süresi ve çocuğun yaş grubuna uygunluk endişeleri.</li>
                      )}
                    </ul>
                  </div>

                  {/* Kanca (Hook) Laboratuvarı */}
                  <div className="cockpit-detail-card" style={{ gridColumn: "1 / -1", background: "#f8fafc" }}>
                    <div className="cockpit-detail-title">
                      <span>🪝</span>
                      <span>Kazanan Kanca (Hook) Laboratuvarı &amp; Psikolojik Açıları</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "8px", marginTop: "4px" }}>
                      {(overview.audienceVoc.winningHooks || []).map((hook, i) => {
                        const cleanH = hook.replace(/^["'“”]+|["'“”]+$/g, "");
                        const cat = hookCategories[i % hookCategories.length];
                        const isCopied = copiedId === cleanH;
                        return (
                          <div key={i} className="cockpit-hook-item">
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              <span
                                className="cockpit-hook-category"
                                style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.border}`, width: "fit-content" }}
                              >
                                {cat.category}
                              </span>
                              <span style={{ fontSize: "11.5px", color: "#1e293b", fontWeight: "600" }}>
                                &ldquo;{cleanH}&rdquo;
                              </span>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              <button
                                type="button"
                                onClick={() => openIdeaMachineModal("all", cleanH)}
                                className="btn-topic-generate"
                                style={{ padding: "3px 6px" }}
                                title="Bu kancadan Fikir Makinesi ile 4 kolonda içerik üret"
                              >
                                <Zap size={10} />
                                <span>Fikir Üret</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(cleanH);
                                  setCopiedId(cleanH);
                                  setTimeout(() => setCopiedId(null), 2000);
                                }}
                                className="btn-card-action icon-only"
                                title="Kancayı Kopyala"
                              >
                                {isCopied ? <CheckCircle2 size={12} style={{ color: "#10b981" }} /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {overview.audienceVoc.unspokenDesires && overview.audienceVoc.unspokenDesires.length > 0 && (
                    <div className="cockpit-detail-card highlight" style={{ gridColumn: "1 / -1", background: "#f0fdf4", borderColor: "#bbf7d0" }}>
                      <div className="cockpit-detail-title" style={{ color: "#166534" }}>
                        <span>💎</span>
                        <span>Dile Getirilmeyen Derin Müşteri Arzuları (Statü &amp; Duygu Tetikleyicileri)</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "4px" }}>
                        {overview.audienceVoc.unspokenDesires.map((desire, dIdx) => (
                          <div key={dIdx} style={{ fontSize: "12px", color: "#14532d", fontWeight: 600 }}>
                            ✦ {desire}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-gray-500">
                  Henüz hedef kitle verisi üretilmedi. Lütfen <strong>Marka &amp; Girdi</strong> sekmesinden stratejiyi başlatın.
                </div>
              )}
            </div>
          )}

          {/* Alt Sekme 5: Büyüme Planı (Haftalık Şablon & Hashtag Bankası) */}
          {activeTab === "growth_plan" && (
            <div className="cockpit-tab-content-panel">
              {overview?.growthStrategy ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div className="cockpit-detail-grid">
                    {/* Haftalık Hacim */}
                    <div className="cockpit-detail-card highlight" style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
                      <div className="cockpit-detail-title" style={{ color: "#166534" }}>
                        <TrendingUp size={15} />
                        <span>Haftalık Paylaşım Hacmi</span>
                      </div>
                      <div className="cockpit-detail-body" style={{ color: "#14532d", fontWeight: "600" }}>
                        {overview.growthStrategy.weeklyPostingPlan}
                      </div>
                    </div>

                    {/* İçerik Sütunları */}
                    <div className="cockpit-detail-card">
                      <div className="cockpit-detail-title">
                        <span>🏛️</span>
                        <span>Ana İçerik Sütunları (Pillars)</span>
                      </div>
                      <div className="cockpit-tags-list">
                        {(overview.growthStrategy.primaryPillars || []).map((pil, idx) => (
                          <span key={idx} className="cockpit-pill-tag" style={{ background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" }}>
                            #{pil}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Kanal Öncelikleri */}
                    <div className="cockpit-detail-card">
                      <div className="cockpit-detail-title">
                        <span>📱</span>
                        <span>Kanal Öncelikleri</span>
                      </div>
                      <div className="cockpit-tags-list">
                        {(overview.growthStrategy.channelPriorities || socialChannels).map((ch, idx) => (
                          <span key={idx} className="cockpit-pill-tag" style={{ background: "#eff6ff", color: "#1e40af", borderColor: "#dbeafe" }}>
                            {idx + 1}. {ch}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Karşı Konulamaz Teklif (Lead Magnet) & AEO Bilgisi */}
                  {overview.growthStrategy.leadMagnetOffer && (
                    <div className="cockpit-detail-card highlight" style={{ background: "#fefce8", borderColor: "#fef08a" }}>
                      <div className="cockpit-detail-title" style={{ color: "#854d0e" }}>
                        <span>🧲</span>
                        <span>Karşı Konulamaz Teklif (Agency Lead Magnet Kurgusu)</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#713f12" }}>
                        <div><strong>Teklif Kancası:</strong> &ldquo;{overview.growthStrategy.leadMagnetOffer.hook}&rdquo;</div>
                        <div><strong>Teslim Edilecek Değer:</strong> {overview.growthStrategy.leadMagnetOffer.deliverable}</div>
                        <div style={{ background: "#fef08a", padding: "4px 8px", borderRadius: "6px", fontWeight: 700, width: "fit-content" }}>
                          DM / Yorum Tetikleyici: {overview.growthStrategy.leadMagnetOffer.ctaTrigger}
                        </div>
                      </div>
                    </div>
                  )}

                  {overview.growthStrategy.contentDistributionRatio && (
                    <div className="cockpit-detail-card" style={{ background: "#f8fafc" }}>
                      <div className="cockpit-detail-title">
                        <span>📊</span>
                        <span>İçerik Dağıtım Matrisi (ToFu / MoFu / BoFu)</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px", marginTop: "6px" }}>
                        <div style={{ padding: "8px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px" }}>
                          <div style={{ fontSize: "10px", fontWeight: 700, color: "#166534" }}>TOFU (KEŞFET &amp; VİRAL)</div>
                          <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#14532d", marginTop: "2px" }}>
                            {overview.growthStrategy.contentDistributionRatio.tofuAwareness}
                          </div>
                        </div>
                        <div style={{ padding: "8px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "6px" }}>
                          <div style={{ fontSize: "10px", fontWeight: 700, color: "#1e40af" }}>MOFU (GÜVEN &amp; REHBER)</div>
                          <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#1e3a8a", marginTop: "2px" }}>
                            {overview.growthStrategy.contentDistributionRatio.mofuTrust}
                          </div>
                        </div>
                        <div style={{ padding: "8px", background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: "6px" }}>
                          <div style={{ fontSize: "10px", fontWeight: 700, color: "#6b21a8" }}>BOFU (SATIŞ &amp; DÖNÜŞÜM)</div>
                          <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#581c87", marginTop: "2px" }}>
                            {overview.growthStrategy.contentDistributionRatio.bofuConversion}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {overview.growthStrategy.aiSearchAeoDirective && (
                    <div className="cockpit-detail-card" style={{ gridColumn: "1 / -1", background: "#eff6ff", borderColor: "#bfdbfe" }}>
                      <div className="cockpit-detail-title" style={{ color: "#1e40af" }}>
                        <span>🌐</span>
                        <span>Yapay Zeka Arama Motoru Görünürlüğü (Agency AEO Stratejisi)</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "#1e3a8a", lineHeight: "1.5" }}>
                        {overview.growthStrategy.aiSearchAeoDirective}
                      </div>
                    </div>
                  )}

                  {/* 7 Günlük Paylaşım Rutini Şablonu */}
                  <div className="cockpit-detail-card" style={{ background: "#fbfbfd" }}>
                    <div className="cockpit-detail-title">
                      <CalendarDays size={15} style={{ color: "var(--primary)" }} />
                      <span>7 Günlük Örnek İçerik Akış Rutini (Pazartesi - Pazar)</span>
                    </div>
                    <div className="cockpit-schedule-grid" style={{ marginTop: "6px" }}>
                      {defaultWeeklySchedule.map((item, idx) => (
                        <div key={idx} className="cockpit-schedule-card">
                          <div className="cockpit-schedule-day">
                            <span>{item.day}</span>
                          </div>
                          <span className="cockpit-schedule-format">{item.format}</span>
                          <p className="cockpit-schedule-focus">{item.focus}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Hashtag Bankası */}
                  <div className="cockpit-detail-card" style={{ background: "#fbfbfd" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <div className="cockpit-detail-title">
                        <Hash size={15} style={{ color: "#0284c7" }} />
                        <span>Sektörel Niş &amp; Keşfet Hashtag Bankası</span>
                      </div>
                      <button
                        type="button"
                        onClick={copyAllHashtags}
                        className="btn-card-action primary"
                        title="Tüm hashtagleri tek tıkla kopyala"
                      >
                        {copiedHashtags ? <CheckCircle2 size={12} style={{ color: "#10b981" }} /> : <Copy size={12} />}
                        <span>{copiedHashtags ? "Kopyalandı!" : "Tüm Etiketleri Kopyala"}</span>
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px", marginTop: "8px" }}>
                      {hashtagGroups.map((group, gIdx) => (
                        <div key={gIdx} className="cockpit-hashtag-group">
                          <span className="cockpit-hashtag-group-title">{group.title}</span>
                          <div className="cockpit-hashtag-pills">
                            {group.tags.map((tag, tIdx) => (
                              <span key={tIdx} className="cockpit-hashtag-pill">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dönüşüm Hunisi */}
                  <div className="cockpit-detail-card" style={{ background: "#f8fafc" }}>
                    <div className="cockpit-detail-title">
                      <span>🎯</span>
                      <span>Dönüşüm Hunisi (Conversion Funnel)</span>
                    </div>
                    <div className="cockpit-detail-body">
                      {overview.growthStrategy.conversionFunnel || "Farkındalık (Reels) → İlgi (Karosel/Rehber) → Güven (Story/DM) → Kayıt"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-gray-500">
                  Henüz büyüme planı üretilmedi. Lütfen <strong>Marka &amp; Girdi</strong> sekmesinden stratejiyi başlatın.
                </div>
              )}
            </div>
          )}

          {/* Alt Sekme 6: Platform Büyümesi (Agency Swarm) */}
          {activeTab === "platform_growth" && (
            <PlatformGrowthPanel key={projectId} projectId={projectId} />
          )}
        </section>
      )}

      {/* ========================================================
          2. ANA SEKME: İÇERİK ÖNERİLERİ (İÇERİK TÜRÜ KOLON MATRİSİ)
      ======================================================== */}
      {mainTab === "content_ideas" && columns && (
        <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* MOBİL FORMAT SEÇİCİ BAR (Hızlı İçerik Önerileri Tarzı) */}
          <div className="ideas-mobile-format-bar">
            {(Object.keys(COLUMN_CONFIG) as ColumnType[]).map((colType) => {
              const conf = COLUMN_CONFIG[colType];
              const isSelected = mobileActiveCol === colType;
              const Icon = conf.icon;
              const count = (columns[colType]?.suggested || []).length;
              return (
                <button
                  key={colType}
                  type="button"
                  onClick={() => setMobileActiveCol(colType)}
                  className={`ideas-mobile-format-btn ${isSelected ? "selected" : ""}`}
                  style={{
                    border: isSelected ? `2px solid ${conf.iconColor}` : "1px solid #e2e8f0",
                    background: isSelected ? conf.iconBg : "#ffffff",
                    color: isSelected ? conf.iconColor : "#64748b",
                  }}
                >
                  <Icon size={16} />
                  <span style={{ fontSize: "11px", fontWeight: isSelected ? 800 : 600 }}>
                    {conf.title.split(" ")[0]}
                  </span>
                  <span
                    className="ideas-mobile-badge"
                    style={{
                      background: isSelected ? conf.iconColor : "#e2e8f0",
                      color: isSelected ? "#ffffff" : "#475569",
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="kanban-grid">
            {(Object.keys(COLUMN_CONFIG) as ColumnType[]).map((colType) => {
              const conf = COLUMN_CONFIG[colType];
              const activeColTab = colTabs[colType];
              const colData = columns[colType] || { suggested: [], hidden: [] };
              const displayList = activeColTab === "suggested" ? colData.suggested : colData.hidden;
              const isColLoading = colLoading[colType];
              const IconComponent = conf.icon;
              const isMobileHidden = mobileActiveCol !== colType;

              return (
                <div key={colType} className={`kanban-column ${isMobileHidden ? "mobile-hidden-col" : ""}`}>
                  {/* Kolon Başlığı */}
                  <div className="kanban-column-header">
                    <div className="kanban-col-title-wrap">
                      <div
                        className="kanban-col-icon"
                        style={{ background: conf.iconBg, color: conf.iconColor }}
                      >
                        <IconComponent size={15} />
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <h4 className="kanban-col-title">{conf.title}</h4>
                          <span
                            style={{
                              fontSize: "9px",
                              fontWeight: 700,
                              background: conf.iconBg,
                              color: conf.iconColor,
                              padding: "1px 5px",
                              borderRadius: "4px",
                              border: `1px solid ${conf.iconColor}33`,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {conf.agentBadge}
                          </span>
                        </div>
                        <p className="kanban-col-subtitle">{conf.subtitle}</p>
                      </div>
                    </div>
                  </div>

                  {/* Çift Sekme: Öneri vs Gizlenmiş */}
                  <div className="col-subtabs">
                    <button
                      type="button"
                      onClick={() => setColTabs((prev) => ({ ...prev, [colType]: "suggested" }))}
                      className={`col-subtab-btn ${activeColTab === "suggested" ? "active" : ""}`}
                    >
                      <span>Öneri</span>
                      <span className="col-subtab-badge">{colData.suggested.length}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setColTabs((prev) => ({ ...prev, [colType]: "hidden" }))}
                      className={`col-subtab-btn ${activeColTab === "hidden" ? "active" : ""}`}
                    >
                      <span>Gizlenmiş</span>
                      <span className="col-subtab-badge">{colData.hidden.length}</span>
                    </button>
                  </div>

                  {/* Yeni Fikir İste Butonu & Kolon Sıfırla */}
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => handleGenerateMoreForColumn(colType)}
                      disabled={isColLoading || !brandName.trim()}
                      className="btn-request-idea"
                      style={{ flex: 1 }}
                    >
                      {isColLoading ? (
                        <>
                          <RefreshCw className="spin" size={13} />
                          <span>Yeni Fikirler Üretiliyor...</span>
                        </>
                      ) : (
                        <>
                          <Plus size={14} />
                          <span>Yeni Fikir İste</span>
                        </>
                      )}
                    </button>
                    {colData.suggested.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleResetColumnIdeas(colType)}
                        disabled={isColLoading}
                        title={`${conf.title} önerilerini temizle`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "34px",
                          height: "34px",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          background: "#ffffff",
                          color: "#94a3b8",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          flexShrink: 0,
                        }}
                      >
                        <RotateCcw size={12} />
                      </button>
                    )}
                  </div>

                  {/* Fikir Kartları Listesi */}
                  <div className="kanban-cards-stack">
                    {displayList.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "24px 12px", background: "white", borderRadius: "10px", border: "1px dashed #cbd5e1" }}>
                        <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                          {activeColTab === "suggested"
                            ? "Henüz öneri yok. Yukarıdaki butondan yeni fikir isteyebilirsiniz."
                            : "Gizlenmiş içerik bulunmuyor."}
                        </small>
                      </div>
                    ) : (
                      displayList.map((idea) => {
                        const isHidden = idea.status === "hidden";
                        const isCopied = copiedId === (idea.id || idea.title);
                        const cleanHook = (idea.hook || "").replace(/^["'“”]+|["'“”]+$/g, "");
                        return (
                          <div
                            key={idea.id || idea.title}
                            className={`kanban-card ${isHidden ? "is-hidden" : ""}`}
                          >
                            {/* Kart Başlığı */}
                            <div className="kanban-card-head">
                              <h5 className={`kanban-card-title ${isHidden ? "crossed" : ""}`}>{idea.title}</h5>
                              {idea.ideaType && (IDEA_TYPE_LABELS as any)[idea.ideaType] && (
                                <span
                                  className="kanban-type-badge"
                                  style={{
                                    background: (IDEA_TYPE_LABELS as any)[idea.ideaType].bg,
                                    color: (IDEA_TYPE_LABELS as any)[idea.ideaType].color,
                                    borderColor: (IDEA_TYPE_LABELS as any)[idea.ideaType].color + "33",
                                  }}
                                  title={(IDEA_TYPE_LABELS as any)[idea.ideaType].label}
                                >
                                  <span>{(IDEA_TYPE_LABELS as any)[idea.ideaType].icon}</span>
                                  <span>{(IDEA_TYPE_LABELS as any)[idea.ideaType].badge}</span>
                                </span>
                              )}
                            </div>

                            {/* Kanca Kutusu */}
                            <div className="kanban-hook-box">
                              <span className="kanban-hook-tag">Kanca (Hook)</span>
                              <p className="kanban-hook-quote">&ldquo;{cleanHook}&rdquo;</p>
                            </div>

                            {/* Açıklama */}
                            <p className="kanban-card-desc">{idea.description}</p>

                            {/* Akış İskeleti: Etkileşim & Story için Seçilebilir Radio Liste, Diğerleri için Accordion */}
                            {idea.structure && idea.structure.length > 0 && (
                              colType === "engagement" ? (
                                <div className="story-picker-wrap">
                                  <div className="story-picker-label">
                                    <span>Üretilecek Story (1 Adet 9:16)</span>
                                    <span style={{ fontSize: "9px", color: "#64748b", textTransform: "none", fontWeight: "normal" }}>
                                      Seçili olan Canva&apos;ya aktarılır
                                    </span>
                                  </div>
                                  <div className="story-picker-list">
                                    {idea.structure.map((storyStep, sIdx) => {
                                      const cardKey = idea.id || idea.title;
                                      const isSelected = (selectedStoryIndex[cardKey] ?? 0) === sIdx;
                                      return (
                                        <button
                                          key={sIdx}
                                          type="button"
                                          onClick={() => setSelectedStoryIndex((prev) => ({ ...prev, [cardKey]: sIdx }))}
                                          className={`story-picker-option ${isSelected ? "selected" : ""}`}
                                        >
                                          <div className="story-picker-radio" />
                                          <span className="story-picker-text">{storyStep}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <details className="kanban-steps-details">
                                  <summary className="kanban-steps-summary">
                                    <span>Akış İskeleti ({idea.structure.length} Adım)</span>
                                  </summary>
                                  <ul className="kanban-steps-list">
                                    {idea.structure.map((st, sIdx) => (
                                      <li key={sIdx}>{st}</li>
                                    ))}
                                  </ul>
                                </details>
                              )
                            )}

                            {/* Alt Çubuk: Hedef Kanal, Agency Ajanı Rozeti & Aksiyon Butonları */}
                            <div className="kanban-card-footer">
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                <span className="kanban-channel-badge" title={idea.targetChannel}>
                                  {idea.nativeFormat === 'long_video' ? 'YouTube · Uzun video' : idea.targetChannel}
                                </span>
                                {idea.skillSource && (
                                  <span
                                    style={{
                                      fontSize: "9px",
                                      fontWeight: 700,
                                      padding: "1px 6px",
                                      borderRadius: "4px",
                                      background: "#f1f5f9",
                                      color: "#334155",
                                      border: "1px solid #cbd5e1",
                                    }}
                                    title={`Üreten Agency Uzmanı: ${idea.skillSource}`}
                                  >
                                    {idea.skillSource === "marketing-tiktok-strategist"
                                      ? "⚡ TikTok Strategist"
                                      : idea.skillSource === "marketing-carousel-growth-engine"
                                      ? "📚 Carousel Engine"
                                      : idea.skillSource === "marketing-content-creator"
                                      ? "🎨 Content Creator"
                                      : idea.skillSource === "marketing-twitter-engager"
                                      ? "💬 Community Engager"
                                      : "Agency Specialist"}
                                  </span>
                                )}
                              </div>

                              <div className="kanban-card-actions" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: "6px" }}>
                                {/* Sol: İçerik türü ve Canva ön ayar rozeti */}
                                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                  {(() => {
                                    const preset = getCanvaPresetBadge(colType, idea);
                                    return (
                                      <span
                                        style={{
                                          fontSize: "10px",
                                          fontWeight: 700,
                                          padding: "2px 6px",
                                          borderRadius: "6px",
                                          background: preset.bg,
                                          color: preset.color,
                                          border: `1px solid ${preset.border}`,
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "3px",
                                        }}
                                        title={`Canva Ön Ayarı: ${preset.label} (${preset.detail})`}
                                      >
                                        {preset.label}
                                        <small style={{ opacity: 0.8, fontWeight: 500 }}>• {preset.detail}</small>
                                      </span>
                                    );
                                  })()}
                                </div>

                                {/* Sağ: Aksiyon butonları */}
                                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                  <button
                                    type="button"
                                    onClick={() => idea.id && handleToggleHideIdea(idea.id)}
                                    className="btn-card-action icon-only"
                                    title={isHidden ? "Görünür Yap (Önerilere Taşı)" : "Gizle (Kullanıldı / Reddedildi)"}
                                  >
                                    {isHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => copyIdeaText(idea)}
                                    className="btn-card-action icon-only"
                                    title={isCopied ? "Panoya Kopyalandı!" : "Fikri ve Akış Planını Kopyala"}
                                    style={isCopied ? { background: "#ecfdf5", borderColor: "#a7f3d0", color: "#059669" } : undefined}
                                  >
                                    {isCopied ? (
                                      <CheckCircle2 size={12} style={{ color: "#10b981" }} />
                                    ) : (
                                      <Copy size={12} />
                                    )}
                                  </button>

                                  {/* Faz 1: Dikey Video için Google Vids AI Video Stüdyosu Köprüsü */}
                                  {colType === "vertical_video" && (
                                    <button
                                      type="button"
                                      onClick={() => handleSendToGoogleVids(idea)}
                                      className="btn-card-action"
                                      style={{ background: "#fdf2f8", borderColor: "#fbcfe8", color: "#db2777", fontWeight: 700 }}
                                      title="Google Vids AI Video Stüdyosu'na Aktar (Otomatik Gizlenene Taşınır)"
                                    >
                                      <Clapperboard size={12} />
                                      <span>Vids</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleSendToCanva(idea)}
                                    className="btn-card-action primary"
                                    title={`Canva Stüdyosuna Ön Ayarlı Aktar (${getCanvaPresetBadge(colType, idea).label})`}
                                    style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 8px" }}
                                  >
                                    <Palette size={12} />
                                    <span>Canva&apos;ya Aktar</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ========================================================
          FİKİR MAKİNESİ / TİPLEŞTİRİLMİŞ İÇERİK ÖNERİSİ MODALI
      ======================================================== */}
      {ideaModalOpen && (
        <div className="idea-machine-backdrop" onClick={() => !modalSubmitting && setIdeaModalOpen(false)}>
          <div className="idea-machine-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="idea-machine-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f5f3ff", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Zap size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, font: "700 15px 'Manrope'", color: "var(--text)" }}>
                    {modalTargetCol === "all"
                      ? "⚡ Fikir Makinesi (Tüm Kolonlar)"
                      : `${COLUMN_CONFIG[modalTargetCol].title} İçin Yeni Fikir`}
                  </h4>
                  <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "var(--muted)" }}>
                    {modalTargetCol === "all"
                      ? "4 formatta (Video, Karosel, Tekil, Story) aynı anda içerik üretin"
                      : `Sadece ${COLUMN_CONFIG[modalTargetCol].title} formatına özel 3 yeni fikir üretin`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="icon-button"
                disabled={modalSubmitting}
                onClick={() => setIdeaModalOpen(false)}
                title="Kapat"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleIdeaMachineSubmit}>
              <div className="idea-machine-body">
                {/* 1. İçerik Tipi Seçimi */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text)", marginBottom: "6px" }}>
                    Ne tip içerik önerisi istiyorsunuz? <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: "11px" }}>(İsteğe bağlı)</span>
                  </label>
                  <div className="idea-machine-type-grid">
                    {(Object.keys(IDEA_TYPE_LABELS) as IdeaType[]).map((tKey) => {
                      const tInfo = IDEA_TYPE_LABELS[tKey];
                      const isSelected = modalIdeaType === tKey;
                      return (
                        <button
                          key={tKey}
                          type="button"
                          disabled={modalSubmitting}
                          onClick={() => setModalIdeaType(isSelected ? "" : tKey)}
                          className={`idea-machine-type-btn ${isSelected ? "active" : ""}`}
                          style={{
                            borderColor: isSelected ? tInfo.color : "#e2e8f0",
                            background: isSelected ? tInfo.bg : "#ffffff",
                            color: isSelected ? tInfo.color : "#334155",
                          }}
                        >
                          <span style={{ fontSize: "14px" }}>{tInfo.icon}</span>
                          <span style={{ fontWeight: isSelected ? 800 : 600 }}>{tInfo.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Özel Konu / Bağlam Kutusu */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)" }}>
                      Özel Konu / Anahtar Kelime <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: "11px" }}>(İsteğe bağlı)</span>
                    </label>
                    {modalTopic && (
                      <button
                        type="button"
                        onClick={() => setModalTopic("")}
                        style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "11px", cursor: "pointer" }}
                      >
                        Temizle
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={modalTopic}
                    onChange={(e) => setModalTopic(e.target.value)}
                    placeholder={
                      modalIdeaType === "campaign_discount"
                        ? "Örn: Hafta sonu atölye kayıtlarında %20 erken kayıt indirimi..."
                        : modalIdeaType === "problem_solution"
                        ? "Örn: Tablet kullanımı ve çocuklarda ekran bağımlılığı..."
                        : "Örn: Tablet kullanımı, ahşap STEM robot, okul öncesi odaklanma..."
                    }
                    className="strategy-input"
                    disabled={modalSubmitting}
                    style={{ width: "100%", height: "38px", fontSize: "12.5px" }}
                  />
                  <p style={{ margin: "5px 0 0", fontSize: "11px", color: "var(--muted)", lineHeight: 1.4 }}>
                    {!modalIdeaType && !modalTopic.trim() && (
                      <span>💡 <strong>Boş bırakılırsa:</strong> Mevcut strateji ve kitle verilerine göre genel taze fikirler üretilir.</span>
                    )}
                    {modalIdeaType && !modalTopic.trim() && (
                      <span>🎯 <strong>Yalnızca tip seçildi:</strong> Seçtiğiniz tipe uygun konuları yapay zeka belirleyerek fikir üretecek.</span>
                    )}
                    {!modalIdeaType && modalTopic.trim() && (
                      <span>📝 <strong>Yalnızca konu yazıldı:</strong> Bu konuda her tipte (fayda, problem-çözüm, bilinirlik vb.) çok yönlü fikirler üretilecek.</span>
                    )}
                    {modalIdeaType && modalTopic.trim() && (
                      <span>⚡ <strong>Hem tip hem konu seçildi:</strong> Belirttiğiniz konuda doğrudan seçtiğiniz amaca yönelik nokta atışı fikirler üretilecek.</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="idea-machine-footer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: modalResetFirst ? "#7c3aed" : "#64748b",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={modalResetFirst}
                    onChange={(e) => setModalResetFirst(e.target.checked)}
                    disabled={modalSubmitting}
                    style={{ accentColor: "#7c3aed", cursor: "pointer", width: "14px", height: "14px" }}
                  />
                  <span>{modalTargetCol === "all" ? "Mevcut önerileri sıfırla ve baştan üret" : "Bu kolondaki mevcut fikirleri sıfırla"}</span>
                </label>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setIdeaModalOpen(false)}
                    disabled={modalSubmitting}
                    className="button secondary text-xs"
                    style={{ height: "34px", padding: "0 12px" }}
                  >
                    Vazgeç
                  </button>

                  <button
                    type="submit"
                    disabled={modalSubmitting}
                    className="button primary text-xs"
                    style={{
                      height: "34px",
                      padding: "0 16px",
                      fontWeight: 700,
                      gap: "6px",
                      background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                    }}
                  >
                    {modalSubmitting ? (
                      <>
                        <RefreshCw className="spin" size={13} />
                        <span>Fikirler Üretiliyor...</span>
                      </>
                    ) : (
                      <>
                        <Zap size={13} style={{ color: "#fef08a" }} />
                        <span>
                          {modalResetFirst
                            ? (modalTargetCol === "all" ? "Sıfırla & Baştan Üret" : "Sıfırla & Yeni Üret")
                            : (modalTargetCol === "all" ? "Fikir Makinesini Çalıştır" : "Yeni Fikirleri Üret")}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
