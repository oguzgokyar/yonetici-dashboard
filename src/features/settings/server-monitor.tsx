"use client";
import { useEffect, useState } from "react";
import { Server, Sparkles, RefreshCw, Trash2, Cpu, HardDrive, CheckCircle2, AlertTriangle, Activity } from "lucide-react";
import type { Metrics, HostMonitorJob } from "@/lib/server/server-monitor";
import type { MonitorJob } from "@/lib/server/server-monitor-jobs";
import { startVisiblePolling } from "./server-monitor-polling";
import "./server-monitor.css";
type Status = { local: Metrics | null; host: { state: string; metrics: Metrics | null; jobs: HostMonitorJob[]; jobsAvailable: boolean }; production: { jobs: MonitorJob[]; total: number; hasMore: boolean } | null };
const labels: Record<string, string> = { canva: "Canva", image: "AI Görsel", video: "Video", "video-layer": "Video Katmanı", other: "Diğer", queued: "Sırada", dispatching: "Gönderiliyor", running: "Çalışıyor", rendering: "İşleniyor", exporting: "Dışa aktarılıyor", uploading: "Yükleniyor", video_exporting: "Video dışa aktarılıyor", complete: "Tamamlandı", failed: "Başarısız" };
const bytes = (n: number | null | undefined) => n == null ? "—" : `${(n / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MiB`;

export function ServerMonitor() {
  const [status, setStatus] = useState<Status | null>(null), [error, setError] = useState("");
  const [locked, setLocked] = useState(false), [token, setToken] = useState(""), [session, setSession] = useState(0);
  const [view, setView] = useState("active"), [offset, setOffset] = useState(0), [now, setNow] = useState(0);
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (locked) return;
    return startVisiblePolling(async signal => {
      try {
        const response = await fetch(`/api/system/server-status?view=${view}&offset=${offset}`, { cache: "no-store", signal });
        if (response.status === 401) { setLocked(true); setStatus(null); return; }
        if (!response.ok) throw new Error();
        const data = await response.json(); if (!data.ok) throw new Error();
        if (!signal.aborted) { setStatus(data); setError(""); setNow(Date.now()); }
      } catch { if (!signal.aborted) { setError("Ölçüm alınamadı; önceki değerler güncel olmayabilir."); setNow(Date.now()); } }
    }, { isVisible: () => document.visibilityState === "visible", subscribe: fn => { document.addEventListener("visibilitychange", fn); return () => document.removeEventListener("visibilitychange", fn); }, schedule: fn => window.setTimeout(fn, 5000), cancel: id => window.clearTimeout(id) });
  }, [view, offset, locked, session]);

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch("/api/system/server-status/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      if (!response.ok) throw new Error();
      setToken(""); setError(""); setLocked(false); setSession(n => n + 1);
    } catch { setError("Yönetici anahtarı doğrulanamadı veya deneme sınırına ulaşıldı."); }
  }

  async function triggerCleanup() {
    setCleaning(true);
    setCleanResult(null);
    try {
      const res = await fetch("/api/system/server-cleanup", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setCleanResult({ ok: true, message: data.message || "Sistem ve bellek başarıyla temizlendi." });
        setSession(s => s + 1);
      } else {
        throw new Error(data.message || "Temizleme yapılamadı.");
      }
    } catch (err) {
      setCleanResult({ ok: false, message: err instanceof Error ? err.message : "Temizleme hatası oluştu." });
    } finally {
      setCleaning(false);
    }
  }

  const metrics = status?.host.metrics || status?.local;
  const stale = metrics && now - Date.parse(metrics.sampledAt) > 15000;
  const isHighLoad = (metrics?.cpuPercent != null && metrics.cpuPercent > 70) || (metrics?.memory && (metrics.memory.usedBytes / metrics.memory.totalBytes) > 0.85);

  return <section className="update-card server-monitor">
    <div className="update-heading"><span><Server size={22} /></span><div><h2>Sunucu &amp; Sistem Sağlığı</h2><p>Canlı donanım kaynakları, bellek yönetimi ve üretim kuyruğu</p></div></div>
    {locked ? <form onSubmit={unlock}><label className="update-token">Yönetici izleme anahtarı<input type="password" value={token} onChange={e => setToken(e.target.value)} autoComplete="off" required /><small>SERVER_MONITOR_ADMIN_TOKEN veya SYSTEM_UPDATE_TOKEN. Anahtar kaydedilmez.</small></label><button className="button secondary" type="submit">Doğrula</button></form> : <>
      {!status && !error && <p role="status">Ölçümler yükleniyor…</p>}

      {/* CANLI SAĞLIK & MANUEL TEMİZLEME KONTROL PANELİ */}
      <div style={{
        marginTop: "16px",
        padding: "16px",
        background: isHighLoad ? "#fff5f5" : "#fbfbfe",
        border: `1px solid ${isHighLoad ? "#fecaca" : "#e0e2ec"}`,
        borderRadius: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "20px",
              fontSize: "11px",
              fontWeight: 700,
              background: isHighLoad ? "#fee2e2" : "#dcfce7",
              color: isHighLoad ? "#dc2626" : "#16a34a",
            }}>
              {isHighLoad ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
              {isHighLoad ? "Yüksek Yük / Bellek Baskısı" : "Sistem Sağlıklı"}
            </span>
            <small style={{ fontSize: "11px", color: "var(--muted)" }}>
              2 vCPU • 3.6 GB RAM • Otomatik Zombi Temizliği Aktif
            </small>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              disabled={cleaning}
              onClick={triggerCleanup}
              className="button compact primary"
              style={{ fontSize: "12px", height: "32px", display: "inline-flex", alignItems: "center", gap: "6px", padding: "0 12px" }}
              title="Arka planda askıda kalan zombi sekmeleri ve gereksiz bellek artıklarını temizler"
            >
              <Trash2 size={14} className={cleaning ? "spin" : ""} />
              <span>{cleaning ? "Temizleniyor..." : "Sistemi & Belleği Rahatlat"}</span>
            </button>
            <button
              type="button"
              onClick={() => setSession(s => s + 1)}
              className="button compact ghost"
              style={{ fontSize: "12px", height: "32px", display: "inline-flex", alignItems: "center", gap: "4px" }}
              title="Metrikleri yenile"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {cleanResult && (
          <div style={{
            padding: "8px 12px",
            borderRadius: "8px",
            fontSize: "11.5px",
            fontWeight: 600,
            background: cleanResult.ok ? "#ecfdf5" : "#fef2f2",
            color: cleanResult.ok ? "#065f46" : "#991b1b",
            border: `1px solid ${cleanResult.ok ? "#a7f3d0" : "#fecaca"}`,
          }}>
            {cleanResult.message}
          </div>
        )}
      </div>

      <p className="server-scope" style={{ marginTop: "12px" }}>{metrics?.scope === "host" ? "Host kaynağı" : "Yerel /proc görünümü (namespace / ortak kernel)"} {status?.host.state === "unconfigured" ? "Host bağlantısı yapılandırılmadı." : status?.host.state === "unavailable" ? "Host bağlantısı kullanılamıyor." : status?.host.metrics?.scope === "local-proc" ? "Uzak kaynak da namespace ile sınırlı; host olarak gösterilmez." : ""}</p>
      {(stale || status?.host.state === "stale") && <p role="status">Ölçüm eski; canlı değer olarak değerlendirmeyin.</p>}
      <div className="server-metrics">
        <div><small>CPU • Kullanım</small><strong>{metrics?.cpuPercent == null ? "—" : `%${metrics.cpuPercent.toFixed(1)}`}</strong></div>
        <div><small>RAM • Kullanılan / Toplam</small><strong>{bytes(metrics?.memory.usedBytes)} / {bytes(metrics?.memory.totalBytes)}</strong></div>
        <div><small>Swap • Kullanılan / Toplam</small><strong>{bytes(metrics?.swap.usedBytes)} / {bytes(metrics?.swap.totalBytes)}</strong><small>Giriş {bytes(metrics?.swap.inBytesPerSecond)}/s · Çıkış {bytes(metrics?.swap.outBytesPerSecond)}/s</small></div>
      </div>
      <p className="server-note">Son ölçüm: {metrics ? new Date(metrics.sampledAt).toLocaleTimeString("tr-TR") : "Kullanılamıyor"}</p>
      <div className="server-filters" aria-label="Üretim işi filtreleri">{[["active", "Aktif"], ["queued", "Sırada"], ["history", "Geçmiş"]].map(([key, label]) => <button className={`button ${view === key ? "primary" : "secondary"}`} aria-pressed={view === key} key={key} onClick={() => { setView(key); setOffset(0); setStatus(s => s ? { ...s, production: null } : s); }}>{label}</button>)}</div>
      <p className="server-note">Mevcut üretim kuyruğu · {status?.production?.total ?? "—"} kayıt.</p>
      <div className="server-jobs">{status?.production ? status.production.jobs.length ? status.production.jobs.map(job => <article key={job.id}><div><strong>{labels[job.type]} · {labels[job.status] || "Diğer"}</strong><small>Üretim · Proje {job.projectId} · İş {job.id}</small></div><span>{job.progressPercent == null ? "İlerleme yok" : `%${job.progressPercent}`} · {Math.max(0, Math.floor(((job.completedAt ? Date.parse(job.completedAt) : now) - Date.parse(job.createdAt)) / 60000))} dk</span><small>{job.status === "queued" ? "FIFO kuyruğunda bekliyor" : job.stale ? "İlerleme sinyali eski / yok" : job.heartbeat ? `Son ilerleme: ${new Date(job.heartbeat).toLocaleTimeString("tr-TR")}` : "Heartbeat kaydı yok"}</small></article>) : <p>Bu filtrede kayıt yok.</p> : <p>İş kayıtları kullanılamıyor / yükleniyor.</p>}</div>
      <div className="server-jobs">{status?.host.jobsAvailable ? status.host.jobs.filter(job => view === "queued" ? job.status === "queued" : view === "history" ? ["complete", "failed", "released"].includes(job.status) : ["starting", "running"].includes(job.status)).map(job => <article key={`host-${job.id}`}><div><strong>{job.service === "seo" ? "SEO" : job.service === "canva" ? "Canva" : "Diğer"} · {labels[job.status] || (job.status === "starting" ? "Başlıyor" : "Rezervasyon bırakıldı")}</strong><small>Koordinatör · {job.id}</small></div><span>{job.progressPercent == null ? "İlerleme yok" : `%${job.progressPercent}`}</span><small>Gerçek başlangıç: {job.startedAt ? new Date(job.startedAt).toLocaleString("tr-TR") : "Kayıt yok"} · {job.heartbeat ? `Son sinyal: ${new Date(job.heartbeat).toLocaleString("tr-TR")}` : "Heartbeat yok"}</small></article>) : <p className="server-note">Koordinatör SEO / Canva iş kayıtları kullanılamıyor.</p>}</div>
      <div className="server-filters"><button className="button secondary" disabled={offset === 0} onClick={() => setOffset(n => Math.max(0, n - 25))}>Önceki</button><button className="button secondary" disabled={!status?.production?.hasMore} onClick={() => setOffset(n => n + 25)}>Sonraki</button></div>
      <details className="server-processes"><summary>Görünür süreçler · en yüksek RSS (en fazla 12)</summary><p className="server-note">RSS ortak belleği çift sayabilir; PSS / süreç ağacı ölçülmüyor.</p>{metrics?.processes.map(p => <div key={p.pid}><span>PID {p.pid} · {p.category}</span><strong>{bytes(p.rssBytes)}</strong></div>) || <p>Süreç ölçümü kullanılamıyor.</p>}</details>
    </>}
    {error && <p className="connection-result error" role="alert">{error}</p>}
  </section>;
}
