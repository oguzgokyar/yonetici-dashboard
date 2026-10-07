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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  ColumnType,
  StrategyOverview,
  StrategyIdea,
} from "@/lib/server/strategy-generator";

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
  { title: string; subtitle: string; icon: LucideIcon; iconBg: string; iconColor: string; defaultTarget: string }
> = {
  vertical_video: {
    title: "Dikey Video",
    subtitle: "Reels / TikTok (9:16)",
    icon: Video,
    iconBg: "#fdf2f8",
    iconColor: "#db2777",
    defaultTarget: "Reels / TikTok",
  },
  carousel: {
    title: "Karosel Seri",
    subtitle: "Canva Carousel (5-7 Slayt)",
    icon: Layers,
    iconBg: "#eef2ff",
    iconColor: "#4f46e5",
    defaultTarget: "Instagram Carousel",
  },
  single_post: {
    title: "Tekil / İnfografik",
    subtitle: "Vurgu, Alıntı & Haber",
    icon: FileText,
    iconBg: "#ecfeff",
    iconColor: "#0891b2",
    defaultTarget: "Instagram / LinkedIn",
  },
  engagement: {
    title: "Etkileşim & Story",
    subtitle: "Anket, İkilem & DM",
    icon: MessageCircle,
    iconBg: "#ecfdf5",
    iconColor: "#059669",
    defaultTarget: "Instagram Story",
  },
};

type MainTab = "cockpit" | "content_ideas";
type CockpitTabId = "brand_input" | "brand_identity" | "competitor_analysis" | "target_audience" | "growth_plan";

export function StrategyStudio({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
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

  // Column generation loading states
  const [colLoading, setColLoading] = useState<Record<ColumnType, boolean>>({
    vertical_video: false,
    carousel: false,
    single_post: false,
    engagement: false,
  });

  // Specific topic idea generation loading
  const [topicLoading, setTopicLoading] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedHashtags, setCopiedHashtags] = useState(false);

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
      } else if (json.initialData) {
        setBrandName(json.initialData.brandName || "");
        setBrandDescription(json.initialData.brandDescription || "");
        setSocialChannels(json.initialData.socialChannels || ["Instagram", "TikTok", "YouTube"]);
      }
    } catch (e) {
      console.error("Load strategy error:", e);
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
        } else if (json.initialData) {
          setBrandName(json.initialData.brandName || "");
          setBrandDescription(json.initialData.brandDescription || "");
          setSocialChannels(json.initialData.socialChannels || ["Instagram", "TikTok", "YouTube"]);
        }
      })
      .catch((e) => {
        console.error("Load strategy error:", e);
      });

    return () => {
      ignore = true;
    };
  }, [projectId]);

  async function handleGenerateFullStrategy(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (generating) return;
    if (!brandName.trim()) {
      alert("Lütfen bir marka / proje adı girin.");
      return;
    }

    setGenerating(true);
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
      } else {
        alert("Hata: " + (json.error || "Strateji üretilemedi."));
        await loadStrategy();
      }
    } catch (e: unknown) {
      alert("Hata: " + (e instanceof Error ? e.message : String(e)));
      await loadStrategy();
    } finally {
      setGenerating(false);
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

  async function handleGenerateMoreForColumn(columnType: ColumnType) {
    setColLoading((prev) => ({ ...prev, [columnType]: true }));
    try {
      const res = await fetch(`/api/projects/${projectId}/strategy/ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnType }),
      });
      const json = await res.json();
      if (json.success && json.ideas) {
        setData((prev) => {
          if (!prev) return prev;
          const nextCols = { ...prev.columns };
          nextCols[columnType].suggested = [
            ...json.ideas,
            ...nextCols[columnType].suggested,
          ];
          return { ...prev, columns: nextCols };
        });
        setColTabs((prev) => ({ ...prev, [columnType]: "suggested" }));
      } else {
        alert("Hata: " + (json.error || "Yeni fikir üretilemedi."));
      }
    } catch (e: unknown) {
      alert("Hata: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setColLoading((prev) => ({ ...prev, [columnType]: false }));
    }
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

  async function handleSendToCanva(idea: StrategyIdea) {
    const confirmMsg = `"${idea.title}" fikri Canva Tasarım Stüdyosu'na aktarılacak ve 'Gizlenmiş' sekmesine taşınacak.\n\nOnaylıyor musunuz?`;
    if (!window.confirm(confirmMsg)) {
      return;
    }

    // 1. Automatically move idea to 'hidden' (consumed) if it has an id
    if (idea.id && idea.status !== "hidden") {
      await handleToggleHideIdea(idea.id);
    }

    // 2. Build full rich creative brief / prompt from card details
    const cleanHook = (idea.hook || "").replace(/^["'“”]+|["'“”]+$/g, "");
    const structureText = idea.structure && idea.structure.length > 0
      ? `\nAkış ve Slayt Planı:\n${idea.structure.map((s, idx) => `${idx + 1}. ${s}`).join("\n")}`
      : "";

    const fullPrompt = [
      `Başlık: ${idea.title}`,
      idea.targetChannel ? `Hedef Kanal: ${idea.targetChannel}` : "",
      cleanHook ? `\nKanca (Hook):\n"${cleanHook}"` : "",
      idea.description ? `\nKonu & İçerik Özeti:\n${idea.description}` : "",
      structureText,
    ].filter(Boolean).join("\n").trim();

    // Determine target Canva content type
    let targetContentType = "instagram_post";
    let targetSlideCount = 5;

    if (idea.columnType === "vertical_video") {
      targetContentType = "reels_video";
      targetSlideCount = 6;
    } else if (idea.columnType === "carousel") {
      targetContentType = "instagram_carousel";
      targetSlideCount = Math.max(3, Math.min(10, idea.structure?.length || 5));
    } else if (idea.columnType === "engagement") {
      targetContentType = "instagram_story";
      targetSlideCount = 3;
    } else {
      targetContentType = "instagram_post";
      targetSlideCount = 1;
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

      router.push(`/projects/${projectId}/image-generation?studio=canva`);
    } catch {
      router.push(`/projects/${projectId}/image-generation?studio=canva`);
    }
  }

  function copyIdeaText(idea: StrategyIdea) {
    const text = `📌 ${idea.title}\n⚡ Kanca: ${idea.hook}\n📝 Açıklama: ${idea.description}\n🎯 Hedef: ${idea.targetChannel}`;
    navigator.clipboard.writeText(text);
    setCopiedId(idea.id || idea.title);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const overview = data?.strategy;
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
    { id: "growth_plan", label: "Büyüme Planı", icon: TrendingUp, badge: overview?.growthStrategy ? "Haftalık" : undefined },
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

        {/* Bilgilendirme Rozeti */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "var(--muted)" }}>
          {mainTab === "cockpit" ? (
            <span>Marka girdileri, rakip açıkları ve haftalık büyüme rehberi</span>
          ) : (
            <span>4 formatlık içerik fikirleri matrisi (Reels, Karosel, Tekil, Story)</span>
          )}
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
                        <span>{overview ? "Stratejiyi Yeniden Üret" : "Stratejiyi Başlat"}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

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
                    <div className="cockpit-detail-title">
                      <Swords size={15} style={{ color: "#7c3aed" }} />
                      <span>Sektör &amp; Rakip İçerik Açıkları</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {(overview.competitorAnalysis.contentGaps || []).map((gap, i) => (
                        <div key={i} className="cockpit-interactive-item">
                          <span style={{ fontSize: "11.5px", color: "#334155" }}>• {gap}</span>
                          <button
                            type="button"
                            disabled={topicLoading === gap}
                            onClick={() => handleGenerateFromTopic(gap, "vertical_video")}
                            className="btn-topic-generate"
                            title="Bu rakip açığını hedefleyen 3 yeni video fikri üret"
                          >
                            {topicLoading === gap ? <RefreshCw size={10} className="spin" /> : <Zap size={10} />}
                            <span>{topicLoading === gap ? "Üretiliyor..." : "Fikir Üret"}</span>
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
                              disabled={topicLoading === pat}
                              onClick={() => handleGenerateFromTopic(pat, "carousel")}
                              className="btn-topic-generate"
                              title="Bu viral modeli kullanarak 3 yeni karosel fikri üret"
                            >
                              {topicLoading === pat ? <RefreshCw size={10} className="spin" /> : <Zap size={10} />}
                              <span>{topicLoading === pat ? "Üretiliyor..." : "Fikir Üret"}</span>
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
                        disabled={topicLoading === overview.competitorAnalysis.differentiationAngle}
                        onClick={() => handleGenerateFromTopic(overview.competitorAnalysis.differentiationAngle, "single_post")}
                        className="btn-topic-generate"
                        title="Bu farklılaşma açısıyla yeni içerikler üret"
                      >
                        {topicLoading === overview.competitorAnalysis.differentiationAngle ? <RefreshCw size={10} className="spin" /> : <Zap size={10} />}
                        <span>{topicLoading === overview.competitorAnalysis.differentiationAngle ? "Üretiliyor..." : "Bu Açıyla Fikir Üret"}</span>
                      </button>
                    </div>
                    <div className="cockpit-detail-body" style={{ color: "#5b21b6", fontWeight: "600", fontSize: "13px" }}>
                      {overview.competitorAnalysis.differentiationAngle}
                    </div>
                  </div>
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
                            disabled={topicLoading === pain}
                            onClick={() => handleGenerateFromTopic(pain, "vertical_video")}
                            className="btn-topic-generate"
                            title="Bu acı noktasına çözüm getiren video fikirleri üret"
                          >
                            {topicLoading === pain ? <RefreshCw size={10} className="spin" /> : <Zap size={10} />}
                            <span>{topicLoading === pain ? "Üretiliyor..." : "Fikir Üret"}</span>
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
                        );
                      })}
                    </div>
                  </div>
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
        </section>
      )}

      {/* ========================================================
          2. ANA SEKME: İÇERİK ÖNERİLERİ (İÇERİK TÜRÜ KOLON MATRİSİ)
      ======================================================== */}
      {mainTab === "content_ideas" && columns && (
        <section style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div className="kanban-grid">
            {(Object.keys(COLUMN_CONFIG) as ColumnType[]).map((colType) => {
              const conf = COLUMN_CONFIG[colType];
              const activeColTab = colTabs[colType];
              const colData = columns[colType] || { suggested: [], hidden: [] };
              const displayList = activeColTab === "suggested" ? colData.suggested : colData.hidden;
              const isColLoading = colLoading[colType];
              const IconComponent = conf.icon;

              return (
                <div key={colType} className="kanban-column">
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
                        <h4 className="kanban-col-title">{conf.title}</h4>
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

                  {/* Yeni Fikir İste Butonu */}
                  <div>
                    <button
                      type="button"
                      onClick={() => handleGenerateMoreForColumn(colType)}
                      disabled={isColLoading || !brandName.trim()}
                      className="btn-request-idea"
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
                            </div>

                            {/* Kanca Kutusu */}
                            <div className="kanban-hook-box">
                              <span className="kanban-hook-tag">Kanca (Hook)</span>
                              <p className="kanban-hook-quote">&ldquo;{cleanHook}&rdquo;</p>
                            </div>

                            {/* Açıklama */}
                            <p className="kanban-card-desc">{idea.description}</p>

                            {/* 4 Adımlı İskelet (Accordion) */}
                            {idea.structure && idea.structure.length > 0 && (
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
                            )}

                            {/* Alt Çubuk: Hedef Kanal & Aksiyon Butonları (PLANLA KALDIRILDI) */}
                            <div className="kanban-card-footer">
                              <span className="kanban-channel-badge" title={idea.targetChannel}>
                                {idea.targetChannel}
                              </span>

                              <div className="kanban-card-actions">
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
                                  title="Fikri Kopyala"
                                >
                                  {isCopied ? (
                                    <CheckCircle2 size={12} style={{ color: "#10b981" }} />
                                  ) : (
                                    <Copy size={12} />
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSendToCanva(idea)}
                                  className="btn-card-action primary"
                                  title="Canva Görsel Üretim Stüdyosuna Aktar (Otomatik Gizlenene Taşınır)"
                                >
                                  <Palette size={12} />
                                  <span>Canva</span>
                                </button>
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
    </div>
  );
}
