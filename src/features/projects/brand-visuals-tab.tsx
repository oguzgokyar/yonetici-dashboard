"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import {
  Sparkles,
  RefreshCw,
  Download,
  CheckCircle2,
  Eye,
  EyeOff,
  Maximize2,
  LoaderCircle,
  X,
  Layers,
  SlidersHorizontal,
  Check,
  CircleAlert,
  Play,
  Share2,
  Palette,
  ShieldCheck,
  ChevronDown,
  Info,
} from "lucide-react";
import {
  BRAND_VISUAL_SPECS,
  BrandVisualSpec,
  BrandVisualType,
  BrandVisualsState,
  SavedVisualItem,
  VISUAL_CATEGORIES,
  VisualCategory,
} from "@/lib/brand-visuals";
import { useProjects } from "./projects-context";

export function BrandVisualsTab({ projectId }: { projectId: string }) {
  const { getProject, updateProject } = useProjects();
  const project = getProject(projectId);

  const [visuals, setVisuals] = useState<BrandVisualsState>({ items: {}, updatedAt: "" });
  const [loading, setLoading] = useState(true);
  const [generatingType, setGeneratingType] = useState<BrandVisualType | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; title: string }>({
    current: 0,
    total: 0,
    title: "",
  });

  const [activeCategory, setActiveCategory] = useState<VisualCategory | "all">("all");
  const [customDirections, setCustomDirections] = useState<Partial<Record<BrandVisualType, string>>>({});
  const [directionInputsOpen, setDirectionInputsOpen] = useState<Partial<Record<BrandVisualType, boolean>>>({});
  const [showSafeZone, setShowSafeZone] = useState<Partial<Record<BrandVisualType, boolean>>>({});
  const [previewModalSpec, setPreviewModalSpec] = useState<BrandVisualSpec | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Görselleri API'den çek
  useEffect(() => {
    let mounted = true;
    async function loadVisuals() {
      try {
        setLoading(true);
        const res = await fetch(`/api/ai/brand-visuals?projectId=${encodeURIComponent(projectId)}`);
        const data = await res.json();
        if (mounted && data.ok && data.visuals) {
          setVisuals(data.visuals);
        }
      } catch (err) {
        console.error("Visuals load error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadVisuals();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  // Sayı istatistikleri
  const allSpecs = useMemo(() => Object.values(BRAND_VISUAL_SPECS), []);
  const generatedCount = useMemo(() => {
    return Object.keys(visuals.items).length;
  }, [visuals]);

  const filteredSpecs = useMemo(() => {
    if (activeCategory === "all") return allSpecs;
    return allSpecs.filter((spec) => spec.category === activeCategory);
  }, [allSpecs, activeCategory]);

  // Tekil Görsel Üretimi
  async function generateVisual(type: BrandVisualType) {
    if (generatingType || batchRunning) return;
    setGeneratingType(type);
    setStatusMessage(null);

    const spec = BRAND_VISUAL_SPECS[type];
    const customDirection = customDirections[type]?.trim();

    try {
      const res = await fetch("/api/ai/brand-visuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          type,
          customDirection,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Görsel üretilemedi.");
      }

      setVisuals(data.visuals);
      setStatusMessage({
        ok: true,
        text: `✓ ${spec.title} başarıyla üretildi ve kaydedildi.`,
      });

      // Başarılı olunca direction inputunu kapat
      setDirectionInputsOpen((prev) => ({ ...prev, [type]: false }));
    } catch (err) {
      setStatusMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Üretim sırasında bir hata oluştu.",
      });
    } finally {
      setGeneratingType(null);
    }
  }

  // Toplu Üretim (Full Social Kit Generator)
  async function runBatchGeneration() {
    if (generatingType || batchRunning) return;
    setBatchRunning(true);
    setStatusMessage(null);

    const targetSpecs = filteredSpecs;
    let completed = 0;

    for (const spec of targetSpecs) {
      setBatchProgress({
        current: completed + 1,
        total: targetSpecs.length,
        title: spec.title,
      });

      try {
        const res = await fetch("/api/ai/brand-visuals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            type: spec.type,
            customDirection: customDirections[spec.type]?.trim(),
          }),
        });

        const data = await res.json();
        if (data.ok && data.visuals) {
          setVisuals(data.visuals);
        }
      } catch (err) {
        console.error(`Batch error for ${spec.type}:`, err);
      }
      completed++;
    }

    setBatchRunning(false);
    setStatusMessage({
      ok: true,
      text: `✓ Toplu üretim tamamlandı (${completed}/${targetSpecs.length} görsel güncellendi).`,
    });
  }

  // Ana Marka Logosu Olarak Ata
  async function setAsPrimaryLogo(spec: BrandVisualSpec, url: string) {
    setStatusMessage(null);
    try {
      const res = await fetch("/api/ai/brand-visuals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          action: "set_primary_logo",
          url,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Logo atanamadı.");

      if (project) {
        updateProject(projectId, {
          brand: {
            ...project.brand,
            logo: url,
          },
        });
      }

      setStatusMessage({
        ok: true,
        text: `✓ "${spec.title}" başarıyla projenin ana marka logosu olarak ayarlandı!`,
      });
    } catch (err) {
      setStatusMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Logo atama hatası.",
      });
    }
  }

  // Görsel İndir
  function downloadVisual(spec: BrandVisualSpec, item: SavedVisualItem) {
    const link = document.createElement("a");
    link.href = item.url;
    const brandSlug = (project?.brand?.brandName || "marka").toLowerCase().replace(/[^a-z0-9]/g, "-");
    link.download = `${brandSlug}-${spec.type}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <section className="settings-card" style={{ maxWidth: "100%" }}>
      {/* Başlık ve İlerleme Barı */}
      <div className="settings-heading" style={{ alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <h2 style={{ margin: 0 }}>Marka Görselleri &amp; Sosyal Medya Kiti</h2>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: "12px",
                background: "rgba(147, 51, 234, 0.15)",
                color: "#a855f7",
                border: "1px solid rgba(147, 51, 234, 0.3)",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Sparkles size={12} />
              Agency Agents Destekli
            </span>
          </div>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "13px" }}>
            Marka stili sözleşmenizdeki renkler ve görsel kurallara tam sadık; Instagram, YouTube, X, LinkedIn ve
            TikTok standartlarına göre güvenli alan optimize edilmiş profesyonel görseller.
          </p>
        </div>

        {/* Toplu Üretim Butonu */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            className="button primary"
            onClick={runBatchGeneration}
            disabled={batchRunning || Boolean(generatingType)}
            style={{
              background: "linear-gradient(135deg, #9333ea, #4f46e5)",
              border: "none",
              boxShadow: "0 4px 12px rgba(147, 51, 234, 0.25)",
            }}
          >
            {batchRunning ? (
              <>
                <LoaderCircle className="spin" size={16} />
                <span>
                  Kit Üretiliyor ({batchProgress.current}/{batchProgress.total})...
                </span>
              </>
            ) : (
              <>
                <Play size={15} />
                <span>Sosyal Medya Kitini Oluştur ({filteredSpecs.length})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* İlerleme ve İstatistik Kartı */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "16px 20px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ flex: "1 1 300px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12px",
              fontWeight: 600,
              marginBottom: "6px",
            }}
          >
            <span>Marka Görsel Hazırlık Durumu</span>
            <span style={{ color: "#a855f7" }}>
              {generatedCount} / {allSpecs.length} Hazır (%
              {Math.round((generatedCount / allSpecs.length) * 100)})
            </span>
          </div>
          <div
            style={{
              width: "100%",
              height: "8px",
              background: "rgba(255, 255, 255, 0.08)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(generatedCount / allSpecs.length) * 100}%`,
                height: "100%",
                background: "linear-gradient(90deg, #9333ea, #38bdf8)",
                borderRadius: "4px",
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "12px", color: "var(--text-muted)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <ShieldCheck size={16} style={{ color: "#10b981" }} />
            Safe Zone Garantisi
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Palette size={16} style={{ color: "#f59e0b" }} />
            60-30-10 Renk Uyumlu
          </span>
        </div>
      </div>

      {/* Başarı / Hata Bildirim Kutusu */}
      {statusMessage && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13px",
            background: statusMessage.ok ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
            border: `1px solid ${statusMessage.ok ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            color: statusMessage.ok ? "#34d399" : "#f87171",
          }}
        >
          {statusMessage.ok ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Kategori Filtre Butonları */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "12px",
          marginBottom: "24px",
          overflowX: "auto",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={`button compact ${activeCategory === "all" ? "primary" : "ghost"}`}
          style={{ fontSize: "12px", padding: "6px 14px", borderRadius: "8px" }}
        >
          Tümü ({allSpecs.length})
        </button>
        {VISUAL_CATEGORIES.map((cat) => {
          const catItems = allSpecs.filter((s) => s.category === cat.id);
          const catReady = catItems.filter((s) => visuals.items[s.type]).length;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`button compact ${activeCategory === cat.id ? "primary" : "ghost"}`}
              style={{ fontSize: "12px", padding: "6px 14px", borderRadius: "8px" }}
            >
              {cat.label} ({catReady}/{catItems.length})
            </button>
          );
        })}
      </div>

      {/* Kart Izgarası (Grid) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "20px",
        }}
      >
        {filteredSpecs.map((spec) => {
          const item = visuals.items[spec.type];
          const isGenerating = generatingType === spec.type || (batchRunning && batchProgress.title === spec.title);
          const isSafeZoneActive = showSafeZone[spec.type] ?? false;
          const isDirectionOpen = directionInputsOpen[spec.type] ?? false;
          const isPrimaryLogo = Boolean(project?.brand?.logo && item && project.brand.logo === item.url);

          return (
            <div
              key={spec.type}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                transition: "transform 0.2s ease, border-color 0.2s ease",
                position: "relative",
              }}
            >
              {/* Kart Üst Başlık & Rozetler */}
              <div
                style={{
                  padding: "12px 14px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "rgba(255, 255, 255, 0.02)",
                }}
              >
                <div>
                  <h4 style={{ margin: "0 0 2px 0", fontSize: "13px", fontWeight: 700 }}>{spec.title}</h4>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{spec.platform}</div>
                </div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: "6px",
                    background: "rgba(255, 255, 255, 0.06)",
                    color: "var(--text-muted)",
                    fontFamily: "monospace",
                  }}
                >
                  {spec.dimensions}
                </span>
              </div>

              {/* Görsel Alanı & Safe Zone Overlay */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: spec.aspectRatio === "16:9" ? "16 / 9" : spec.aspectRatio === "3:1" ? "3 / 1" : spec.aspectRatio === "4:1" ? "4 / 1" : "1 / 1",
                  maxHeight: "280px",
                  background: "#0f1015",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {item ? (
                  <>
                    <Image
                      src={`${item.url}?thumb=1&v=${new Date(item.updatedAt || item.createdAt).getTime()}`}
                      alt={spec.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 360px"
                      style={{ objectFit: "contain" }}
                      unoptimized
                    />

                    {/* Safe Zone Kılavuzu (Overlay) */}
                    {isSafeZoneActive && (
                      <SafeZoneOverlay type={spec.safeZoneOverlayType} width={spec.width} height={spec.height} />
                    )}

                    {/* Üstte Hızlı Aksiyon İkonları */}
                    <div
                      style={{
                        position: "absolute",
                        top: "8px",
                        right: "8px",
                        display: "flex",
                        gap: "6px",
                        zIndex: 10,
                      }}
                    >
                      {spec.safeZoneOverlayType && (
                        <button
                          type="button"
                          title={isSafeZoneActive ? "Güvenli Alan Kılavuzunu Kapat" : "Güvenli Alan Kılavuzunu Göster"}
                          onClick={() => setShowSafeZone((prev) => ({ ...prev, [spec.type]: !isSafeZoneActive }))}
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "6px",
                            background: isSafeZoneActive ? "#9333ea" : "rgba(0,0,0,0.65)",
                            color: "#fff",
                            border: "1px solid rgba(255,255,255,0.2)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          {isSafeZoneActive ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}

                      <button
                        type="button"
                        title="Tam Ekran İncele"
                        onClick={() => setPreviewModalSpec(spec)}
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "6px",
                          background: "rgba(0,0,0,0.65)",
                          color: "#fff",
                          border: "1px solid rgba(255,255,255,0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <Maximize2 size={14} />
                      </button>
                    </div>
                  </>
                ) : (
                  /* Henüz Üretilmemiş Durum Placeholder */
                  <div
                    style={{
                      textAlign: "center",
                      padding: "20px",
                      color: "var(--text-muted)",
                    }}
                  >
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "50%",
                        background: "rgba(255, 255, 255, 0.04)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 8px auto",
                        color: "var(--text-muted)",
                      }}
                    >
                      <Sparkles size={20} />
                    </div>
                    <div style={{ fontSize: "12px", fontWeight: 600 }}>Henüz Üretilmedi</div>
                    <div style={{ fontSize: "11px", opacity: 0.7, marginTop: "2px" }}>
                      {spec.dimensions}
                    </div>
                  </div>
                )}

                {/* Üretim Sırasında Loading Katmanı */}
                {isGenerating && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(15, 16, 21, 0.85)",
                      backdropFilter: "blur(3px)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "10px",
                      zIndex: 20,
                    }}
                  >
                    <LoaderCircle className="spin" size={28} style={{ color: "#a855f7" }} />
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#fff" }}>
                      AI Görsel Üretiliyor...
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      Safe zone &amp; stil sözleşmesi uygulanıyor
                    </span>
                  </div>
                )}
              </div>

              {/* Safe Zone Bilgi Notu */}
              <div
                style={{
                  padding: "8px 12px",
                  background: "rgba(255, 255, 255, 0.02)",
                  borderBottom: "1px solid var(--border)",
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "6px",
                  lineHeight: "1.4",
                }}
              >
                <Info size={13} style={{ flexShrink: 0, marginTop: "1px", color: "#38bdf8" }} />
                <span>{spec.safeZoneGuide}</span>
              </div>

              {/* Özel Prompt / Yönlendirme Açılır Alanı */}
              {isDirectionOpen && (
                <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.2)" }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, marginBottom: "4px" }}>
                    Özel Tasarım Notu / Yönlendirme (Opsiyonel):
                  </label>
                  <input
                    type="text"
                    value={customDirections[spec.type] || ""}
                    onChange={(e) =>
                      setCustomDirections((prev) => ({ ...prev, [spec.type]: e.target.value }))
                    }
                    placeholder="Örn: Ahşap doku öne çıksın, daha minimalist olsun..."
                    style={{
                      width: "100%",
                      fontSize: "12px",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid var(--border)",
                      color: "#fff",
                    }}
                  />
                </div>
              )}

              {/* Alt Butonlar & Aksiyonlar */}
              <div
                style={{
                  padding: "12px",
                  marginTop: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", gap: "6px" }}>
                  {/* Üret / Yeniden Üret Butonu */}
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => generateVisual(spec.type)}
                    disabled={isGenerating || batchRunning}
                    style={{
                      flex: 1,
                      fontSize: "12px",
                      height: "34px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    {item ? <RefreshCw size={14} /> : <Sparkles size={14} />}
                    <span>{item ? "Yeniden Üret" : "Görseli Üret"}</span>
                  </button>

                  {/* İndir Butonu */}
                  {item && (
                    <button
                      type="button"
                      className="button ghost"
                      title="Orijinal Ölçüde PNG İndir"
                      onClick={() => downloadVisual(spec, item)}
                      style={{ width: "34px", height: "34px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <Download size={15} />
                    </button>
                  )}

                  {/* Özel Prompt Aç/Kapat Butonu */}
                  <button
                    type="button"
                    className={`button ghost ${isDirectionOpen ? "active" : ""}`}
                    title="Özel tasarım yönlendirmesi ekle"
                    onClick={() =>
                      setDirectionInputsOpen((prev) => ({ ...prev, [spec.type]: !isDirectionOpen }))
                    }
                    style={{ width: "34px", height: "34px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <SlidersHorizontal size={14} />
                  </button>
                </div>

                {/* Eğer Logo kategorisindeyse: Ana Logo Olarak Ata Butonu */}
                {spec.category === "logos" && item && (
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => setAsPrimaryLogo(spec, item.url)}
                    disabled={isPrimaryLogo}
                    style={{
                      fontSize: "11px",
                      height: "28px",
                      padding: "0 8px",
                      color: isPrimaryLogo ? "#10b981" : "var(--text-muted)",
                      borderColor: isPrimaryLogo ? "rgba(16, 185, 129, 0.4)" : undefined,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    <CheckCircle2 size={13} style={{ color: isPrimaryLogo ? "#10b981" : undefined }} />
                    <span>{isPrimaryLogo ? "Ana Marka Logosu Olarak Seçili" : "Ana Logo Olarak Ata"}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tam Ekran İnceleme Modalı */}
      {previewModalSpec && (
        <PreviewModal
          spec={previewModalSpec}
          item={visuals.items[previewModalSpec.type]}
          onClose={() => setPreviewModalSpec(null)}
          onDownload={() => {
            const item = visuals.items[previewModalSpec.type];
            if (item) downloadVisual(previewModalSpec, item);
          }}
          onSetPrimaryLogo={
            previewModalSpec.category === "logos" && visuals.items[previewModalSpec.type]
              ? () => setAsPrimaryLogo(previewModalSpec, visuals.items[previewModalSpec.type]!.url)
              : undefined
          }
        />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// SAFE ZONE KILAVUZU (CANLI ÖNİZLEME KATMANI)
// ─────────────────────────────────────────────────────────────
function SafeZoneOverlay({
  type,
  width,
  height,
}: {
  type?: "circle" | "youtube_banner" | "twitter_header" | "linkedin_banner";
  width: number;
  height: number;
}) {
  if (type === "circle") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 5,
        }}
      >
        {/* Dairesel Güvenli Alan Çerçevesi */}
        <div
          style={{
            width: "64%",
            height: "64%",
            borderRadius: "50%",
            border: "2px dashed #38bdf8",
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)",
            position: "relative",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "4px",
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: "10px",
              fontWeight: 700,
              color: "#38bdf8",
              background: "rgba(0,0,0,0.8)",
              padding: "1px 5px",
              borderRadius: "4px",
              whiteSpace: "nowrap",
            }}
          >
            Dairesel Profil Alanı
          </span>
        </div>
      </div>
    );
  }

  if (type === "youtube_banner") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 5,
        }}
      >
        {/* Üst Karartma */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "35.3%", background: "rgba(0,0,0,0.65)" }}>
          <span style={{ position: "absolute", bottom: "4px", left: "8px", fontSize: "9px", color: "#94a3b8" }}>
            TV Ekranı Alanı (Masaüstü/Mobilde Görünmez)
          </span>
        </div>

        {/* Merkez Safe Zone (Tüm Cihazlarda Görünür) */}
        <div
          style={{
            position: "absolute",
            top: "35.3%",
            bottom: "35.3%",
            left: "19.8%",
            right: "19.8%",
            border: "2px dashed #10b981",
            background: "rgba(16, 185, 129, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "#10b981",
              background: "rgba(0,0,0,0.85)",
              padding: "2px 6px",
              borderRadius: "4px",
            }}
          >
            Mobil &amp; Masaüstü Güvenli Alanı (1546×423 px)
          </span>
        </div>

        {/* Alt Karartma */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "35.3%", background: "rgba(0,0,0,0.65)" }} />
      </div>
    );
  }

  if (type === "twitter_header") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 5,
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "4%",
            width: "24%",
            height: "55%",
            border: "2px dashed #ef4444",
            background: "rgba(239, 68, 68, 0.25)",
            borderRadius: "8px 8px 0 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "4px",
          }}
        >
          <span style={{ fontSize: "9px", fontWeight: 700, color: "#fca5a5", background: "rgba(0,0,0,0.7)", padding: "2px 4px", borderRadius: "4px" }}>
            Avatar Kör Noktası
          </span>
        </div>
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// TAM EKRAN İNCELEME MODALI
// ─────────────────────────────────────────────────────────────
function PreviewModal({
  spec,
  item,
  onClose,
  onDownload,
  onSetPrimaryLogo,
}: {
  spec: BrandVisualSpec;
  item?: SavedVisualItem;
  onClose: () => void;
  onDownload: () => void;
  onSetPrimaryLogo?: () => void;
}) {
  const [showGuide, setShowGuide] = useState(true);

  if (!item) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#12131a",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          maxWidth: "950px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Başlık */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 2px 0", fontSize: "16px" }}>{spec.title}</h3>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {spec.platform} • {spec.dimensions}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="button ghost"
            style={{ width: "32px", height: "32px", padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Görsel Alanı */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "520px",
            background: "#0a0b0e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            src={item.url}
            alt={spec.title}
            fill
            style={{ objectFit: "contain" }}
            unoptimized
          />

          {showGuide && spec.safeZoneOverlayType && (
            <SafeZoneOverlay type={spec.safeZoneOverlayType} width={spec.width} height={spec.height} />
          )}
        </div>

        {/* Modal Alt Çubuk */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(255, 255, 255, 0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {spec.safeZoneOverlayType && (
              <button
                type="button"
                className={`button compact ${showGuide ? "secondary" : "ghost"}`}
                onClick={() => setShowGuide(!showGuide)}
                style={{ fontSize: "12px" }}
              >
                {showGuide ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>{showGuide ? "Kılavuzu Gizle" : "Kılavuzu Göster"}</span>
              </button>
            )}
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {spec.safeZoneGuide}
            </span>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            {onSetPrimaryLogo && (
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  onSetPrimaryLogo();
                  onClose();
                }}
                style={{ fontSize: "12px" }}
              >
                <CheckCircle2 size={14} />
                <span>Ana Logo Yap</span>
              </button>
            )}
            <button
              type="button"
              className="button primary"
              onClick={onDownload}
              style={{ fontSize: "12px" }}
            >
              <Download size={14} />
              <span>Orijinal PNG İndir</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
