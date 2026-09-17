"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, CircleAlert, Globe2, ImagePlus, LoaderCircle, Palette, RefreshCw, Save, Sparkles, SwatchBook, X } from "lucide-react";
import { BrandConcept, normalizeBrandConcept } from "@/lib/brand-concept";
import { BrandProfile, useProjects } from "./projects-context";

export function BrandSettings({ projectId }: { projectId: string }) {
  const { getProject, updateProject, ready } = useProjects();
  const project = getProject(projectId);
  const [tab, setTab] = useState<"brand" | "concept">("brand");
  const [saved, setSaved] = useState(false);
  const [importing, setImporting] = useState(false);
  const [generatingConcept, setGeneratingConcept] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [form, setForm] = useState<BrandProfile>({ brandName: "", website: "", logo: "", phone: "", email: "", address: "", industry: "", description: "", audience: "", tone: "", primaryColor: "#6d5dfc", secondaryColor: "#171826", defaultCta: "Detaylı bilgi alın" });
  const [concept, setConcept] = useState<BrandConcept>(normalizeBrandConcept());

  useEffect(() => {
    // Keep editable drafts synchronized when the active project changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (project) { setForm(project.brand); setConcept(normalizeBrandConcept(project.brandConcept)); }
  }, [project]);
  if (!ready || !project) return <div className="overview-loading" />;

  function field(key: keyof BrandProfile, value: string) { setForm((current) => ({ ...current, [key]: value })); setSaved(false); }
  function conceptField(key: keyof BrandConcept, value: string) { setConcept((current) => ({ ...current, [key]: value })); setSaved(false); }
  function uploadLogo(file?: File) { if (!file || !file.type.startsWith("image/")) return; const reader = new FileReader(); reader.onload = () => field("logo", String(reader.result)); reader.readAsDataURL(file); }
  function saveBrand() { updateProject(projectId, { brand: form }); setSaved(true); window.setTimeout(() => setSaved(false), 2000); }

  async function saveConcept(next = concept) {
    setResult(null);
    try {
      const response = await fetch("/api/ai/brand-concept", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, concept: next }) });
      const body = await response.json() as { ok: boolean; concept?: BrandConcept; message?: string };
      if (!response.ok || !body.ok || !body.concept) throw new Error(body.message || "Konsept kaydedilemedi.");
      setConcept(body.concept); updateProject(projectId, { brandConcept: body.concept }); setSaved(true); window.setTimeout(() => setSaved(false), 2000);
    } catch (error) { setResult({ ok: false, message: error instanceof Error ? error.message : "Konsept kaydedilemedi." }); }
  }

  async function generateConcept() {
    setGeneratingConcept(true); setResult(null);
    try {
      const response = await fetch("/api/ai/brand-concept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId }) });
      const body = await response.json() as { ok: boolean; concept?: BrandConcept; message?: string };
      if (!response.ok || !body.ok || !body.concept) throw new Error(body.message || "Konsept oluşturulamadı.");
      setConcept(body.concept); updateProject(projectId, { brandConcept: body.concept }); setResult({ ok: true, message: "Marka konsepti oluşturuldu ve kaydedildi." });
    } catch (error) { setResult({ ok: false, message: error instanceof Error ? error.message : "Konsept oluşturulamadı." }); }
    finally { setGeneratingConcept(false); }
  }

  async function importFromWebsite() {
    if (!form.website.trim()) { setResult({ ok: false, message: "Önce web sitesi adresini girin." }); return; }
    setImporting(true); setResult(null);
    try {
      const response = await fetch("/api/brand/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ website: form.website }) });
      const body = await response.json() as { ok: boolean; message?: string; brand?: Partial<BrandProfile> & { brandConcept?: BrandConcept } };
      if (!body.ok || !body.brand) throw new Error(body.message || "Marka bilgileri alınamadı.");
      const { brandConcept, ...foundBrand } = body.brand;
      let added = 0; const nextBrand = { ...form };
      for (const [key, value] of Object.entries(foundBrand)) { const typedKey = key as keyof BrandProfile; if (typedKey in nextBrand && !nextBrand[typedKey] && typeof value === "string" && value.trim()) { nextBrand[typedKey] = value.trim(); added++; } }
      const nextConcept = brandConcept ? normalizeBrandConcept(brandConcept) : concept;
      setForm(nextBrand); setConcept(nextConcept); updateProject(projectId, { brand: nextBrand, brandConcept: nextConcept });
      if (brandConcept) await saveConcept(nextConcept);
      setResult({ ok: true, message: `${added} boş alan dolduruldu ve marka konsepti güncellendi.` });
    } catch (error) { setResult({ ok: false, message: error instanceof Error ? error.message : "Marka bilgileri alınamadı." }); }
    finally { setImporting(false); }
  }

  const colors = [concept.primaryColor, concept.secondaryColor, concept.accentColor];
  return <div className="settings-layout">
    <aside className="settings-nav"><strong>Proje ayarları</strong><button className={tab === "brand" ? "active" : ""} onClick={() => { setTab("brand"); setResult(null); }}><Palette size={17} />Marka bilgileri</button><button className={tab === "concept" ? "active" : ""} onClick={() => { setTab("concept"); setResult(null); }}><SwatchBook size={17} />Marka konsepti</button></aside>
    {tab === "brand" ? <section className="settings-card"><div className="settings-heading"><div><h2>Marka bilgileri</h2><p>AI üretimlerinde kullanılacak doğrulanmış marka ve iletişim bilgileri.</p></div><button className="button primary" onClick={saveBrand}>{saved ? <Check size={17} /> : <Save size={17} />}{saved ? "Kaydedildi" : "Kaydet"}</button></div>
      <div className="brand-import-card"><div><span><Globe2 size={18} /></span><div><strong>Web sitesinden marka bilgilerini ve konsepti getir</strong><p>AI boş alanları doldurur ve görsel marka konseptini otomatik belirler.</p></div></div><button type="button" className="button secondary" onClick={importFromWebsite} disabled={importing}>{importing ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}{importing ? "Site inceleniyor" : "Marka bilgilerini getir"}</button></div>
      {result && <ResultBox result={result} />}
      <div className="form-grid"><label className="field-label full">Marka logosu<div className="logo-upload">{form.logo ? <><Image src={form.logo} alt="Marka logosu" width={180} height={68} unoptimized /><button type="button" className="icon-button" onClick={() => field("logo", "")} aria-label="Logoyu kaldır"><X size={16} /></button></> : <><ImagePlus size={22} /><span>PNG, JPG veya SVG yükleyin</span></>}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => uploadLogo(e.target.files?.[0])} /></div></label>
        <TextField label="Marka adı" value={form.brandName} onChange={(v) => field("brandName", v)} /><TextField label="Web sitesi" value={form.website} onChange={(v) => field("website", v)} /><TextField label="Telefon" value={form.phone} onChange={(v) => field("phone", v)} /><TextField label="E-posta" value={form.email} onChange={(v) => field("email", v)} /><TextField label="Adres" value={form.address} onChange={(v) => field("address", v)} full /><TextField label="Sektör" value={form.industry} onChange={(v) => field("industry", v)} full /><AreaField label="Marka açıklaması" value={form.description} onChange={(v) => field("description", v)} /><AreaField label="Hedef kitle" value={form.audience} onChange={(v) => field("audience", v)} /><AreaField label="Marka tonu" value={form.tone} onChange={(v) => field("tone", v)} /><ColorField label="Ana renk" value={form.primaryColor} onChange={(v) => field("primaryColor", v)} /><ColorField label="Yardımcı renk" value={form.secondaryColor} onChange={(v) => field("secondaryColor", v)} /><TextField label="Varsayılan çağrı metni" value={form.defaultCta} onChange={(v) => field("defaultCta", v)} full />
      </div></section> : <section className="settings-card"><div className="settings-heading"><div><h2>Marka konsepti</h2><p>Görsel üretimlerinde otomatik ve zorunlu kullanılan tasarım yönü.</p></div><button className="button primary" onClick={() => saveConcept()}>{saved ? <Check size={17} /> : <Save size={17} />}{saved ? "Kaydedildi" : "Kaydet"}</button></div>
      <div className="concept-layout"><div className="concept-editor"><AreaField label="Konsept özeti" value={concept.summary} onChange={(v) => conceptField("summary", v)} extraClass="concept-textarea" /><TextField label="Marka karakteri" value={concept.personality} onChange={(v) => conceptField("personality", v)} /><TextField label="Görsel stil" value={concept.visualStyle} onChange={(v) => conceptField("visualStyle", v)} /><TextField label="Fotoğraf stili" value={concept.photographyStyle} onChange={(v) => conceptField("photographyStyle", v)} /><div className="concept-colors"><ColorField label="Ana renk" value={concept.primaryColor} onChange={(v) => conceptField("primaryColor", v)} /><ColorField label="Yardımcı renk" value={concept.secondaryColor} onChange={(v) => conceptField("secondaryColor", v)} /><ColorField label="Vurgu" value={concept.accentColor} onChange={(v) => conceptField("accentColor", v)} /></div><button className="button secondary concept-ai-button" onClick={generateConcept} disabled={generatingConcept}>{generatingConcept ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}{generatingConcept ? "Konsept hazırlanıyor" : concept.summary ? "AI ile yeniden oluştur" : "AI ile konsept oluştur"}</button>{result && <ResultBox result={result} />}</div>
        <div className="concept-preview" style={{ background: `linear-gradient(145deg, ${colors[1]}, ${colors[0]})` }}><div className="concept-preview-glow" style={{ background: colors[2] }} /><span>MARKA KONSEPTİ</span><h3>{form.brandName || project.name}</h3><p>{concept.summary || "Marka konsepti oluşturulduğunda temsili görünüm burada yer alacak."}</p><button style={{ background: colors[2], color: colors[1] }}>{form.defaultCta || "Detaylı bilgi alın"}</button><div className="concept-swatches">{colors.map((color, index) => <i key={`${color}-${index}`} style={{ background: color }} />)}</div></div></div>
    </section>}
  </div>;
}

function ResultBox({ result }: { result: { ok: boolean; message: string } }) { return <div className={`import-result ${result.ok ? "success" : "error"}`}>{result.ok ? <Check size={15} /> : <CircleAlert size={15} />}<span>{result.message}</span></div>; }
function TextField({ label, value, onChange, full = false }: { label: string; value: string; onChange: (value: string) => void; full?: boolean }) { return <label className={`field-label ${full ? "full" : ""}`}>{label}<input value={value} onChange={(e) => onChange(e.target.value)} /></label>; }
function AreaField({ label, value, onChange, extraClass = "" }: { label: string; value: string; onChange: (value: string) => void; extraClass?: string }) { return <label className="field-label full">{label}<textarea className={extraClass} value={value} onChange={(e) => onChange(e.target.value)} /></label>; }
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="field-label">{label}<div className="color-field"><input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#6d5dfc"} onChange={(e) => onChange(e.target.value)} /><input value={value} onChange={(e) => onChange(e.target.value)} /></div></label>; }
