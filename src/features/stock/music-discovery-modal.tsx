"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { ExternalLink, LoaderCircle, Music, X } from "lucide-react";
import type { MusicSelection } from "@/lib/music-discovery";
import { createMusicPickerState, reduceMusicPicker } from "@/lib/music-picker-state";

export function MusicDiscoveryModal({ projectId, onSelect, onClose }: {
  projectId: string;
  onSelect: (selection: MusicSelection) => void;
  onClose: () => void;
}) {
  const [state, dispatch] = useReducer(reduceMusicPicker, undefined, createMusicPickerState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const selected = state.items.find((item) => item.id === state.selectedId);
  const preview = state.items.find((item) => item.id === state.previewId);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setMessage("");
      try {
        const params = new URLSearchParams({ provider: state.provider, query: state.query });
        const response = await fetch(`/api/projects/${projectId}/music/search?${params}`, { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Müzik araması tamamlanamadı.");
        if (controller.signal.aborted) return;
        dispatch({ type: "results", provider: state.provider, query: state.query, items: data.items || [] });
        setMessage(data.message || "");
      } catch (error) {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Müzik kaynağına erişilemiyor.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [projectId, state.provider, state.query]);

  function stopPreview() { audioRef.current?.pause(); dispatch({ type: "preview", id: "" }); }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} className="surface-modal music-discovery-dialog" role="dialog" aria-modal="true" aria-labelledby="music-discovery-title" tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.stopPropagation(); onClose(); }
        if (event.key === "Tab") {
          const nodes = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href], audio[controls], [tabindex="0"]');
          if (!nodes?.length) return;
          const first = nodes[0], last = nodes[nodes.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }}>
      <div className="drive-dialog-header"><div><span>ARŞİVSİZ MÜZİK KEŞFİ</span><h3 id="music-discovery-title"><Music size={18} /> Videoya müzik ekle</h3></div><button type="button" className="icon-button" aria-label="Kapat" onClick={onClose}><X size={18} /></button></div>
      <div className="segmented-filter" role="tablist" aria-label="Müzik kaynağı">
        {(["instagram", "youtube"] as const).map((provider) => <button key={provider} type="button" role="tab" aria-selected={state.provider === provider} className={state.provider === provider ? "active" : ""} onClick={() => { stopPreview(); dispatch({ type: "provider", provider }); }}>{provider === "instagram" ? "Instagram" : "YouTube"}</button>)}
      </div>
      <label className="music-search-label">Şarkı, sanatçı veya içerik etiketi<input type="search" maxLength={120} autoComplete="off" placeholder="Örn. dekorasyon, sakin, enerjik…" value={state.query} onChange={(event) => { stopPreview(); dispatch({ type: "query", query: event.target.value }); }} /></label>
      <p className="music-discovery-note">Yalnız seçilen, kullanım hakkı doğrulanmış ses render sırasında geçici alınır ve silinir. Platform önizlemesi, MP4’e gömme izni değildir.</p>
      <div className="music-discovery-results" aria-busy={loading}>
        {loading && <p role="status"><LoaderCircle size={16} className="spin" /> Müzikler aranıyor…</p>}
        {message && <p role="status" className="music-discovery-notice">{message}</p>}
        {!loading && !message && state.items.length === 0 && <p>Bu aramada sonuç bulunamadı.</p>}
        {!loading && state.items.map((item) => <article className={`music-discovery-item ${state.selectedId === item.id ? "selected" : ""}`} key={`${item.provider}:${item.id}`}>
          <div><strong>{item.title}</strong><small>{item.artist}{item.durationSeconds != null ? ` · ${Math.round(item.durationSeconds)} sn` : ""}</small><span className="stock-badge-selected">{item.sourceKind === "licensed-alternative" ? "Ücretsiz lisanslı alternatif · Trend değil" : item.isTrending ? "Kaynakta trend" : "Arama / keşif sonucu"}</span><p>{item.embedReason}</p></div>
          <div className="music-discovery-actions">
            {item.previewUrl && <button type="button" className="button secondary" onClick={() => { audioRef.current?.pause(); dispatch({ type: "preview", id: state.previewId === item.id ? "" : item.id }); }}> {state.previewId === item.id ? "Durdur" : "Dinle"}</button>}
            <a className="button secondary" href={item.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> Kaynakta dinle</a>
            <button type="button" className="button secondary" disabled={!item.canEmbed} title={item.embedReason} onClick={() => { dispatch({ type: "select", id: item.id }); audioRef.current?.pause(); dispatch({ type: "preview", id: item.id }); }}>Seç</button>
          </div>
        </article>)}
      </div>
      {preview?.previewUrl && <audio key={`${preview.provider}:${preview.id}`} ref={audioRef} src={preview.previewUrl} controls autoPlay onLoadedMetadata={(event) => { const duration = event.currentTarget.duration; if (Number.isFinite(duration) && duration > 0) setAudioDurations((current) => ({ ...current, [preview.id]: duration })); }} onError={() => setMessage("Ses önizlemesi açılamadı veya bağlantının süresi doldu. Kaynakta dinleyebilirsiniz.")} />}
      {selected && <div className="music-offset-control"><strong>{selected.title}</strong><label>Müzik başlangıcı: {state.offsetSeconds.toFixed(1)} sn<input type="range" min={0} max={Math.max(0, (audioDurations[selected.id] || selected.durationSeconds || 0) - 0.1)} step={0.1} value={state.offsetSeconds} onChange={(event) => { const seconds = Number(event.target.value); dispatch({ type: "offset", seconds }); if (audioRef.current && preview?.id === selected.id) audioRef.current.currentTime = seconds; }} /></label><small>Outro dahil video boyunca çalar; kısa kalırsa izin verilen ses tekrar edilir.</small>{selected.attribution && <small>Yayın açıklamasına otomatik kredi eklenecek: {selected.attribution}</small>}</div>}
      <div className="music-discovery-footer"><button type="button" className="button secondary" onClick={onClose}>İptal</button><button type="button" className="button primary" disabled={!selected?.canEmbed} onClick={() => { if (selected?.canEmbed) { stopPreview(); onSelect({ track: selected, offsetSeconds: state.offsetSeconds }); } }}>Videoya ekle</button></div>
    </div>
  </div>;
}
