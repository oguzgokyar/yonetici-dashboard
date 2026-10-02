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
  ChevronDown,
  ChevronUp,
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
  { title: string; subtitle: string; icon: any; iconBg: string; iconColor: string; defaultTarget: string }
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
  const [formExpanded, setFormExpanded] = useState(true);

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
        setFormExpanded(false); // Collapse form if strategy already exists to keep page minimal
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
    } catch (e: any) {
      alert("Hata: " + e.message);
    } finally {
      setColLoading((prev) => ({ ...prev, [columnType]: false }));
    }
  }

  function handleSendToCanva(idea: StrategyIdea) {
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
      <div className="strategy-container max-w-7xl mx-auto">
        {/* ÜST PANEL: MARKA & ANALİZ FORMU (Kompakt & Katlanabilir) */}
        <section className="strategy-panel">
          <div className="strategy-panel-header">
            <div>
              <div className="strategy-panel-title">
                <Compass size={18} />
                <span>Marka &amp; Rakip Bilgileri</span>
              </div>
              <p className="strategy-panel-desc">
                Hedef kitle acı noktalarını (VOC), rakip açıklarını ve 4 kolonluk içerik fikirlerini yapılandırın.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFormExpanded(!formExpanded)}
                className="button secondary text-xs"
                style={{ height: "36px", padding: "0 11px" }}
              >
                {formExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>{formExpanded ? "Formu Gizle" : "Formu Aç"}</span>
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
                    <span>Üretiliyor...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>{overview ? "Yeniden Üret" : "Stratejiyi Başlat"}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {formExpanded && (
            <form onSubmit={handleGenerateFullStrategy} style={{ marginTop: "12px" }}>
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

              <div className="strategy-field" style={{ marginTop: "12px" }}>
                <label className="strategy-field-label">Marka Değer Vaadi &amp; Niş Özeti</label>
                <textarea
                  value={brandDescription}
                  onChange={(e) => setBrandDescription(e.target.value)}
                  placeholder="Örn: Çocuklar ve gençler için ahşap STEM ve robotik atölyesi. Ebeveynlerin ekran bağımlılığı endişesine pratik üretkenlik çözümü sunuyoruz."
                  className="strategy-textarea"
                />
              </div>
            </form>
          )}
        </section>

        {/* 1. KATMAN: STRATEJİ & BİLGİ KOKPİTİ (4 Temiz Light Kart) */}
        {overview && (
          <section style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <strong style={{ font: "700 13px 'Manrope'", color: "var(--text)" }}>Katman 1: Strateji Kokpiti</strong>
                <small style={{ color: "var(--muted)", fontSize: "11px" }}>· Marka Kimliği, Kitle ve Fırsat Haritası</small>
              </div>
            </div>

            <div className="cockpit-grid">
              {/* Kart 1: Marka Kimliği */}
              <div className="cockpit-box">
                <div className="cockpit-box-header">
                  <div className="cockpit-box-title">
                    <span>🏷️</span>
                    <span>Marka Kimliği</span>
                  </div>
                  <span className="cockpit-box-badge">{overview.brandIdentity?.tone || "Ton"}</span>
                </div>
                <p className="cockpit-box-desc">
                  <strong>Vaat:</strong> {overview.brandIdentity?.valueProposition}
                </p>
                <div className="cockpit-box-subbox">
                  <span style={{ fontSize: "10px", fontWeight: "700", color: "#64748b", display: "block" }}>Kilit Mesaj</span>
                  {overview.brandIdentity?.keyMessaging}
                </div>
              </div>

              {/* Kart 2: Rakip Açıkları */}
              <div className="cockpit-box purple">
                <div className="cockpit-box-header">
                  <div className="cockpit-box-title">
                    <span>⚔️</span>
                    <span>Rakip Açıkları</span>
                  </div>
                  <span className="cockpit-box-badge" style={{ background: "#f5f3ff", color: "#6d28d9" }}>Fırsat</span>
                </div>
                <div className="cockpit-box-subbox" style={{ background: "#faf5ff", borderColor: "#f3e8ff" }}>
                  <ul style={{ margin: 0, paddingLeft: "14px", display: "flex", flexDirection: "column", gap: "3px" }}>
                    {(overview.competitorAnalysis?.contentGaps || []).slice(0, 2).map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
                <p style={{ fontSize: "11px", color: "#7c3aed", fontWeight: "600", margin: 0 }}>
                  ✦ {overview.competitorAnalysis?.differentiationAngle}
                </p>
              </div>

              {/* Kart 3: Hedef Kitle & VOC */}
              <div className="cockpit-box amber">
                <div className="cockpit-box-header">
                  <div className="cockpit-box-title">
                    <span>🎯</span>
                    <span>Kitle &amp; VOC</span>
                  </div>
                  <span className="cockpit-box-badge" style={{ background: "#fffbeb", color: "#b45309" }}>Persona</span>
                </div>
                <p className="cockpit-box-desc">
                  <strong>Profil:</strong> {overview.audienceVoc?.targetPersona}
                </p>
                <div className="cockpit-box-subbox" style={{ background: "#fffdfa", borderColor: "#fef3c7" }}>
                  <span style={{ fontSize: "10px", fontWeight: "700", color: "#b45309", display: "block" }}>Müşteri Acı Noktası</span>
                  <span style={{ color: "#78350f" }}>{overview.audienceVoc?.painPoints?.[0] || "Belirlenmedi"}</span>
                </div>
              </div>

              {/* Kart 4: Büyüme Stratejisi */}
              <div className="cockpit-box emerald">
                <div className="cockpit-box-header">
                  <div className="cockpit-box-title">
                    <span>🧭</span>
                    <span>Büyüme Planı</span>
                  </div>
                  <span className="cockpit-box-badge" style={{ background: "#ecfdf5", color: "#047857" }}>Haftalık</span>
                </div>
                <p className="cockpit-box-desc">
                  {overview.growthStrategy?.weeklyPostingPlan}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {(overview.growthStrategy?.primaryPillars || []).slice(0, 3).map((pil, idx) => (
                    <span
                      key={idx}
                      style={{ fontSize: "10px", background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", padding: "1px 6px", borderRadius: "5px", fontWeight: "600" }}
                    >
                      #{pil}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

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
                const activeTab = colTabs[colType];
                const colData = columns[colType] || { suggested: [], hidden: [] };
                const displayList = activeTab === "suggested" ? colData.suggested : colData.hidden;
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
                        className={`col-subtab-btn ${activeTab === "suggested" ? "active" : ""}`}
                      >
                        <span>Öneri</span>
                        <span className="col-subtab-badge">{colData.suggested.length}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setColTabs((prev) => ({ ...prev, [colType]: "hidden" }))}
                        className={`col-subtab-btn ${activeTab === "hidden" ? "active" : ""}`}
                      >
                        <span>Gizlenmiş</span>
                        <span className="col-subtab-badge">{colData.hidden.length}</span>
                      </button>
                    </div>

                    {/* + Bu Kolona Yeni Fikir İste */}
                    <button
                      type="button"
                      onClick={() => handleGenerateMoreForColumn(colType)}
                      disabled={isColLoading || generating}
                      className="btn-request-idea"
                    >
                      {isColLoading ? (
                        <>
                          <RefreshCw size={12} className="spin" />
                          <span>Üretiliyor...</span>
                        </>
                      ) : (
                        <>
                          <Plus size={13} />
                          <span>Yeni Fikir İste</span>
                        </>
                      )}
                    </button>

                    {/* Fikir Kartları Listesi */}
                    <div className="kanban-cards-stack">
                      {displayList.length === 0 ? (
                        <div
                          style={{
                            textAlign: "center",
                            padding: "24px 10px",
                            border: "1px dashed var(--border)",
                            borderRadius: "10px",
                            background: "white",
                            fontSize: "11px",
                            color: "var(--muted)",
                          }}
                        >
                          <p style={{ margin: 0 }}>
                            {activeTab === "suggested" ? "Bu kolonda öneri yok." : "Gizlenmiş fikir yok."}
                          </p>
                          {activeTab === "suggested" && (
                            <button
                              type="button"
                              onClick={() => handleGenerateMoreForColumn(colType)}
                              style={{
                                border: 0,
                                background: "none",
                                color: "var(--primary)",
                                fontWeight: "700",
                                fontSize: "11px",
                                marginTop: "6px",
                                cursor: "pointer",
                              }}
                            >
                              Şimdi 3 fikir üret ➔
                            </button>
                          )}
                        </div>
                      ) : (
                        displayList.map((idea) => {
                          const isHidden = idea.status === "hidden";
                          return (
                            <div key={idea.id || idea.title} className={`kanban-card ${isHidden ? "is-hidden" : ""}`}>
                              <div className="kanban-card-head">
                                <h5 className={`kanban-card-title ${isHidden ? "crossed" : ""}`}>
                                  {idea.title}
                                </h5>
                                <button
                                  type="button"
                                  onClick={() => handleToggleHideIdea(idea.id!, idea.status || "suggested")}
                                  className="btn-card-toggle"
                                  title={isHidden ? "Önerilere Geri Al" : "Kullanıldı / Gizle"}
                                >
                                  {isHidden ? <Eye size={13} style={{ color: "#10b981" }} /> : <EyeOff size={13} />}
                                </button>
                              </div>

                              {idea.hook && (
                                <div className="kanban-hook-pill">
                                  <strong style={{ fontSize: "9px", textTransform: "uppercase", display: "block", color: "#6366f1" }}>
                                    ⚡ Kanca (Hook)
                                  </strong>
                                  &quot;{idea.hook}&quot;
                                </div>
                              )}

                              <p className="kanban-card-desc">{idea.description}</p>

                              {idea.structure && idea.structure.length > 0 && (
                                <div className="kanban-steps-list">
                                  {idea.structure.slice(0, 3).map((st, sIdx) => (
                                    <div key={sIdx} className="kanban-step-row">
                                      <span style={{ color: "#94a3b8", fontWeight: "bold" }}>•</span>
                                      <span>{st}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="kanban-card-footer">
                                <span className="kanban-card-channel">
                                  {idea.targetChannel || conf.defaultTarget}
                                </span>

                                <div className="kanban-card-actions">
                                  <button
                                    type="button"
                                    onClick={() => copyIdeaText(idea)}
                                    className="btn-mini-action"
                                    title="Metni Kopyala"
                                  >
                                    {copiedId === (idea.id || idea.title) ? (
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
    </DashboardShell>
  );
}
