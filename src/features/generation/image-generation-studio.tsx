"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import {
  Check, ChevronDown, Download, ImageIcon, Info, LayoutTemplate, LoaderCircle, Palette,
  Plus, Settings2, Sparkles, WandSparkles,
} from "lucide-react";
import { useProjects } from "@/features/projects/projects-context";

type BrandKey = "logo" | "brandName" | "phone" | "email" | "address" | "website";

const brandFields: { key: BrandKey; label: string }[] = [
  { key: "logo", label: "Logo" }, { key: "brandName", label: "Marka adı" },
  { key: "phone", label: "Telefon" }, { key: "email", label: "E-posta" },
  { key: "address", label: "Adres" }, { key: "website", label: "Web sitesi" },
];

export function ImageGenerationStudio({ projectId }: { projectId: string }) {
  const { getProject } = useProjects();
  const project = getProject(projectId);
  const [prompt, setPrompt] = useState("");
  const [selectedFields, setSelectedFields] = useState<BrandKey[]>(["logo", "brandName", "website"]);
  const [platform, setPlatform] = useState("Instagram dikey gönderi");
  const [ratio, setRatio] = useState("4:5");
  const [purpose, setPurpose] = useState("Ürün tanıtımı");
  const [style, setStyle] = useState("Modern ve minimalist");
  const [provider, setProvider] = useState("Otomatik");
  const [mode, setMode] = useState<"safe" | "free">("safe");
  const [count, setCount] = useState(2);
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<{ id: string; url: string; mimeType: string }[]>([]);
  const [usedModel, setUsedModel] = useState("");

  const available = useMemo(() => project?.brand, [project]);
  if (!project || !available) return <div className="overview-loading" />;

  function toggle(key: BrandKey) {
    if (!available?.[key]) return;
    setSelectedFields((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  async function generate() {
    if (!prompt.trim()) { setMessage("Üretime başlamak için kreatif fikrinizi yazın."); return; }
    if (!["Otomatik", "CliProxyAPI"].includes(provider)) { setMessage("Bu sağlayıcının doğrudan bağlantısı henüz hazır değil. CliProxyAPI veya Otomatik seçin."); return; }
    setGenerating(true); setMessage(""); setResults([]);
    const brand = project!.brand;
    const selectedBrand = selectedFields.filter((key) => brand[key]).map((key) => `${brandFields.find((item) => item.key === key)?.label}: ${brand[key]}`).join("; ");
    const finalPrompt = `${prompt.trim()}\nReklam amacı: ${purpose}. Görsel stil: ${style}. Platform: ${platform}, oran: ${ratio}. ${mode === "safe" ? "Görselin içinde yazı veya yapay logo üretme; metin ve marka öğeleri sonradan eklenecek, yerleşim için temiz negatif alan bırak." : "Tamamlanmış bir sosyal medya reklam kreatifi oluştur."}${selectedBrand ? ` Marka bağlamı: ${selectedBrand}.` : ""}`;
    try {
      const response = await fetch("/api/ai/images/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, prompt: finalPrompt, ratio, count, settings: { platform, purpose, style, mode, selectedFields } }) });
      const body = await response.json() as { ok: boolean; message?: string; model?: string; assets?: { id: string; url: string; mimeType: string }[] };
      if (!response.ok || !body.ok || !body.assets?.length) { setMessage(body.message || "Görsel üretilemedi."); return; }
      setResults(body.assets); setUsedModel(body.model || "");
    } catch { setMessage("Görsel üretim isteği tamamlanamadı."); }
    finally { setGenerating(false); }
  }

  return (
    <div className="generation-studio">
      <section className="generation-controls">
        <div className="generation-control-header"><div><span>KREATİF BRİFİ</span><h2>Yeni görsel üret</h2></div><WandSparkles size={21} /></div>

        <div className="control-section">
          <div className="control-title"><span>Marka kaynakları</span><Link href={`/projects/${projectId}/settings`}>Düzenle</Link></div>
          <p className="control-help">Kreatifte görünmesini istediğiniz bilgileri seçin.</p>
          <div className="brand-source-grid">
            {brandFields.map(({ key, label }) => {
              const exists = Boolean(available[key]);
              const selected = selectedFields.includes(key);
              return <button key={key} type="button" disabled={!exists} className={`source-chip ${selected ? "selected" : ""}`} onClick={() => toggle(key)}><span>{selected && <Check size={12} />}</span>{label}{!exists && <small>Eksik</small>}</button>;
            })}
          </div>
        </div>

        <div className="control-section">
          <label className="control-title" htmlFor="creative-prompt"><span>Ne üretelim?</span><button type="button" className="inline-ai" onClick={() => prompt && setPrompt(`${prompt.trim()} Marka kimliğine uygun, güçlü bir görsel hiyerarşi ve net bir odak noktası kullan.`)}><Sparkles size={13} />Promptu geliştir</button></label>
          <textarea id="creative-prompt" className="prompt-area" value={prompt} onChange={(e) => { setPrompt(e.target.value); setMessage(""); }} placeholder="Örn. Yeni bioklimatik pergola modelini modern bir terasta, gün batımı ışığında tanıtan premium reklam kreatifi..." />
          <div className="prompt-footer"><span>{prompt.length}/1200</span><button type="button"><Plus size={13} />Referans görsel</button></div>
        </div>

        <div className="control-section">
          <div className="control-title"><span>Üretim biçimi</span></div>
          <div className="mode-switch">
            <button type="button" className={mode === "safe" ? "active" : ""} onClick={() => setMode("safe")}><LayoutTemplate size={16} /><span><strong>Marka Güvenli</strong><small>Metin ve logo sonradan yerleşir</small></span></button>
            <button type="button" className={mode === "free" ? "active" : ""} onClick={() => setMode("free")}><Palette size={16} /><span><strong>Serbest AI</strong><small>Tüm kreatifi AI üretir</small></span></button>
          </div>
        </div>

        <div className="attribute-grid">
          <SelectField label="Platform" value={platform} onChange={(value) => { setPlatform(value); const map: Record<string,string> = { "Instagram dikey gönderi":"4:5", "Instagram Story / Reels":"9:16", "Instagram kare gönderi":"1:1", "Pinterest Pin":"2:3", "LinkedIn gönderisi":"1:1" }; setRatio(map[value] || "1:1"); }} options={["Instagram dikey gönderi", "Instagram Story / Reels", "Instagram kare gönderi", "Pinterest Pin", "LinkedIn gönderisi"]} />
          <SelectField label="Oran" value={ratio} onChange={setRatio} options={["1:1", "4:5", "9:16", "2:3", "16:9"]} />
          <SelectField label="Amaç" value={purpose} onChange={setPurpose} options={["Ürün tanıtımı", "Hizmet tanıtımı", "Kampanya / indirim", "Fayda odaklı", "Problem–çözüm", "Marka bilinirliği"]} />
          <SelectField label="Görsel stil" value={style} onChange={setStyle} options={["Modern ve minimalist", "Premium ve sinematik", "Canlı ve enerjik", "Editoryal", "Fotogerçekçi", "İllüstratif"]} />
          <SelectField label="Sağlayıcı" value={provider} onChange={setProvider} options={["Otomatik", "CliProxyAPI", "OpenAI", "Gemini"]} />
          <SelectField label="Varyasyon" value={`${count} görsel`} onChange={(value) => setCount(Number(value[0]))} options={["1 görsel", "2 görsel", "3 görsel", "4 görsel"]} />
        </div>

        {message && <div className="generation-notice"><Info size={15} /><span>{message}</span></div>}
        <button type="button" className="generate-button" onClick={generate} disabled={generating}>{generating ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}{generating ? "Görsel üretiliyor" : "Görsel üret"}<span>{count} varyasyon</span></button>
      </section>

      <section className="generation-results">
        <div className="results-toolbar"><div><h2>Üretilen görseller</h2><span>Bu projeye ait kreatifler</span></div><div className="result-tabs"><button className="active">Son üretim</button><button>Geçmiş</button></div></div>
        {results.length ? <div className="generated-gallery">{results.map((result) => <article className="generated-card" key={result.id}><div className="generated-image"><Image src={result.url} alt="AI ile üretilen reklam kreatifi" fill sizes="(max-width: 760px) 100vw, 40vw" unoptimized /></div><div><span>{usedModel || "CliProxyAPI"}</span><a href={result.url} download={`kreatif-${result.id}.png`}><Download size={14} />İndir</a></div></article>)}</div> : <div className="results-empty">
          <div className="empty-canvas"><div className="canvas-glow" style={{ background: available.primaryColor }} /><ImageIcon size={38} /><span><Sparkles size={13} />AI KREATİF STÜDYOSU</span></div>
          <h3>İlk kreatifinizi oluşturun</h3>
          <p>Soldaki briefi tamamlayın. Üretilen görseller burada yan yana görüntülenecek.</p>
          <div className="active-brief"><span><Settings2 size={14} />{platform}</span><span>{ratio}</span><span>{mode === "safe" ? "Marka Güvenli" : "Serbest AI"}</span></div>
        </div>}
      </section>
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="select-field"><span>{label}</span><div><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={14} /></div></label>;
}
