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
  Type,
  Cpu,
  Compass,
  Crown,
  Trash2,
  FileCode,
  Image as ImageIcon,
  Wand2,
} from "lucide-react";
import {
  BRAND_VISUAL_SPECS,
  BrandVisualSpec,
  BrandVisualType,
  BrandVisualsState,
  GeneratedLogoConcept,
  LOGO_STYLE_ARCHETYPES,
  LOGO_TYPOGRAPHY_STYLES,
  LogoEngine,
  LogoLayout,
  LogoReferenceMode,
  LogoStyleArchetype,
  LogoTypographyStyle,
  SavedVisualItem,
  VISUAL_CATEGORIES,
  VisualCategory,
} from "@/lib/brand-visuals";
import { useProjects } from "./projects-context";

export function BrandVisualsTab({ projectId }: { projectId: string }) {
  const { getProject, updateProject } = useProjects();
  const project = getProject(projectId);

  // Ana Görünüm Modu: "logo_studio" (Logo Tasarım Masası) veya "social_kit" (Sosyal Medya Varlıkları)
  const [viewMode, setViewMode] = useState<"logo_studio" | "social_kit">("logo_studio");

  const [visuals, setVisuals] = useState<BrandVisualsState>({ items: {}, logoConcepts: [], updatedAt: "" });
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // ── LOGO STÜDYOSU FORM DURUMU ──
  const [logoStyle, setLogoStyle] = useState<LogoStyleArchetype>("geometric");
  const [logoEngine, setLogoEngine] = useState<LogoEngine>("gemini_image");
  const [logoLayout, setLogoLayout] = useState<LogoLayout>("stacked");
  const [logoRefMode, setLogoRefMode] = useState<LogoReferenceMode>("none");
  const [logoBrandName, setLogoBrandName] = useState("");
  const [logoTagline, setLogoTagline] = useState("");
  const [logoFontStyle, setLogoFontStyle] = useState<LogoTypographyStyle>("sans");
  const [logoCustomPrompt, setLogoCustomPrompt] = useState("");
  const [generatingLogo, setGeneratingLogo] = useState(false);

  // ── SOSYAL MEDYA KİTİ DURUMU ──
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
  const [previewConcept, setPreviewConcept] = useState<GeneratedLogoConcept | null>(null);

  // İlk yüklemede proje marka bilgilerini doldur
  useEffect(() => {
    if (project) {
      setLogoBrandName(project.brand.brandName || project.name || "");
      setLogoTagline(project.brand.industry || "STEM & Maker Atölyesi");
    }
  }, [project]);

  // Görselleri ve Logo Konseptlerini API'den çek
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
  const generatedSocialCount = useMemo(() => Object.keys(visuals.items).length, [visuals]);
  const logoConcepts = visuals.logoConcepts || [];

  const filteredSpecs = useMemo(() => {
    if (activeCategory === "all") return allSpecs;
    return allSpecs.filter((spec) => spec.category === activeCategory);
  }, [allSpecs, activeCategory]);

  // ─────────────────────────────────────────────────────────────
  // LOGO TASARIM STÜDYOSU: KONSEPT ÜRETİMİ (Tekil veya 3 Alternatif)
  // ─────────────────────────────────────────────────────────────
  async function handleGenerateLogoConcepts(count: number = 1) {
    if (generatingLogo) return;
    setGeneratingLogo(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/ai/brand-visuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_logo_concept",
          projectId,
          style: logoStyle,
          engine: logoEngine,
          layout: logoLayout,
          referenceMode: logoRefMode,
          typography: {
            brandName: logoBrandName.trim(),
            tagline: logoTagline.trim(),
            fontStyle: logoFontStyle,
          },
          customDirection: logoCustomPrompt.trim() || undefined,
          count,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Logo üretilemedi.");
      }

      setVisuals(data.visuals);
      setStatusMessage({
        ok: true,
        text: `✓ ${count > 1 ? `${count} farklı logo alternatifi (A/B/C)` : "Yeni logo konsepti"} başarıyla üretildi!`,
      });
    } catch (err) {
      setStatusMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Logo üretimi sırasında hata oluştu.",
      });
    } finally {
      setGeneratingLogo(false);
    }
  }

  // Logo Konseptini Ana Logo Olarak Ata
  async function setConceptAsPrimaryLogo(concept: GeneratedLogoConcept) {
    setStatusMessage(null);
    try {
      const res = await fetch("/api/ai/brand-visuals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          action: "set_primary_logo",
          url: concept.url,
          conceptId: concept.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Logo atanamadı.");

      if (project) {
        updateProject(projectId, {
          brand: {
            ...project.brand,
            logo: concept.url,
          },
        });
      }

      if (data.visuals) setVisuals(data.visuals);

      setStatusMessage({
        ok: true,
        text: `👑 "${concept.title}" başarıyla markanızın resmi ana logosu olarak belirlendi!`,
      });
    } catch (err) {
      setStatusMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Logo atama hatası.",
      });
    }
  }

  // Logo Konseptini Sil
  async function deleteLogoConcept(conceptId: string) {
    try {
      const res = await fetch("/api/ai/brand-visuals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          action: "delete_logo_concept",
          conceptId,
        }),
      });
      const data = await res.json();
      if (data.ok && data.visuals) setVisuals(data.visuals);
    } catch (err) {
      console.error("Delete concept error:", err);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SOSYAL MEDYA KİTİ: TEKİL & TOPLU ÜRETİM
  // ─────────────────────────────────────────────────────────────
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
      if (!res.ok || !data.ok) throw new Error(data.message || "Görsel üretilemedi.");

      setVisuals(data.visuals);
      setStatusMessage({
        ok: true,
        text: `✓ ${spec.title} başarıyla üretildi.`,
      });
      setDirectionInputsOpen((prev) => ({ ...prev, [type]: false }));
    } catch (err) {
      setStatusMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Üretim hatası.",
      });
    } finally {
      setGeneratingType(null);
    }
  }

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
        if (data.ok && data.visuals) setVisuals(data.visuals);
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

  function downloadVisual(spec: BrandVisualSpec, item: SavedVisualItem) {
    const link = document.createElement("a");
    link.href = item.url;
    const brandSlug = (project?.brand?.brandName || "marka").toLowerCase().replace(/[^a-z0-9]/g, "-");
    link.download = `${brandSlug}-${spec.type}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function downloadConceptFile(concept: GeneratedLogoConcept) {
    const link = document.createElement("a");
    const brandSlug = (concept.typography.brandName || "marka").toLowerCase().replace(/[^a-z0-9]/g, "-");
    if (concept.svgContent && concept.engine === "svg_vector") {
      const blob = new Blob([concept.svgContent], { type: "image/svg+xml" });
      link.href = URL.createObjectURL(blob);
      link.download = `${brandSlug}-logo-${concept.style}.svg`;
    } else {
      link.href = concept.url;
      link.download = `${brandSlug}-logo-${concept.style}.png`;
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <section className="settings-card" style={{ maxWidth: "100%", width: "100%", boxSizing: "border-box" }}>
      {/* ── ÜST BAŞLIK & İKİ ANA BÖLÜM SEÇİCİ ── */}
      <div
        style={{
          borderBottom: "1px solid var(--border)",
          paddingBottom: "16px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>Marka Görselleri &amp; Kimlik Merkezi</h2>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 8px",
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
              Agency Agents
            </span>
          </div>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "13px" }}>
            Marka stilinize sadık özel logo tasarım stüdyosu ve tüm sosyal medya platformları için güvenli alan uyumlu görseller.
          </p>
        </div>

        {/* Görünüm Modu Değiştirici: [🎨 Logo Stüdyosu] vs [📱 Sosyal Medya Kiti] */}
        <div style={{ display: "flex", background: "rgba(255, 255, 255, 0.04)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)", gap: "4px" }}>
          <button
            type="button"
            onClick={() => setViewMode("logo_studio")}
            className={`button compact ${viewMode === "logo_studio" ? "primary" : "ghost"}`}
            style={{
              fontSize: "12px",
              fontWeight: 700,
              padding: "6px 14px",
              borderRadius: "6px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Palette size={14} />
            <span>Logo Tasarım Stüdyosu ({logoConcepts.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("social_kit")}
            className={`button compact ${viewMode === "social_kit" ? "primary" : "ghost"}`}
            style={{
              fontSize: "12px",
              fontWeight: 700,
              padding: "6px 14px",
              borderRadius: "6px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Layers size={14} />
            <span>Sosyal Medya Varlıkları ({generatedSocialCount}/{allSpecs.length})</span>
          </button>
        </div>
      </div>

      {/* Durum Bildirim Kutusu */}
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
            style={{ marginLeft: "auto", background: "none", border: "none", color: "inherit", cursor: "pointer" }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 1. BÖLÜM: LOGO & KİMLİK TASARIM STÜDYOSU                      */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {viewMode === "logo_studio" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Logo Tasarım Masası (Workbench Kontrolleri) */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              padding: "20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Compass size={18} style={{ color: "#a855f7" }} />
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>Logo Yaratım &amp; Tasarım Masası</h3>
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Tipografi, referans modu ve 7 farklı arketiple özgün amblem sentezi
              </span>
            </div>

            {/* Kontrol Alanları Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "18px" }}>
              {/* Tipografi: Marka Adı & Slogan */}
              <div style={{ background: "rgba(0,0,0,0.2)", padding: "14px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, marginBottom: "8px" }}>
                  <Type size={14} style={{ color: "#38bdf8" }} />
                  <span>Marka İsmi &amp; Slogan</span>
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <input
                    type="text"
                    value={logoBrandName}
                    onChange={(e) => setLogoBrandName(e.target.value)}
                    placeholder="Marka Adı (Örn: Atölye Hanem)"
                    style={{ width: "100%", padding: "7px 10px", fontSize: "12px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "#fff" }}
                  />
                  <input
                    type="text"
                    value={logoTagline}
                    onChange={(e) => setLogoTagline(e.target.value)}
                    placeholder="Slogan / Açıklama (Örn: STEM & Maker Atölyesi)"
                    style={{ width: "100%", padding: "7px 10px", fontSize: "12px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "#fff" }}
                  />
                </div>
              </div>

              {/* Tipografi Karakteri & Font Ekolü */}
              <div style={{ background: "rgba(0,0,0,0.2)", padding: "14px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, marginBottom: "8px" }}>
                  <SlidersHorizontal size={14} style={{ color: "#f59e0b" }} />
                  <span>Yazı Karakteri Ekolü</span>
                </label>
                <select
                  value={logoFontStyle}
                  onChange={(e) => setLogoFontStyle(e.target.value as LogoTypographyStyle)}
                  style={{ width: "100%", padding: "8px 10px", fontSize: "12px", borderRadius: "6px", background: "#1a1b24", border: "1px solid var(--border)", color: "#fff", marginBottom: "6px" }}
                >
                  {LOGO_TYPOGRAPHY_STYLES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.example})
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
                  {LOGO_TYPOGRAPHY_STYLES.find((t) => t.id === logoFontStyle)?.fontCategory}
                </div>
              </div>

              {/* Referans Modu (Aynı Logoyu Önleme) */}
              <div style={{ background: "rgba(0,0,0,0.2)", padding: "14px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, marginBottom: "8px" }}>
                  <ShieldCheck size={14} style={{ color: "#10b981" }} />
                  <span>Referans Mantığı</span>
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="refMode"
                      checked={logoRefMode === "none"}
                      onChange={() => setLogoRefMode("none")}
                    />
                    <span style={{ color: logoRefMode === "none" ? "#38bdf8" : "inherit" }}>
                      <strong>Sıfırdan Özgün Keşif (Tavsiye Edilen)</strong>
                    </span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="refMode"
                      checked={logoRefMode === "evolve"}
                      onChange={() => setLogoRefMode("evolve")}
                    />
                    <span>Mevcut Logodan Evrimleştirme (Refresh)</span>
                  </label>
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
                  {logoRefMode === "none"
                    ? "✓ Eski logoyu tamamen unutur; sadece marka kimliği ve renklere odaklı %100 yeni fikirler üretir."
                    : "Mevcut logonun ana hatlarını koruyarak daha modern veya taktil varyantlara dönüştürür."}
                </div>
              </div>

              {/* Yerleşim Mimarisi & Motor Tercihi */}
              <div style={{ background: "rgba(0,0,0,0.2)", padding: "14px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, marginBottom: "8px" }}>
                  <Cpu size={14} style={{ color: "#ec4899" }} />
                  <span>Yerleşim &amp; Çıktı Motoru</span>
                </label>
                <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  <select
                    value={logoLayout}
                    onChange={(e) => setLogoLayout(e.target.value as LogoLayout)}
                    style={{ flex: 1, padding: "7px 10px", fontSize: "12px", borderRadius: "6px", background: "#1a1b24", border: "1px solid var(--border)", color: "#fff" }}
                  >
                    <option value="stacked">Stacked (Amblem Üstte)</option>
                    <option value="horizontal">Yatay (Amblem Solda)</option>
                    <option value="icon_only">Yalnızca İkon / Amblem</option>
                    <option value="badge">Rozet / Dairesel Mühür</option>
                  </select>
                  <select
                    value={logoEngine}
                    onChange={(e) => setLogoEngine(e.target.value as LogoEngine)}
                    style={{ flex: 1, padding: "7px 10px", fontSize: "12px", borderRadius: "6px", background: "#1a1b24", border: "1px solid var(--border)", color: "#fff" }}
                  >
                    <option value="gemini_image">Gemini 3D Taktil Render</option>
                    <option value="svg_vector">Saf Vektör SVG Motoru</option>
                  </select>
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {logoEngine === "svg_vector"
                    ? "✓ Sonsuz büyütülebilir saf matematiksel SVG vektör kodu + yüksek çözünürlüklü PNG."
                    : "✓ Gerçekçi stüdyo ışığı, gölgeler, derinlik ve malzeme dokulu modern 3D render."}
                </div>
              </div>
            </div>

            {/* 7 Logo Arketipi Seçici Çubuğu */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Wand2 size={14} style={{ color: "#a855f7" }} />
                <span>Tasarım Arketipi / Tarzı (Seçili: {LOGO_STYLE_ARCHETYPES.find((s) => s.id === logoStyle)?.name})</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px" }}>
                {LOGO_STYLE_ARCHETYPES.map((arch) => {
                  const isSelected = logoStyle === arch.id;
                  return (
                    <button
                      key={arch.id}
                      type="button"
                      onClick={() => setLogoStyle(arch.id)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: `1px solid ${isSelected ? "#9333ea" : "var(--border)"}`,
                        background: isSelected ? "rgba(147, 51, 234, 0.18)" : "rgba(255, 255, 255, 0.03)",
                        color: isSelected ? "#fff" : "var(--text-muted)",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ fontSize: "12px", fontWeight: isSelected ? 700 : 500, color: isSelected ? "#c084fc" : "#fff", marginBottom: "2px" }}>
                        {arch.name}
                      </div>
                      <div style={{ fontSize: "10px", opacity: 0.7, lineHeight: "1.2" }}>
                        {arch.tagline.slice(0, 38)}...
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* İsteğe Bağlı Ek Tasarım Notu & Üretim Butonları */}
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="text"
                value={logoCustomPrompt}
                onChange={(e) => setLogoCustomPrompt(e.target.value)}
                placeholder="Özel Yaratıcı Not (Opsiyonel: örn: ahşap robotik eklem, mikro servo, minimalist simge)..."
                style={{
                  flex: "1 1 280px",
                  padding: "9px 12px",
                  fontSize: "12px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--border)",
                  color: "#fff",
                }}
              />
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => handleGenerateLogoConcepts(1)}
                  disabled={generatingLogo}
                  style={{
                    background: "linear-gradient(135deg, #9333ea, #4f46e5)",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(147, 51, 234, 0.25)",
                    height: "38px",
                    padding: "0 16px",
                  }}
                >
                  {generatingLogo ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}
                  <span>Tekil Konsept Üret</span>
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => handleGenerateLogoConcepts(3)}
                  disabled={generatingLogo}
                  style={{
                    border: "1px solid rgba(147, 51, 234, 0.4)",
                    color: "#c084fc",
                    height: "38px",
                    padding: "0 16px",
                  }}
                >
                  {generatingLogo ? <LoaderCircle className="spin" size={15} /> : <Layers size={15} />}
                  <span>3 Farklı Alternatif Üret (A/B/C)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Üretilen Logo Konseptleri Galerisi */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Crown size={18} style={{ color: "#f59e0b" }} />
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>Üretilen Logo Konseptleri ({logoConcepts.length})</h3>
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Beğendiğiniz konsepti tek tıkla projenin resmi logosu olarak atayabilirsiniz
              </span>
            </div>

            {logoConcepts.length === 0 ? (
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px dashed var(--border)",
                  borderRadius: "14px",
                  padding: "40px 20px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                }}
              >
                <Palette size={32} style={{ margin: "0 auto 10px auto", opacity: 0.5 }} />
                <h4 style={{ margin: "0 0 4px 0", fontSize: "14px" }}>Henüz logo konsepti üretilmedi</h4>
                <p style={{ margin: 0, fontSize: "12px", maxWidth: "420px", marginInline: "auto" }}>
                  Yukarıdaki tasarım masasından bir arketip ve stil seçerek "Tekil Konsept Üret" veya "3 Farklı Alternatif Üret" butonuna basın.
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "18px" }}>
                {logoConcepts.map((concept) => {
                  const isPrimary = project?.brand?.logo === concept.url || concept.isPrimary;
                  const isSvg = concept.engine === "svg_vector";

                  return (
                    <div
                      key={concept.id}
                      style={{
                        background: "var(--surface)",
                        border: `1px solid ${isPrimary ? "#10b981" : "var(--border)"}`,
                        borderRadius: "12px",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        position: "relative",
                        boxShadow: isPrimary ? "0 0 16px rgba(16, 185, 129, 0.15)" : undefined,
                      }}
                    >
                      {/* Kart Başlık */}
                      <div
                        style={{
                          padding: "10px 14px",
                          borderBottom: "1px solid var(--border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          background: "rgba(255, 255, 255, 0.02)",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 700 }}>{concept.title}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            {new Date(concept.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} • {concept.layout}
                          </div>
                        </div>

                        {/* Motor Rozeti */}
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "6px",
                            background: isSvg ? "rgba(56, 189, 248, 0.15)" : "rgba(168, 85, 247, 0.15)",
                            color: isSvg ? "#38bdf8" : "#c084fc",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {isSvg ? <FileCode size={11} /> : <ImageIcon size={11} />}
                          <span>{isSvg ? "SVG Vektör" : "Gemini 3D"}</span>
                        </span>
                      </div>

                      {/* Görsel Alanı */}
                      <div
                        style={{
                          position: "relative",
                          width: "100%",
                          height: "220px",
                          background: "#0c0d12",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "12px",
                        }}
                      >
                        <Image
                          src={`${concept.url}?thumb=1&v=${new Date(concept.createdAt).getTime()}`}
                          alt={concept.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 320px"
                          style={{ objectFit: "contain", padding: "12px" }}
                          unoptimized
                        />

                        {/* Aktif Logo İbaresi */}
                        {isPrimary && (
                          <div
                            style={{
                              position: "absolute",
                              top: "8px",
                              left: "8px",
                              background: "#10b981",
                              color: "#fff",
                              fontSize: "10px",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "12px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                            }}
                          >
                            <Crown size={11} />
                            <span>Ana Marka Logosu</span>
                          </div>
                        )}

                        {/* Büyütme Butonu */}
                        <button
                          type="button"
                          title="Tam Ekran Aç"
                          onClick={() => setPreviewConcept(concept)}
                          style={{
                            position: "absolute",
                            top: "8px",
                            right: "8px",
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
                          <Maximize2 size={13} />
                        </button>
                      </div>

                      {/* Alt Aksiyon Butonları */}
                      <div style={{ padding: "12px", marginTop: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            className={`button ${isPrimary ? "secondary" : "primary"}`}
                            onClick={() => setConceptAsPrimaryLogo(concept)}
                            disabled={isPrimary}
                            style={{ flex: 1, fontSize: "11.5px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                          >
                            <CheckCircle2 size={13} style={{ color: isPrimary ? "#10b981" : undefined }} />
                            <span>{isPrimary ? "Seçili Ana Logo" : "Ana Logo Olarak Ata"}</span>
                          </button>
                          <button
                            type="button"
                            className="button ghost"
                            title={isSvg ? "SVG Vektör İndir" : "Yüksek Çözünürlüklü PNG İndir"}
                            onClick={() => downloadConceptFile(concept)}
                            style={{ width: "32px", height: "32px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <Download size={14} />
                          </button>
                          <button
                            type="button"
                            className="button ghost"
                            title="Konsepti Sil"
                            onClick={() => deleteLogoConcept(concept.id)}
                            style={{ width: "32px", height: "32px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 2. BÖLÜM: SOSYAL MEDYA VARLIKLARI & KAPAKLAR                  */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {viewMode === "social_kit" && (
        <div>
          {/* Toplu Üretim & Bilgi Çubuğu */}
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
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                <span>Sosyal Medya Görsel Hazırlık Durumu</span>
                <span style={{ color: "#a855f7" }}>
                  {generatedSocialCount} / {allSpecs.length} Hazır (%
                  {Math.round((generatedSocialCount / allSpecs.length) * 100)})
                </span>
              </div>
              <div style={{ width: "100%", height: "8px", background: "rgba(255, 255, 255, 0.08)", borderRadius: "4px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${(generatedSocialCount / allSpecs.length) * 100}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #9333ea, #38bdf8)",
                    borderRadius: "4px",
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
                    <span>Kit Üretiliyor ({batchProgress.current}/{batchProgress.total})...</span>
                  </>
                ) : (
                  <>
                    <Play size={15} />
                    <span>Tüm Sosyal Medya Kitini Oluştur ({filteredSpecs.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Kategori Filtre Butonları */}
          <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "20px", overflowX: "auto" }}>
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

          {/* Kart Izgarası */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
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
                    position: "relative",
                  }}
                >
                  {/* Başlık */}
                  <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255, 255, 255, 0.02)" }}>
                    <div>
                      <h4 style={{ margin: "0 0 2px 0", fontSize: "13px", fontWeight: 700 }}>{spec.title}</h4>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{spec.platform}</div>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 6px", borderRadius: "6px", background: "rgba(255, 255, 255, 0.06)", color: "var(--text-muted)", fontFamily: "monospace" }}>
                      {spec.dimensions}
                    </span>
                  </div>

                  {/* Önizleme & Safe Zone */}
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      aspectRatio: spec.aspectRatio === "16:9" ? "16 / 9" : spec.aspectRatio === "3:1" ? "3 / 1" : spec.aspectRatio === "4:1" ? "4 / 1" : "1 / 1",
                      maxHeight: "260px",
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
                        {isSafeZoneActive && (
                          <SafeZoneOverlay type={spec.safeZoneOverlayType} width={spec.width} height={spec.height} />
                        )}
                        <div style={{ position: "absolute", top: "8px", right: "8px", display: "flex", gap: "6px", zIndex: 10 }}>
                          {spec.safeZoneOverlayType && (
                            <button
                              type="button"
                              title={isSafeZoneActive ? "Güvenli Alanı Gizle" : "Güvenli Alanı Göster"}
                              onClick={() => setShowSafeZone((prev) => ({ ...prev, [spec.type]: !isSafeZoneActive }))}
                              style={{ width: "28px", height: "28px", borderRadius: "6px", background: isSafeZoneActive ? "#9333ea" : "rgba(0,0,0,0.65)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                            >
                              {isSafeZoneActive ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          )}
                          <button
                            type="button"
                            title="Tam Ekran Aç"
                            onClick={() => setPreviewModalSpec(spec)}
                            style={{ width: "28px", height: "28px", borderRadius: "6px", background: "rgba(0,0,0,0.65)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                          >
                            <Maximize2 size={14} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                        <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "rgba(255, 255, 255, 0.04)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px auto" }}>
                          <Sparkles size={18} />
                        </div>
                        <div style={{ fontSize: "12px", fontWeight: 600 }}>Henüz Üretilmedi</div>
                        <div style={{ fontSize: "11px", opacity: 0.7, marginTop: "2px" }}>{spec.dimensions}</div>
                      </div>
                    )}

                    {isGenerating && (
                      <div style={{ position: "absolute", inset: 0, background: "rgba(15, 16, 21, 0.85)", backdropFilter: "blur(3px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", zIndex: 20 }}>
                        <LoaderCircle className="spin" size={26} style={{ color: "#a855f7" }} />
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#fff" }}>AI Görsel Üretiliyor...</span>
                      </div>
                    )}
                  </div>

                  {/* Safe Zone Notu */}
                  <div style={{ padding: "8px 12px", background: "rgba(255, 255, 255, 0.02)", borderBottom: "1px solid var(--border)", fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "flex-start", gap: "6px", lineHeight: "1.4" }}>
                    <Info size={13} style={{ flexShrink: 0, marginTop: "1px", color: "#38bdf8" }} />
                    <span>{spec.safeZoneGuide}</span>
                  </div>

                  {/* Özel Not Açılır Alanı */}
                  {isDirectionOpen && (
                    <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.2)" }}>
                      <input
                        type="text"
                        value={customDirections[spec.type] || ""}
                        onChange={(e) => setCustomDirections((prev) => ({ ...prev, [spec.type]: e.target.value }))}
                        placeholder="Özel tasarım yönlendirmesi..."
                        style={{ width: "100%", fontSize: "12px", padding: "6px 10px", borderRadius: "6px", background: "rgba(255, 255, 255, 0.05)", border: "1px solid var(--border)", color: "#fff" }}
                      />
                    </div>
                  )}

                  {/* Butonlar */}
                  <div style={{ padding: "12px", marginTop: "auto", display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      className="button primary"
                      onClick={() => generateVisual(spec.type)}
                      disabled={isGenerating || batchRunning}
                      style={{ flex: 1, fontSize: "12px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                    >
                      {item ? <RefreshCw size={14} /> : <Sparkles size={14} />}
                      <span>{item ? "Yeniden Üret" : "Görseli Üret"}</span>
                    </button>
                    {item && (
                      <button
                        type="button"
                        className="button ghost"
                        title="Orijinal PNG İndir"
                        onClick={() => downloadVisual(spec, item)}
                        style={{ width: "34px", height: "34px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <Download size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      className={`button ghost ${isDirectionOpen ? "active" : ""}`}
                      title="Özel tasarım notu"
                      onClick={() => setDirectionInputsOpen((prev) => ({ ...prev, [spec.type]: !isDirectionOpen }))}
                      style={{ width: "34px", height: "34px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <SlidersHorizontal size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MODAL: STANDART GÖRSEL TAM EKRAN ── */}
      {previewModalSpec && (
        <PreviewModal
          spec={previewModalSpec}
          item={visuals.items[previewModalSpec.type]}
          onClose={() => setPreviewModalSpec(null)}
          onDownload={() => {
            const item = visuals.items[previewModalSpec.type];
            if (item) downloadVisual(previewModalSpec, item);
          }}
        />
      )}

      {/* ── MODAL: LOGO KONSEPTİ TAM EKRAN ── */}
      {previewConcept && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0, 0, 0, 0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
          onClick={() => setPreviewConcept(null)}
        >
          <div
            style={{ background: "#12131a", border: "1px solid var(--border)", borderRadius: "16px", maxWidth: "800px", width: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ margin: "0 0 2px 0", fontSize: "16px" }}>{previewConcept.title}</h3>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {previewConcept.engine === "svg_vector" ? "Saf Matematiksel SVG Vektör" : "Gemini 3.1 3D Taktil Render"}
                </span>
              </div>
              <button type="button" onClick={() => setPreviewConcept(null)} className="button ghost" style={{ width: "32px", height: "32px", padding: 0 }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ position: "relative", width: "100%", height: "480px", background: "#0a0b0e", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
              <Image src={previewConcept.url} alt={previewConcept.title} fill style={{ objectFit: "contain", padding: "24px" }} unoptimized />
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255, 255, 255, 0.02)" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Stil: {previewConcept.style} • Tipografi: {previewConcept.typography.brandName}
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setConceptAsPrimaryLogo(previewConcept);
                    setPreviewConcept(null);
                  }}
                  style={{ fontSize: "12px" }}
                >
                  <Crown size={14} />
                  <span>Ana Logo Yap</span>
                </button>
                <button type="button" className="button primary" onClick={() => downloadConceptFile(previewConcept)} style={{ fontSize: "12px" }}>
                  <Download size={14} />
                  <span>İndir ({previewConcept.engine === "svg_vector" ? "SVG" : "PNG"})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
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
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5 }}>
        <div style={{ width: "64%", height: "64%", borderRadius: "50%", border: "2px dashed #38bdf8", boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)", position: "relative" }}>
          <span style={{ position: "absolute", top: "4px", left: "50%", transform: "translateX(-50%)", fontSize: "10px", fontWeight: 700, color: "#38bdf8", background: "rgba(0,0,0,0.8)", padding: "1px 5px", borderRadius: "4px", whiteSpace: "nowrap" }}>
            Dairesel Profil Alanı
          </span>
        </div>
      </div>
    );
  }

  if (type === "youtube_banner") {
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "35.3%", background: "rgba(0,0,0,0.65)" }}>
          <span style={{ position: "absolute", bottom: "4px", left: "8px", fontSize: "9px", color: "#94a3b8" }}>
            TV Ekranı Alanı (Masaüstü/Mobilde Görünmez)
          </span>
        </div>
        <div style={{ position: "absolute", top: "35.3%", bottom: "35.3%", left: "19.8%", right: "19.8%", border: "2px dashed #10b981", background: "rgba(16, 185, 129, 0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, color: "#10b981", background: "rgba(0,0,0,0.85)", padding: "2px 6px", borderRadius: "4px" }}>
            Mobil &amp; Masaüstü Güvenli Alanı (1546×423 px)
          </span>
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "35.3%", background: "rgba(0,0,0,0.65)" }} />
      </div>
    );
  }

  if (type === "twitter_header") {
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
        <div style={{ position: "absolute", bottom: 0, left: "4%", width: "24%", height: "55%", border: "2px dashed #ef4444", background: "rgba(239, 68, 68, 0.25)", borderRadius: "8px 8px 0 0", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "4px" }}>
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
// TAM EKRAN İNCELEME MODALI (SOSYAL MEDYA VARLIĞI)
// ─────────────────────────────────────────────────────────────
function PreviewModal({
  spec,
  item,
  onClose,
  onDownload,
}: {
  spec: BrandVisualSpec;
  item?: SavedVisualItem;
  onClose: () => void;
  onDownload: () => void;
}) {
  const [showGuide, setShowGuide] = useState(true);

  if (!item) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0, 0, 0, 0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={onClose}>
      <div style={{ background: "#12131a", border: "1px solid var(--border)", borderRadius: "16px", maxWidth: "950px", width: "100%", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: "0 0 2px 0", fontSize: "16px" }}>{spec.title}</h3>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {spec.platform} • {spec.dimensions}
            </span>
          </div>
          <button type="button" onClick={onClose} className="button ghost" style={{ width: "32px", height: "32px", padding: 0 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ position: "relative", width: "100%", height: "520px", background: "#0a0b0e", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Image src={item.url} alt={spec.title} fill style={{ objectFit: "contain" }} unoptimized />
          {showGuide && spec.safeZoneOverlayType && (
            <SafeZoneOverlay type={spec.safeZoneOverlayType} width={spec.width} height={spec.height} />
          )}
        </div>
        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255, 255, 255, 0.02)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {spec.safeZoneOverlayType && (
              <button type="button" className={`button compact ${showGuide ? "secondary" : "ghost"}`} onClick={() => setShowGuide(!showGuide)} style={{ fontSize: "12px" }}>
                {showGuide ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>{showGuide ? "Kılavuzu Gizle" : "Kılavuzu Göster"}</span>
              </button>
            )}
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{spec.safeZoneGuide}</span>
          </div>
          <button type="button" className="button primary" onClick={onDownload} style={{ fontSize: "12px" }}>
            <Download size={14} />
            <span>Orijinal PNG İndir</span>
          </button>
        </div>
      </div>
    </div>
  );
}
