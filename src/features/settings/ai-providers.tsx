"use client";

import { useEffect, useState } from "react";
import { Bot, Check, CircleAlert, Eye, EyeOff, KeyRound, LoaderCircle, Network, Save, ShieldCheck, Sparkles } from "lucide-react";

type Provider = { id: string; name: string; description: string; color: string; baseUrl: string; textModel: string; imageModel: string };
type StoredProvider = { provider: string; enabled: boolean; baseUrl: string; hasApiKey: boolean; maskedKey: string; textModel: string; imageModel: string; visionModel: string; editModel: string; priority: number };
const providers: Provider[] = [
  { id: "cliproxy", name: "CliProxyAPI", description: "Prompt, görsel ve video isteklerini özel dağıtım servisiniz üzerinden yönetin.", color: "#725cff", baseUrl: "", textModel: "", imageModel: "" },
  { id: "openai", name: "OpenAI", description: "Prompt geliştirme ve GPT Image modelleri için doğrudan bağlantı.", color: "#111827", baseUrl: "https://api.openai.com/v1", textModel: "", imageModel: "" },
  { id: "gemini", name: "Gemini", description: "Gemini metin ve Nano Banana görsel üretim modellerini kullanın.", color: "#3b82f6", baseUrl: "https://generativelanguage.googleapis.com", textModel: "", imageModel: "" },
];

export function AiProviders() {
  const [active, setActive] = useState("cliproxy");
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ cliproxy: true, openai: false, gemini: false });
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; models?: string[] } | null>(null);
  const provider = providers.find((item) => item.id === active)!;
  const [baseUrls, setBaseUrls] = useState<Record<string, string>>(Object.fromEntries(providers.map((item) => [item.id, item.baseUrl])));
  const [stored, setStored] = useState<Record<string, StoredProvider>>({});
  const [textModels, setTextModels] = useState<Record<string, string>>({});
  const [imageModels, setImageModels] = useState<Record<string, string>>({});
  const [visionModels, setVisionModels] = useState<Record<string, string>>({});
  const [editModels, setEditModels] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/ai/providers").then((response) => response.json()).then((rows: StoredProvider[]) => {
      if (!Array.isArray(rows)) return;
      setStored(Object.fromEntries(rows.map((row) => [row.provider, row])));
      setEnabled((current) => ({ ...current, ...Object.fromEntries(rows.map((row) => [row.provider, row.enabled])) }));
      setBaseUrls((current) => ({ ...current, ...Object.fromEntries(rows.map((row) => [row.provider, row.baseUrl])) }));
      setTextModels(Object.fromEntries(rows.map((row) => [row.provider, row.textModel])));
      setImageModels(Object.fromEntries(rows.map((row) => [row.provider, row.imageModel])));
      setVisionModels(Object.fromEntries(rows.map((row) => [row.provider, row.visionModel])));
      setEditModels(Object.fromEntries(rows.map((row) => [row.provider, row.editModel])));
    }).catch(() => undefined);
  }, []);

  async function save() {
    setSaving(true); setSaved(false);
    try {
      const response = await fetch("/api/ai/providers", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: active, enabled: enabled[active], baseUrl: baseUrls[active], apiKey: keys[active] || undefined, textModel: textModels[active] || "", imageModel: imageModels[active] || "", visionModel: visionModels[active] || "", editModel: editModels[active] || "", priority: providers.findIndex((item) => item.id === active) }) });
      if (!response.ok) throw new Error("save failed");
      const result = await response.json() as { hasApiKey: boolean };
      setStored((current) => ({ ...current, [active]: { provider: active, enabled: enabled[active], baseUrl: baseUrls[active], hasApiKey: result.hasApiKey, maskedKey: current[active]?.maskedKey || "Güvenle kaydedildi", textModel: textModels[active] || "", imageModel: imageModels[active] || "", visionModel: visionModels[active] || "", editModel: editModels[active] || "", priority: providers.findIndex((item) => item.id === active) } }));
      setKeys((current) => ({ ...current, [active]: "" })); setSaved(true);
    } catch { setTestResult({ ok: false, message: "Yapılandırma kaydedilemedi." }); }
    finally { setSaving(false); }
  }
  async function testConnection() {
    setTesting(true); setTestResult(null);
    try {
      const response = await fetch("/api/ai/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: active, baseUrl: baseUrls[active], apiKey: keys[active] || undefined }) });
      setTestResult(await response.json());
    } catch { setTestResult({ ok: false, message: "Test isteği tamamlanamadı." }); }
    finally { setTesting(false); }
  }

  return <div className="provider-settings">
    <aside className="provider-sidebar">
      <div><span>AYARLAR</span><h2>AI Sağlayıcıları</h2><p>Üretim servislerini bağlayın ve önceliklendirin.</p></div>
      <nav>{providers.map((item) => <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => { setActive(item.id); setSaved(false); setTestResult(null); }}><i style={{ background: item.color }}><Bot size={16} /></i><span><strong>{item.name}</strong><small>{stored[item.id]?.hasApiKey ? "Bağlı" : enabled[item.id] ? "Etkin" : "Yapılandırılmadı"}</small></span></button>)}</nav>
      <div className="security-note"><ShieldCheck size={18} /><span><strong>Anahtar güvenliği</strong><small>API anahtarları AES-256-GCM ile şifrelenerek sunucuda saklanır.</small></span></div>
    </aside>

    <section className="provider-card">
      <div className="provider-heading"><div className="provider-logo" style={{ background: provider.color }}><Sparkles size={20} /></div><div><h2>{provider.name}</h2><p>{provider.description}</p></div><label className="toggle"><input type="checkbox" checked={enabled[active]} onChange={(e) => setEnabled((current) => ({ ...current, [active]: e.target.checked }))} /><span /></label></div>
      <div className="provider-form">
        <label className="field-label full">Base URL<div className="input-with-icon"><Network size={16} /><input value={baseUrls[active]} onChange={(e) => setBaseUrls((current) => ({ ...current, [active]: e.target.value }))} placeholder="https://api.servisiniz.com/v1" /></div></label>
        <label className="field-label full">API anahtarı<div className="input-with-icon"><KeyRound size={16} /><input type={visible ? "text" : "password"} value={keys[active] || ""} onChange={(e) => setKeys((current) => ({ ...current, [active]: e.target.value }))} placeholder={stored[active]?.hasApiKey ? stored[active].maskedKey || "Kayıtlı anahtarı değiştirmek için yenisini girin" : "API anahtarını girin"} /><button type="button" onClick={() => setVisible(!visible)} aria-label="Anahtarı göster veya gizle">{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div><small className="field-note">{stored[active]?.hasApiKey ? "Anahtar şifreli olarak kayıtlı. Değiştirmek istemiyorsanız alanı boş bırakın." : "Anahtar tarayıcıda tutulmaz; kaydettiğinizde şifrelenerek sunucuya aktarılır."}</small></label>
        <label className="field-label">Varsayılan prompt modeli<input value={textModels[active] || ""} onChange={(e) => setTextModels((current) => ({ ...current, [active]: e.target.value }))} placeholder="Otomatik seç" /></label><label className="field-label">Varsayılan görsel modeli<input value={imageModels[active] || ""} onChange={(e) => setImageModels((current) => ({ ...current, [active]: e.target.value }))} placeholder="Otomatik seç" /></label>
        <label className="field-label">Görsel kontrol modeli<input value={visionModels[active] || ""} onChange={(e) => setVisionModels((current) => ({ ...current, [active]: e.target.value }))} placeholder="Boşsa prompt modeli" /></label><label className="field-label">Görsel düzeltme modeli<input value={editModels[active] || ""} onChange={(e) => setEditModels((current) => ({ ...current, [active]: e.target.value }))} placeholder="Boşsa görsel modeli" /></label>
        {active === "cliproxy" && <div className="capabilities full"><span><Check size={14} />Prompt</span><span><Check size={14} />Görsel</span><span><Check size={14} />Video</span></div>}
      </div>
      {testResult && <div className={`connection-result ${testResult.ok ? "success" : "error"}`}>{testResult.ok ? <Check size={16} /> : <CircleAlert size={16} />}<span><strong>{testResult.ok ? "Bağlantı başarılı" : "Bağlantı kurulamadı"}</strong><small>{testResult.message}{testResult.models?.length ? ` Örnekler: ${testResult.models.join(", ")}` : ""}</small></span></div>}
      <div className="provider-actions"><button className="button secondary" type="button" onClick={testConnection} disabled={testing}>{testing ? <LoaderCircle className="spin" size={16} /> : <Network size={16} />}{testing ? "Test ediliyor" : "Bağlantıyı test et"}</button><button className="button primary" type="button" onClick={save} disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : saved ? <Check size={16} /> : <Save size={16} />}{saving ? "Kaydediliyor" : saved ? "Kaydedildi" : "Yapılandırmayı kaydet"}</button></div>
    </section>
  </div>;
}
