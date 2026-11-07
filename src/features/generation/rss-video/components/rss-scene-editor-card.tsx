"use client";

import { useState } from "react";
import {
  LoaderCircle,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  ZoomIn,
} from "lucide-react";
import {
  RSS_CAMERA_EFFECT_LABELS,
  RSS_TRANSITION_LABELS,
  type RssAspectRatio,
  type RssCameraEffect,
  type RssScenePlan,
  type RssTransitionType,
  type RssVoiceEmotion,
} from "../types";

export interface RssSceneEditorCardProps {
  scene: RssScenePlan;
  sceneIdx: number;
  totalScenes: number;
  aspectRatio: RssAspectRatio;
  isGeneratingImage: boolean;
  onUpdateScene: (sceneIndex: number, updates: Partial<RssScenePlan>) => void;
  onDeleteScene?: () => void;
  onGenerateSceneImage?: (sceneIndex: number) => void;
  onOpenLightbox: (img: { url: string; title: string; promptEn: string }) => void;
}

function toThumbUrl(url: string): string {
  if (!url) return "";
  if (url.includes("thumb=1")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}thumb=1`;
}

export function RssSceneEditorCard({
  scene,
  sceneIdx,
  totalScenes,
  aspectRatio,
  isGeneratingImage,
  onUpdateScene,
  onDeleteScene,
  onGenerateSceneImage,
  onOpenLightbox,
}: RssSceneEditorCardProps) {
  const [showPromptAccordion, setShowPromptAccordion] = useState(false);

  const wordCount = scene.voiceoverTr.split(/\s+/).filter(Boolean).length;
  const estSeconds = Math.max(2, Math.round(wordCount / 2.2));
  const ratioClass =
    aspectRatio === "16:9"
      ? "ratio-landscape"
      : aspectRatio === "1:1"
      ? "ratio-square"
      : "ratio-portrait";

  return (
    <div className="rss-scene-editor-card">
      {/* Sol Sütun: Sahne Kurgu Özeti, Dış Ses, Efektler ve Görsel Promptu */}
      <div className="rss-scene-fields-col">
        <div className="rss-scene-top-inputs">
          <div>
            <label className="rss-field-label">Sahne {scene.sceneIndex} Kurgu Özeti</label>
            <input
              type="text"
              value={scene.summaryTr}
              onChange={(e) => onUpdateScene(sceneIdx, { summaryTr: e.target.value })}
              className="rss-text-input"
            />
          </div>
          <div>
            <label className="rss-field-label">Ekran Üst Başlığı (Kısa Kanca)</label>
            <input
              type="text"
              value={scene.onScreenTextTr}
              onChange={(e) => onUpdateScene(sceneIdx, { onScreenTextTr: e.target.value })}
              placeholder="Örn: ŞAŞIRTICI GERÇEK"
              className="rss-text-input"
            />
          </div>
        </div>

        {/* Türkçe Dış Ses Metni (Gemini 2.0 TTS) */}
        <div>
          <div className="rss-voiceover-header">
            <label className="rss-voiceover-label">
              🎙️ Gemini 2.0 TTS Dış Ses Metni (Türkçe)
            </label>
            <span className="rss-voiceover-stats">
              {wordCount} kelime (~{estSeconds} sn okuma)
            </span>
          </div>
          <textarea
            value={scene.voiceoverTr}
            onChange={(e) => onUpdateScene(sceneIdx, { voiceoverTr: e.target.value })}
            rows={2}
            className="rss-voiceover-textarea"
          />
        </div>

        {/* Kamera Hareketi, Geçiş ve Ses Duygusu */}
        <div className="rss-scene-selects-grid">
          <div>
            <label className="rss-field-label-sm">Kamera Hareketi (FFmpeg)</label>
            <select
              value={scene.cameraEffect}
              onChange={(e) =>
                onUpdateScene(sceneIdx, {
                  cameraEffect: e.target.value as RssCameraEffect,
                })
              }
              className="rss-scene-select"
            >
              {Object.entries(RSS_CAMERA_EFFECT_LABELS).map(([k, lbl]) => (
                <option key={k} value={k}>
                  {lbl}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="rss-field-label-sm">Sahne Geçişi (xfade)</label>
            <select
              value={scene.transition}
              onChange={(e) =>
                onUpdateScene(sceneIdx, {
                  transition: e.target.value as RssTransitionType,
                })
              }
              className="rss-scene-select"
            >
              {Object.entries(RSS_TRANSITION_LABELS).map(([k, lbl]) => (
                <option key={k} value={k}>
                  {lbl}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="rss-field-label-sm">Sahne Ses Duygusu</label>
            <select
              value={scene.voiceEmotion}
              onChange={(e) =>
                onUpdateScene(sceneIdx, {
                  voiceEmotion: e.target.value as RssVoiceEmotion,
                })
              }
              className="rss-scene-select"
            >
              <option value="urgent">Acil / Sıcak Haber</option>
              <option value="serious">Ciddi / Analitik</option>
              <option value="calm">Sakin / Belgesel</option>
              <option value="warm_storyteller">Sıcak Masal Anlatıcısı</option>
              <option value="dramatic">Derin / Sinematik</option>
              <option value="mysterious">Gizemli / Merak</option>
              <option value="excited">Enerjik / Rehber</option>
            </select>
          </div>
        </div>

        {/* Açılır Akordeon: İngilizce CLIProxy Görsel Promptu */}
        <div>
          <button
            type="button"
            onClick={() => setShowPromptAccordion(!showPromptAccordion)}
            className="rss-prompt-accordion-btn"
          >
            {showPromptAccordion ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            <span>
              ⚙️ Teknik CliProxy Görsel Promptunu Düzenle (İngilizce • FG/MG/BG Derinlikli)
            </span>
          </button>
          {showPromptAccordion && (
            <textarea
              value={scene.promptEn}
              onChange={(e) => onUpdateScene(sceneIdx, { promptEn: e.target.value })}
              rows={3}
              className="rss-prompt-textarea"
            />
          )}
        </div>
      </div>

      {/* Sağ Sütun: Kutu Alanı Ölçüsünde Hafif Önizleme (Thumbnail ~10KB WebP) */}
      <div className="rss-scene-preview-col">
        <div className="rss-scene-preview-header">
          <span className="rss-scene-preview-title">🖼️ Sahne {scene.sceneIndex}</span>
          <span className="rss-scene-preview-ratio">{aspectRatio}</span>
        </div>

        <div className={`rss-scene-thumb-frame ${ratioClass}`}>
          {isGeneratingImage ? (
            <div className="rss-scene-thumb-loading">
              <LoaderCircle className="spin" size={18} />
              <span>Üretiliyor...</span>
            </div>
          ) : scene.previewImageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={toThumbUrl(scene.previewImageUrl)}
                alt={`Sahne ${scene.sceneIndex}`}
                loading="lazy"
                decoding="async"
                width={130}
                height={156}
                onClick={() =>
                  onOpenLightbox({
                    url: scene.previewImageUrl!,
                    title: `Sahne ${scene.sceneIndex}: ${scene.summaryTr}`,
                    promptEn: scene.promptEn,
                  })
                }
                className="rss-scene-thumb-img"
                title="Tam boyutta görüntülemek için tıklayın"
              />
              <button
                type="button"
                onClick={() =>
                  onOpenLightbox({
                    url: scene.previewImageUrl!,
                    title: `Sahne ${scene.sceneIndex}: ${scene.summaryTr}`,
                    promptEn: scene.promptEn,
                  })
                }
                className="rss-scene-zoom-btn"
                title="Tam boyutta görüntüle"
              >
                <ZoomIn size={11} />
                <span>Büyüt</span>
              </button>
            </>
          ) : (
            <div className="rss-scene-thumb-empty">
              <ImageIcon size={18} />
              <span>Önizleme görseli yok</span>
            </div>
          )}
        </div>

        {onGenerateSceneImage && (
          <button
            type="button"
            onClick={() => onGenerateSceneImage(sceneIdx)}
            disabled={isGeneratingImage}
            className="rss-scene-gen-btn"
          >
            {isGeneratingImage ? (
              <LoaderCircle className="spin" size={11} />
            ) : (
              <RefreshCw size={11} />
            )}
            <span>{scene.previewImageUrl ? "Yeniden Üret" : "Görsel Üret"}</span>
          </button>
        )}

        {onDeleteScene && totalScenes > 2 && (
          <button
            type="button"
            onClick={onDeleteScene}
            className="rss-scene-delete-btn"
            title="Bu sahneyi senaryodan çıkar"
          >
            <Trash2 size={10} />
            <span>Sahneyi Sil</span>
          </button>
        )}
      </div>
    </div>
  );
}
