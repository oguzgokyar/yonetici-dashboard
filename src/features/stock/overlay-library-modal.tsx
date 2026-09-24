"use client";

import { Check, Image as ImageIcon, LoaderCircle, Trash2, Upload, X } from "lucide-react";
import type { ChangeEvent } from "react";
import type { OverlayItem } from "./types";

export function OverlayLibraryModal({
  overlays,
  selectedOverlayId,
  uploading,
  onSelect,
  onUpload,
  onDelete,
  onClose,
}: {
  overlays: OverlayItem[];
  selectedOverlayId: string;
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
          <div>
            <span>ÇERÇEVE KATMANI</span>
            <h3>Özel Çerçeve (PNG / WebP) Kütüphanesi</h3>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="outro-library-toolbar">
          <div>
            <p>
              1080×1920 çözünürlüğünde şeffaf PNG veya WebP çerçeve şablonlarınızı yükleyin. Seçilen şablon videonun üzerine en üst katman olarak tam ekran giydirilir.
            </p>
          </div>
          <label className="button primary stock-upload-btn">
            {uploading ? (
              <LoaderCircle className="spin" size={14} />
            ) : (
              <Upload size={14} />
            )}
            <span>Yeni Çerçeve Yükle</span>
            <input
              type="file"
              accept="image/png,image/webp"
              onChange={onUpload}
              disabled={uploading}
              hidden
            />
          </label>
        </div>

        <div className="outro-library-grid">
          {/* Option: No custom overlay */}
          <div
            className={`outro-library-card none ${!selectedOverlayId ? "selected" : ""}`}
            onClick={() => onSelect("")}
          >
            <div className="outro-library-preview" style={{ background: "#222" }}>
              <ImageIcon size={22} />
            </div>
            <span>
              <strong>Özel Çerçeve Yok</strong>
              <small>Yalnızca seçilen stil kullanılır</small>
            </span>
            {!selectedOverlayId && <Check className="outro-selected-check" size={18} />}
          </div>

          {overlays.map((overlay) => {
            const isSelected = selectedOverlayId === overlay.id;
            return (
              <div
                key={overlay.id}
                className={`outro-library-card ${isSelected ? "selected" : ""}`}
              >
                <button
                  type="button"
                  className="outro-card-main"
                  onClick={() => onSelect(overlay.id)}
                >
                  <div className="outro-library-preview" style={{ background: "#0a0c14" }}>
                    <img
                      src={overlay.imageUrl}
                      alt={overlay.title}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  </div>
                  <span>
                    <strong>{overlay.title}</strong>
                    <small>1080 × 1920 Şeffaf Katman</small>
                  </span>
                  {isSelected && <Check className="outro-selected-check" size={18} />}
                </button>
                <button
                  type="button"
                  className="outro-card-delete"
                  title="Çerçeveyi Sil"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(overlay.id);
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="outro-library-footer">
          <span>
            Seçili Çerçeve:{" "}
            <strong>
              {overlays.find((o) => o.id === selectedOverlayId)?.title || "Özel Çerçeve Yok"}
            </strong>
          </span>
          <button type="button" className="button primary" onClick={onClose}>
            Seçimi Uygula
          </button>
        </div>
      </div>
    </div>
  );
}
