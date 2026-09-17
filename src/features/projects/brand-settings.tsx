"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, CircleAlert, Globe2, ImagePlus, LoaderCircle, Palette, Save, Sparkles, X } from "lucide-react";
import { BrandProfile, useProjects } from "./projects-context";

export function BrandSettings({ projectId }: { projectId: string }) {
  const { getProject, updateProject, ready } = useProjects();
  const project = getProject(projectId);
  const [saved, setSaved] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [form, setForm] = useState<BrandProfile>({ brandName: "", website: "", logo: "", phone: "", email: "", address: "", industry: "", description: "", audience: "", tone: "", primaryColor: "#6d5dfc", secondaryColor: "#171826", defaultCta: "Detaylı bilgi alın" });
  useEffect(() => {
    // Keep the form synchronized when the active project changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (project) setForm(project.brand);
  }, [project]);
  if (!ready || !project) return <div className="overview-loading" />;
  function field(key: keyof BrandProfile, value: string) { setForm((current) => ({ ...current, [key]: value })); setSaved(false); }
  function uploadLogo(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => field("logo", String(reader.result));
    reader.readAsDataURL(file);
  }
  function save() { updateProject(projectId, { brand: form }); setSaved(true); window.setTimeout(() => setSaved(false), 2000); }
  async function importFromWebsite() {
    if (!form.website.trim()) { setImportResult({ ok: false, message: "Önce web sitesi adresini girin." }); return; }
    setImporting(true); setImportResult(null);
    try {
      const response = await fetch("/api/brand/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ website: form.website }) });
      const result = await response.json() as { ok: boolean; message?: string; brand?: Partial<BrandProfile> };
      if (!result.ok || !result.brand) { setImportResult({ ok: false, message: result.message || "Marka bilgileri alınamadı." }); return; }
      let added = 0;
      setForm((current) => {
        const next = { ...current };
        for (const [key, value] of Object.entries(result.brand || {})) {
          const typedKey = key as keyof BrandProfile;
          if (typedKey in next && !next[typedKey] && typeof value === "string" && value.trim()) { next[typedKey] = value.trim(); added++; }
        }
        return next;
      });
      setSaved(false); setImportResult({ ok: true, message: `${added} boş alan web sitesinden dolduruldu. Kontrol edip kaydedin.` });
    } catch { setImportResult({ ok: false, message: "Marka bilgileri alınamadı." }); }
    finally { setImporting(false); }
  }
  return <div className="settings-layout"><aside className="settings-nav"><strong>Proje ayarları</strong><button className="active"><Palette size={17} />Marka bilgileri</button></aside><section className="settings-card"><div className="settings-heading"><div><h2>Marka bilgileri</h2><p>AI üretimlerinde kullanılacak marka kimliğini ve iletişim bilgilerini tanımlayın.</p></div><button className="button primary" onClick={save}>{saved ? <Check size={17} /> : <Save size={17} />}{saved ? "Kaydedildi" : "Kaydet"}</button></div><div className="brand-import-card"><div><span><Globe2 size={18} /></span><div><strong>Web sitesinden marka bilgilerini getir</strong><p>AI siteyi inceler ve yalnızca boş marka alanlarını doldurur.</p></div></div><button type="button" className="button secondary" onClick={importFromWebsite} disabled={importing}>{importing ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}{importing ? "Site inceleniyor" : "Marka bilgilerini getir"}</button></div>{importResult && <div className={`import-result ${importResult.ok ? "success" : "error"}`}>{importResult.ok ? <Check size={15} /> : <CircleAlert size={15} />}<span>{importResult.message}</span></div>}<div className="form-grid">
    <label className="field-label full">Marka logosu<div className="logo-upload">{form.logo ? <><Image src={form.logo} alt="Marka logosu" width={180} height={68} unoptimized /><button type="button" className="icon-button" onClick={() => field("logo", "")} aria-label="Logoyu kaldır"><X size={16} /></button></> : <><ImagePlus size={22} /><span>PNG, JPG veya SVG yükleyin</span></>}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => uploadLogo(e.target.files?.[0])} /></div></label>
    <label className="field-label">Marka adı<input value={form.brandName} onChange={(e) => field("brandName", e.target.value)} placeholder={project.name} /></label><label className="field-label">Web sitesi<input value={form.website} onChange={(e) => field("website", e.target.value)} placeholder="https://marka.com" /></label>
    <label className="field-label">Telefon<input value={form.phone} onChange={(e) => field("phone", e.target.value)} placeholder="+90 555 000 00 00" /></label><label className="field-label">E-posta<input type="email" value={form.email} onChange={(e) => field("email", e.target.value)} placeholder="merhaba@marka.com" /></label>
    <label className="field-label full">Adres<input value={form.address} onChange={(e) => field("address", e.target.value)} placeholder="Açık adres veya şehir" /></label><label className="field-label full">Sektör<input value={form.industry} onChange={(e) => field("industry", e.target.value)} placeholder="Örn. E-ticaret, turizm, teknoloji" /></label>
    <label className="field-label full">Marka açıklaması<textarea value={form.description} onChange={(e) => field("description", e.target.value)} placeholder="Markanızı birkaç cümleyle anlatın." /></label><label className="field-label full">Hedef kitle<textarea value={form.audience} onChange={(e) => field("audience", e.target.value)} placeholder="İçerikleriniz kimlere hitap ediyor?" /></label><label className="field-label full">Marka tonu<textarea value={form.tone} onChange={(e) => field("tone", e.target.value)} placeholder="Örn. Samimi, modern, bilgilendirici" /></label>
    <label className="field-label">Ana renk<div className="color-field"><input type="color" value={form.primaryColor} onChange={(e) => field("primaryColor", e.target.value)} /><input value={form.primaryColor} onChange={(e) => field("primaryColor", e.target.value)} /></div></label><label className="field-label">Yardımcı renk<div className="color-field"><input type="color" value={form.secondaryColor} onChange={(e) => field("secondaryColor", e.target.value)} /><input value={form.secondaryColor} onChange={(e) => field("secondaryColor", e.target.value)} /></div></label>
    <label className="field-label full">Varsayılan çağrı metni<input value={form.defaultCta} onChange={(e) => field("defaultCta", e.target.value)} placeholder="Detaylı bilgi alın" /></label>
  </div></section></div>;
}
