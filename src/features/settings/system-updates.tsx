"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, CloudDownload, GitBranch, Github, LoaderCircle, RefreshCw, Server } from "lucide-react";

type Status = {
  mode: "local-git" | "coolify";
  repositoryReady: boolean; remoteUrl: string; branch: string; currentCommit: string; currentMessage: string;
  latestCommit: string; latestMessage: string; behind: number; ahead: number; updateAvailable: boolean; dirty: boolean; restartRequired?: boolean; deploymentQueued?: boolean;
};

export function SystemUpdates() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<"loading" | "check" | "update" | null>("loading");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [adminToken, setAdminToken] = useState("");

  useEffect(() => {
    fetch("/api/system/updates").then((response) => response.json()).then((data) => {
      if (data.ok) setStatus(data.status); else setResult({ ok: false, message: data.message });
    }).catch(() => setResult({ ok: false, message: "Sürüm bilgisi okunamadı." })).finally(() => setBusy(null));
  }, []);

  async function run(action: "check" | "update") {
    setBusy(action); setResult(null);
    try {
      const response = await fetch("/api/system/updates", { method: "POST", headers: { "Content-Type": "application/json", ...(adminToken ? { "x-update-token": adminToken } : {}) }, body: JSON.stringify({ action }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || "İşlem tamamlanamadı.");
      setStatus(data.status);
      setResult({ ok: true, message: action === "check" ? (data.status.updateAvailable ? `${data.status.behind} yeni değişiklik bulundu.` : "Bu kurulum güncel.") : (data.status.deploymentQueued ? "Yeni sürüm Coolify dağıtım kuyruğuna alındı. Mevcut sürüm, yenisi sağlıklı başlayana kadar çalışmaya devam eder." : data.status.restartRequired ? "Güncelleme kuruldu. Yeni sürümün açılması için uygulamayı yeniden başlatın." : "Bu kurulum zaten güncel.") });
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : "İşlem tamamlanamadı." });
    } finally { setBusy(null); }
  }

  const blocked = !status?.repositoryReady || !status.remoteUrl || status.branch !== "main" || status.dirty || status.ahead > 0;
  return <section className="update-card">
    <div className="update-heading"><span><Github size={22} /></span><div><h2>GitHub güncellemeleri</h2><p>{status?.mode === "coolify" ? "GitHub main sürümünü kontrol edin ve güvenli Coolify dağıtımını başlatın." : "Sunucudaki kararlı sürümü yalnızca siz istediğinizde kontrol edin ve güncelleyin."}</p></div></div>
    {busy === "loading" ? <div className="update-loading"><LoaderCircle className="spin" size={18} /> Sürüm bilgisi okunuyor</div> : <>
      <div className="version-grid">
        <div><span><Server size={15} /> Çalışan sürüm</span><strong>{status?.currentCommit || "—"}</strong><small>{status?.currentMessage || "Git deposu bekleniyor"}</small></div>
        <div><span><CloudDownload size={15} /> GitHub / main</span><strong>{status?.latestCommit || "Henüz kontrol edilmedi"}</strong><small>{status?.latestMessage || "Kontrol ederek son sürümü alın"}</small></div>
      </div>
      <div className="repository-line"><GitBranch size={15} /><span><strong>{status?.branch || "Bağlı değil"}</strong><small>{status?.remoteUrl || "GitHub origin adresi bulunamadı"}</small></span>{status?.updateAvailable ? <b className="status-badge update">{status.behind} güncelleme</b> : status?.repositoryReady && status.latestCommit ? <b className="status-badge current"><Check size={12} /> Güncel</b> : null}</div>
      <label className="update-token">Yönetici güncelleme anahtarı<input type="password" value={adminToken} onChange={(event) => setAdminToken(event.target.value)} placeholder="Üretim sunucusunda zorunlu" autoComplete="off" /><small>Bu değer kaydedilmez; yalnızca bu güncelleme isteğiyle sunucuya gönderilir.</small></label>
      {(status?.dirty || (status?.ahead ?? 0) > 0) && <div className="update-warning"><AlertTriangle size={16} /><span>{status?.dirty ? "Sunucuda yerel dosya değişiklikleri var. Güncellemeden önce bunları temizleyin." : "Sunucu dalı GitHub'dan ileride; otomatik güncelleme güvenlik için kapalı."}</span></div>}
      {result && <div className={`connection-result ${result.ok ? "success" : "error"}`}>{result.ok ? <Check size={16} /> : <AlertTriangle size={16} />}<span><strong>{result.ok ? "İşlem tamamlandı" : "İşlem durduruldu"}</strong><small>{result.message}</small></span></div>}
      <div className="update-actions"><button className="button secondary" onClick={() => run("check")} disabled={Boolean(busy) || !status?.repositoryReady || !status.remoteUrl}>{busy === "check" ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}{busy === "check" ? "Kontrol ediliyor" : "Güncellemeleri kontrol et"}</button><button className="button primary" onClick={() => run("update")} disabled={Boolean(busy) || blocked || !status?.updateAvailable}>{busy === "update" ? <LoaderCircle className="spin" size={16} /> : <CloudDownload size={16} />}{busy === "update" ? "Güncelleniyor" : "Kararlı sürüme güncelle"}</button></div>
    </>}
  </section>;
}
