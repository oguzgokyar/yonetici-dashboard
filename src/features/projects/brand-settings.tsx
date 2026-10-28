"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Check,
  CircleAlert,
  Globe2,
  ImagePlus,
  LoaderCircle,
  Palette,
  Save,
  Sparkles,
  SwatchBook,
  Upload,
  Wand2,
  X,
  CheckCircle2,
  SlidersHorizontal,
  Building2,
  Link2,
} from "lucide-react";
import { BrandConcept, normalizeBrandConcept } from "@/lib/brand-concept";
import { BrandProfile, useProjects } from "./projects-context";
import { BrandVisualsTab } from "./brand-visuals-tab";

export function BrandSettings({ projectId }: { projectId: string }) {
  const { getProject, updateProject, ready } = useProjects();
  const project = getProject(projectId);
  const [tab, setTab] = useState<"brand" | "concept" | "visuals">("brand");
  const [saved, setSaved] = useState(false);
  const [importing, setImporting] = useState(false);
  const [generatingConcept, setGeneratingConcept] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardVibe, setWizardVibe] = useState("Aydınlık Maker, Ahşap & Robotik");
  const [wizardAudience, setWizardAudience] = useState("7–14 Yaş İlkokul & Ortaokul Aileleri");
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardAlternatives, setWizardAlternatives] = useState<BrandConcept[]>([]);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Logo Studio States
  const [logoContrast, setLogoContrast] = useState<"light" | "dark" | "checker">("light");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState("");
  const [fetchingLogo, setFetchingLogo] = useState(false);

  const [form, setForm] = useState<BrandProfile>({
    brandName: "",
    website: "",
    logo: "",
    phone: "",
    email: "",
    address: "",
    industry: "",
    description: "",
    audience: "",
    tone: "",
    primaryColor: "#FF6B35",
    secondaryColor: "#0F4C81",
    defaultCta: "Detaylı bilgi alın",
  });
  const [concept, setConcept] = useState<BrandConcept>(normalizeBrandConcept());

  useEffect(() => {
    // Keep editable drafts synchronized when the active project changes.
    if (project) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(project.brand);
      setConcept(normalizeBrandConcept(project.brandConcept));
    }
  }, [project]);

  if (!ready || !project) return <div className="overview-loading" />;

  function field(key: keyof BrandProfile, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function conceptField(key: keyof BrandConcept, value: string) {
    setConcept((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function uploadLogo(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => field("logo", String(reader.result));
    reader.readAsDataURL(file);
  }

  function uploadKeyVisual(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      conceptField("sampleVisualUrl", dataUrl);
    };
    reader.readAsDataURL(file);
  }

  async function handleFetchLogoFromWebsite() {
    if (!form.website?.trim()) {
      alert("Lütfen önce web sitesi adresini girin.");
      return;
    }
    setFetchingLogo(true);
    try {
      const res = await fetch("/api/brand/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: form.website.trim() }),
      });
      const data = await res.json();
      if (data.ok && data.brand?.logo) {
        field("logo", data.brand.logo);
        alert("✓ Logo web sitesinden başarıyla çekildi!");
      } else {
        alert(data.message || "Siteden logo tespit edilemedi. Lütfen manuel dosya yükleyin veya URL girin.");
      }
    } catch (e: any) {
      alert("Logo çekilirken hata oluştu: " + e.message);
    } finally {
      setFetchingLogo(false);
    }
  }

  function saveBrand() {
    const cleanName = form.brandName.trim() || project?.name || "Proje";
    updateProject(projectId, {
      name: cleanName,
      brand: form,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  async function saveConcept(next = concept) {
    setResult(null);
    try {
      const response = await fetch("/api/ai/brand-concept", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, concept: next }),
      });
      const body = (await response.json()) as { ok: boolean; concept?: BrandConcept; message?: string };
      if (!response.ok || !body.ok || !body.concept) throw new Error(body.message || "Konsept kaydedilemedi.");
      setConcept(body.concept);
      updateProject(projectId, { brandConcept: body.concept });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : "Konsept kaydedilemedi." });
    }
  }

  async function runWizard() {
    setWizardLoading(true);
    setWizardAlternatives([]);
    try {
      const response = await fetch("/api/ai/brand-concept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          mode: "alternatives",
          direction: { vibe: wizardVibe, targetAudience: wizardAudience },
        }),
      });
      const body = (await response.json()) as { ok: boolean; alternatives?: BrandConcept[]; message?: string };
      if (!response.ok || !body.ok || !body.alternatives?.length) {
        throw new Error(body.message || "Alternatif konseptler üretilemedi.");
      }
      setWizardAlternatives(body.alternatives);
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Sihirbaz çalıştırılamadı." });
    } finally {
      setWizardLoading(false);
    }
  }

  function applyAlternative(alt: BrandConcept) {
    const nextConcept = normalizeBrandConcept({
      ...alt,
      sampleVisualUrl: concept.sampleVisualUrl || alt.sampleVisualUrl,
    });
    setConcept(nextConcept);
    const nextBrand: BrandProfile = {
      ...form,
      primaryColor: alt.primaryColor || form.primaryColor,
      secondaryColor: alt.secondaryColor || form.secondaryColor,
    };
    setForm(nextBrand);
    updateProject(projectId, { brand: nextBrand, brandConcept: nextConcept });
    void saveConcept(nextConcept);
    setWizardOpen(false);
    setResult({ ok: true, message: "Yeni marka stili seçildi ve kaydedildi!" });
  }

  async function generateKeyVisual() {
    setGeneratingConcept(true);
    setResult(null);
    try {
      const response = await fetch("/api/ai/brand-concept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, mode: "single" }),
      });
      const body = (await response.json()) as { ok: boolean; concept?: BrandConcept; message?: string };
      if (!response.ok || !body.ok || !body.concept) throw new Error(body.message || "Stil görseli oluşturulamadı.");
      setConcept(body.concept);
      updateProject(projectId, { brandConcept: body.concept });
      setResult({ ok: true, message: "Marka stili ve stil panosu güncellendi." });
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : "Stil panosu oluşturulamadı." });
    } finally {
      setGeneratingConcept(false);
    }
  }

  async function importFromWebsite() {
    if (!form.website.trim()) {
      setResult({ ok: false, message: "Önce web sitesi adresini girin." });
      return;
    }
    setImporting(true);
    setResult(null);
    try {
      const response = await fetch("/api/brand/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: form.website }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        message?: string;
        brand?: Partial<BrandProfile> & { brandConcept?: BrandConcept };
      };
      if (!body.ok || !body.brand) throw new Error(body.message || "Marka bilgileri alınamadı.");
      const { brandConcept, ...foundBrand } = body.brand;
      let added = 0;
      const nextBrand = { ...form };
      for (const [key, value] of Object.entries(foundBrand)) {
        const typedKey = key as keyof BrandProfile;
        if (typedKey in nextBrand && !nextBrand[typedKey] && typeof value === "string" && value.trim()) {
          nextBrand[typedKey] = value.trim();
          added++;
        }
      }
      const nextConcept = brandConcept ? normalizeBrandConcept(brandConcept) : concept;
      setForm(nextBrand);
      setConcept(nextConcept);
      updateProject(projectId, { brand: nextBrand, brandConcept: nextConcept });
      if (brandConcept) await saveConcept(nextConcept);
      setResult({ ok: true, message: `${added} boş alan dolduruldu ve marka konsepti güncellendi.` });
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : "Marka bilgileri alınamadı." });
    } finally {
      setImporting(false);
    }
  }

  const fields = [
    form.brandName,
    form.website,
    form.industry,
    form.description,
    form.audience,
    form.tone,
    form.phone,
    form.email,
    form.address,
    form.logo,
  ];
  const completed = fields.filter(Boolean).length;
  const completeness = Math.round((completed / fields.length) * 100);

  const groundColor = concept.groundColor || "#FDFBF7";
  const primaryColor = concept.primaryColor || form.primaryColor || "#FF6B35";
  const secondaryColor = concept.secondaryColor || form.secondaryColor || "#0F4C81";
  const accentColor = concept.accentColor || "#FFD166";

  return (
    <div className="settings-layout">
      <aside className="settings-nav">
        <strong>Proje ayarları</strong>
        <button
          className={tab === "brand" ? "active" : ""}
          onClick={() => {
            setTab("brand");
            setResult(null);
          }}
        >
          <Palette size={17} />
          Marka bilgileri
        </button>
        <button
          className={tab === "concept" ? "active" : ""}
          onClick={() => {
            setTab("concept");
            setResult(null);
          }}
        >
          <SwatchBook size={17} />
          Marka stili &amp; tasarım
        </button>
        <button
          className={tab === "visuals" ? "active" : ""}
          onClick={() => {
            setTab("visuals");
            setResult(null);
          }}
        >
          <ImagePlus size={17} />
          Marka Görselleri
        </button>
      </aside>

      {tab === "brand" ? (
        <section className="settings-card">
          <div className="settings-heading">
            <div>
              <h2>Marka bilgileri</h2>
              <p>AI üretimlerinde kullanılacak doğrulanmış marka ve iletişim bilgileri.</p>
            </div>
            <button className="button primary" onClick={saveBrand}>
              {saved ? <Check size={17} /> : <Save size={17} />}
              {saved ? "Kaydedildi" : "Kaydet"}
            </button>
          </div>

          <div className="brand-import-card">
            <div>
              <span>
                <Globe2 size={18} />
              </span>
              <div>
                <strong>Web sitesinden marka bilgilerini ve konsepti getir</strong>
                <p>AI boş alanları doldurur ve görsel marka konseptini otomatik belirler.</p>
              </div>
            </div>
            <button type="button" className="button secondary" onClick={importFromWebsite} disabled={importing}>
              {importing ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
              {importing ? "Site inceleniyor" : "Marka bilgilerini getir"}
            </button>
          </div>

          {result && <ResultBox result={result} />}

          {/* MARKA DNA'SI & PROFİL TAMAMLAMA KARTLARI */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", margin: "16px 0" }}>
            <div
              style={{
                padding: "14px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#1e293b",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Palette size={15} color="var(--primary)" /> Marka DNA&apos;sı Özeti
                </span>
                <small style={{ fontSize: "10.5px", color: "var(--muted)" }}>Canlı Bağlam</small>
              </div>
              <div style={{ fontSize: "11px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Hedef Kitle:</span>
                  <strong style={{ color: "#0f172a", maxWidth: "60%", textAlign: "right" }}>
                    {form.audience || "Tanımlanmadı"}
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>İletişim Tonu:</span>
                  <strong style={{ color: "#0f172a" }}>{form.tone || "Tanımlanmadı"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#64748b" }}>Ana Renk:</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <i style={{ width: "12px", height: "12px", borderRadius: "3px", background: form.primaryColor }} />
                    <strong>{form.primaryColor.toUpperCase()}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "14px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>Profil Doluluğu</span>
                <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--primary)" }}>%{completeness}</span>
              </div>
              <div style={{ height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${completeness}%`,
                    height: "100%",
                    background: form.primaryColor,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <div style={{ fontSize: "10.5px", color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                <span>{completed}/10 Alan Dolu</span>
                <span>{completeness === 100 ? "✓ Tam Uyum" : "Eksik alanları aşağıdan doldurun"}</span>
              </div>
            </div>
          </div>

          {/* TEMEL PROJE VE MARKA KİMLİĞİ KARTI */}
          <div
            style={{
              padding: "20px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              marginBottom: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(99, 102, 241, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#6366f1" }}>
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#0f172a" }}>
                    Temel Proje Kimliği & Logo Yönetimi
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                    Proje adı, resmi logo ve web sitesi adresini senkronize yönetin
                  </p>
                </div>
              </div>

              <div style={{ fontSize: "11px", color: "#64748b", background: "#f1f5f9", padding: "4px 10px", borderRadius: "6px" }}>
                Proje ID: <strong style={{ color: "#334155" }}>{projectId}</strong>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 320px) 1fr", gap: "24px", alignItems: "start" }}>
              {/* LOGO STUDIO COLUMN */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "8px" }}>
                  Resmi Marka Logosu
                </label>

                {/* LOGO PREVIEW BOX */}
                <div
                  style={{
                    width: "100%",
                    height: "150px",
                    borderRadius: "12px",
                    border: "2px dashed #cbd5e1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "hidden",
                    padding: "16px",
                    boxSizing: "border-box",
                    background:
                      logoContrast === "dark"
                        ? "#0f172a"
                        : logoContrast === "checker"
                        ? "repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%) 50% / 16px 16px"
                        : "#f8fafc",
                    transition: "background 0.2s ease",
                  }}
                >
                  {form.logo ? (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Image
                        src={form.logo}
                        alt="Marka logosu"
                        width={240}
                        height={110}
                        unoptimized
                        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                      />
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => field("logo", "")}
                        aria-label="Logoyu kaldır"
                        title="Logoyu kaldır"
                        style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          background: "rgba(255, 255, 255, 0.9)",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                          width: "26px",
                          height: "26px",
                        }}
                      >
                        <X size={15} color="#ef4444" />
                      </button>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", color: "#94a3b8" }}>
                      <ImagePlus size={32} style={{ margin: "0 auto 6px auto", opacity: 0.7 }} />
                      <div style={{ fontSize: "12px", fontWeight: "600" }}>Logo Tanımlanmadı</div>
                      <div style={{ fontSize: "10.5px" }}>PNG, SVG, JPG veya WebP</div>
                    </div>
                  )}
                </div>

                {/* CONTRAST CONTROLS */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
                  <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>Zemin Kontrastı:</span>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      type="button"
                      onClick={() => setLogoContrast("light")}
                      style={{
                        padding: "3px 8px",
                        fontSize: "11px",
                        borderRadius: "5px",
                        border: logoContrast === "light" ? "1px solid #6366f1" : "1px solid #e2e8f0",
                        background: "#ffffff",
                        color: logoContrast === "light" ? "#4338ca" : "#64748b",
                        fontWeight: logoContrast === "light" ? "700" : "500",
                        cursor: "pointer",
                      }}
                    >
                      ⚪ Açık
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoContrast("dark")}
                      style={{
                        padding: "3px 8px",
                        fontSize: "11px",
                        borderRadius: "5px",
                        border: logoContrast === "dark" ? "1px solid #6366f1" : "1px solid #e2e8f0",
                        background: "#1e293b",
                        color: "#ffffff",
                        fontWeight: logoContrast === "dark" ? "700" : "500",
                        cursor: "pointer",
                      }}
                    >
                      ⚫ Koyu
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoContrast("checker")}
                      style={{
                        padding: "3px 8px",
                        fontSize: "11px",
                        borderRadius: "5px",
                        border: logoContrast === "checker" ? "1px solid #6366f1" : "1px solid #e2e8f0",
                        background: "#f1f5f9",
                        color: logoContrast === "checker" ? "#4338ca" : "#64748b",
                        fontWeight: logoContrast === "checker" ? "700" : "500",
                        cursor: "pointer",
                      }}
                    >
                      🏁 Grid
                    </button>
                  </div>
                </div>

                {/* LOGO ACTION BUTTONS (3 KANAL) */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px" }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <label
                      className="button secondary text-xs"
                      style={{ flex: 1, height: "32px", padding: "0 10px", justifyContent: "center", cursor: "pointer", fontWeight: "600" }}
                    >
                      <Upload size={13} />
                      <span>Dosya Yükle</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        style={{ display: "none" }}
                        onChange={(e) => uploadLogo(e.target.files?.[0])}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowUrlInput(!showUrlInput)}
                      className={`button ${showUrlInput ? "primary" : "secondary"} text-xs`}
                      style={{ flex: 1, height: "32px", padding: "0 10px", justifyContent: "center", fontWeight: "600" }}
                      title="Görsel bağlantı linki yapıştır"
                    >
                      <Globe2 size={13} />
                      <span>URL Gir</span>
                    </button>
                  </div>

                  {form.website && (
                    <button
                      type="button"
                      onClick={handleFetchLogoFromWebsite}
                      disabled={fetchingLogo}
                      className="button ghost text-xs"
                      style={{ height: "30px", border: "1px dashed #cbd5e1", color: "#4f46e5", justifyContent: "center", fontWeight: "600" }}
                    >
                      {fetchingLogo ? <LoaderCircle className="spin" size={13} /> : <Wand2 size={13} />}
                      <span>{fetchingLogo ? "Siteden Taranıyor..." : "Web Sitesinden Otomatik Çek"}</span>
                    </button>
                  )}

                  {showUrlInput && (
                    <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                      <input
                        type="url"
                        placeholder="https://.../logo.png"
                        value={urlInputValue}
                        onChange={(e) => setUrlInputValue(e.target.value)}
                        style={{
                          flex: 1,
                          fontSize: "12px",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          outline: "none",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (urlInputValue.trim()) {
                            field("logo", urlInputValue.trim());
                            setShowUrlInput(false);
                            setUrlInputValue("");
                          }
                        }}
                        className="button primary text-xs"
                        style={{ height: "30px", padding: "0 10px" }}
                      >
                        Uygula
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* NAME & GENERAL INFO COLUMN */}
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                    Proje & Marka Adı *
                  </label>
                  <input
                    type="text"
                    value={form.brandName}
                    onChange={(e) => field("brandName", e.target.value)}
                    placeholder="Örn: Betonax"
                    style={{
                      width: "100%",
                      fontSize: "14px",
                      fontWeight: "600",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                    💡 Bu isim kaydedildiğinde sol menüdeki proje listesi, üst bardaki başlık ve içerik stüdyosuyla otomatik senkronize olur.
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                    Resmi Web Sitesi
                  </label>
                  <input
                    type="url"
                    value={form.website}
                    onChange={(e) => field("website", e.target.value)}
                    placeholder="https://www.ornek.com"
                    style={{
                      width: "100%",
                      fontSize: "13px",
                      padding: "9px 14px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                    Logo çekme ve AI pazar analizi için baz alınır.
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid #f1f5f9" }}>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    {saved ? (
                      <span style={{ color: "#16a34a", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Check size={14} /> Değişiklikler kaydedildi
                      </span>
                    ) : (
                      "Değişiklikleri uygulamak için kaydedin"
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={saveBrand}
                    className="button primary text-xs"
                    style={{ height: "36px", padding: "0 16px", fontWeight: "700" }}
                  >
                    <Save size={14} />
                    <span>Kimlik Bilgilerini Kaydet</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="form-grid">
            <TextField label="Telefon" value={form.phone} onChange={(v) => field("phone", v)} />
            <TextField label="E-posta" value={form.email} onChange={(v) => field("email", v)} />
            <TextField label="Adres" value={form.address} onChange={(v) => field("address", v)} full />
            <TextField label="Sektör" value={form.industry} onChange={(v) => field("industry", v)} full />
            <AreaField label="Marka açıklaması" value={form.description} onChange={(v) => field("description", v)} />
            <AreaField label="Hedef kitle" value={form.audience} onChange={(v) => field("audience", v)} />
            <AreaField label="Marka tonu" value={form.tone} onChange={(v) => field("tone", v)} />
            <ColorField label="Ana renk" value={form.primaryColor} onChange={(v) => field("primaryColor", v)} />
            <ColorField
              label="Yardımcı renk"
              value={form.secondaryColor}
              onChange={(v) => field("secondaryColor", v)}
            />
            <TextField
              label="Varsayılan çağrı metni"
              value={form.defaultCta}
              onChange={(v) => field("defaultCta", v)}
              full
            />
          </div>
        </section>
      ) : tab === "concept" ? (
        <section className="settings-card" style={{ width: "100%", boxSizing: "border-box" }}>
          {/* HEADER WITH WIZARD & SAVE ACTIONS */}
          <div className="settings-heading" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2>Marka Stili &amp; Tasarım Stüdyosu</h2>
                <span
                  style={{
                    fontSize: "10.5px",
                    fontWeight: 700,
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    padding: "3px 8px",
                    borderRadius: "99px",
                    border: "1px solid #bfdbfe",
                  }}
                >
                  Canlı Referans
                </span>
              </div>
              <p style={{ marginTop: "4px", maxWidth: "620px" }}>
                AI görsel, Canva karosel ve video üretimlerinde zorunlu olarak referans alınan renk dengesi, tipografi
                ve görsel kimlik sözleşmesi.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => setWizardOpen(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
              >
                <Wand2 size={15} color="#FF6B35" />
                Stil Sihirbazı (Gemini)
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => saveConcept()}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
              >
                {saved ? <Check size={16} /> : <Save size={16} />}
                {saved ? "Kaydedildi" : "Kaydet"}
              </button>
            </div>
          </div>

          {result && <ResultBox result={result} />}

          {/* 2-COLUMN MINIMALIST WORKSPACE */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.25fr) minmax(320px, 0.95fr)",
              gap: "24px",
              marginTop: "20px",
              alignItems: "start",
            }}
          >
            {/* SOL SÜTUN: PALET & KURAL DÜZENLEYİCİ */}
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* 4-COLOR DESIGN SYSTEM CARD */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "12px", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                    <SlidersHorizontal size={15} color="var(--primary)" /> Renk Dengesi (%60-%30-%10 Kuralı)
                  </strong>
                  <span style={{ fontSize: "10.5px", color: "#64748b" }}>Canlı Renk Seçimi</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
                  {/* %60 Zemin */}
                  <PaletteSwatchCard
                    role="%60 Zemin"
                    label="Ferah Arka Plan"
                    color={groundColor}
                    onChange={(v) => conceptField("groundColor", v)}
                  />
                  {/* %30 Yapı */}
                  <PaletteSwatchCard
                    role="%30 Yapı"
                    label="Tipografi &amp; Çerçeve"
                    color={secondaryColor}
                    onChange={(v) => {
                      conceptField("secondaryColor", v);
                      field("secondaryColor", v);
                    }}
                  />
                  {/* %10 Aksiyon */}
                  <PaletteSwatchCard
                    role="%10 Aksiyon"
                    label="Ana Buton &amp; Vurgu"
                    color={primaryColor}
                    onChange={(v) => {
                      conceptField("primaryColor", v);
                      field("primaryColor", v);
                    }}
                  />
                  {/* Rozet / LED */}
                  <PaletteSwatchCard
                    role="Rozet / LED"
                    label="İkincil Vurgu"
                    color={accentColor}
                    onChange={(v) => conceptField("accentColor", v)}
                  />
                </div>
              </div>

              {/* STİL SÖZLEŞMESİ FORMU */}
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <AreaField
                  label="Konsept Özeti &amp; Tasarım Ruhu"
                  value={concept.summary}
                  onChange={(v) => conceptField("summary", v)}
                  extraClass="concept-textarea"
                />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <TextField
                    label="Marka Karakteri"
                    value={concept.personality}
                    onChange={(v) => conceptField("personality", v)}
                  />
                  <TextField
                    label="Tipografi Kuralı"
                    value={concept.typographyStyle || ""}
                    onChange={(v) => conceptField("typographyStyle", v)}
                  />
                </div>

                <TextField
                  label="Görsel Tasarım Dili &amp; Dokular"
                  value={concept.visualStyle}
                  onChange={(v) => conceptField("visualStyle", v)}
                  full
                />

                <TextField
                  label="Fotoğrafçılık &amp; Işık Kuralları"
                  value={concept.photographyStyle}
                  onChange={(v) => conceptField("photographyStyle", v)}
                  full
                />

                <TextField
                  label="Yerleşim &amp; Kenar Boşlukları (Margin/Padding)"
                  value={concept.layoutGuidelines || ""}
                  onChange={(v) => conceptField("layoutGuidelines", v)}
                  full
                />
              </div>
            </div>

            {/* SAĞ SÜTUN: CANLI MOCKUP & STİL PANOSU GÖRSELİ */}
            <div style={{ display: "flex", flexDirection: "column", gap: "18px", position: "sticky", top: "96px" }}>
              {/* CANLI KARE GÖNDERİ MOCKUP */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "16px",
                  padding: "16px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569", letterSpacing: ".08em" }}>
                    CANLI KARE GÖNDERİ MOCKUP (1080×1080)
                  </span>
                  <span
                    style={{
                      fontSize: "9.5px",
                      fontWeight: 700,
                      background: "#ecfdf5",
                      color: "#059669",
                      padding: "2px 7px",
                      borderRadius: "6px",
                    }}
                  >
                    Anlık Senkron
                  </span>
                </div>

                {/* DİNAMİK RENDER EDİLEN MOCKUP KARTI */}
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    borderRadius: "14px",
                    background: groundColor,
                    border: `2px solid ${secondaryColor}`,
                    overflow: "hidden",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    padding: "12px",
                    boxSizing: "border-box",
                    gap: "8px",
                  }}
                >
                  {/* Mockup Header */}
                  <div
                    style={{
                      background: secondaryColor,
                      color: "#ffffff",
                      borderRadius: "8px",
                      padding: "6px 10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "10px",
                      fontWeight: 700,
                    }}
                  >
                    <span style={{ fontFamily: "monospace", letterSpacing: ".05em" }}>
                      {form.brandName ? form.brandName.toUpperCase() : "ATÖLYE HANEM"}
                    </span>
                    <span
                      style={{
                        background: accentColor,
                        color: secondaryColor,
                        padding: "1px 6px",
                        borderRadius: "99px",
                        fontSize: "9px",
                      }}
                    >
                      7–14 YAŞ
                    </span>
                  </div>

                  {/* Mockup Image Preview Area */}
                  <div
                    style={{
                      flex: 1,
                      borderRadius: "10px",
                      border: `1.5px solid ${secondaryColor}`,
                      overflow: "hidden",
                      position: "relative",
                      background: "#f8fafc",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {concept.sampleVisualUrl ? (
                      <img
                        src={concept.sampleVisualUrl}
                        alt="Stil Önizlemesi"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ textAlign: "center", color: "#94a3b8", fontSize: "11px", padding: "10px" }}>
                        <ImagePlus size={28} style={{ margin: "0 auto 4px" }} />
                        <span>Stil Panosu Henüz Eklenmedi</span>
                      </div>
                    )}
                    <span
                      style={{
                        position: "absolute",
                        top: "6px",
                        left: "6px",
                        background: primaryColor,
                        color: "#ffffff",
                        fontSize: "9px",
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: "99px",
                      }}
                    >
                      ✦ Örnek Sahne
                    </span>
                  </div>

                  {/* Mockup Title & CTA */}
                  <div
                    style={{
                      background: "#ffffff",
                      border: `1.5px solid ${secondaryColor}`,
                      borderRadius: "10px",
                      padding: "8px 10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <strong
                        style={{
                          fontSize: "11.5px",
                          color: secondaryColor,
                          display: "block",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {concept.personality ? concept.personality.split(",")[0] : "Küçük Mucitler Atölyede"}
                      </strong>
                      <small style={{ fontSize: "9.5px", color: "#64748b" }}>
                        Pedagog Onaylı • Kontenjan 8 Kişi
                      </small>
                    </div>
                    <span
                      style={{
                        background: primaryColor,
                        color: "#ffffff",
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "5px 9px",
                        borderRadius: "6px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {form.defaultCta || "Keşfet"}
                    </span>
                  </div>
                </div>
              </div>

              {/* AKTİF STİL PANOSU (KEY VISUAL) KARTI */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "16px",
                  padding: "16px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                    🎨 Aktif Stil Panosu (Key Visual)
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      background: "#f0fdf4",
                      color: "#15803d",
                      padding: "2px 7px",
                      borderRadius: "99px",
                      border: "1px solid #bbf7d0",
                    }}
                  >
                    Üretim Referansı
                  </span>
                </div>

                <div
                  style={{
                    borderRadius: "10px",
                    overflow: "hidden",
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    maxHeight: "220px",
                    position: "relative",
                  }}
                >
                  {concept.sampleVisualUrl ? (
                    <img
                      src={concept.sampleVisualUrl}
                      alt="Marka Tasarım Sistemi"
                      style={{ width: "100%", height: "auto", maxHeight: "220px", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ padding: "32px 16px", textAlign: "center", color: "#94a3b8", fontSize: "11px" }}>
                      <ImagePlus size={32} style={{ margin: "0 auto 6px" }} />
                      <p style={{ margin: 0 }}>Referans stil panosu henüz bağlanmadı.</p>
                    </div>
                  )}
                </div>

                <p style={{ fontSize: "10.5px", color: "#64748b", margin: 0, lineHeight: 1.45 }}>
                  Bu görsel; Gemini görsel üretiminde <em>multimodal görsel referans</em>, Canva ve Remotion kurgularında ise
                  estetik şablon kılavuzu olarak kullanılır.
                </p>

                {/* Stil Görseli Aksiyonları */}
                <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                  <label
                    className="button secondary"
                    style={{
                      flex: 1,
                      height: "34px",
                      fontSize: "11px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                    }}
                  >
                    <Upload size={14} />
                    Görsel Yükle
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      style={{ display: "none" }}
                      onChange={(e) => uploadKeyVisual(e.target.files?.[0])}
                    />
                  </label>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={generateKeyVisual}
                    disabled={generatingConcept}
                    style={{
                      flex: 1,
                      height: "34px",
                      fontSize: "11px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                    }}
                  >
                    {generatingConcept ? <LoaderCircle className="spin" size={14} /> : <Wand2 size={14} />}
                    {generatingConcept ? "Üretiliyor..." : "AI ile Yenile"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* AI STİL SİHİRBAZI MODALI (2 ALTERNATİF SEÇİMİ) */}
          {wizardOpen && (
            <div className="modal-backdrop" style={{ zIndex: 120 }}>
              <div
                className="modal"
                style={{
                  width: "min(720px, 96vw)",
                  maxHeight: "88vh",
                  overflowY: "auto",
                  padding: "24px",
                }}
              >
                <button
                  type="button"
                  className="icon-button modal-close"
                  onClick={() => setWizardOpen(false)}
                  aria-label="Kapat"
                >
                  <X size={18} />
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      background: "#eff6ff",
                      color: "#2563eb",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Wand2 size={18} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, font: '700 17px "Manrope"', color: "#0f172a" }}>
                      Gemini Marka Stili Sihirbazı
                    </h3>
                    <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "#64748b" }}>
                      Brifinginize göre 2 yarışan marka stili ve renk sözleşmesi üretir.
                    </p>
                  </div>
                </div>

                {/* SİHİRBAZ GİRDİLERİ */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                    margin: "16px 0",
                    padding: "14px",
                    background: "#f8fafc",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <label className="field-label">
                    Tasarım Hissi &amp; Atmosfer
                    <input
                      value={wizardVibe}
                      onChange={(e) => setWizardVibe(e.target.value)}
                      placeholder="Örn: Aydınlık Maker, Ahşap &amp; Robotik"
                    />
                  </label>
                  <label className="field-label">
                    Öncelikli Hedef Kitle
                    <input
                      value={wizardAudience}
                      onChange={(e) => setWizardAudience(e.target.value)}
                      placeholder="Örn: 7–14 Yaş İlkokul &amp; Ortaokul Aileleri"
                    />
                  </label>
                  <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="button primary"
                      onClick={runWizard}
                      disabled={wizardLoading}
                      style={{ fontSize: "12px", height: "36px" }}
                    >
                      {wizardLoading ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}
                      {wizardLoading ? "Gemini 2 Alternatif Üretiyor..." : "Alternatif Stilleri Üret"}
                    </button>
                  </div>
                </div>

                {/* ALTERNATİFLER LİSTESİ */}
                {wizardAlternatives.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: "16px" }}>
                    {wizardAlternatives.map((alt, idx) => (
                      <div
                        key={idx}
                        style={{
                          border: "1.5px solid #e2e8f0",
                          borderRadius: "14px",
                          padding: "16px",
                          background: alt.groundColor || "#ffffff",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                          boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 800,
                              color: alt.secondaryColor || "#0f172a",
                              letterSpacing: ".08em",
                            }}
                          >
                            ALTERNATİF {idx === 0 ? "A" : "B"}
                          </span>
                          <div style={{ display: "flex", gap: "4px" }}>
                            <span
                              style={{
                                width: "14px",
                                height: "14px",
                                borderRadius: "4px",
                                background: alt.groundColor,
                                border: "1px solid rgba(0,0,0,0.15)",
                              }}
                            />
                            <span
                              style={{
                                width: "14px",
                                height: "14px",
                                borderRadius: "4px",
                                background: alt.secondaryColor,
                              }}
                            />
                            <span
                              style={{
                                width: "14px",
                                height: "14px",
                                borderRadius: "4px",
                                background: alt.primaryColor,
                              }}
                            />
                            <span
                              style={{
                                width: "14px",
                                height: "14px",
                                borderRadius: "4px",
                                background: alt.accentColor,
                              }}
                            />
                          </div>
                        </div>

                        <strong style={{ fontSize: "12px", color: alt.secondaryColor || "#0f172a" }}>
                          {alt.personality || "Tasarım Karakteri"}
                        </strong>

                        <p style={{ fontSize: "11px", color: "#475569", margin: 0, lineHeight: 1.45, flex: 1 }}>
                          {alt.summary}
                        </p>

                        <div style={{ fontSize: "10px", color: "#64748b" }}>
                          <strong>Tipografi:</strong> {alt.typographyStyle || "Inter Sans"}
                        </div>

                        <button
                          type="button"
                          className="button primary"
                          onClick={() => applyAlternative(alt)}
                          style={{
                            background: alt.primaryColor || "var(--primary)",
                            color: "#ffffff",
                            width: "100%",
                            height: "34px",
                            fontSize: "11px",
                            marginTop: "6px",
                          }}
                        >
                          <CheckCircle2 size={14} />
                          Bu Stili Aktif Yap
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      ) : (
        <BrandVisualsTab projectId={projectId} />
      )}
    </div>
  );
}

function PaletteSwatchCard({
  role,
  label,
  color,
  onChange,
}: {
  role: string;
  label: string;
  color: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "9.5px", fontWeight: 800, color: "#64748b", letterSpacing: ".05em" }}>
          {role}
        </span>
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(color) ? color : "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "18px",
            height: "18px",
            borderRadius: "4px",
            border: "1px solid #cbd5e1",
            padding: 0,
            cursor: "pointer",
            background: "transparent",
          }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <input
          value={color}
          onChange={(e) => onChange(e.target.value)}
          style={{
            fontSize: "11px",
            fontFamily: "monospace",
            fontWeight: 700,
            border: "none",
            padding: "2px 0",
            width: "100%",
            outline: "none",
            color: "#0f172a",
          }}
        />
      </div>
      <small style={{ fontSize: "9px", color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden" }}>
        {label}
      </small>
    </div>
  );
}

function ResultBox({ result }: { result: { ok: boolean; message: string } }) {
  return (
    <div className={`import-result ${result.ok ? "success" : "error"}`}>
      {result.ok ? <Check size={15} /> : <CircleAlert size={15} />}
      <span>{result.message}</span>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  full = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  full?: boolean;
}) {
  return (
    <label className={`field-label ${full ? "full" : ""}`}>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function AreaField({
  label,
  value,
  onChange,
  extraClass = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  extraClass?: string;
}) {
  return (
    <label className="field-label full">
      {label}
      <textarea className={extraClass} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field-label">
      {label}
      <div className="color-field">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#6d5dfc"}
          onChange={(e) => onChange(e.target.value)}
        />
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </label>
  );
}
