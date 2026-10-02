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
  ChevronRight,
  Plus,
  Send,
  Palette,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Target,
  Swords,
  BadgePercent,
  Copy,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
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
  { title: string; subtitle: string; icon: any; color: string; defaultTarget: string }
> = {
  vertical_video: {
    title: "Dikey Video",
    subtitle: "Reels / TikTok / Shorts (9:16)",
    icon: Video,
    color: "#ec4899", // pink
    defaultTarget: "Instagram Reels / TikTok",
  },
  carousel: {
    title: "Karosel Seri",
    subtitle: "Canva Carousel (5-7 Slayt)",
    icon: Layers,
    color: "#6366f1", // indigo
    defaultTarget: "Instagram Carousel",
  },
  single_post: {
    title: "Tekil / İnfografik",
    subtitle: "Vurgu, Alıntı & Sektör Haberi",
    icon: FileText,
    color: "#06b6d4", // cyan
    defaultTarget: "Instagram / LinkedIn",
  },
  engagement: {
    title: "Etkileşim & Story",
    subtitle: "Anket, Soru-Cevap & DM Kurgusu",
    icon: MessageCircle,
    color: "#10b981", // emerald
    defaultTarget: "Instagram Story",
  },
};

export function StrategyStudio({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
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
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStrategy();
  }, [projectId]);

  async function handleGenerateFullStrategy(e: React.FormEvent) {
    e.preventDefault();
    if (!brandName.trim()) return;

    setGenerating(true);
    try {
      const competitors = competitorsText
        .split(/[,\\n]/)
        .map((s) => s.trim())
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
      } else {
        alert("Hata: " + (json.error || "Strateji üretilemedi."));
      }
    } catch (e: any) {
      alert("Hata: " + e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggleHideIdea(ideaId: string, currentStatus: "suggested" | "hidden") {
    const nextStatus = currentStatus === "suggested" ? "hidden" : "suggested";
    try {
      const res = await fetch(`/api/projects/${projectId}/strategy/ideas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId, status: nextStatus }),
      });
      const json = await res.json();
      if (json.success) {
        // Optimistic local update
        setData((prev) => {
          if (!prev) return prev;
          const nextCols = { ...prev.columns };
          for (const key of Object.keys(nextCols) as ColumnType[]) {
            const col = nextCols[key];
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
        // Append new ideas to suggested
        setData((prev) => {
          if (!prev) return prev;
          const nextCols = { ...prev.columns };
          nextCols[columnType].suggested = [
            ...json.ideas,
            ...nextCols[columnType].suggested,
          ];
          return { ...prev, columns: nextCols };
        });
        // Switch to suggested tab so user immediately sees them
        setColTabs((prev) => ({ ...prev, [columnType]: "suggested" }));
      } else {
        alert("Hata: " + (json.error || "Yeni fikir üretilemedi."));
      }
    } catch (e: any) {
      alert("Hata: " + e.message);
    } finally {
      setColLoading((prev) => ({ ...prev, [columnType]: false }));
    }
  }

  function handleSendToCanva(idea: StrategyIdea) {
    // Pass idea title and concept to Canva studio via localStorage or query
    try {
      const payload = {
        title: idea.title,
        concept: `${idea.hook}\\n\\n${idea.description}`,
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
      const caption = `🎯 ${idea.title}\\n\\n${idea.hook}\\n\\n${idea.description}\\n\\n#${idea.targetChannel.replace(/\\s+/g, "")} #strateji #içerik`;
      localStorage.setItem(`publishing_prefill_${projectId}`, JSON.stringify({ caption }));
      router.push(`/projects/${projectId}/publishing`);
    } catch {
      router.push(`/projects/${projectId}/publishing`);
    }
  }

  function copyIdeaText(idea: StrategyIdea) {
    const text = `📌 ${idea.title}\\n⚡ Kanca: ${idea.hook}\\n📝 Açıklama: ${idea.description}\\n🎯 Hedef: ${idea.targetChannel}`;
    navigator.clipboard.writeText(text);
    setCopiedId(idea.id || idea.title);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const overview = data?.strategy;
  const columns = data?.columns;

  return (
    <DashboardShell
      projectId={projectId}
      title="Sosyal Medya Strateji & İçerik Matrisi"
      eyebrow="ScrapeCreators Metodolojisi & Hermes Ajanı"
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* ÜST PANEL: MARKA & ANALİZ FORMU */}
        <section className="panel">
          <div className="panel-header flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2 text-white">
                <Compass className="text-brand-400" size={18} />
                Marka ve Rakip Bilgileri
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Marka kimliği, sosyal kanallar ve takip edilen rakipleri girerek yapay zeka destekli içerik stratejinizi oluşturun.
              </p>
            </div>
            <button
              onClick={handleGenerateFullStrategy}
              disabled={generating || !brandName.trim()}
              className="btn btn-primary text-xs flex items-center gap-2 cursor-pointer w-full md:w-auto justify-center"
            >
              {generating ? (
                <>
                  <RefreshCw className="animate-spin" size={14} />
                  <span>Strateji & Fikirler Üretiliyor...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>{overview ? "Stratejiyi Yeniden Üret" : "Strateji ve Matrisi Başlat"}</span>
                </>
              )}
            </button>
          </div>

          <form onSubmit={handleGenerateFullStrategy} className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="field-label text-xs font-semibold text-slate-300 mb-1 block">
                  Marka / Proje Adı *
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Örn: Atölye Hanem"
                  className="input-field text-xs w-full"
                  required
                />
              </div>

              <div>
                <label className="field-label text-xs font-semibold text-slate-300 mb-1 block">
                  Sosyal Medya Kanalları
                </label>
                <div className="flex items-center gap-2 pt-1 text-xs">
                  {["Instagram", "TikTok", "YouTube"].map((ch) => (
                    <label
                      key={ch}
                      className="flex items-center gap-1.5 cursor-pointer bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-slate-300 hover:border-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={socialChannels.includes(ch)}
                        onChange={(e) => {
                          if (e.target.checked) setSocialChannels([...socialChannels, ch]);
                          else setSocialChannels(socialChannels.filter((c) => c !== ch));
                        }}
                        className="rounded border-slate-700 text-brand-600 focus:ring-0"
                      />
                      <span>{ch}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="field-label text-xs font-semibold text-slate-300 mb-1 block">
                  Rakipler / Örnek Hesaplar
                </label>
                <input
                  type="text"
                  value={competitorsText}
                  onChange={(e) => setCompetitorsText(e.target.value)}
                  placeholder="@rakip1, @rakip2, @sektor_lideri"
                  className="input-field text-xs w-full"
                />
              </div>
            </div>

            <div>
              <label className="field-label text-xs font-semibold text-slate-300 mb-1 block">
                Marka Değer Vaadi & Niş Açıklaması
              </label>
              <textarea
                value={brandDescription}
                onChange={(e) => setBrandDescription(e.target.value)}
                placeholder="Örn: Çocuklar ve gençler için ahşap STEM ve robotik kodlama atölyesi. Ebeveynlere ekran süresini azaltıp üretkenliği artırma vaadi sunuyoruz."
                rows={2}
                className="input-field text-xs w-full"
              />
            </div>
          </form>
        </section>

        {/* 1. KATMAN: STRATEJİ KOKPİTİ (4 KART) */}
        {overview && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Target size={14} className="text-brand-400" />
                Katman 1: Strateji &amp; Bilgi Kokpiti
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">
                Son Güncelleme: {overview.updatedAt ? new Date(overview.updatedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "Yeni"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Kart 1: Marka Kimliği */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2 border-t-2 border-t-blue-500 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
                    <span className="text-blue-400">🏷️</span> Marka Kimliği
                  </h4>
                  <span className="text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20 px-1.5 py-0.2 rounded font-medium">
                    {overview.brandIdentity?.tone || "Ton"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  <strong>Vaat:</strong> {overview.brandIdentity?.valueProposition}
                </p>
                <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Kilit Mesaj</span>
                  {overview.brandIdentity?.keyMessaging}
                </div>
              </div>

              {/* Kart 2: Rakip Açıkları */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2 border-t-2 border-t-purple-500 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
                    <Swords size={13} className="text-purple-400" /> Rakip Açıkları
                  </h4>
                  <span className="text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-1.5 py-0.2 rounded font-medium">
                    Fırsat
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Yakalanan Fırsatlar</span>
                  <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
                    {(overview.competitorAnalysis?.contentGaps || []).slice(0, 2).map((g, i) => (
                      <li key={i} className="line-clamp-2">{g}</li>
                    ))}
                  </ul>
                </div>
                <p className="text-[10.5px] text-purple-300 font-medium">
                  ✦ {overview.competitorAnalysis?.differentiationAngle}
                </p>
              </div>

              {/* Kart 3: Hedef Kitle & VOC */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2 border-t-2 border-t-amber-500 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
                    <Target size={13} className="text-amber-400" /> Kitle &amp; VOC
                  </h4>
                  <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.2 rounded font-medium">
                    Persona
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">
                  <strong>Profil:</strong> {overview.audienceVoc?.targetPersona}
                </p>
                <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">En Büyük Acı Noktası</span>
                  <p className="text-amber-200/90 line-clamp-2">
                    {overview.audienceVoc?.painPoints?.[0] || "Belirlenmedi"}
                  </p>
                </div>
              </div>

              {/* Kart 4: Büyüme Stratejisi */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2 border-t-2 border-t-emerald-500 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
                    <TrendingUp size={13} className="text-emerald-400" /> Büyüme Stratejisi
                  </h4>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-1.5 py-0.2 rounded font-medium">
                    Haftalık Plan
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  {overview.growthStrategy?.weeklyPostingPlan}
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {(overview.growthStrategy?.primaryPillars || []).slice(0, 3).map((pil, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] bg-slate-950 text-slate-400 px-2 py-0.5 rounded border border-slate-800"
                    >
                      #{pil}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 2. KATMAN: İÇERİK TÜRÜNE GÖRE DİKEY KOLON MATRİSİ */}
        {columns && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Layers size={14} className="text-emerald-400" />
                Katman 2: İçerik Türüne Göre Dikey Kolon Matrisi (Kanban)
              </h3>
              <span className="text-xs text-slate-500">
                Kolon bazlı yeni fikir üretebilir, kullanılan fikirleri gizleyebilirsiniz.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 items-start">
              {(Object.keys(COLUMN_CONFIG) as ColumnType[]).map((colType) => {
                const conf = COLUMN_CONFIG[colType];
                const activeTab = colTabs[colType];
                const colData = columns[colType] || { suggested: [], hidden: [] };
                const displayList = activeTab === "suggested" ? colData.suggested : colData.hidden;
                const isColLoading = colLoading[colType];
                const IconComponent = conf.icon;

                return (
                  <div
                    key={colType}
                    className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex flex-col gap-3 shadow-md"
                    style={{ borderTop: `3px solid ${conf.color}` }}
                  >
                    {/* Kolon Başlığı */}
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${conf.color}20`, color: conf.color }}
                        >
                          <IconComponent size={15} />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-white leading-tight">{conf.title}</h4>
                          <p className="text-[10px] text-slate-500 leading-tight">{conf.subtitle}</p>
                        </div>
                      </div>
                    </div>

                    {/* Çift Sekme: Öneri vs Gizlenmiş */}
                    <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setColTabs((prev) => ({ ...prev, [colType]: "suggested" }))}
                        className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          activeTab === "suggested"
                            ? "bg-slate-800 text-white shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <span>Öneri</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-700 text-slate-200">
                          {colData.suggested.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setColTabs((prev) => ({ ...prev, [colType]: "hidden" }))}
                        className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          activeTab === "hidden"
                            ? "bg-slate-800 text-white shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <span>Gizlenmiş</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-700 text-slate-200">
                          {colData.hidden.length}
                        </span>
                      </button>
                    </div>

                    {/* + Bu Kolona Yeni Fikir İste Butonu */}
                    <button
                      type="button"
                      onClick={() => handleGenerateMoreForColumn(colType)}
                      disabled={isColLoading || generating}
                      className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-700 hover:border-slate-500 bg-slate-950/40 hover:bg-slate-950 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      {isColLoading ? (
                        <>
                          <RefreshCw size={12} className="animate-spin text-brand-400" />
                          <span>3 Yeni Fikir Üretiliyor...</span>
                        </>
                      ) : (
                        <>
                          <Plus size={13} className="text-brand-400" />
                          <span>+ Yeni Fikir İste</span>
                        </>
                      )}
                    </button>

                    {/* Kartlar Listesi */}
                    <div className="space-y-2.5 min-h-[160px]">
                      {displayList.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 border border-dashed border-slate-800/80 rounded-xl text-xs space-y-1">
                          <p>{activeTab === "suggested" ? "Bu kolonda öneri yok." : "Gizlenmiş fikir yok."}</p>
                          {activeTab === "suggested" && (
                            <button
                              onClick={() => handleGenerateMoreForColumn(colType)}
                              className="text-[11px] text-brand-400 underline cursor-pointer"
                            >
                              Şimdi üretin
                            </button>
                          )}
                        </div>
                      ) : (
                        displayList.map((idea) => {
                          const isHidden = idea.status === "hidden";
                          return (
                            <div
                              key={idea.id || idea.title}
                              className={`p-3 rounded-xl border transition space-y-2 ${
                                isHidden
                                  ? "bg-slate-950/60 border-slate-800/60 opacity-75"
                                  : "bg-slate-950 border-slate-800 hover:border-slate-700 shadow-sm"
                              }`}
                            >
                              {/* Kart Başlık ve Gizle/Geri Al Düğmesi */}
                              <div className="flex items-start justify-between gap-2">
                                <h5 className={`font-bold text-xs leading-snug ${isHidden ? "text-slate-400 line-through" : "text-white"}`}>
                                  {idea.title}
                                </h5>
                                <button
                                  type="button"
                                  onClick={() => handleToggleHideIdea(idea.id!, idea.status || "suggested")}
                                  className="text-slate-500 hover:text-slate-300 p-1 rounded transition shrink-0 cursor-pointer"
                                  title={isHidden ? "Önerilere Geri Döndür" : "Kullanıldı / Gizle"}
                                >
                                  {isHidden ? <Eye size={13} className="text-emerald-400" /> : <EyeOff size={13} />}
                                </button>
                              </div>

                              {/* Kanca (Hook) */}
                              {idea.hook && (
                                <div className="text-[11px] text-brand-300 bg-brand-950/30 p-2 rounded-lg border border-brand-500/20">
                                  <strong className="text-[10px] text-brand-400 uppercase block">⚡ Kanca (Hook):</strong>
                                  &quot;{idea.hook}&quot;
                                </div>
                              )}

                              {/* Açıklama */}
                              <p className="text-[11px] text-slate-400 leading-snug">
                                {idea.description}
                              </p>

                              {/* Akış / Yapı Adımları */}
                              {idea.structure && idea.structure.length > 0 && (
                                <div className="space-y-1 pt-1 border-t border-slate-900">
                                  <span className="text-[10px] text-slate-500 font-semibold block">Yapı / Akış:</span>
                                  <div className="space-y-0.5">
                                    {idea.structure.map((st, sIdx) => (
                                      <div key={sIdx} className="text-[10.5px] text-slate-300 flex items-start gap-1">
                                        <span className="text-slate-600 font-mono text-[9px] mt-0.5">•</span>
                                        <span>{st}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Alt Aksiyon Butonları */}
                              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px]">
                                <span className="text-slate-500 font-medium truncate max-w-[90px]">
                                  {idea.targetChannel || conf.defaultTarget}
                                </span>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => copyIdeaText(idea)}
                                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                                    title="Metni Kopyala"
                                  >
                                    {copiedId === (idea.id || idea.title) ? (
                                      <CheckCircle2 size={12} className="text-emerald-400" />
                                    ) : (
                                      <Copy size={12} />
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleSendToCanva(idea)}
                                    className="px-2 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 font-semibold flex items-center gap-1 transition cursor-pointer"
                                    title="Canva Görsel Üretim Stüdyosuna Aktar"
                                  >
                                    <Palette size={11} />
                                    <span>Canva</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleSendToPublishing(idea)}
                                    className="px-2 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 font-semibold flex items-center gap-1 transition cursor-pointer"
                                    title="Paylaşım Planı / Yayınlama Takvimine Ekle"
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
    </DashboardShell>
  );
}
