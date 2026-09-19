"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Player } from "@remotion/player";
import { Blend, Check, Clapperboard, Download, ImageOff, Layers3, LoaderCircle, Play, RefreshCw, Send, Sparkles, Type } from "lucide-react";
import { useProjects } from "@/features/projects/projects-context";
import { AnimatedCreative } from "@/remotion/AnimatedCreative";
import type { AnimatedCreativeProps, MotionStyle } from "@/remotion/types";

type CreativeAsset = { id: string; url: string; model: string; prompt: string; createdAt: string };
type RenderedVideo = { id: string; url: string; sourceAssetId?: string; durationSeconds?: number; motionStyle?: string; createdAt: string };

const styleOptions: { value: MotionStyle; label: string; detail: string }[] = [
  { value: "minimal", label: "Sade", detail: "Yumuşak ve kontrollü" },
  { value: "premium", label: "Premium", detail: "Derinlik ve ışık geçişi" },
  { value: "energetic", label: "Enerjik", detail: "Hızlı ve dinamik giriş" },
];

async function fetchStudioData(projectId: string) {
  const [imageResponse, videoResponse] = await Promise.all([
    fetch(`/api/ai/images?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" }),
    fetch(`/api/videos?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" }),
  ]);
  const imageBody = await imageResponse.json() as { ok: boolean; assets?: CreativeAsset[] };
  const videoBody = await videoResponse.json() as { ok: boolean; videos?: RenderedVideo[] };
  return { assets: imageBody.assets || [], videos: videoBody.videos || [] };
}

export function VideoGenerationStudio({ projectId }: { projectId: string }) {
  const { getProject } = useProjects();
  const project = getProject(projectId);
  const [assets, setAssets] = useState<CreativeAsset[]>([]);
  const [videos, setVideos] = useState<RenderedVideo[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [duration, setDuration] = useState<6 | 8 | 10>(8);
  const [motionStyle, setMotionStyle] = useState<MotionStyle>("premium");
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [packageId, setPackageId] = useState("");
  const [preparedSpec, setPreparedSpec] = useState<AnimatedCreativeProps | null>(null);
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    try {
      const result = await fetchStudioData(projectId);
      const nextAssets = result.assets;
      setAssets(nextAssets); setVideos(result.videos);
      setSelectedId((current) => current || nextAssets[0]?.id || "");
    } catch { setMessage("Kreatif ve video arşivi yüklenemedi."); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    void fetchStudioData(projectId).then((result) => {
      if (cancelled) return;
      setAssets(result.assets); setVideos(result.videos);
      setSelectedId((current) => current || result.assets[0]?.id || "");
    }).catch(() => { if (!cancelled) setMessage("Kreatif ve video arşivi yüklenemedi."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);
  const selected = useMemo(() => assets.find((asset) => asset.id === selectedId), [assets, selectedId]);

  function selectCreative(id: string) { setSelectedId(id); setPackageId(""); setPreparedSpec(null); setMessage(""); }

  async function prepareLayers() {
    if (!selected) { setMessage("Önce bir kreatif seçin."); return; }
    setPreparing(true); setMessage("Metinsiz arka plan, dinamik gradient ve özgün içerik katmanları hazırlanıyor. Bu işlem birkaç dakika sürebilir.");
    try {
      const response = await fetch("/api/videos/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, assetId: selected.id }) });
      const body = await response.json() as { ok: boolean; message?: string; packageId?: string; spec?: AnimatedCreativeProps };
      if (!response.ok || !body.ok || !body.packageId || !body.spec) throw new Error(body.message || "Katmanlar hazırlanamadı.");
      setPackageId(body.packageId); setPreparedSpec(body.spec); setMessage("Yeni sahne hazır: sabit metinsiz arka plan, tek parça gradient ve bağımsız içerik animasyonları.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Katmanlar hazırlanamadı."); }
    finally { setPreparing(false); }
  }

  async function renderVideo() {
    if (!selected || !packageId) { setMessage("Önce kreatifi bağımsız katmanlara hazırlayın."); return; }
    setRendering(true); setMessage("Local Remotion render başlatıldı. Bu işlem kısa süre alabilir.");
    try {
      const response = await fetch("/api/videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, assetId: selected.id, packageId, durationSeconds: duration, motionStyle }) });
      const body = await response.json() as { ok: boolean; message?: string; video?: RenderedVideo };
      if (!response.ok || !body.ok || !body.video) throw new Error(body.message || "Video üretilemedi.");
      setVideos((current) => [body.video!, ...current]); setMessage("Video local Remotion ile hazırlandı.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Video üretilemedi."); }
    finally { setRendering(false); }
  }

  if (!project) return <div className="overview-loading" />;

  return (
    <div className="video-studio">
      <section className="video-controls">
        <div className="video-section-heading"><span><Clapperboard size={18} /></span><div><h2>Motion kreatif</h2><p>Tek sahneli, efektli dikey video</p></div></div>

        <div className="video-control-section"><strong>Kreatif seç</strong><small>Animasyon uygulanacak mevcut görsel</small>
          {loading ? <div className="video-control-loading"><LoaderCircle className="spin" size={18} />Kreatifler yükleniyor</div> : assets.length ? <div className="video-asset-picker">{assets.map((asset) => <button type="button" key={asset.id} className={selectedId === asset.id ? "selected" : ""} onClick={() => selectCreative(asset.id)}><Image src={asset.url} alt="Kreatif" fill sizes="100px" unoptimized />{selectedId === asset.id && <span><Check size={12} /></span>}</button>)}</div> : <div className="video-control-empty">Önce Görsel Üret bölümünden bir kreatif oluşturun.</div>}
        </div>

        <div className="video-control-section"><strong>Sahne hazırlığı</strong><small>Kreatifin özgün düzeni korunarak video katmanlarına dönüştürülür.</small>
          <div className="video-pipeline-steps">
            <span><ImageOff size={13} />Metinsiz zemin</span><span><Blend size={13} />Akıllı gradient</span><span><Type size={13} />Saf içerikler</span>
          </div>
          <button type="button" className={`layer-prepare-button ${packageId ? "ready" : ""}`} disabled={!selected || preparing || rendering} onClick={() => void prepareLayers()}>{preparing ? <LoaderCircle className="spin" size={16} /> : packageId ? <Check size={16} /> : <Layers3 size={16} />}{preparing ? "Sahne hazırlanıyor" : packageId ? "Sahne hazır" : "Video sahnesini hazırla"}</button>
        </div>

        <div className="video-control-section"><strong>Süre</strong><small>Kısa motion poster uzunluğu</small><div className="video-segmented">{([6, 8, 10] as const).map((value) => <button type="button" key={value} className={duration === value ? "active" : ""} onClick={() => setDuration(value)}>{value} sn</button>)}</div></div>

        <div className="video-control-section"><strong>Hareket stili</strong><small>Bilgi bölgelerinin giriş karakteri</small><div className="motion-style-list">{styleOptions.map((option) => <button type="button" key={option.value} className={motionStyle === option.value ? "active" : ""} onClick={() => setMotionStyle(option.value)}><span><Sparkles size={14} /></span><div><b>{option.label}</b><small>{option.detail}</small></div>{motionStyle === option.value && <Check size={14} />}</button>)}</div></div>

        {message && <div className="generation-notice"><Sparkles size={14} /><span>{message}</span></div>}
        <button type="button" className="generate-button" disabled={!selected || !packageId || rendering || preparing} onClick={() => void renderVideo()}>{rendering ? <LoaderCircle className="spin" size={18} /> : <Play size={18} />}{rendering ? "Video render ediliyor" : "Katmanlı video üret"}<span>{duration} sn</span></button>
      </section>

      <section className="video-preview-panel">
        <div className="results-toolbar"><div><h2>Canlı önizleme</h2><span>Remotion Player · 1080 × 1920 · 30 FPS</span></div><div className="video-preview-actions">{packageId && <span className="video-scene-ready"><Check size={12} />Gradient sahne hazır</span>}<button type="button" className="icon-button" onClick={() => void loadData()} aria-label="Yenile"><RefreshCw size={16} /></button></div></div>
        <div className="video-player-shell">
          {selected ? <Player component={AnimatedCreative} inputProps={preparedSpec ? { ...preparedSpec, durationSeconds: duration, motionStyle } : { imageSrc: selected.url, durationSeconds: duration, motionStyle, accentColor: project.brand.primaryColor || "#6d5dfc" }} durationInFrames={duration * 30} compositionWidth={1080} compositionHeight={1920} fps={30} controls loop style={{ width: "100%", height: "100%" }} /> : <div className="video-preview-empty"><Clapperboard size={35} /><strong>Önizleme için kreatif seçin</strong></div>}
        </div>
      </section>

      <section className="video-history">
        <div className="history-heading"><div><span><Clapperboard size={16} /></span><div><h2>Üretilen videolar</h2><p>Local Remotion çıktıları</p></div></div></div>
        {videos.length ? <div className="video-history-grid">{videos.map((video) => <article key={video.id}><video src={video.url} controls preload="metadata" /><div><span>{video.durationSeconds || 8} sn · {video.motionStyle || "premium"}</span><a href={video.url} download={`motion-kreatif-${video.id}.mp4`}><Download size={14} />İndir</a><Link href={`/projects/${projectId}/publishing`} style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--accent, #612bd3)", fontWeight: 600, fontSize: "11px" }}><Send size={13} />Planla</Link></div></article>)}</div> : <div className="history-empty"><Clapperboard size={23} /><span>Henüz video üretilmedi.</span></div>}
      </section>
    </div>
  );
}
