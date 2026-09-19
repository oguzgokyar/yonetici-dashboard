"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Download, History, ImageIcon, Info, Lightbulb, LoaderCircle,
  Maximize2, Pencil, Plus, RefreshCw, Send, Settings2, Sparkles, Trash2, WandSparkles, X,
} from "lucide-react";
import { useProjects } from "@/features/projects/projects-context";

type BrandKey = "logo" | "brandName" | "phone" | "email" | "address" | "website";
type ContentIdea = { id: string; sourcePrompt: string; title: string; concept: string; visualDirection: string; suggestedPrompt: string; status: "suggested" | "used"; createdAt: string; usedAt: string | null };
type GeneratedAsset = { id: string; url: string; mimeType: string; jobId?: string; model?: string; prompt?: string; createdAt?: string; qaScore?: number };
type RunningJob = { id: string; model: string; prompt: string; createdAt: string; progress: { phase?: string; completed?: number; total?: number; detail?: string; updatedAt?: string } };

const brandFields: { key: BrandKey; label: string }[] = [
  { key: "logo", label: "Logo" }, { key: "brandName", label: "Marka adı" },
  { key: "phone", label: "Telefon" }, { key: "email", label: "E-posta" },
  { key: "address", label: "Adres" }, { key: "website", label: "Web sitesi" },
];

export function ImageGenerationStudio({ projectId }: { projectId: string }) {
  const { getProject } = useProjects();
  const project = getProject(projectId);
  const [prompt, setPrompt] = useState("");
  const [contentType, setContentType] = useState("Otomatik");
  const [selectedFields, setSelectedFields] = useState<BrandKey[]>(["logo", "brandName", "website"]);
  const [platform, setPlatform] = useState("Instagram dikey gönderi");
  const [ratio, setRatio] = useState("4:5");
  const [purpose, setPurpose] = useState("Ürün tanıtımı");
  const [style, setStyle] = useState("Modern ve minimalist");
  const [provider, setProvider] = useState("Otomatik");
  const [count, setCount] = useState(2);
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedAsset[]>([]);
  const [history, setHistory] = useState<GeneratedAsset[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [runningJobs, setRunningJobs] = useState<RunningJob[]>([]);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<GeneratedAsset | null>(null);
  const [editInstruction, setEditInstruction] = useState("");
  const [editing, setEditing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState("");
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [ideasView, setIdeasView] = useState<"suggested" | "used">("suggested");
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [activeIdea, setActiveIdea] = useState<ContentIdea | null>(null);

  const available = useMemo(() => project?.brand, [project]);
  const currentIds = useMemo(() => new Set(results.map((item) => item.id)), [results]);
  const previousAssets = useMemo(() => history.filter((item) => !currentIds.has(item.id)), [history, currentIds]);
  const viewable = useMemo(() => [...results, ...previousAssets], [results, previousAssets]);
  const lightboxIndex = lightboxId ? viewable.findIndex((item) => item.id === lightboxId) : -1;
  const activeJob = runningJobs[0];
  const isProducing = generating || runningJobs.length > 0;

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/ai/images?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const body = await response.json() as { ok: boolean; assets?: GeneratedAsset[]; runningJobs?: RunningJob[] };
      if (body.ok && body.assets) setHistory(body.assets);
      if (body.ok && runningJobs.length > 0 && !(body.runningJobs || []).length && body.assets?.length) setResults(body.assets.slice(0, Math.max(1, count)));
      if (body.ok) setRunningJobs(body.runningJobs || []);
    } catch { setMessage("Önceki görseller alınamadı."); }
    finally { setHistoryLoading(false); }
  }, [projectId, runningJobs.length, count]);

  useEffect(() => {
    let active = true;
    fetch(`/api/ai/images?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" }).then((response) => response.json()).then((body: { ok: boolean; assets?: GeneratedAsset[]; runningJobs?: RunningJob[] }) => {
      if (active && body.ok && body.assets) setHistory(body.assets);
      if (active && body.ok) setRunningJobs(body.runningJobs || []);
    }).catch(() => { if (active) setMessage("Önceki görseller alınamadı."); }).finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [projectId]);
  useEffect(() => {
    if (!runningJobs.length && !generating) return;
    const timer = window.setInterval(() => { void loadHistory(); }, 3000);
    return () => window.clearInterval(timer);
  }, [runningJobs.length, generating, loadHistory]);
  if (!project || !available) return <div className="overview-loading" />;

  function toggle(key: BrandKey) {
    if (!available?.[key]) return;
    setSelectedFields((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  async function deleteAsset(asset: GeneratedAsset) {
    if (!window.confirm("Bu görsel kalıcı olarak silinsin mi?")) return;
    setDeletingId(asset.id); setMessage("");
    try {
      const response = await fetch("/api/ai/images", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, assetId: asset.id }) });
      const body = await response.json() as { ok: boolean; message?: string };
      if (!response.ok || !body.ok) throw new Error(body.message || "Görsel silinemedi.");
      setResults((current) => current.filter((item) => item.id !== asset.id)); setHistory((current) => current.filter((item) => item.id !== asset.id));
      if (lightboxId === asset.id) setLightboxId(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Görsel silinemedi."); }
    finally { setDeletingId(null); }
  }

  async function editAsset() {
    if (!editTarget || !editInstruction.trim()) return;
    setEditing(true); setMessage("");
    try {
      const response = await fetch("/api/ai/images/edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, assetId: editTarget.id, instruction: editInstruction.trim() }) });
      const body = await response.json() as { ok: boolean; message?: string; asset?: GeneratedAsset };
      if (!response.ok || !body.ok || !body.asset) throw new Error(body.message || "Görsel düzenlenemedi.");
      setResults([body.asset]); setHistory((current) => [body.asset!, ...current]); setEditTarget(null); setEditInstruction(""); setMessage("Düzenlenen görsel yeni sürüm olarak kaydedildi.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Görsel düzenlenemedi."); }
    finally { setEditing(false); }
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
      const response = await fetch("/api/ai/content-ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, prompt: prompt.trim(), contentType }) });
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
      const response = await fetch("/api/ai/prompts/enhance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, prompt: prompt.trim(), contentType, selectedFields, idea: activeIdea ? { title: activeIdea.title, concept: activeIdea.concept, visualDirection: activeIdea.visualDirection } : undefined }) });
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
    const finalPrompt = `${prompt.trim()}\nİçerik tipi: ${contentType}. Reklam amacı: ${purpose}. Tercih edilen yorum: ${style}. Platform: ${platform}, oran: ${ratio}. Kayıtlı marka konseptini kesin biçimde koru. Bitmiş reklam kreatifini metinleri ve seçilen marka kaynaklarıyla birlikte özgün bir kompozisyon olarak render et; sabit şablon kullanma.${selectedBrand ? ` Kullanılacak doğrulanmış marka kaynakları: ${selectedBrand}.` : ""}`;
    const sourceTopic = activeIdea ? activeIdea.sourcePrompt : prompt.trim();
    try {
      const response = await fetch("/api/ai/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          prompt: finalPrompt,
          ratio,
          count,
          settings: {
            platform,
            purpose,
            style,
            contentType,
            selectedFields,
            idea: activeIdea
              ? { id: activeIdea.id, title: activeIdea.title, concept: activeIdea.concept }
              : undefined,
            sourceTopic,
          },
        }),
      });
      const body = await response.json() as { ok: boolean; message?: string; model?: string; assets?: { id: string; url: string; mimeType: string }[] };
      if (!response.ok || !body.ok || !body.assets?.length) { setMessage(body.message || "Görsel üretilemedi."); return; }
      setResults(body.assets); setUsedModel(body.model || ""); await loadHistory();
    } catch { setMessage("Görsel üretim isteği tamamlanamadı."); }
    finally { setGenerating(false); }
  }

  return (
    <div className="generation-studio">
      <section className="generation-controls">
        <div className="generation-control-header"><div><span>HIZLI MOD</span><h2>Yeni görsel üret</h2></div><WandSparkles size={21} /></div>

        <div className="brand-concept-status"><span style={{ background: available.primaryColor }}><Sparkles size={13} /></span><div><strong>{project.brandConcept.summary ? "Marka konsepti aktif" : "Temel marka konsepti"}</strong><small>{project.brandConcept.summary || "Marka bilgilerine göre güvenli görsel dil uygulanacak."}</small></div><Link href={`/projects/${projectId}/settings`}>Düzenle</Link></div>

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

        <div className="attribute-grid">
          <SelectField label="İçerik tipi" value={contentType} onChange={setContentType} options={["Otomatik", "Problem–çözüm", "Öncesi–sonrası", "Tamamlanan proje", "Sık sorulan soru", "Soru / etkileşim", "Ürün / hizmet tanıtımı", "Fayda odaklı"]} />
          <SelectField label="Platform" value={platform} onChange={(value) => { setPlatform(value); const map: Record<string,string> = { "Instagram dikey gönderi":"4:5", "Instagram Story / Reels":"9:16", "Instagram kare gönderi":"1:1", "Pinterest Pin":"2:3", "LinkedIn gönderisi":"1:1" }; setRatio(map[value] || "1:1"); }} options={["Instagram dikey gönderi", "Instagram Story / Reels", "Instagram kare gönderi", "Pinterest Pin", "LinkedIn gönderisi"]} />
          <SelectField label="Oran" value={ratio} onChange={setRatio} options={["1:1", "4:5", "9:16", "2:3", "16:9"]} />
          <SelectField label="Amaç" value={purpose} onChange={setPurpose} options={["Ürün tanıtımı", "Hizmet tanıtımı", "Kampanya / indirim", "Fayda odaklı", "Problem–çözüm", "Marka bilinirliği"]} />
          <SelectField label="Görsel stil" value={style} onChange={setStyle} options={["Modern ve minimalist", "Premium ve sinematik", "Canlı ve enerjik", "Editoryal", "Fotogerçekçi", "İllüstratif"]} />
          <SelectField label="Sağlayıcı" value={provider} onChange={setProvider} options={["Otomatik", "CliProxyAPI", "OpenAI", "Gemini"]} />
          <SelectField label="Varyasyon" value={`${count} görsel`} onChange={(value) => setCount(Number(value[0]))} options={["1 görsel", "2 görsel", "3 görsel", "4 görsel"]} />
        </div>

        {message && <div className="generation-notice"><Info size={15} /><span>{message}</span></div>}
        <button type="button" className="generate-button" onClick={generate} disabled={isProducing}>{isProducing ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}{isProducing ? "Üretim devam ediyor" : "Görsel üret"}<span>{isProducing ? `${activeJob?.progress.completed || 0}/${activeJob?.progress.total || count}` : `${count} varyasyon`}</span></button>
      </section>

      <section className="generation-results">
        <div className="results-toolbar"><div><h2>Üretilen görseller</h2><span>Bu projeye ait kreatifler</span></div><div className="result-tabs"><button className="active">Son üretim</button><button>Geçmiş</button></div></div>
        {isProducing && <ProductionStatus job={activeJob} requestedCount={count} />}
        {results.length > 0 && <div className="generated-gallery">{results.map((result) => <CreativeCard key={result.id} asset={result} model={result.model || usedModel} deleting={deletingId === result.id} projectId={projectId} onView={() => setLightboxId(result.id)} onEdit={() => { setEditTarget(result); setEditInstruction(""); }} onDelete={() => void deleteAsset(result)} />)}</div>}
        {!results.length && !isProducing && <div className="results-empty">
          <div className="empty-canvas"><div className="canvas-glow" style={{ background: available.primaryColor }} /><ImageIcon size={38} /><span><Sparkles size={13} />AI KREATİF STÜDYOSU</span></div>
          <h3>İlk kreatifinizi oluşturun</h3>
          <p>Soldaki briefi tamamlayın. Üretilen görseller burada yan yana görüntülenecek.</p>
          <div className="active-brief"><span><Settings2 size={14} />{platform}</span><span>{ratio}</span><span>Marka konsepti aktif</span></div>
        </div>}
      </section>

      <section className="generation-history">
        <div className="history-heading"><div><span><History size={16} /></span><div><h2>Önceki üretilen görseller</h2><p>Bu projede üretilen ve düzenlenen kreatifler kalıcı olarak saklanır.</p></div></div><button type="button" className="button secondary" onClick={() => void loadHistory()} disabled={historyLoading}>{historyLoading ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}Yenile</button></div>
        {historyLoading && !history.length ? <div className="history-loading"><LoaderCircle className="spin" size={20} />Görsel arşivi yükleniyor</div> : previousAssets.length ? <div className="history-gallery">{previousAssets.map((asset) => <CreativeCard key={asset.id} asset={asset} deleting={deletingId === asset.id} projectId={projectId} onView={() => setLightboxId(asset.id)} onEdit={() => { setEditTarget(asset); setEditInstruction(""); }} onDelete={() => void deleteAsset(asset)} />)}</div> : <div className="history-empty"><ImageIcon size={23} /><span>Henüz önceki üretim bulunmuyor.</span></div>}
      </section>

      {lightboxIndex >= 0 && <div className="creative-lightbox" role="dialog" aria-modal="true" aria-label="Görsel önizleme" onMouseDown={(event) => { if (event.target === event.currentTarget) setLightboxId(null); }}>
        <button type="button" className="lightbox-close" onClick={() => setLightboxId(null)} aria-label="Kapat"><X size={22} /></button>
        {viewable.length > 1 && <button type="button" className="lightbox-nav previous" onClick={() => setLightboxId(viewable[(lightboxIndex - 1 + viewable.length) % viewable.length].id)} aria-label="Önceki görsel"><ChevronLeft size={26} /></button>}
        <div className="lightbox-content"><Image src={viewable[lightboxIndex].url} alt="Tam ekran reklam kreatifi" fill sizes="100vw" unoptimized priority /><div><span>{lightboxIndex + 1} / {viewable.length}</span><a href={viewable[lightboxIndex].url} download={`kreatif-${viewable[lightboxIndex].id}.png`}><Download size={15} />İndir</a><button type="button" onClick={() => { setEditTarget(viewable[lightboxIndex]); setEditInstruction(""); setLightboxId(null); }}><Pencil size={15} />Düzenle</button><Link href={`/projects/${projectId}/publishing?assetId=${viewable[lightboxIndex].id}`} className="button ghost" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><Send size={15} />Planla</Link></div></div>
        {viewable.length > 1 && <button type="button" className="lightbox-nav next" onClick={() => setLightboxId(viewable[(lightboxIndex + 1) % viewable.length].id)} aria-label="Sonraki görsel"><ChevronRight size={26} /></button>}
      </div>}

      {editTarget && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !editing) setEditTarget(null); }}><section className="modal creative-edit-modal" role="dialog" aria-modal="true" aria-labelledby="creative-edit-title"><button className="icon-button modal-close" type="button" onClick={() => setEditTarget(null)} disabled={editing} aria-label="Kapat"><X size={18} /></button><div className="modal-icon"><Pencil size={20} /></div><h2 id="creative-edit-title">Görseli AI ile düzenle</h2><p>Değişmesini istediğiniz kısmı yazın. Orijinal görsel korunur ve düzenleme yeni sürüm olarak kaydedilir.</p><div className="edit-preview"><Image src={editTarget.url} alt="Düzenlenecek kreatif" fill sizes="160px" unoptimized /></div><label className="field-label">Düzenleme talimatı<textarea value={editInstruction} onChange={(event) => setEditInstruction(event.target.value)} placeholder="Örn. Başlığı biraz büyüt, logonun kontrastını artır ve arka planı gündüz atmosferine çevir." autoFocus /></label><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setEditTarget(null)} disabled={editing}>Vazgeç</button><button type="button" className="button primary" onClick={() => void editAsset()} disabled={editing || !editInstruction.trim()}>{editing ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}{editing ? "Düzenleniyor" : "Yeni sürüm oluştur"}</button></div></section></div>}

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

function CreativeCard({ asset, model, deleting, projectId, onView, onEdit, onDelete }: { asset: GeneratedAsset; model?: string; deleting: boolean; projectId?: string; onView: () => void; onEdit: () => void; onDelete: () => void }) {
  return <article className="generated-card"><button type="button" className="generated-image" onClick={onView} aria-label="Görseli tam ekran aç"><Image src={asset.url} alt="AI ile üretilen reklam kreatifi" fill sizes="(max-width: 760px) 100vw, 30vw" unoptimized /><span><Maximize2 size={15} />Tam ekran</span></button><div className="creative-card-footer"><span>{asset.createdAt ? new Date(asset.createdAt).toLocaleDateString("tr-TR") : model || "CliProxyAPI"}</span><div><button type="button" onClick={onEdit} title="Düzenle"><Pencil size={14} /></button><a href={asset.url} download={`kreatif-${asset.id}.png`} title="İndir"><Download size={14} /></a>{projectId && <Link href={`/projects/${projectId}/publishing?assetId=${asset.id}`} title="Paylaşım Planına Ekle"><Send size={14} /></Link>}<button type="button" className="danger" onClick={onDelete} disabled={deleting} title="Sil">{deleting ? <LoaderCircle className="spin" size={14} /> : <Trash2 size={14} />}</button></div></div></article>;
}

function ProductionStatus({ job, requestedCount }: { job?: RunningJob; requestedCount: number }) {
  const phase = job?.progress.phase || "planning"; const completed = job?.progress.completed || 0; const total = job?.progress.total || requestedCount;
  const phases = [{ key: "planning", label: "Kreatif planı" }, { key: "rendering", label: "AI render" }, { key: "checking", label: "Kalite kontrolü" }, { key: "correcting", label: "İyileştirme" }];
  const currentIndex = Math.max(0, phases.findIndex((item) => item.key === phase));
  return <div className="production-status"><div className="production-visual"><div className="production-orbit"><Sparkles size={25} /></div><span className="production-scan" /></div><div className="production-copy"><span>ÜRETİM DEVAM EDİYOR</span><h3>{job?.progress.detail || "Kreatif fikir ve sanat yönetimi hazırlanıyor"}</h3><p>Sayfadan ayrılabilirsiniz. Üretim sunucuda devam eder ve tamamlandığında görsel arşivine otomatik eklenir.</p><div className="production-steps">{phases.map((item, index) => <span key={item.key} className={index < currentIndex ? "done" : index === currentIndex ? "active" : ""}><i>{index < currentIndex ? <Check size={10} /> : index + 1}</i>{item.label}</span>)}</div><div className="production-progress"><span style={{ width: `${Math.max(8, Math.min(100, total ? (completed / total) * 100 : 8))}%` }} /></div><small>{completed}/{total} görsel tamamlandı {job?.model ? `• ${job.model}` : ""}</small></div></div>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="select-field"><span>{label}</span><div><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={14} /></div></label>;
}
