"use client";

import { useEffect, useState } from "react";
import { Instagram, Youtube, Music2 } from "lucide-react";
import type { MusicProvider } from "@/lib/music-discovery";
import type { MusicProviderPublicConfig } from "@/lib/music-provider-settings";
import { connectMusicProvider, musicFormPayload, type MusicProviderForm } from "@/lib/music-provider-form";
import "./music-provider-settings.css";

const emptyForm: MusicProviderForm = { enabled: false, regionCode: "TR", clientId: "", clientSecret: "", apiKey: "", accessToken: "", userId: "" };

async function request<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, { method, cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json();
  if (response.status === 401) window.dispatchEvent(new Event("music-settings-locked"));
  if (!response.ok) throw new Error(result.message || result.error || "İstek tamamlanamadı. Lütfen tekrar deneyin.");
  return result as T;
}

function MusicProviderCard({ provider }: { provider: MusicProvider }) {
  const [config, setConfig] = useState<MusicProviderPublicConfig | null>(null);
  const [form, setForm] = useState<MusicProviderForm>(emptyForm);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState<{ error: boolean; message: string } | null>(null);
  const [redirectUri, setRedirectUri] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const youtube = provider === "youtube";
  const name = youtube ? "YouTube" : "Instagram";
  const endpoint = `/api/settings/music/${provider}`;

  function accept(value: MusicProviderPublicConfig) {
    setConfig(value);
    setForm({ ...emptyForm, enabled: value.enabled, regionCode: value.regionCode || "TR", clientId: value.clientId, userId: value.userId });
  }

  useEffect(() => {
    let cancelled = false;
    request<MusicProviderPublicConfig>(endpoint).then((value) => {
      if (cancelled) return;
      accept(value);
      setRedirectUri(value.redirectUri || `${window.location.origin}${endpoint}/oauth/callback`);
      const params = new URLSearchParams(window.location.search);
      if (params.get("provider") === provider && params.has("musicOAuth")) {
        const status = params.get("musicOAuth");
        setNotice({ error: status === "error", message: status === "connected" ? "Hesap bağlandı." : status === "select-account" ? "Erişilebilir Instagram hesabını seçin." : "Bağlantı tamamlanamadı. Uygulama izinlerini kontrol edip yeniden bağlayın." });
      }
    }).catch(() => { if (!cancelled) setNotice({ error: true, message: "Ayarlar yüklenemedi. Sayfayı yenileyin." }); }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [endpoint, provider]);

  async function save() {
    setBusy(true);
    setNotice(null);
    try {
      const value = await request<MusicProviderPublicConfig>(endpoint, "PUT", musicFormPayload(provider, form));
      accept(value);
      setNotice({ error: false, message: "Ayarlar güvenle kaydedildi." });
    } catch (error) { setNotice({ error: true, message: error instanceof Error ? error.message : "Ayarlar kaydedilemedi." }); }
    finally { setBusy(false); }
  }

  async function action(kind: "connect" | "test" | "disable" | "disconnect" | "remove" | "account" | "key") {
    const confirmations = { disconnect: "Hesap bağlantısı yerel olarak silinsin mi? Uygulama ayarları ve API anahtarı korunur. Sağlayıcı erişimini Google/Meta ayarlarından ayrıca kaldırabilirsiniz.", remove: "Bu sağlayıcının tüm müzik ayarları ve anahtarları kaldırılsın mı? Postiz hesapları etkilenmez.", key: "YouTube API anahtarı kaldırılsın mı?" };
    if ((kind === "disconnect" || kind === "remove" || kind === "key") && !window.confirm(confirmations[kind])) return;
    setBusy(true);
    setNotice(null);
    try {
      if (kind === "connect") {
        const url = await connectMusicProvider(provider, form, request);
        setForm((current) => ({ ...current, clientSecret: "", apiKey: "", accessToken: "" }));
        window.location.assign(url);
        return;
      }
      if (kind === "test") {
        accept(await request<MusicProviderPublicConfig>(endpoint, "PUT", musicFormPayload(provider, form)));
        const result = await request<{ ok: boolean; message: string }>(`${endpoint}/test`, "POST");
        setNotice({ error: !result.ok, message: result.message });
      } else {
        if (kind === "account") await request(`${endpoint}/accounts`, "POST", { userId: selectedAccount });
        else if (kind === "remove" || kind === "disconnect") await request(endpoint, "POST", { action: kind });
        else await request(endpoint, "PUT", kind === "disable" ? { enabled: false } : { clearFields: ["apiKey"] });
        accept(await request<MusicProviderPublicConfig>(endpoint));
        setNotice({ error: false, message: kind === "disconnect" ? "Yerel hesap bağlantısı silindi. Sağlayıcı iznini hesap ayarlarından kaldırabilirsiniz." : "Ayarlar güncellendi." });
      }
    } catch (error) { setNotice({ error: true, message: error instanceof Error ? error.message : "İşlem tamamlanamadı." }); }
    finally { setBusy(false); }
  }

  function field(key: keyof MusicProviderForm, label: string, secret = false, saved = "") {
    return <label className="field-label">{label}<input type={secret ? "password" : "text"} autoComplete="off" value={String(form[key])} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} placeholder={saved ? "Kayıtlı · değiştirmek için yenisini girin" : undefined} />{saved && <small className="music-field-note">{saved} · Boş bırakırsanız korunur.</small>}</label>;
  }

  return <article className="music-provider-card" aria-labelledby={`music-${provider}-title`} aria-busy={busy}>
    <header className="music-provider-heading"><span className={`music-provider-icon ${provider}`}>{youtube ? <Youtube size={21} /> : <Instagram size={21} />}</span><div><h3 id={`music-${provider}-title`}>{name}</h3><p>{youtube ? "Video keşfi · API anahtarı tek başına yeterli" : "Professional hesap · Audio API izinleri gerekli"}</p></div></header>
    <fieldset disabled={busy || !config} className="music-provider-fields">
      <label className="music-enabled"><input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />Müzik keşfi etkin</label>
      {youtube && field("apiKey", "YouTube API anahtarı", true, config?.hasApiKey ? config.maskedKey || "•••••••• kayıtlı" : "")}
      {field("regionCode", "Bölge kodu")}
      {field("clientId", youtube ? "Google Client ID" : "Meta App ID")}
      {field("clientSecret", youtube ? "Google Client Secret" : "Meta App Secret", true, config?.hasClientSecret ? "•••••••• kayıtlı" : "")}
      {!youtube && <details className="music-details"><summary>İleri seviye · manuel token</summary><div className="music-detail-fields">{field("accessToken", "User Access Token", true, config?.hasAccessToken ? config.maskedAccessToken || "•••••••• kayıtlı" : "")}{field("userId", "Instagram User ID")}</div></details>}
    </fieldset>
    {config && <div className="music-account-status"><strong>{config.status === "expired" ? "Süre doldu · yeniden bağlayın" : !config.enabled ? "Devre dışı" : config.hasAccessToken ? "Hesap bağlı" : config.hasApiKey ? "API anahtarı kayıtlı" : "Bağlı değil"}{config.source === "environment" ? " · ortamdan" : ""}</strong>{(config.accountName || config.userId) && <span>{config.accountName || "Instagram hesabı"}{config.userId ? ` · ID ${config.userId}` : ""}</span>}{config.expiresAt && <span>Token süre sonu: {new Date(config.expiresAt).toLocaleString("tr-TR")}</span>}<small>{youtube ? "Video keşfi; Shorts ses kataloğu veya ses indirme değildir." : "Token geçerliliği, Audio API katalog erişimini garanti etmez."}</small>{config.permissions.length > 0 && <small>Yetkiler: {config.permissions.join(", ")}</small>}</div>}
    {!youtube && !!config?.accountChoices.length && <div className="music-account-picker"><label className="field-label">Doğrulanmış Instagram hesabı<select value={selectedAccount || config.userId} disabled={busy} onChange={(event) => setSelectedAccount(event.target.value)}><option value="">Hesap seçin</option>{config.accountChoices.map((account) => <option key={account.userId} value={account.userId}>{account.accountName} · {account.userId}</option>)}</select></label><button type="button" className="button secondary" disabled={busy || !selectedAccount} onClick={() => action("account")}>Hesabı seç</button></div>}
    <details className="music-details"><summary>Kurulum rehberi</summary><div className="music-setup"><p>{youtube ? "Public keşif için Google Cloud projesinde YouTube Data API v3 etkinleştirin; API anahtarı kısıtlarını ve kotayı kontrol edin. Google hesabı bağlantısı isteğe bağlıdır." : "Facebook Login uyumlu Meta uygulaması oluşturun. Instagram professional hesabını bir Facebook Sayfasına bağlayın. Sayfa keşfi ve Instagram izinleri, uygulama incelemesi ve Audio API erişimi gerekir."}</p><p>{youtube ? "İsteğe bağlı Google bağlantısı için Web application OAuth Client ID ve Client Secret girin. Yalnız okuma/hesap tanımlama izinleri istenir." : "Meta App ID ve App Secret girin; Meta ile bağlanın ve sunucunun doğruladığı hesabı seçin."}</p><label className="field-label">OAuth callback URL<input readOnly value={redirectUri} aria-label={`${name} OAuth callback URL`} /></label><small>Bu adresi sağlayıcının izin verilen yönlendirme adreslerine aynen ekleyin. Token veya JSON dosyası yüklemeniz gerekmez.</small></div></details>
    {notice && <p role="status" aria-live="polite" className={`music-notice ${notice.error ? "error" : "success"}`}>{notice.message}</p>}
    <div className="music-actions"><button type="button" className="button primary" disabled={busy || !config} onClick={save}>{busy ? "İşlem sürüyor…" : "Kaydet"}</button><button type="button" className="button secondary" disabled={busy || !config} onClick={() => action("test")}>Bağlantıyı test et</button><button type="button" className="button secondary" disabled={busy || !config || !form.clientId.trim() || !(form.clientSecret.trim() || config.hasClientSecret)} onClick={() => action("connect")}>{config?.hasAccessToken ? "Yeniden bağla" : youtube ? "Google ile bağlan" : "Meta ile bağlan"}</button></div>
    <div className="music-lifecycle"><button type="button" disabled={busy || !config?.enabled} onClick={() => action("disable")}>Devre dışı bırak</button><button type="button" disabled={busy || !config?.hasAccessToken} onClick={() => action("disconnect")}>Bağlantıyı kes</button>{youtube && <button type="button" disabled={busy || !config?.hasApiKey} onClick={() => action("key")}>Anahtarı kaldır</button>}<button type="button" className="danger-text" disabled={busy || !config} onClick={() => action("remove")}>Tüm ayarları kaldır</button></div>
  </article>;
}

export function MusicProviderSettings() {
  const [authorized, setAuthorized] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [busy, setBusy] = useState(true);
  const [adminToken, setAdminToken] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    const lock = () => { setAuthorized(false); setAdminToken(""); setMessage("Oturum kapandı. Yeniden yönetici doğrulaması yapın."); };
    window.addEventListener("music-settings-locked", lock);
    request<{ authorized: boolean; configured?: boolean }>("/api/settings/music/session").then((value) => { if (!cancelled) { setAuthorized(value.authorized); setConfigured(value.configured !== false); } }).catch(() => { if (!cancelled) setMessage("Yönetici oturumu kontrol edilemedi."); }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; window.removeEventListener("music-settings-locked", lock); };
  }, []);
  async function session(method: "POST" | "DELETE") {
    setBusy(true);
    setMessage("");
    const token = adminToken;
    setAdminToken("");
    try {
      const value = await request<{ authorized: boolean }>("/api/settings/music/session", method, method === "POST" ? { token } : undefined);
      setAuthorized(method === "DELETE" ? false : value.authorized);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Yönetici doğrulaması başarısız."); }
    finally { setBusy(false); }
  }
  return <section className="music-provider-settings" aria-labelledby="music-settings-title"><div className="music-section-heading"><Music2 size={20} /><div><h2 id="music-settings-title">Müzik Kaynakları</h2><p>Keşif bağlantıları Postiz yayın hesaplarından bağımsızdır.</p></div>{authorized && <button type="button" className="button secondary" disabled={busy} onClick={() => session("DELETE")}>Kilitle</button>}</div>{message && <p role="status" className="music-notice error">{message}</p>}{authorized ? <div className="music-provider-grid"><MusicProviderCard provider="youtube" /><MusicProviderCard provider="instagram" /></div> : <form className="music-provider-unlock music-unlock" onSubmit={(event) => { event.preventDefault(); void session("POST"); }}><h3>Yönetici doğrulaması</h3><p>Müzik anahtarlarını yönetmek için yönetici anahtarı ile güvenli oturum açın. AI ve Postiz ayarları etkilenmez.</p>{!configured && <p role="status">Sunucuda MUSIC_SETTINGS_ADMIN_TOKEN veya SYSTEM_UPDATE_TOKEN yapılandırılmalı.</p>}<label className="field-label">Yönetici anahtarı<input type="password" autoComplete="off" value={adminToken} onChange={(event) => setAdminToken(event.target.value)} disabled={busy || !configured} /></label><button type="submit" className="button primary" disabled={busy || !configured || !adminToken.trim()}>{busy ? "Kontrol ediliyor…" : "Kilidi aç"}</button></form>}</section>;
}
