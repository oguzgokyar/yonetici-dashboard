"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { Check, ExternalLink, Info, LoaderCircle, Music, Pause, Play, Plus, X } from "lucide-react";
import type { MusicSelection } from "@/lib/music-discovery";
import { createMusicPickerState, reduceMusicPicker } from "@/lib/music-picker-state";
import { musicSearchNotice, presentMusicTrack } from "@/lib/music-modal-presentation";
import "./music-discovery-modal.css";

export function MusicDiscoveryModal({ projectId, onSelect, onClose }: {
  projectId: string;
  onSelect: (selection: MusicSelection) => void;
  onClose: () => void;
}) {
  const [state, dispatch] = useReducer(reduceMusicPicker, undefined, createMusicPickerState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showSettings, setShowSettings] = useState(false);
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
      setShowSettings(false);
      try {
        const params = new URLSearchParams({ provider: state.provider, query: state.query });
        const response = await fetch(`/api/projects/${projectId}/music/search?${params}`, { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error("Müzik araması başarısız. Tekrar deneyin.");
        if (controller.signal.aborted) return;
        dispatch({ type: "results", provider: state.provider, query: state.query, items: data.items || [] });
        const notice = musicSearchNotice(state.provider, data);
        setMessage(notice.text);
        setShowSettings(notice.settings);
      } catch {
        if (!controller.signal.aborted) setMessage("Müzik araması başarısız. Tekrar deneyin.");
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
      <div className="music-discovery-results" aria-busy={loading}>
        {loading && <p role="status"><LoaderCircle size={16} className="spin" /> Müzikler aranıyor…</p>}
        {message && <p role="status" className="music-discovery-notice">{message}{showSettings && <> · <a href="/settings?tab=api">Ayarlara git</a></>}</p>}
        {!loading && !message && state.items.length === 0 && <p>Bu aramada sonuç bulunamadı.</p>}
        {!loading && state.items.map((item, index) => {
          const presentation = presentMusicTrack(item);
          const reasonId = `music-unavailable-${index}`;
          return <article className={`music-discovery-item ${state.selectedId === item.id ? "selected" : ""}`} key={`${item.provider}:${item.id}`}>
            <button type="button" className="music-row-icon" disabled={!item.previewUrl} aria-label={`${state.previewId === item.id ? "Durdur" : "Dinle"}: ${presentation.title}`} aria-pressed={state.previewId === item.id} onClick={() => { audioRef.current?.pause(); dispatch({ type: "preview", id: state.previewId === item.id ? "" : item.id }); }}>{state.previewId === item.id ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}</button>
            <span className="music-track-title" title={presentation.title}>{presentation.title}</span>
            <span className="music-track-duration" aria-label={`Süre: ${presentation.duration}`}>{presentation.duration}</span>
            <span className="music-track-source" title={`${presentation.sourceName}${presentation.trending ? " · Kaynakta trend" : ""}`} aria-label={`${presentation.sourceName}${presentation.trending ? " · Kaynakta trend" : ""}`}>{presentation.sourceLabel}{presentation.trending ? " ↑" : ""}</span>
            <a className="music-row-icon" href={item.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`Kaynakta dinle: ${presentation.title}`}><ExternalLink size={16} aria-hidden="true" /></a>
            <span className="music-track-selection">
              <button type="button" className="music-row-icon" disabled={!item.canEmbed} aria-label={`Seç: ${presentation.title}`} aria-pressed={state.selectedId === item.id} aria-describedby={presentation.unavailableReason ? reasonId : undefined} onClick={() => { dispatch({ type: "select", id: item.id }); audioRef.current?.pause(); dispatch({ type: "preview", id: item.id }); }}>{state.selectedId === item.id ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}</button>
              {presentation.unavailableReason && <><button type="button" className="music-row-icon music-track-info" aria-label={`Neden seçilemiyor: ${presentation.title}`} aria-describedby={reasonId}><Info size={16} aria-hidden="true" /></button><span id={reasonId} className="music-track-tooltip" role="tooltip">{presentation.unavailableReason}</span></>}
            </span>
          </article>;
        })}
      </div>
      {preview?.previewUrl && <audio key={`${preview.provider}:${preview.id}`} ref={audioRef} src={preview.previewUrl} controls autoPlay aria-label={`Önizleme: ${preview.title}`} onEnded={stopPreview} onLoadedMetadata={(event) => { const duration = event.currentTarget.duration; if (Number.isFinite(duration) && duration > 0) setAudioDurations((current) => ({ ...current, [preview.id]: duration })); }} onError={() => { setShowSettings(false); setMessage("Önizleme açılamadı. Kaynakta dinleyin."); }} />}
      {selected && <div className="music-offset-control"><strong title={selected.title}>{selected.title}</strong><label>Müzik başlangıcı: {state.offsetSeconds.toFixed(1)} sn<input type="range" min={0} max={Math.max(0, (audioDurations[selected.id] || selected.durationSeconds || 0) - 0.1)} step={0.1} value={state.offsetSeconds} onChange={(event) => { const seconds = Number(event.target.value); dispatch({ type: "offset", seconds }); if (audioRef.current && preview?.id === selected.id) audioRef.current.currentTime = seconds; }} /></label></div>}
      <div className="music-discovery-footer"><button type="button" className="button secondary" onClick={onClose}>İptal</button><button type="button" className="button primary" disabled={!selected?.canEmbed} onClick={() => { if (selected?.canEmbed) { stopPreview(); onSelect({ track: selected, offsetSeconds: state.offsetSeconds }); } }}>Videoya ekle</button></div>
    </div>
  </div>;
}
