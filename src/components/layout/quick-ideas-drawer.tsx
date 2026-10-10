"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  RefreshCw,
  Copy,
  CheckCircle2,
  Eye,
  EyeOff,
  Palette,
  Clapperboard,
  Video,
  Layers,
  FileText,
  MessageCircle,
  Search,
  Sparkles,
  Compass,
  Plus,
} from "lucide-react";
import type { ColumnType, StrategyIdea } from "@/lib/server/strategy-generator";

type ColumnData = {
  suggested: StrategyIdea[];
  hidden: StrategyIdea[];
};

type StrategyResponse = {
  success: boolean;
  hasStrategy: boolean;
  strategy?: {
    brandName?: string;
    brandDescription?: string;
  };
  columns?: Record<ColumnType, ColumnData>;
};

const CATEGORIES: Array<{
  type: ColumnType;
  title: string;
  shortLabel: string;
  subtitle: string;
  icon: typeof Video;
  color: string;
  bg: string;
}> = [
  {
    type: "vertical_video",
    title: "Dikey Video",
    shortLabel: "Video",
    subtitle: "Reels / TikTok (9:16)",
    icon: Video,
    color: "#db2777",
    bg: "#fdf2f8",
  },
  {
    type: "carousel",
    title: "Karosel Seri",
    shortLabel: "Karosel",
    subtitle: "Canva Carousel (5-7 Slayt)",
    icon: Layers,
    color: "#4f46e5",
    bg: "#eef2ff",
  },
  {
    type: "single_post",
    title: "Tekil / İnfografik",
    shortLabel: "Tekil",
    subtitle: "Vurgu & Alıntı Postu",
    icon: FileText,
    color: "#0891b2",
    bg: "#ecfeff",
  },
  {
    type: "engagement",
    title: "Etkileşim & Story",
    shortLabel: "Story",
    subtitle: "Anket, Soru & DM Kurgusu",
    icon: MessageCircle,
    color: "#059669",
    bg: "#ecfdf5",
  },
];

type QuickIdeasDrawerProps = {
  projectId?: string;
  isOpen: boolean;
  onClose: () => void;
  onTotalCountChange?: (count: number) => void;
};

export function QuickIdeasDrawer({
  projectId,
  isOpen,
  onClose,
  onTotalCountChange,
}: QuickIdeasDrawerProps) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<ColumnType>("vertical_video");
  const [activeSubtab, setActiveSubtab] = useState<"suggested" | "hidden">("suggested");
  const [searchQuery, setSearchQuery] = useState("");
  const [columns, setColumns] = useState<Record<ColumnType, ColumnData> | null>(null);
  const [brandName, setBrandName] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatingMore, setGeneratingMore] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<Record<string, number>>({});

  const fetchStrategyData = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/strategy`, {
        cache: "no-store",
      });
      const data: StrategyResponse = await res.json();
      if (data.columns) {
        setColumns(data.columns);
        if (data.strategy?.brandName) setBrandName(data.strategy.brandName);

        // Calculate total suggested count across all categories
        let totalSuggested = 0;
        for (const col of Object.values(data.columns)) {
          totalSuggested += (col.suggested || []).length;
        }
        if (onTotalCountChange) {
          onTotalCountChange(totalSuggested);
        }
      }
    } catch {
      // background fetch error ignore
    } finally {
      setLoading(false);
    }
  }, [projectId, onTotalCountChange]);

  useEffect(() => {
    if (projectId) {
      void fetchStrategyData();
    }
  }, [projectId, fetchStrategyData]);

  // Refresh when opened
  useEffect(() => {
    if (isOpen && projectId) {
      void fetchStrategyData();
    }
  }, [isOpen, projectId, fetchStrategyData]);

  const handleToggleHide = async (ideaId: string) => {
    if (!projectId || !columns) return;
    try {
      // Optimistic update
      const updated = { ...columns };
      for (const cType of Object.keys(updated) as ColumnType[]) {
        const col = updated[cType];
        const inSugg = col.suggested.find((i) => i.id === ideaId);
        const inHidden = col.hidden.find((i) => i.id === ideaId);
        if (inSugg) {
          col.suggested = col.suggested.filter((i) => i.id !== ideaId);
          col.hidden = [{ ...inSugg, status: "hidden" }, ...col.hidden];
          break;
        } else if (inHidden) {
          col.hidden = col.hidden.filter((i) => i.id !== ideaId);
          col.suggested = [{ ...inHidden, status: "suggested" }, ...col.suggested];
          break;
        }
      }
      setColumns({ ...updated });

      await fetch(`/api/projects/${encodeURIComponent(projectId)}/strategy/ideas`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId, action: "toggle_hide" }),
      });
      void fetchStrategyData();
    } catch {
      // ignore
    }
  };

  const handleCopy = (idea: StrategyIdea) => {
    const cleanHook = (idea.hook || "").replace(/^["'“”]+|["'“”]+$/g, "");
    const parts = [
      `BAŞLIK: ${idea.title}`,
      cleanHook ? `KANCA: "${cleanHook}"` : "",
      idea.description ? `ÖZET: ${idea.description}` : "",
      idea.structure && idea.structure.length > 0
        ? `AKIŞ:\n${idea.structure.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
        : "",
    ].filter(Boolean);

    void navigator.clipboard.writeText(parts.join("\n\n"));
    const key = idea.id || idea.title;
    setCopiedId(key);
    setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 2000);
  };

  const handleSendToCanva = async (idea: StrategyIdea) => {
    if (!projectId) return;
    const cardKey = idea.id || idea.title;
    const isEngagement = activeCategory === "engagement";
    const selectedStepIndex = selectedStoryIndex[cardKey] ?? 0;
    const selectedStepText =
      isEngagement && idea.structure && idea.structure.length > 0
        ? idea.structure[selectedStepIndex] || idea.description
        : "";

    if (idea.id && idea.status !== "hidden") {
      await handleToggleHide(idea.id);
    }

    let fullPrompt = "";
    let targetContentType = "instagram_post";
    let targetSlideCount = 1;

    if (isEngagement) {
      targetContentType = "instagram_story";
      targetSlideCount = 1;
      fullPrompt = [
        `Hedef Format: Instagram Story (1080x1920, 9:16)`,
        `Konsept / Fikir: ${idea.title}`,
        idea.targetChannel ? `Kanal: ${idea.targetChannel}` : "",
        selectedStepText ? `Uygulanacak Story İçeriği:\n${selectedStepText}` : "",
        idea.description ? `Genel Konu Özeti: ${idea.description}` : "",
      ]
        .filter(Boolean)
        .join("\n\n")
        .trim();
    } else {
      const cleanHook = (idea.hook || "").replace(/^["'“”]+|["'“”]+$/g, "");
      const structureText =
        idea.structure && idea.structure.length > 0
          ? `\nAkış ve Slayt Planı:\n${idea.structure.map((s, idx) => `${idx + 1}. ${s}`).join("\n")}`
          : "";

      fullPrompt = [
        `Başlık: ${idea.title}`,
        idea.targetChannel ? `Hedef Kanal: ${idea.targetChannel}` : "",
        cleanHook ? `\nKanca (Hook):\n"${cleanHook}"` : "",
        idea.description ? `\nKonu & İçerik Özeti:\n${idea.description}` : "",
        structureText,
      ]
        .filter(Boolean)
        .join("\n")
        .trim();

      if (activeCategory === "vertical_video") {
        targetContentType = "reels_video";
        targetSlideCount = 6;
      } else if (activeCategory === "carousel") {
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
      onClose();
      router.push(`/projects/${projectId}/image-generation?studio=canva`);
    } catch {}
  };

  const handleSendToGoogleVids = (idea: StrategyIdea) => {
    if (!projectId) return;
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
      onClose();
      router.push(`/projects/${projectId}/video-generation?studio=vids`);
    } catch {}
  };

  const handleGenerateMore = async () => {
    if (!projectId || generatingMore) return;
    setGeneratingMore(true);
    try {
      await fetch(`/api/projects/${encodeURIComponent(projectId)}/strategy/ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnType: activeCategory }),
      });
      await fetchStrategyData();
    } catch {
      // ignore
    } finally {
      setGeneratingMore(false);
    }
  };

  // Filtered idea list based on search and subtab
  const currentCategoryData = columns?.[activeCategory] || { suggested: [], hidden: [] };
  const rawList = activeSubtab === "suggested" ? currentCategoryData.suggested : currentCategoryData.hidden;

  const displayList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rawList;
    return rawList.filter((item) => {
      const t = (item.title || "").toLowerCase();
      const d = (item.description || "").toLowerCase();
      const h = (item.hook || "").toLowerCase();
      return t.includes(q) || d.includes(q) || h.includes(q);
    });
  }, [rawList, searchQuery]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="prod-drawer-backdrop" onClick={onClose} />

      {/* Slide-over Panel */}
      <aside
        className="prod-drawer-panel quick-ideas-drawer"
        style={{ width: "440px", maxWidth: "94vw" }}
        aria-label="Hızlı İçerik Önerileri"
      >
        {/* Header */}
        <div className="prod-drawer-header">
          <div className="prod-drawer-title-group">
            <div className="prod-drawer-icon" style={{ background: "#fdf4ff", color: "#c026d3" }}>
              <Compass size={18} />
            </div>
            <div>
              <h3>Hızlı İçerik Önerileri</h3>
              <p>{brandName ? `${brandName} • ` : ""}Stratejiden türetilen hazır fikirler</p>
            </div>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Çekmeceyi kapat"
          >
            <X size={18} />
          </button>
        </div>

        {/* 4 Simge Tabanlı Kategori Sekmesi */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "6px",
            padding: "10px 16px",
            background: "#fbfbfd",
            borderBottom: "1px solid #f0f0f5",
          }}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat.type;
            const Icon = cat.icon;
            const count = (columns?.[cat.type]?.suggested || []).length;
            return (
              <button
                key={cat.type}
                type="button"
                onClick={() => setActiveCategory(cat.type)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  padding: "8px 4px",
                  borderRadius: "10px",
                  border: isSelected ? `2px solid ${cat.color}` : "1px solid #e2e8f0",
                  background: isSelected ? cat.bg : "#ffffff",
                  color: isSelected ? cat.color : "#64748b",
                  cursor: "pointer",
                  position: "relative",
                  transition: "all 0.15s ease",
                }}
                title={`${cat.title} (${count} öneri)`}
              >
                <Icon size={17} />
                <span style={{ fontSize: "11px", fontWeight: isSelected ? 800 : 600 }}>
                  {cat.shortLabel}
                </span>
                <span
                  style={{
                    position: "absolute",
                    top: "-5px",
                    right: "-3px",
                    fontSize: "9.5px",
                    fontWeight: 800,
                    padding: "1px 5px",
                    borderRadius: "99px",
                    background: isSelected ? cat.color : "#e2e8f0",
                    color: isSelected ? "#ffffff" : "#475569",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Alt Filtre Çubuğu: Arama + Öneri / Gizlenmiş Sekmesi */}
        <div
          style={{
            padding: "10px 16px",
            borderBottom: "1px solid #f0f0f5",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            background: "#ffffff",
          }}
        >
          {/* Arama Kutusu */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
            }}
          >
            <Search size={14} style={{ color: "#94a3b8" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Fikirlerde ara (kanca, konu...)"
              style={{
                border: "none",
                background: "transparent",
                fontSize: "12px",
                width: "100%",
                outline: "none",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", padding: "0" }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Öneri / Gizlenmiş Toggle */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                type="button"
                onClick={() => setActiveSubtab("suggested")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: activeSubtab === "suggested" ? "#f1f5f9" : "transparent",
                  color: activeSubtab === "suggested" ? "#0f172a" : "#64748b",
                }}
              >
                Öneriler ({currentCategoryData.suggested.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveSubtab("hidden")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: activeSubtab === "hidden" ? "#f1f5f9" : "transparent",
                  color: activeSubtab === "hidden" ? "#0f172a" : "#64748b",
                }}
              >
                Gizlenmiş ({currentCategoryData.hidden.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => void handleGenerateMore()}
              disabled={generatingMore}
              style={{
                background: "none",
                border: "none",
                color: "#6d5dfc",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
              }}
              title="Bu kategori için yeni fikirler üret"
            >
              {generatingMore ? <RefreshCw className="spin" size={11} /> : <Plus size={12} />}
              <span>{generatingMore ? "Üretiliyor..." : "Yeni Fikir"}</span>
            </button>
          </div>
        </div>

        {/* Gövde / Kart Listesi */}
        <div className="prod-drawer-body" style={{ padding: "14px 16px", gap: "12px" }}>
          {!projectId ? (
            <div className="prod-drawer-empty">
              <p>İçerik önerilerini görmek için bir proje seçin.</p>
            </div>
          ) : loading && !columns ? (
            <div className="prod-drawer-empty">
              <RefreshCw className="spin" size={20} />
              <p>Fikir önerileri yükleniyor...</p>
            </div>
          ) : displayList.length === 0 ? (
            <div className="prod-drawer-empty">
              <div className="prod-empty-circle">
                <Sparkles size={20} />
              </div>
              <strong>
                {searchQuery
                  ? "Aramaya uygun fikir bulunamadı"
                  : activeSubtab === "suggested"
                  ? "Bu kategoride öneri bulunmuyor"
                  : "Gizlenmiş içerik bulunmuyor"}
              </strong>
              <p>
                {activeSubtab === "suggested"
                  ? "Yukarıdaki '+ Yeni Fikir' butonuna tıklayarak anında yeni içerik fikirleri türetebilirsiniz."
                  : "Daha önce gizlediğiniz fikirler burada listelenir."}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {displayList.map((idea) => {
                const isHidden = idea.status === "hidden";
                const cardKey = idea.id || idea.title;
                const isCopied = copiedId === cardKey;
                const cleanHook = (idea.hook || "").replace(/^["'“”]+|["'“”]+$/g, "");
                const isEngagement = activeCategory === "engagement";
                const isVideo = activeCategory === "vertical_video";

                return (
                  <div
                    key={cardKey}
                    className={`kanban-card ${isHidden ? "is-hidden" : ""}`}
                    style={{ margin: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                  >
                    {/* Kart Başlığı */}
                    <div className="kanban-card-head">
                      <h5 className={`kanban-card-title ${isHidden ? "crossed" : ""}`}>
                        {idea.title}
                      </h5>
                    </div>

                    {/* Kanca Kutusu */}
                    {cleanHook && (
                      <div className="kanban-hook-box">
                        <span className="kanban-hook-tag">Kanca (Hook)</span>
                        <p className="kanban-hook-quote">&ldquo;{cleanHook}&rdquo;</p>
                      </div>
                    )}

                    {/* Açıklama */}
                    <p className="kanban-card-desc">{idea.description}</p>

                    {/* Akış İskeleti */}
                    {idea.structure && idea.structure.length > 0 && (
                      isEngagement ? (
                        <div className="story-picker-wrap">
                          <div className="story-picker-label">
                            <span>Story Adımı (1 Adet 9:16)</span>
                          </div>
                          <div className="story-picker-list">
                            {idea.structure.map((storyStep, sIdx) => {
                              const isSelected = (selectedStoryIndex[cardKey] ?? 0) === sIdx;
                              return (
                                <button
                                  key={sIdx}
                                  type="button"
                                  onClick={() =>
                                    setSelectedStoryIndex((prev) => ({ ...prev, [cardKey]: sIdx }))
                                  }
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

                    {/* Alt Çubuk & Aksiyon Butonları */}
                    <div className="kanban-card-footer">
                      <span className="kanban-channel-badge" title={idea.targetChannel}>
                        {idea.targetChannel || "Instagram / TikTok"}
                      </span>

                      <div className="kanban-card-actions">
                        {/* Gizle / Göster */}
                        <button
                          type="button"
                          onClick={() => idea.id && handleToggleHide(idea.id)}
                          className="btn-card-action icon-only"
                          title={isHidden ? "Önerilere Taşı" : "Gizle (Kullanıldı / Reddedildi)"}
                        >
                          {isHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>

                        {/* Kopyala */}
                        <button
                          type="button"
                          onClick={() => handleCopy(idea)}
                          className="btn-card-action icon-only"
                          title="Fikri Kopyala"
                        >
                          {isCopied ? (
                            <CheckCircle2 size={12} style={{ color: "#10b981" }} />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>

                        {/* Video Stüdyosuna Aktar (Eğer Dikey Video İse) */}
                        {isVideo && (
                          <button
                            type="button"
                            onClick={() => handleSendToGoogleVids(idea)}
                            className="btn-card-action"
                            style={{ background: "#fdf2f8", borderColor: "#fbcfe8", color: "#db2777", fontWeight: 700 }}
                            title="Google Vids AI Video Stüdyosu'na Aktar"
                          >
                            <Clapperboard size={12} />
                            <span>Vids</span>
                          </button>
                        )}

                        {/* Canva'ya Aktar */}
                        <button
                          type="button"
                          onClick={() => void handleSendToCanva(idea)}
                          className="btn-card-action primary"
                          title="Canva Tasarım Stüdyosu'na Aktar"
                        >
                          <Palette size={12} />
                          <span>Canva</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
