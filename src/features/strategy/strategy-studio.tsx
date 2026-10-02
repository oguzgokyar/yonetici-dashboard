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
  Send,
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

  // Tier 1 Active Tab (5 tabs max 2 words each)
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

  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      }
    } catch (e: unknown) {
      alert("Hata: " + (e instanceof Error ? e.message : String(e)));
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
    try {
      const res = await fetch(`/api/projects/${projectId}/strategy/ideas`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId, action: "toggle_hide" }),
      });
      const json = await res.json();
      if (json.success) {
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
          }
          return { ...prev, columns: nextCols };
        });
      }
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

  function handleSendToCanva(idea: StrategyIdea) {
    try {
      const payload = {
        title: idea.title,
        concept: `${idea.hook}\n\n${idea.description}`,
        contentType: idea.columnType === "carousel" ? "instagram_carousel" : "reels_video",
        slideCount: idea.columnType === "carousel" ? 5 : 6,
      };
      localStorage.setItem(`canva_prefill_${projectId}`, JSON.stringify(payload));
      router.push(`/projects/${projectId}/image-generation`);
    } catch {
      router.push(`/projects/${projectId}/image-generation`);
    }
  }

  function handleSendToPublishing(idea: StrategyIdea) {
    try {
      const caption = `🎯 ${idea.title}\n\n${idea.hook}\n\n${idea.description}\n\n#${idea.targetChannel.replace(/\s+/g, "")} #strateji #içerik`;
      localStorage.setItem(`publishing_prefill_${projectId}`, JSON.stringify({ caption }));
      router.push(`/projects/${projectId}/publishing`);
    } catch {
      router.push(`/projects/${projectId}/publishing`);
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

  const tabsConfig: Array<{ id: CockpitTabId; label: string; icon: LucideIcon; badge?: string }> = [
    { id: "brand_input", label: "Marka & Girdi", icon: Building2 },
    { id: "brand_identity", label: "Marka Kimliği", icon: Tag, badge: overview?.brandIdentity?.tone ? "Aktif" : undefined },
    { id: "competitor_analysis", label: "Rakip Analizi", icon: Swords, badge: overview?.competitorAnalysis ? "Fırsat" : undefined },
    { id: "target_audience", label: "Hedef Kitle", icon: Target, badge: overview?.audienceVoc ? "Persona" : undefined },
    { id: "growth_plan", label: "Büyüme Planı", icon: TrendingUp, badge: overview?.growthStrategy ? "Haftalık" : undefined },
  ];

  return (
    <div className="strategy-container w-full">
      {/* 1. KATMAN: SEKMELİ STRATEJİ KOKPİTİ */}
      <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "26px", height: "26px", borderRadius: "8px", background: "var(--primary-light, #f3f0ff)", color: "var(--primary)", display: "grid", placeItems: "center" }}>
              <Compass size={16} />
            </div>
            <div>
              <strong style={{ font: "700 14px 'Manrope'", color: "var(--text)" }}>Katman 1: Strateji Kokpiti</strong>
              <small style={{ color: "var(--muted)", fontSize: "11px", marginLeft: "8px" }}>
                · Marka girdileri, kitle acı noktaları ve büyüme haritası
              </small>
            </div>
          </div>

          {/* Sekme Butonları (Maksimum 2 Kelime) */}
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

        {/* Sekme 1: Marka & Girdi (Form İçeriği) */}
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

        {/* Sekme 2: Marka Kimliği */}
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

        {/* Sekme 3: Rakip Analizi */}
        {activeTab === "competitor_analysis" && (
          <div className="cockpit-tab-content-panel">
            {overview?.competitorAnalysis ? (
              <div className="cockpit-detail-grid">
                <div className="cockpit-detail-card">
                  <div className="cockpit-detail-title">
                    <Swords size={15} style={{ color: "#7c3aed" }} />
                    <span>Sektör &amp; Rakip İçerik Açıkları</span>
                  </div>
                  <ul className="cockpit-bullet-list">
                    {(overview.competitorAnalysis.contentGaps || []).map((gap, i) => (
                      <li key={i}>{gap}</li>
                    ))}
                  </ul>
                </div>

                <div className="cockpit-detail-card">
                  <div className="cockpit-detail-title">
                    <Zap size={15} style={{ color: "#d97706" }} />
                    <span>Uyarlanacak Viral Modeller</span>
                  </div>
                  <ul className="cockpit-bullet-list">
                    {(overview.competitorAnalysis.viralPatternsToAdapt || []).length > 0 ? (
                      overview.competitorAnalysis.viralPatternsToAdapt.map((pat, i) => (
                        <li key={i}>{pat}</li>
                      ))
                    ) : (
                      <li>Ters köşe kancalar ve adım adım dönüşüm formatları.</li>
                    )}
                  </ul>
                </div>

                <div className="cockpit-detail-card highlight" style={{ gridColumn: "1 / -1", background: "#faf5ff", borderColor: "#f3e8ff" }}>
                  <div className="cockpit-detail-title" style={{ color: "#6d28d9" }}>
                    <span>✦</span>
                    <span>Markanın Farklılaşma Açısı (Unfair Advantage)</span>
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

        {/* Sekme 4: Hedef Kitle */}
        {activeTab === "target_audience" && (
          <div className="cockpit-tab-content-panel">
            {overview?.audienceVoc ? (
              <div className="cockpit-detail-grid">
                <div className="cockpit-detail-card highlight" style={{ background: "#fffdfa", borderColor: "#fef3c7" }}>
                  <div className="cockpit-detail-title" style={{ color: "#b45309" }}>
                    <Target size={15} />
                    <span>Hedef Persona Profili</span>
                  </div>
                  <div className="cockpit-detail-body" style={{ color: "#78350f" }}>
                    {overview.audienceVoc.targetPersona}
                  </div>
                </div>

                <div className="cockpit-detail-card">
                  <div className="cockpit-detail-title">
                    <span>⚡</span>
                    <span>Müşteri Acı Noktaları (VOC Pain Points)</span>
                  </div>
                  <ul className="cockpit-bullet-list">
                    {(overview.audienceVoc.painPoints || []).map((pain, i) => (
                      <li key={i}>{pain}</li>
                    ))}
                  </ul>
                </div>

                <div className="cockpit-detail-card">
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

                <div className="cockpit-detail-card" style={{ gridColumn: "1 / -1", background: "#f8fafc" }}>
                  <div className="cockpit-detail-title">
                    <span>🪝</span>
                    <span>Kazanan Kanca (Hook) Açıları</span>
                  </div>
                  <div className="cockpit-tags-list">
                    {(overview.audienceVoc.winningHooks || []).map((hook, i) => (
                      <span key={i} className="cockpit-pill-tag" style={{ background: "#fef2f2", color: "#991b1b", borderColor: "#fee2e2" }}>
                        &ldquo;{hook}&rdquo;
                      </span>
                    ))}
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

        {/* Sekme 5: Büyüme Planı */}
        {activeTab === "growth_plan" && (
          <div className="cockpit-tab-content-panel">
            {overview?.growthStrategy ? (
              <div className="cockpit-detail-grid">
                <div className="cockpit-detail-card highlight" style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
                  <div className="cockpit-detail-title" style={{ color: "#166534" }}>
                    <TrendingUp size={15} />
                    <span>Haftalık Paylaşım Rutini</span>
                  </div>
                  <div className="cockpit-detail-body" style={{ color: "#14532d", fontWeight: "600" }}>
                    {overview.growthStrategy.weeklyPostingPlan}
                  </div>
                </div>

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

                <div className="cockpit-detail-card" style={{ gridColumn: "1 / -1", background: "#f8fafc" }}>
                  <div className="cockpit-detail-title">
                    <span>🎯</span>
                    <span>Dönüşüm Hunisi (Funnel)</span>
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

      {/* 2. KATMAN: İÇERİK TÜRÜNE GÖRE DİKEY KOLON MATRİSİ (KANBAN) */}
      {columns && (
        <section style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <strong style={{ font: "700 13px 'Manrope'", color: "var(--text)" }}>Katman 2: İçerik Türü Kolon Matrisi</strong>
              <small style={{ color: "var(--muted)", fontSize: "11px" }}>· Kolon bazlı yeni fikir üretin veya kullanılanları gizleyin</small>
            </div>
          </div>

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
                  <div style={{ padding: "0 10px 8px" }}>
                    <button
                      type="button"
                      onClick={() => handleGenerateMoreForColumn(colType)}
                      disabled={isColLoading || !brandName.trim()}
                      className="btn-col-action"
                    >
                      {isColLoading ? (
                        <>
                          <RefreshCw className="spin" size={12} />
                          <span>Yeni Fikirler Üretiliyor...</span>
                        </>
                      ) : (
                        <>
                          <Plus size={13} />
                          <span>+ Yeni Fikir İste</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Fikir Kartları Listesi */}
                  <div className="kanban-cards-list">
                    {displayList.length === 0 ? (
                      <div className="kanban-empty">
                        <small>
                          {activeColTab === "suggested"
                            ? "Henüz öneri yok. Yukarıdaki butondan yeni fikir isteyebilirsiniz."
                            : "Gizlenmiş içerik bulunmuyor."}
                        </small>
                      </div>
                    ) : (
                      displayList.map((idea) => {
                        const isHidden = idea.status === "hidden";
                        const isCopied = copiedId === (idea.id || idea.title);
                        return (
                          <div
                            key={idea.id || idea.title}
                            className={`kanban-idea-card ${isHidden ? "hidden-card" : ""}`}
                          >
                            {/* Kanca Kutusu */}
                            <div className="idea-hook-box">
                              <span className="idea-hook-label">KANCA (HOOK)</span>
                              <p className="idea-hook-text">&ldquo;{idea.hook}&rdquo;</p>
                            </div>

                            {/* Başlık ve Açıklama */}
                            <h5 className="idea-card-title">{idea.title}</h5>
                            <p className="idea-card-desc">{idea.description}</p>

                            {/* 4 Adımlı İskelet (Accordion) */}
                            {idea.structure && idea.structure.length > 0 && (
                              <details className="idea-structure-details">
                                <summary>Akış İskeleti ({idea.structure.length} Adım)</summary>
                                <ul>
                                  {idea.structure.map((st, sIdx) => (
                                    <li key={sIdx}>{st}</li>
                                  ))}
                                </ul>
                              </details>
                            )}

                            {/* Alt Çubuk: Hedef Kanal & Aksiyon Butonları */}
                            <div className="idea-card-footer">
                              <span className="idea-target-tag">{idea.targetChannel}</span>

                              <div className="idea-actions-row">
                                <button
                                  type="button"
                                  onClick={() => idea.id && handleToggleHideIdea(idea.id)}
                                  className="btn-mini-action"
                                  title={isHidden ? "Görünür Yap (Önerilere Taşı)" : "Gizle (Kullanıldı / Reddedildi)"}
                                >
                                  {isHidden ? <Eye size={11} /> : <EyeOff size={11} />}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => copyIdeaText(idea)}
                                  className="btn-mini-action"
                                  title="Fikri Kopyala"
                                >
                                  {isCopied ? (
                                    <CheckCircle2 size={11} style={{ color: "#10b981" }} />
                                  ) : (
                                    <Copy size={11} />
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSendToCanva(idea)}
                                  className="btn-mini-action primary"
                                  title="Canva Görsel Üretim Stüdyosuna Aktar"
                                >
                                  <Palette size={11} />
                                  <span>Canva</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSendToPublishing(idea)}
                                  className="btn-mini-action"
                                  title="Paylaşım Planına Ekle"
                                >
                                  <Send size={11} />
                                  <span>Planla</span>
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
