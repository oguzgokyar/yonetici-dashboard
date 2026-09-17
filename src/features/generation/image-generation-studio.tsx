"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import {
  ArrowRight, Check, ChevronDown, Clock3, Download, History, ImageIcon, Info, LayoutTemplate, Lightbulb, LoaderCircle, Palette,
  Plus, RefreshCw, Settings2, Sparkles, WandSparkles, X,
} from "lucide-react";
import { useProjects } from "@/features/projects/projects-context";

type BrandKey = "logo" | "brandName" | "phone" | "email" | "address" | "website";
type ContentIdea = { id: string; sourcePrompt: string; title: string; concept: string; visualDirection: string; suggestedPrompt: string; status: "suggested" | "used"; createdAt: string; usedAt: string | null };

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
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [ideasView, setIdeasView] = useState<"suggested" | "used">("suggested");
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [activeIdea, setActiveIdea] = useState<ContentIdea | null>(null);

  const available = useMemo(() => project?.brand, [project]);
  if (!project || !available) return <div className="overview-loading" />;

  function toggle(key: BrandKey) {
    if (!available?.[key]) return;
    setSelectedFields((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  async function loadIdeas(open = true) {
    if (open) setIdeasOpen(true);
    try {
      const response = await fetch(`/api/ai/content-ideas?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const body = await response.json() as { ok: boolean; ideas?: ContentIdea[] };
      if (body.ok && body.ideas) setIdeas(body.ideas);
    } catch { setMessage("Kayıtlı içerik fikirleri alınamadı."); }
  }

  async function suggestIdeas() {
    if (!prompt.trim()) { setMessage("Önce ürün veya içerik bilgisini prompt alanına yazın."); return; }
    setIdeasOpen(true); setIdeasView("suggested"); setIdeasLoading(true); setMessage("");
    try {
      const response = await fetch("/api/ai/content-ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, prompt: prompt.trim() }) });
      const body = await response.json() as { ok: boolean; message?: string; ideas?: ContentIdea[] };
      if (!response.ok || !body.ok || !body.ideas) throw new Error(body.message || "İçerik fikirleri üretilemedi.");
      setIdeas((current) => [...body.ideas!, ...current]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "İçerik fikirleri üretilemedi."); }
    finally { setIdeasLoading(false); }
  }

  async function applyIdea(idea: ContentIdea) {
    setPrompt(idea.suggestedPrompt); setActiveIdea(idea); setIdeasOpen(false); setMessage(`“${idea.title}” fikri prompta uygulandı.`);
    if (idea.status !== "used") {
      const usedAt = new Date().toISOString();
      setIdeas((current) => current.map((item) => item.id === idea.id ? { ...item, status: "used", usedAt } : item));
      fetch("/api/ai/content-ideas", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, ideaId: idea.id }) }).catch(() => undefined);
    }
  }

  async function enhancePrompt() {
    if (!prompt.trim()) { setMessage("Geliştirmek için önce bir prompt yazın veya içerik fikri seçin."); return; }
    setEnhancing(true); setMessage("");
    try {
      const response = await fetch("/api/ai/prompts/enhance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, prompt: prompt.trim(), selectedFields, idea: activeIdea ? { title: activeIdea.title, concept: activeIdea.concept, visualDirection: activeIdea.visualDirection } : undefined }) });
      const body = await response.json() as { ok: boolean; prompt?: string; message?: string };
      if (!response.ok || !body.ok || !body.prompt) throw new Error(body.message || "Prompt geliştirilemedi.");
      setPrompt(body.prompt); setMessage("Prompt, seçilen marka kaynakları ve içerik fikrine göre geliştirildi.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Prompt geliştirilemedi."); }
    finally { setEnhancing(false); }
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
          <label className="control-title" htmlFor="creative-prompt"><span>Ne üretelim?</span><button type="button" className="inline-ai" onClick={enhancePrompt} disabled={enhancing}>{enhancing ? <LoaderCircle className="spin" size={13} /> : <Sparkles size={13} />}{enhancing ? "Geliştiriliyor" : "Promptu geliştir"}</button></label>
          <textarea id="creative-prompt" className="prompt-area" value={prompt} onChange={(e) => { setPrompt(e.target.value); setMessage(""); }} placeholder="Örn. Yeni bioklimatik pergola modelini modern bir terasta, gün batımı ışığında tanıtan premium reklam kreatifi..." />
          {activeIdea && <div className="active-idea-chip"><Lightbulb size={13} /><span>{activeIdea.title}</span><button type="button" onClick={() => setActiveIdea(null)} aria-label="Seçili fikri kaldır"><X size={12} /></button></div>}
          <div className="prompt-footer"><span>{prompt.length}/1200</span><div><button type="button" onClick={() => loadIdeas()}><History size={13} />Fikirler</button><button type="button"><Plus size={13} />Referans görsel</button></div></div>
          <button type="button" className="idea-button" onClick={suggestIdeas} disabled={ideasLoading}>{ideasLoading ? <LoaderCircle className="spin" size={15} /> : <Lightbulb size={15} />}{ideasLoading ? "Yeni fikirler hazırlanıyor" : "Öneri içerik fikri al"}</button>
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

      {ideasOpen && <div className="modal-backdrop idea-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIdeasOpen(false); }}><section className="idea-modal" role="dialog" aria-modal="true" aria-labelledby="idea-modal-title">
        <button className="icon-button idea-modal-close" type="button" onClick={() => setIdeasOpen(false)} aria-label="Kapat"><X size={18} /></button>
        <div className="idea-modal-heading"><span><Lightbulb size={20} /></span><div><h2 id="idea-modal-title">İçerik fikirleri</h2><p>Yeni bir yaklaşım seçin veya daha önce kullandığınız fikirlere dönün.</p></div></div>
        <div className="idea-modal-tabs"><button className={ideasView === "suggested" ? "active" : ""} onClick={() => setIdeasView("suggested")}><Sparkles size={14} />Öneriler <span>{ideas.filter((idea) => idea.status === "suggested").length}</span></button><button className={ideasView === "used" ? "active" : ""} onClick={() => setIdeasView("used")}><History size={14} />Daha önce kullanılanlar <span>{ideas.filter((idea) => idea.status === "used").length}</span></button></div>
        <div className="idea-list">{ideasLoading ? <div className="ideas-loading"><LoaderCircle className="spin" size={22} /><strong>Birbirinden farklı fikirler hazırlanıyor</strong><span>Daha önce önerilen ve kullanılan konseptler tekrar edilmiyor.</span></div> : ideas.filter((idea) => idea.status === ideasView).length ? ideas.filter((idea) => idea.status === ideasView).map((idea) => <article className="idea-card" key={idea.id}><div><span><Clock3 size={12} />{new Date(idea.createdAt).toLocaleDateString("tr-TR")}</span><h3>{idea.title}</h3><p>{idea.concept}</p><small>{idea.visualDirection}</small></div><button type="button" onClick={() => applyIdea(idea)}>{idea.status === "used" ? "Tekrar kullan" : "Bu fikri kullan"}<ArrowRight size={14} /></button></article>) : <div className="ideas-empty"><Lightbulb size={26} /><strong>{ideasView === "used" ? "Henüz kullanılan fikir yok" : "Henüz öneri oluşturulmadı"}</strong><span>{ideasView === "used" ? "Seçtiğiniz fikirler burada saklanır." : "Prompt alanına ürün veya içerik bilgisini yazıp yeni öneriler alın."}</span></div>}</div>
        <div className="idea-modal-footer"><button type="button" className="button secondary" onClick={suggestIdeas} disabled={ideasLoading}>{ideasLoading ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}Yeni 7 fikir üret</button></div>
      </section></div>}
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="select-field"><span>{label}</span><div><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={14} /></div></label>;
}
