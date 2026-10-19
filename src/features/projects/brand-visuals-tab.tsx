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
  Palette,
  ShieldCheck,
  Type,
  Cpu,
  Compass,
  Crown,
  Trash2,
  FileCode,
  Image as ImageIcon,
  Wand2,
  Sun,
  Moon,
  LayoutTemplate,
  Box,
  Hexagon,
  Award,
  Bot,
  Zap,
  Workflow,
  Sparkle,
  ArrowRight,
  Info,
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

// ─────────────────────────────────────────────────────────────
// 7 LOGO ARKETİPİ İÇİN MİNYATÜR GÖRSEL İLLÜSTRASYONLAR
// ─────────────────────────────────────────────────────────────
function ArchetypeVisualPreview({ archetype, active }: { archetype: LogoStyleArchetype; active: boolean }) {
  const primary = active ? "#7c3aed" : "#475569";
  const accent = active ? "#ec4899" : "#0284c7";
  const bg = active ? "#f5f3ff" : "#f8fafc";

  switch (archetype) {
    case "geometric":
      // Kesişen Altın Oran Daireler & Prizma
      return (
        <svg viewBox="0 0 80 60" width="100%" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="30" r="18" stroke={primary} strokeWidth="2.5" strokeDasharray="3 3" opacity="0.6" />
          <circle cx="48" cy="30" r="18" stroke={accent} strokeWidth="2.5" opacity="0.7" />
          <polygon points="40,16 54,40 26,40" stroke={primary} strokeWidth="3" fill={bg} />
          <circle cx="40" cy="28" r="4" fill={accent} />
        </svg>
      );
    case "monogram":
      // A ve H Harflerinin İç İçe Geçen Lüks Füzyonu
      return (
        <svg viewBox="0 0 80 60" width="100%" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M26,45 L40,14 L54,45" stroke={primary} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M30,34 L50,34" stroke={accent} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M48,18 L48,45" stroke={primary} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="40" cy="14" r="3" fill={accent} />
        </svg>
      );
    case "tactile_3d":
      // 3D İzometrik Yumuşak Gölgeli Hacimli Blok
      return (
        <svg viewBox="0 0 80 60" width="100%" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="40,12 60,23 40,34 20,23" fill={active ? "#c4b5fd" : "#cbd5e1"} />
          <polygon points="20,23 40,34 40,48 20,37" fill={primary} />
          <polygon points="40,34 60,23 60,37 40,48" fill={active ? "#5b21b6" : "#334155"} />
          <circle cx="40" cy="23" r="3" fill="#ffffff" />
        </svg>
      );
    case "metaphor":
      // Dişli & Robotik Kol / Fidan Simgesel Birleşimi
      return (
        <svg viewBox="0 0 80 60" width="100%" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="34" cy="30" r="12" stroke={primary} strokeWidth="2.5" />
          <path d="M34,14 L34,18 M34,42 L34,46 M18,30 L22,30 M46,30 L50,30" stroke={primary} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M38,24 Q52,18 56,32 Q46,40 38,34" fill={accent} opacity="0.8" />
          <circle cx="56" cy="32" r="3" fill={primary} />
        </svg>
      );
    case "abstract_dynamic":
      // Fütüristik İvme & Akışkan Kanat Hatları
      return (
        <svg viewBox="0 0 80 60" width="100%" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22,42 Q40,12 62,18 Q42,28 32,44 Z" fill={primary} />
          <path d="M32,44 Q50,22 66,28 Q48,38 42,46 Z" fill={accent} opacity="0.85" />
          <circle cx="22" cy="42" r="3" fill={accent} />
        </svg>
      );
    case "stamp_badge":
      // Çift Halkalı Kurumsal Onay Mührü
      return (
        <svg viewBox="0 0 80 60" width="100%" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="40" cy="30" r="20" stroke={primary} strokeWidth="2" />
          <circle cx="40" cy="30" r="16" stroke={primary} strokeWidth="1" strokeDasharray="2 2" />
          <polygon points="40,20 42,26 48,27 43,31 45,37 40,33 35,37 37,31 32,27 38,26" fill={accent} />
        </svg>
      );
    case "mascot":
      // Dostane Geometrik Robot / Karakter Yüzü
      return (
        <svg viewBox="0 0 80 60" width="100%" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="26" y="18" width="28" height="24" rx="6" stroke={primary} strokeWidth="2.5" fill={bg} />
          <line x1="40" y1="12" x2="40" y2="18" stroke={primary} strokeWidth="2" />
          <circle cx="40" cy="11" r="3" fill={accent} />
          <circle cx="34" cy="28" r="3" fill={primary} />
          <circle cx="46" cy="28" r="3" fill={primary} />
          <path d="M35,35 Q40,39 45,35" stroke={accent} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
  }
}

// ─────────────────────────────────────────────────────────────
// 4 YERLEŞİM (LAYOUT) İÇİN MİNYATÜR ŞEMATİK KUTU GÖRSELLERİ
// ─────────────────────────────────────────────────────────────
function LayoutSchematic({ layout, active }: { layout: LogoLayout; active: boolean }) {
  const primary = active ? "#7c3aed" : "#64748b";
  const textLine = active ? "#9333ea" : "#94a3b8";

  switch (layout) {
    case "stacked":
      // Üstte amblem, altta ortalanmış marka adı
      return (
        <svg viewBox="0 0 70 50" width="100%" height="38" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="27" y="6" width="16" height="16" rx="4" fill={primary} />
          <rect x="15" y="28" width="40" height="4.5" rx="2" fill={textLine} />
          <rect x="22" y="36" width="26" height="3" rx="1.5" fill={textLine} opacity="0.6" />
        </svg>
      );
    case "horizontal":
      // Solda amblem, sağda marka adı ve slogan
      return (
        <svg viewBox="0 0 70 50" width="100%" height="38" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="8" y="15" width="20" height="20" rx="5" fill={primary} />
          <rect x="33" y="18" width="31" height="5" rx="2" fill={textLine} />
          <rect x="33" y="27" width="22" height="3.5" rx="1.5" fill={textLine} opacity="0.6" />
        </svg>
      );
    case "icon_only":
      // Sadece merkez amblem (yazısız)
      return (
        <svg viewBox="0 0 70 50" width="100%" height="38" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="22" y="12" width="26" height="26" rx="6" fill={primary} />
          <circle cx="35" cy="25" r="5" fill="#ffffff" />
        </svg>
      );
    case "badge":
      // Dairesel mühür rozet yerleşimi
      return (
        <svg viewBox="0 0 70 50" width="100%" height="38" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="35" cy="25" r="18" stroke={primary} strokeWidth="2.5" />
          <circle cx="35" cy="25" r="14" stroke={textLine} strokeWidth="1" strokeDasharray="2 2" />
          <rect x="31" y="21" width="8" height="8" rx="2" fill={primary} />
        </svg>
      );
  }
}

export function BrandVisualsTab({ projectId }: { projectId: string }) {
  const { getProject, updateProject } = useProjects();
  const project = getProject(projectId);

  // Görünüm Modu: "logo_studio" veya "social_kit"
  const [viewMode, setViewMode] = useState<"logo_studio" | "social_kit">("logo_studio");

  const [visuals, setVisuals] = useState<BrandVisualsState>({ items: {}, logoConcepts: [], updatedAt: "" });
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // ── LOGO STÜDYOSU SEÇİMLERİ ──
  const [logoStyle, setLogoStyle] = useState<LogoStyleArchetype>("geometric");
  const [logoEngine, setLogoEngine] = useState<LogoEngine>("svg_vector");
  const [logoLayout, setLogoLayout] = useState<LogoLayout>("stacked");
  const [logoRefMode, setLogoRefMode] = useState<LogoReferenceMode>("none");
  const [logoBrandName, setLogoBrandName] = useState("");
  const [logoTagline, setLogoTagline] = useState("");
  const [logoFontStyle, setLogoFontStyle] = useState<LogoTypographyStyle>("sans");
  const [logoCustomPrompt, setLogoCustomPrompt] = useState("");
  const [generatingLogo, setGeneratingLogo] = useState(false);
  const [canvasBgDark, setCanvasBgDark] = useState(false);

  // ── SOSYAL MEDYA KİTİ SEÇİMLERİ ──
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

  useEffect(() => {
    if (project) {
      setLogoBrandName(project.brand.brandName || project.name || "");
      setLogoTagline(project.brand.industry || "STEM & Maker Atölyesi");
    }
  }, [project]);

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

  const allSpecs = useMemo(() => Object.values(BRAND_VISUAL_SPECS), []);
  const generatedSocialCount = useMemo(() => Object.keys(visuals.items).length, [visuals]);
  const logoConcepts = visuals.logoConcepts || [];

  const filteredSpecs = useMemo(() => {
    if (activeCategory === "all") return allSpecs;
    return allSpecs.filter((spec) => spec.category === activeCategory);
  }, [allSpecs, activeCategory]);

  // Logo Üretimi
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
      if (!res.ok || !data.ok) throw new Error(data.message || "Logo üretilemedi.");

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

  // Ana Logo Olarak Ata
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

  // Sosyal Medya Tekil Üretim
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

  // Sosyal Medya Toplu Üretim
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
    <section
      className="settings-card"
      style={{
        maxWidth: "100%",
        width: "100%",
        boxSizing: "border-box",
        background: "#ffffff",
        border: "1px solid var(--border)",
        borderRadius: "16px",
        padding: "24px",
      }}
    >
      {/* ── ÜST BAŞLIK & İKİ ANA BÖLÜM SEÇİCİ ── */}
      <div
        style={{
          borderBottom: "1px solid #e2e8f0",
          paddingBottom: "18px",
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
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0f172a", fontFamily: "Manrope, sans-serif" }}>
              Marka Görselleri &amp; Kimlik Merkezi
            </h2>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "3px 9px",
                borderRadius: "99px",
                background: "#faf5ff",
                color: "#7e22ce",
                border: "1px solid #e9d5ff",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Sparkles size={12} color="#9333ea" />
              Agency Agents
            </span>
          </div>
          <p style={{ margin: 0, color: "#64748b", fontSize: "12.5px", lineHeight: "1.5" }}>
            Görsel örneklerle desteklenen interaktif logo stüdyosu ve tüm sosyal medya platformları için güvenli alan uyumlu görseller.
          </p>
        </div>

        {/* Segmented Controller (Görünüm Seçici) */}
        <div
          style={{
            display: "inline-flex",
            background: "#f1f5f9",
            padding: "4px",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            gap: "4px",
          }}
        >
          <button
            type="button"
            onClick={() => setViewMode("logo_studio")}
            style={{
              border: 0,
              background: viewMode === "logo_studio" ? "#ffffff" : "transparent",
              color: viewMode === "logo_studio" ? "#4338ca" : "#64748b",
              fontWeight: viewMode === "logo_studio" ? 700 : 500,
              boxShadow: viewMode === "logo_studio" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
              fontSize: "12px",
              padding: "7px 16px",
              borderRadius: "8px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.18s ease",
            }}
          >
            <Palette size={14} color={viewMode === "logo_studio" ? "#6366f1" : "currentColor"} />
            <span>Logo Tasarım Stüdyosu ({logoConcepts.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("social_kit")}
            style={{
              border: 0,
              background: viewMode === "social_kit" ? "#ffffff" : "transparent",
              color: viewMode === "social_kit" ? "#4338ca" : "#64748b",
              fontWeight: viewMode === "social_kit" ? 700 : 500,
              boxShadow: viewMode === "social_kit" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
              fontSize: "12px",
              padding: "7px 16px",
              borderRadius: "8px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.18s ease",
            }}
          >
            <Layers size={14} color={viewMode === "social_kit" ? "#6366f1" : "currentColor"} />
            <span>Sosyal Medya Varlıkları ({generatedSocialCount}/{allSpecs.length})</span>
          </button>
        </div>
      </div>

      {/* Durum Bildirim Kutusu */}
      {statusMessage && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13px",
            background: statusMessage.ok ? "#ecfdf5" : "#fff1f2",
            border: `1px solid ${statusMessage.ok ? "#a7f3d0" : "#fecdd3"}`,
            color: statusMessage.ok ? "#047857" : "#be123c",
          }}
        >
          {statusMessage.ok ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}
          <span style={{ fontWeight: 500 }}>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            style={{ marginLeft: "auto", background: "none", border: "none", color: "inherit", cursor: "pointer", padding: "4px" }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* 1. BÖLÜM: GÖRSEL ÖRNEKLİ LOGO TASARIM STÜDYOSU                */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {viewMode === "logo_studio" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Logo Tasarım Masası (Workbench Kontrolleri) */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              padding: "20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "#eeebff",
                    color: "#6d5dfc",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Compass size={17} />
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>Logo Tasarım &amp; Yaratım Masası</h3>
                  <small style={{ color: "#64748b", fontSize: "11px" }}>
                    Örnekleri görerek seçin: Arketip çizimleri, yerleşim şemaları ve tipografi kartları
                  </small>
                </div>
              </div>

              {/* Açık / Koyu Önizleme Zemin Değiştirici */}
              <button
                type="button"
                onClick={() => setCanvasBgDark(!canvasBgDark)}
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "5px 11px",
                  borderRadius: "8px",
                  background: canvasBgDark ? "#1e293b" : "#ffffff",
                  color: canvasBgDark ? "#f8fafc" : "#475569",
                  border: "1px solid #cbd5e1",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                }}
              >
                {canvasBgDark ? <Moon size={13} color="#f59e0b" /> : <Sun size={13} color="#f59e0b" />}
                <span>Zemin: {canvasBgDark ? "Koyu Tema" : "Açık Tema"}</span>
              </button>
            </div>

            {/* 1. ALAN: 7 LOGO ARKETİPİ İÇİN GÖRSEL KARTLAR */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Wand2 size={13} color="#7c3aed" />
                <span>1. Adım: Tasarım Tarzını / Arketipini Seçin</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
                {LOGO_STYLE_ARCHETYPES.map((arch) => {
                  const isSelected = logoStyle === arch.id;
                  return (
                    <button
                      key={arch.id}
                      type="button"
                      onClick={() => setLogoStyle(arch.id)}
                      style={{
                        padding: "10px 8px",
                        borderRadius: "10px",
                        border: isSelected ? "2px solid #7c3aed" : "1px solid #e2e8f0",
                        background: isSelected ? "#f5f3ff" : "#ffffff",
                        color: isSelected ? "#5b21b6" : "#334155",
                        textAlign: "center",
                        cursor: "pointer",
                        transition: "all 0.18s ease",
                        boxShadow: isSelected ? "0 4px 12px rgba(124, 58, 237, 0.15)" : "0 1px 3px rgba(0,0,0,0.03)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        position: "relative",
                      }}
                    >
                      {/* Seçili İkon Rozeti */}
                      {isSelected && (
                        <div
                          style={{
                            position: "absolute",
                            top: "6px",
                            right: "6px",
                            width: "16px",
                            height: "16px",
                            borderRadius: "50%",
                            background: "#7c3aed",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Check size={10} strokeWidth={3} />
                        </div>
                      )}

                      {/* Minyatür Görsel Çizim */}
                      <div style={{ width: "100%", height: "46px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px" }}>
                        <ArchetypeVisualPreview archetype={arch.id} active={isSelected} />
                      </div>

                      <div style={{ fontSize: "11.5px", fontWeight: isSelected ? 800 : 700, color: isSelected ? "#6d28d9" : "#1e293b", marginBottom: "2px" }}>
                        {arch.name}
                      </div>
                      <div style={{ fontSize: "9.5px", color: isSelected ? "#7c3aed" : "#64748b", lineHeight: "1.2" }}>
                        {arch.tagline.slice(0, 36)}...
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. ALAN: YERLEŞİM (LAYOUT) ŞEMATİK KUTU GÖRSELLERİ */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <LayoutTemplate size={13} color="#0284c7" />
                <span>2. Adım: Logo Yerleşim Mimarisi (Şematik Düzen)</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
                {[
                  { id: "stacked", name: "Stacked (Kare)", desc: "Amblem üstte, yazı altta" },
                  { id: "horizontal", name: "Yatay Header", desc: "Amblem solda, yazı sağda" },
                  { id: "icon_only", name: "Yalnızca Amblem", desc: "Yazısız, saf sembol" },
                  { id: "badge", name: "Dairesel Mühür", desc: "Rozet içinde dairesel hat" },
                ].map((item) => {
                  const isSelected = logoLayout === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setLogoLayout(item.id as LogoLayout)}
                      style={{
                        padding: "10px",
                        borderRadius: "10px",
                        border: isSelected ? "2px solid #0284c7" : "1px solid #e2e8f0",
                        background: isSelected ? "#f0f9ff" : "#ffffff",
                        color: isSelected ? "#0369a1" : "#334155",
                        textAlign: "center",
                        cursor: "pointer",
                        transition: "all 0.18s ease",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        boxShadow: isSelected ? "0 4px 12px rgba(2, 132, 199, 0.12)" : "0 1px 3px rgba(0,0,0,0.03)",
                      }}
                    >
                      <div style={{ width: "100%", height: "38px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "6px" }}>
                        <LayoutSchematic layout={item.id as LogoLayout} active={isSelected} />
                      </div>
                      <div style={{ fontSize: "11.5px", fontWeight: isSelected ? 800 : 700, color: isSelected ? "#0284c7" : "#1e293b", marginBottom: "2px" }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: "9.5px", color: isSelected ? "#0284c7" : "#64748b" }}>
                        {item.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. ALAN: YAZI KARAKTERİ & TİPOGRAFİ EKOLÜ KARTLARI */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Type size={13} color="#d97706" />
                <span>3. Adım: Tipografi Ekolü (Yazı Karakteri Görünümü)</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
                {LOGO_TYPOGRAPHY_STYLES.map((t) => {
                  const isSelected = logoFontStyle === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setLogoFontStyle(t.id)}
                      style={{
                        padding: "10px",
                        borderRadius: "10px",
                        border: isSelected ? "2px solid #d97706" : "1px solid #e2e8f0",
                        background: isSelected ? "#fffbeb" : "#ffffff",
                        color: isSelected ? "#b45309" : "#334155",
                        textAlign: "center",
                        cursor: "pointer",
                        transition: "all 0.18s ease",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        boxShadow: isSelected ? "0 4px 12px rgba(217, 119, 6, 0.12)" : "0 1px 3px rgba(0,0,0,0.03)",
                      }}
                    >
                      {/* Büyük Tipografi Glifi */}
                      <div
                        style={{
                          fontSize: "26px",
                          fontWeight: 800,
                          lineHeight: "1.1",
                          marginBottom: "4px",
                          fontFamily: t.cssStyle,
                          color: isSelected ? "#b45309" : "#1e293b",
                        }}
                      >
                        {t.id === "monogram_only" ? "AH" : "Aa"}
                      </div>
                      <div style={{ fontSize: "11.5px", fontWeight: isSelected ? 800 : 700, color: isSelected ? "#b45309" : "#1e293b", marginBottom: "2px" }}>
                        {t.name}
                      </div>
                      <div style={{ fontSize: "9.5px", color: isSelected ? "#b45309" : "#64748b" }}>
                        {t.example}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. ALAN: REFERANS MANTIĞI & MOTOR SEÇİMİ GÖRSEL KARTLARI */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px", marginBottom: "18px" }}>
              {/* Referans Modu */}
              <div style={{ background: "#ffffff", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <ShieldCheck size={13} color="#059669" />
                  <span>Referans Mantığı</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setLogoRefMode("none")}
                    style={{
                      padding: "8px",
                      borderRadius: "8px",
                      border: logoRefMode === "none" ? "1.5px solid #059669" : "1px solid #e2e8f0",
                      background: logoRefMode === "none" ? "#ecfdf5" : "#f8fafc",
                      color: logoRefMode === "none" ? "#047857" : "#475569",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11.5px", fontWeight: 700, marginBottom: "2px" }}>
                      <Sparkles size={12} color="#059669" />
                      <span>Sıfırdan Keşif</span>
                    </div>
                    <div style={{ fontSize: "9.5px", color: "#64748b", lineHeight: "1.2" }}>
                      Eski logoyu unutur, %100 taze konsept türetir.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLogoRefMode("evolve")}
                    style={{
                      padding: "8px",
                      borderRadius: "8px",
                      border: logoRefMode === "evolve" ? "1.5px solid #0284c7" : "1px solid #e2e8f0",
                      background: logoRefMode === "evolve" ? "#f0f9ff" : "#f8fafc",
                      color: logoRefMode === "evolve" ? "#0369a1" : "#475569",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11.5px", fontWeight: 700, marginBottom: "2px" }}>
                      <RefreshCw size={12} color="#0284c7" />
                      <span>Evrimleştir</span>
                    </div>
                    <div style={{ fontSize: "9.5px", color: "#64748b", lineHeight: "1.2" }}>
                      Mevcut hatları korur, modernize eder.
                    </div>
                  </button>
                </div>
              </div>

              {/* Çıktı Motoru */}
              <div style={{ background: "#ffffff", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Cpu size={13} color="#9333ea" />
                  <span>Çıktı Motoru</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setLogoEngine("svg_vector")}
                    style={{
                      padding: "8px",
                      borderRadius: "8px",
                      border: logoEngine === "svg_vector" ? "1.5px solid #0284c7" : "1px solid #e2e8f0",
                      background: logoEngine === "svg_vector" ? "#f0f9ff" : "#f8fafc",
                      color: logoEngine === "svg_vector" ? "#0369a1" : "#475569",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11.5px", fontWeight: 700, marginBottom: "2px" }}>
                      <FileCode size={12} color="#0284c7" />
                      <span>SVG Vektör</span>
                    </div>
                    <div style={{ fontSize: "9.5px", color: "#64748b", lineHeight: "1.2" }}>
                      Sonsuz büyütme, sıfır pikselleşme, temiz kod.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLogoEngine("gemini_image")}
                    style={{
                      padding: "8px",
                      borderRadius: "8px",
                      border: logoEngine === "gemini_image" ? "1.5px solid #7c3aed" : "1px solid #e2e8f0",
                      background: logoEngine === "gemini_image" ? "#faf5ff" : "#f8fafc",
                      color: logoEngine === "gemini_image" ? "#6d28d9" : "#475569",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11.5px", fontWeight: 700, marginBottom: "2px" }}>
                      <ImageIcon size={12} color="#7c3aed" />
                      <span>Gemini 3D Taktil</span>
                    </div>
                    <div style={{ fontSize: "9.5px", color: "#64748b", lineHeight: "1.2" }}>
                      Gerçekçi stüdyo ışığı, gölgeli derinlik.
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* 5. ALAN: YAZI İÇERİĞİ & ÖZEL NOT & ÜRETİM BUTONLARI */}
            <div style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                    Marka Adı
                  </label>
                  <input
                    type="text"
                    value={logoBrandName}
                    onChange={(e) => setLogoBrandName(e.target.value)}
                    placeholder="Marka Adı"
                    style={{ width: "100%", padding: "8px 10px", fontSize: "12px", borderRadius: "7px", background: "#f8fafc", border: "1px solid #cbd5e1", color: "#0f172a" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                    Slogan / Açıklama
                  </label>
                  <input
                    type="text"
                    value={logoTagline}
                    onChange={(e) => setLogoTagline(e.target.value)}
                    placeholder="Slogan / Alt Başlık"
                    style={{ width: "100%", padding: "8px 10px", fontSize: "12px", borderRadius: "7px", background: "#f8fafc", border: "1px solid #cbd5e1", color: "#0f172a" }}
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                    Özel Tasarım Notu (Opsiyonel)
                  </label>
                  <input
                    type="text"
                    value={logoCustomPrompt}
                    onChange={(e) => setLogoCustomPrompt(e.target.value)}
                    placeholder="Örn: Dişli ve fidan figürü birleşsin, ahşap doku öne çıksın..."
                    style={{ width: "100%", padding: "8px 10px", fontSize: "12px", borderRadius: "7px", background: "#f8fafc", border: "1px solid #cbd5e1", color: "#0f172a" }}
                  />
                </div>
              </div>

              {/* Üretim Butonları */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => handleGenerateLogoConcepts(1)}
                  disabled={generatingLogo}
                  style={{
                    height: "40px",
                    padding: "0 18px",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    borderColor: "#d8b4fe",
                    color: "#7e22ce",
                  }}
                >
                  {generatingLogo ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} color="#9333ea" />}
                  <span>Tekil Konsept Üret</span>
                </button>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => handleGenerateLogoConcepts(3)}
                  disabled={generatingLogo}
                  style={{
                    height: "40px",
                    padding: "0 20px",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                    border: "none",
                    boxShadow: "0 4px 14px rgba(124, 58, 237, 0.28)",
                  }}
                >
                  {generatingLogo ? <LoaderCircle className="spin" size={16} /> : <Layers size={16} />}
                  <span>3 Farklı Alternatif Üret (A/B/C)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Üretilen Logo Konseptleri Galerisi */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Crown size={18} color="#d97706" />
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#1e293b" }}>Üretilen Logo Konseptleri ({logoConcepts.length})</h3>
              </div>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Beğendiğiniz logoyu tek tıkla resmi marka logosu olarak atayabilirsiniz
              </span>
            </div>

            {logoConcepts.length === 0 ? (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px dashed #cbd5e1",
                  borderRadius: "14px",
                  padding: "40px 20px",
                  textAlign: "center",
                  color: "#64748b",
                }}
              >
                <Palette size={32} style={{ margin: "0 auto 10px auto", color: "#94a3b8" }} />
                <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", color: "#334155" }}>Henüz logo konsepti üretilmedi</h4>
                <p style={{ margin: 0, fontSize: "12px", maxWidth: "420px", marginInline: "auto" }}>
                  Yukarıdaki görsel tasarım masasından bir stil ve arketip seçerek "Tekil Konsept Üret" veya "3 Farklı Alternatif Üret" butonuna basın.
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
                        background: "#ffffff",
                        border: isPrimary ? "2px solid #10b981" : "1px solid #e2e8f0",
                        borderRadius: "14px",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        position: "relative",
                        boxShadow: isPrimary ? "0 4px 16px rgba(16, 185, 129, 0.15)" : "0 2px 8px rgba(0,0,0,0.04)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {/* Kart Başlık */}
                      <div
                        style={{
                          padding: "10px 14px",
                          borderBottom: "1px solid #f1f5f9",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          background: "#f8fafc",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>{concept.title}</div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>
                            {new Date(concept.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} • {concept.layout}
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: "6px",
                            background: isSvg ? "#f0f9ff" : "#faf5ff",
                            color: isSvg ? "#0284c7" : "#7e22ce",
                            border: `1px solid ${isSvg ? "#bae6fd" : "#e9d5ff"}`,
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
                          background: canvasBgDark ? "#0f172a" : "#fbfbfe",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "12px",
                          transition: "background 0.2s ease",
                        }}
                      >
                        <Image
                          src={`${concept.url}?thumb=1&v=${new Date(concept.createdAt).getTime()}`}
                          alt={concept.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 320px"
                          style={{ objectFit: "contain", padding: "16px" }}
                          unoptimized
                        />

                        {isPrimary && (
                          <div
                            style={{
                              position: "absolute",
                              top: "8px",
                              left: "8px",
                              background: "#10b981",
                              color: "#fff",
                              fontSize: "10.5px",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "12px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                            }}
                          >
                            <Crown size={11} />
                            <span>Ana Marka Logosu</span>
                          </div>
                        )}

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
                            borderRadius: "7px",
                            background: "rgba(255,255,255,0.9)",
                            color: "#334155",
                            border: "1px solid #cbd5e1",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
                          }}
                        >
                          <Maximize2 size={13} />
                        </button>
                      </div>

                      {/* Alt Aksiyon Butonları */}
                      <div style={{ padding: "12px", marginTop: "auto", display: "flex", flexDirection: "column", gap: "6px", background: "#ffffff" }}>
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
                            style={{ width: "32px", height: "32px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0" }}
                          >
                            <Download size={14} />
                          </button>
                          <button
                            type="button"
                            className="button ghost"
                            title="Konsepti Sil"
                            onClick={() => deleteLogoConcept(concept.id)}
                            style={{ width: "32px", height: "32px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", border: "1px solid #fee2e2" }}
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
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
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
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                <span>Sosyal Medya Görsel Hazırlık Durumu</span>
                <span style={{ color: "#7c3aed" }}>
                  {generatedSocialCount} / {allSpecs.length} Hazır (%
                  {Math.round((generatedSocialCount / allSpecs.length) * 100)})
                </span>
              </div>
              <div style={{ width: "100%", height: "8px", background: "#e2e8f0", borderRadius: "99px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${(generatedSocialCount / allSpecs.length) * 100}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #7c3aed, #0284c7)",
                    borderRadius: "99px",
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
                  background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                  border: "none",
                  boxShadow: "0 4px 12px rgba(124, 58, 237, 0.25)",
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                {batchRunning ? (
                  <>
                    <LoaderCircle className="spin" size={15} />
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
          <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px", marginBottom: "20px", overflowX: "auto" }}>
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

              return (
                <div
                  key={spec.type}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "14px",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    position: "relative",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  }}
                >
                  {/* Başlık */}
                  <div style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
                    <div>
                      <h4 style={{ margin: "0 0 2px 0", fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>{spec.title}</h4>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>{spec.platform}</div>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 7px", borderRadius: "6px", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", fontFamily: "monospace" }}>
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
                      background: "#f8fafc",
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
                              style={{
                                width: "28px",
                                height: "28px",
                                borderRadius: "7px",
                                background: isSafeZoneActive ? "#7c3aed" : "rgba(255,255,255,0.9)",
                                color: isSafeZoneActive ? "#fff" : "#334155",
                                border: "1px solid #cbd5e1",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
                              }}
                            >
                              {isSafeZoneActive ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          )}
                          <button
                            type="button"
                            title="Tam Ekran Aç"
                            onClick={() => setPreviewModalSpec(spec)}
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "7px",
                              background: "rgba(255,255,255,0.9)",
                              color: "#334155",
                              border: "1px solid #cbd5e1",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
                            }}
                          >
                            <Maximize2 size={13} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8" }}>
                        <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px auto", color: "#64748b" }}>
                          <Sparkles size={18} />
                        </div>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Henüz Üretilmedi</div>
                        <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "2px" }}>{spec.dimensions}</div>
                      </div>
                    )}

                    {isGenerating && (
                      <div style={{ position: "absolute", inset: 0, background: "rgba(255, 255, 255, 0.88)", backdropFilter: "blur(3px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", zIndex: 20 }}>
                        <LoaderCircle className="spin" size={26} color="#7c3aed" />
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>AI Görsel Üretiliyor...</span>
                      </div>
                    )}
                  </div>

                  {/* Safe Zone Notu */}
                  <div style={{ padding: "8px 12px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9", fontSize: "11px", color: "#64748b", display: "flex", alignItems: "flex-start", gap: "6px", lineHeight: "1.4" }}>
                    <Info size={13} style={{ flexShrink: 0, marginTop: "1px", color: "#0284c7" }} />
                    <span>{spec.safeZoneGuide}</span>
                  </div>

                  {/* Özel Not Açılır Alanı */}
                  {isDirectionOpen && (
                    <div style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
                      <input
                        type="text"
                        value={customDirections[spec.type] || ""}
                        onChange={(e) => setCustomDirections((prev) => ({ ...prev, [spec.type]: e.target.value }))}
                        placeholder="Özel tasarım yönlendirmesi..."
                        style={{ width: "100%", fontSize: "12px", padding: "6px 10px", borderRadius: "6px", background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a" }}
                      />
                    </div>
                  )}

                  {/* Butonlar */}
                  <div style={{ padding: "12px", marginTop: "auto", display: "flex", gap: "6px", background: "#ffffff" }}>
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
                        style={{ width: "34px", height: "34px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0" }}
                      >
                        <Download size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      className={`button ghost ${isDirectionOpen ? "active" : ""}`}
                      title="Özel tasarım notu"
                      onClick={() => setDirectionInputsOpen((prev) => ({ ...prev, [spec.type]: !isDirectionOpen }))}
                      style={{ width: "34px", height: "34px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0" }}
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
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
          onClick={() => setPreviewConcept(null)}
        >
          <div
            style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "16px", maxWidth: "800px", width: "100%", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
              <div>
                <h3 style={{ margin: "0 0 2px 0", fontSize: "16px", color: "#0f172a", fontWeight: 700 }}>{previewConcept.title}</h3>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  {previewConcept.engine === "svg_vector" ? "Saf Matematiksel SVG Vektör" : "Gemini 3.1 3D Taktil Render"}
                </span>
              </div>
              <button type="button" onClick={() => setPreviewConcept(null)} className="button ghost" style={{ width: "32px", height: "32px", padding: 0 }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ position: "relative", width: "100%", height: "480px", background: canvasBgDark ? "#0f172a" : "#fbfbfe", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
              <Image src={previewConcept.url} alt={previewConcept.title} fill style={{ objectFit: "contain", padding: "24px" }} unoptimized />
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
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
                  <Crown size={14} color="#d97706" />
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
        <div style={{ width: "64%", height: "64%", borderRadius: "50%", border: "2px dashed #0284c7", boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.45)", position: "relative" }}>
          <span style={{ position: "absolute", top: "6px", left: "50%", transform: "translateX(-50%)", fontSize: "10px", fontWeight: 700, color: "#0284c7", background: "rgba(255,255,255,0.92)", padding: "1px 6px", borderRadius: "4px", whiteSpace: "nowrap", border: "1px solid #bae6fd" }}>
            Dairesel Profil Alanı
          </span>
        </div>
      </div>
    );
  }

  if (type === "youtube_banner") {
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "35.3%", background: "rgba(15, 23, 42, 0.45)" }}>
          <span style={{ position: "absolute", bottom: "4px", left: "8px", fontSize: "9px", color: "#f8fafc", fontWeight: 600 }}>
            TV Ekranı Alanı (Mobilde Kırpılır)
          </span>
        </div>
        <div style={{ position: "absolute", top: "35.3%", bottom: "35.3%", left: "19.8%", right: "19.8%", border: "2px dashed #059669", background: "rgba(5, 150, 105, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, color: "#047857", background: "rgba(255,255,255,0.95)", padding: "2px 8px", borderRadius: "4px", border: "1px solid #a7f3d0" }}>
            Mobil &amp; Masaüstü Güvenli Alanı (1546×423 px)
          </span>
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "35.3%", background: "rgba(15, 23, 42, 0.45)" }} />
      </div>
    );
  }

  if (type === "twitter_header") {
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
        <div style={{ position: "absolute", bottom: 0, left: "4%", width: "24%", height: "55%", border: "2px dashed #dc2626", background: "rgba(220, 38, 38, 0.18)", borderRadius: "8px 8px 0 0", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "4px" }}>
          <span style={{ fontSize: "9px", fontWeight: 700, color: "#b91c1c", background: "rgba(255,255,255,0.95)", padding: "2px 5px", borderRadius: "4px", border: "1px solid #fecdd3" }}>
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
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={onClose}>
      <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "16px", maxWidth: "950px", width: "100%", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
          <div>
            <h3 style={{ margin: "0 0 2px 0", fontSize: "16px", color: "#0f172a" }}>{spec.title}</h3>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              {spec.platform} • {spec.dimensions}
            </span>
          </div>
          <button type="button" onClick={onClose} className="button ghost" style={{ width: "32px", height: "32px", padding: 0 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ position: "relative", width: "100%", height: "520px", background: "#fbfbfe", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Image src={item.url} alt={spec.title} fill style={{ objectFit: "contain" }} unoptimized />
          {showGuide && spec.safeZoneOverlayType && (
            <SafeZoneOverlay type={spec.safeZoneOverlayType} width={spec.width} height={spec.height} />
          )}
        </div>
        <div style={{ padding: "16px 20px", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {spec.safeZoneOverlayType && (
              <button type="button" className={`button compact ${showGuide ? "secondary" : "ghost"}`} onClick={() => setShowGuide(!showGuide)} style={{ fontSize: "12px" }}>
                {showGuide ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>{showGuide ? "Kılavuzu Gizle" : "Kılavuzu Göster"}</span>
              </button>
            )}
            <span style={{ fontSize: "12px", color: "#64748b" }}>{spec.safeZoneGuide}</span>
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
