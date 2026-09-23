"use client";

import { Check, Film, LoaderCircle, Trash2, Upload, X } from "lucide-react";
import type { ChangeEvent } from "react";
import type { OutroItem } from "./types";

export function OutroLibraryModal({
  outros,
  selectedOutroId,
  uploading,
  onSelect,
  onUpload,
  onDelete,
  onClose,
}: {
  outros: OutroItem[];
  selectedOutroId: string;
  uploading: boolean;
  onSelect: (id: string) => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="surface-modal outro-library-dialog">
        <div className="drive-dialog-header">
          <div><span>VİDEO SONU</span><h3>Outro Kütüphanesi</h3></div>
          <button type="button" className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="outro-library-toolbar">
          <p>Bu projede daha önce yüklenen outro videolarından birini seçin veya yeni bir video yükleyin.</p>
          <label className="button secondary">
            {uploading ? <LoaderCircle className="spin" size={14} /> : <Upload size={14} />}
            {uploading ? "Yükleniyor" : "Yeni outro yükle"}
            <input type="file" accept="video/mp4,video/quicktime,video/webm" hidden disabled={uploading} onChange={onUpload} />
          </label>
        </div>

        <div className="outro-library-grid">
          <button type="button" className={`outro-library-card none ${!selectedOutroId ? "selected" : ""}`} onClick={() => onSelect("")}>
            <span className="outro-library-preview"><X size={25} /></span>
            <span><strong>Outro kullanma</strong><small>Video ana içerikten sonra biter.</small></span>
            {!selectedOutroId && <Check className="outro-selected-check" size={17} />}
          </button>

          {outros.map((outro) => (
            <div key={outro.id} className={`outro-library-card ${selectedOutroId === outro.id ? "selected" : ""}`}>
              <button type="button" className="outro-card-main" onClick={() => onSelect(outro.id)}>
                <span className="outro-library-preview"><video src={outro.videoUrl} preload="metadata" muted /></span>
                <span><strong title={outro.title}>{outro.title}</strong><small>{outro.durationSeconds ? `${Math.round(outro.durationSeconds)} sn` : "Outro videosu"}</small></span>
                {selectedOutroId === outro.id && <Check className="outro-selected-check" size={17} />}
              </button>
              <button type="button" className="outro-card-delete" title="Outro'yu sil" onClick={() => onDelete(outro.id)}><Trash2 size={14} /></button>
            </div>
          ))}

          {!outros.length && (
            <div className="outro-library-empty"><Film size={28} /><strong>Henüz outro yüklenmedi</strong><span>İlk outro videonuzu üstteki düğmeden yükleyebilirsiniz.</span></div>
          )}
        </div>

        <div className="outro-library-footer">
          <span>{selectedOutroId ? "Seçili outro videoya eklenecek." : "Video outrosuz üretilecek."}</span>
          <button type="button" className="button primary" onClick={onClose}>Seçimi uygula</button>
        </div>
      </div>
    </div>
  );
}
