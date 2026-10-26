'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  Sparkles,
  Calendar,
  FlaskConical,
  Target,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertCircle,
  Zap,
  Sliders,
  Layers,
  Copy,
  Check,
  Palette,
  Clapperboard,
} from 'lucide-react';
import type { GrowthResponse, GrowthPlatform, SavedGrowth } from '@/lib/strategy-types';
import { GROWTH_FORMATS } from '@/lib/strategy-growth-validation';

type Preview = {
  title: string;
  hook: string;
  description: string;
  structure: string[];
};

const PLATFORM_INFO: Record<
  GrowthPlatform,
  { label: string; icon: string; agent: string; color: string; border: string; bg: string }
> = {
  instagram: {
    label: 'Instagram',
    icon: '📸',
    agent: 'Instagram Curator & Carousel Growth Engine',
    color: '#e1306c',
    border: '#fbcfe8',
    bg: '#fdf2f8',
  },
  tiktok: {
    label: 'TikTok',
    icon: '🎵',
    agent: 'TikTok Strategist (Viral Retention & Hook Engine)',
    color: '#0f172a',
    border: '#cbd5e1',
    bg: '#f8fafc',
  },
  youtube: {
    label: 'YouTube',
    icon: '▶️',
    agent: 'Video Optimization Specialist (CTR & Search Intent)',
    color: '#ef4444',
    border: '#fecaca',
    bg: '#fef2f2',
  },
};

export function PlatformGrowthPanel({ projectId }: { projectId: string }) {
  return <ProjectGrowthPanel key={projectId} projectId={projectId} />;
}

function ProjectGrowthPanel({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [data, setData] = useState<GrowthResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeStrategyPlatform, setActiveStrategyPlatform] = useState<GrowthPlatform>('instagram');
  const [copiedTacticId, setCopiedTacticId] = useState<string | null>(null);

  // Input states
  const [selected, setSelected] = useState<GrowthPlatform[]>([]);
  const [objective, setObjective] = useState('Nitelikli topluluk, organik etkileşim ve profile yönlendirme');
  const [posts, setPosts] = useState(3);
  const [hours, setHours] = useState(4);

  // Idea generation states
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const [formats, setFormats] = useState<Record<string, string>>({});
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [reload, setReload] = useState(0);

  const generation = useRef(0);
  const pendingKey = useRef<string | null>(null);
  const url = `/api/projects/${projectId}/strategy/growth`;

  useEffect(() => {
    const epoch = ++generation.current;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polls = 0;

    async function load() {
      try {
        const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
        const json = await res.json();
        if (controller.signal.aborted || epoch !== generation.current) return;
        if (!res.ok) throw new Error(json.error);
        setError('');
        setData(json);
        setSelected((prev) => (prev.length ? prev : json.availablePlatforms));
        if (json.strategies?.length) {
          setActiveStrategyPlatform((prev) =>
            json.strategies.some((s: SavedGrowth) => s.platform === prev) ? prev : json.strategies[0].platform
          );
        }
        if (json.activeRun && polls++ < 180) {
          timer = setTimeout(load, 3000);
        } else if (json.activeRun) {
          setError('Strateji analizi sürüyor. Durumu görmek için sekmeyi yeniden açın.');
        }
      } catch (e) {
        if (!controller.signal.aborted && epoch === generation.current) {
          setError(e instanceof Error ? e.message : 'Veri okunamadı');
        }
      }
    }

    void load();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [url, busy, reload]);

  async function generate(platforms: GrowthPlatform[]) {
    const epoch = generation.current;
    setBusy(true);
    setError('');
    pendingKey.current ??= crypto.randomUUID();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms,
          objective,
          capacity: { postsPerWeek: posts, hoursPerWeek: hours },
          idempotencyKey: pendingKey.current,
        }),
      });
      const json = await res.json();
      if (epoch !== generation.current && generation.current !== epoch + 1) return;
      if (!res.ok) throw new Error(json.error);
      pendingKey.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Üretim başlatılamadı');
    } finally {
      setBusy(false);
    }
  }

  async function idea(action: 'preview' | 'add', saved: SavedGrowth, id: string, defaultFormat: string) {
    const epoch = generation.current;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(url + '/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          strategyId: saved.id,
          recommendationId: id,
          format: formats[id] || defaultFormat,
        }),
      });
      const json = await res.json();
      if (generation.current !== epoch && generation.current !== epoch + 1) return;
      if (!res.ok) throw new Error(json.error);
      if (action === 'preview') {
        setPreviews((p) => ({ ...p, [id]: json.idea }));
      } else {
        window.dispatchEvent(new CustomEvent('hermes_strategy_idea_added'));
        setAddedIds((prev) => new Set(prev).add(id));
        setPreviews((p) => {
          const next = { ...p };
          delete next[id];
          return next;
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fikir işlemi başarısız');
    } finally {
      setBusy(false);
    }
  }

  function copyTacticText(rec: SavedGrowth['strategy']['recommendations'][number], platform: GrowthPlatform) {
    const stepsText = (rec.steps || []).map((s, idx) => `  ${idx + 1}. ${s}`).join('\n');
    const fullText = `🎯 [${PLATFORM_INFO[platform].label.toUpperCase()}] Büyüme Taktiği: ${rec.title}\n📌 Format: ${rec.format.toUpperCase()} • Efor: ${rec.effort.toUpperCase()}\n💡 Stratejik Gerekçe: ${rec.rationale}\n📋 Uygulama Adımları:\n${stepsText}\n📈 Beklenen Etki: ${rec.impactHypothesis}`;

    navigator.clipboard.writeText(fullText);
    setCopiedTacticId(rec.id);
    setTimeout(() => setCopiedTacticId(null), 2500);
  }

  function directProduceInCanva(rec: SavedGrowth['strategy']['recommendations'][number], platform: GrowthPlatform) {
    const selectedFmt = formats[rec.id] || rec.format;
    let targetContentType = 'instagram_carousel';
    let targetSlideCount = 6;

    if (selectedFmt === 'vertical_video' || selectedFmt === 'reels' || selectedFmt === 'shorts') {
      targetContentType = 'reels_video';
      targetSlideCount = 6;
    } else if (selectedFmt === 'carousel') {
      targetContentType = 'instagram_carousel';
      targetSlideCount = Math.max(3, Math.min(10, rec.steps?.length || 5));
    } else if (selectedFmt === 'story') {
      targetContentType = 'instagram_story';
      targetSlideCount = 1;
    } else {
      targetContentType = 'instagram_post';
      targetSlideCount = 1;
    }

    const stepsText = (rec.steps || []).map((s, idx) => `Sayfa ${idx + 1}: ${s}`).join('\n');
    const briefPrompt = `[${PLATFORM_INFO[platform].label} Büyüme Taktiği]\nBaşlık: ${rec.title}\nStratejik Amaç: ${rec.rationale}\n\nAkış Planı:\n${stepsText}\n\nFormat: ${targetContentType}, profesyonel, marka kimliğiyle uyumlu tasarım.`;

    const formPayload = {
      prompt: briefPrompt,
      contentType: targetContentType,
      slideCount: targetSlideCount,
      style: 'minimalist_modern',
      isPrefilledFromIdea: true,
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem(`canva_form_${projectId}`, JSON.stringify(formPayload));
      localStorage.setItem(`canva_prefill_${projectId}`, JSON.stringify(formPayload));
      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        window.dispatchEvent(new CustomEvent("canva-prefill", { detail: formPayload }));
      }
      router.push(`/projects/${projectId}/image-generation?studio=canva`);
    } catch {
      router.push(`/projects/${projectId}/image-generation?studio=canva`);
    }
  }

  function directProduceInVideo(rec: SavedGrowth['strategy']['recommendations'][number]) {
    router.push(`/projects/${projectId}/video-generation?tab=vids&topic=${encodeURIComponent(rec.title + ' - ' + rec.rationale)}`);
  }

  const currentStrategy = data?.strategies?.find((s) => s.platform === activeStrategyPlatform);

  return (
    <div className="cockpit-tab-content-panel" style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%", boxSizing: "border-box" }}>
      {/* 1. ÜST KONTROL BAR: STRATEJİ VE KAPASİTE YAPILANDIRMASI */}
      <div className="cockpit-detail-card highlight">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", paddingBottom: "12px", borderBottom: "1px solid #ede8ff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Sliders size={16} style={{ color: "var(--primary)" }} />
            <span style={{ font: "700 13px 'Manrope'", color: "var(--text)" }}>Agency Platform Büyüme Kokpiti</span>
            <span className="cockpit-pill-tag" style={{ background: "#ede8ff", color: "#4f46e5", border: "1px solid #dcd8ff" }}>
              Agency Specialists Entegre
            </span>
          </div>
          {data?.activeRun ? (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, color: "#d97706", background: "#fffbeb", padding: "4px 10px", borderRadius: "20px", border: "1px solid #fde68a" }}>
              <RefreshCw size={12} className="animate-spin" />
              <span>Agency uzmanları stratejiyi analiz ediyor ({data.activeRun.id.slice(0, 8)})...</span>
            </div>
          ) : null}
        </div>

        {/* Yapılandırma Alanları */}
        <div className="growth-control-grid" style={{ paddingTop: "12px" }}>
          {/* Platform Seçimi */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Hedef Platformlar
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {data?.availablePlatforms.map((p) => {
                const isSelected = selected.includes(p);
                const isConnected = data.connectedPlatforms.includes(p);
                const info = PLATFORM_INFO[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setSelected((prev) =>
                        isSelected ? prev.filter((x) => x !== p) : [...prev, p]
                      );
                      pendingKey.current = null;
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      border: isSelected ? "1px solid #6366f1" : "1px solid #e2e8f0",
                      background: isSelected ? "#f5f3ff" : "#ffffff",
                      color: isSelected ? "#4338ca" : "#64748b",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>{info.icon}</span>
                    <span>{info.label}</span>
                    {isConnected ? (
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} title="Hesap Bağlı" />
                    ) : (
                      <span style={{ fontSize: "10px", opacity: 0.6 }}>(Bağlı Değil)</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Haftalık İçerik */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text)" }}>Haftalık İçerik</label>
            <input
              type="number"
              min={1}
              max={21}
              value={posts}
              onChange={(e) => {
                setPosts(Number(e.target.value));
                pendingKey.current = null;
              }}
              style={{ width: "100%", height: "34px", padding: "0 10px", fontSize: "12px", fontWeight: 600, borderRadius: "8px", border: "1px solid var(--border)", background: "white", boxSizing: "border-box" }}
            />
          </div>

          {/* Haftalık Çalışma */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text)" }}>Haftalık Saat</label>
            <input
              type="number"
              min={0.5}
              max={80}
              step={0.5}
              value={hours}
              onChange={(e) => {
                setHours(Number(e.target.value));
                pendingKey.current = null;
              }}
              style={{ width: "100%", height: "34px", padding: "0 10px", fontSize: "12px", fontWeight: 600, borderRadius: "8px", border: "1px solid var(--border)", background: "white", boxSizing: "border-box" }}
            />
          </div>

          {/* Başlat Butonu */}
          <div>
            <button
              type="button"
              disabled={busy || Boolean(data?.activeRun) || !selected.length}
              onClick={() => generate(selected)}
              className="button primary"
              style={{ width: "100%", height: "34px", justifyContent: "center", fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap" }}
            >
              {busy ? <RefreshCw size={13} className="spin" /> : <Sparkles size={13} />}
              <span>{busy ? "Hazırlanıyor..." : "Stratejiyi Üret"}</span>
            </button>
          </div>

          {/* Hedef Cümlesi */}
          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text)" }}>Odak Büyüme Hedefi</label>
            <input
              type="text"
              value={objective}
              maxLength={2000}
              onChange={(e) => {
                setObjective(e.target.value);
                pendingKey.current = null;
              }}
              style={{ width: "100%", height: "34px", padding: "0 10px", fontSize: "12px", borderRadius: "8px", border: "1px solid var(--border)", background: "white", boxSizing: "border-box" }}
              placeholder="Örn: Nitelikli takipçi kazanımı, yüksek Reels kaydetme oranı ve organik kitle büyütme"
            />
          </div>
        </div>

        {error && (
          <div style={{ marginTop: "10px", padding: "8px 12px", borderRadius: "8px", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setReload((n) => n + 1)}
              style={{ fontSize: "11px", fontWeight: 700, textDecoration: "underline", color: "#991b1b", background: "none", border: 0, cursor: "pointer" }}
            >
              Yeniden dene
            </button>
          </div>
        )}
      </div>

      {/* 2. STRATEJİ PLATFORM SEKMELERİ (SONUÇLAR MEVCUTSA) */}
      {data?.strategies && data.strategies.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Platform Tab Bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {data.strategies.map((saved) => {
                const info = PLATFORM_INFO[saved.platform];
                const isActive = activeStrategyPlatform === saved.platform;
                return (
                  <button
                    key={saved.id}
                    type="button"
                    onClick={() => setActiveStrategyPlatform(saved.platform)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      border: isActive ? "1px solid var(--text)" : "1px solid var(--border)",
                      background: isActive ? "var(--text)" : "white",
                      color: isActive ? "white" : "var(--muted)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>{info.icon}</span>
                    <span>{info.label} Büyüme Stratejisi</span>
                    {saved.stale && (
                      <span style={{ fontSize: "10px", padding: "1px 5px", borderRadius: "4px", background: "rgba(245, 158, 11, 0.2)", color: "#b45309" }}>
                        Eski
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {currentStrategy && (
              <button
                type="button"
                disabled={busy || Boolean(data?.activeRun)}
                onClick={() => generate([currentStrategy.platform])}
                className="button ghost"
                style={{ height: "32px", fontSize: "11px", fontWeight: 600, padding: "0 10px", gap: "5px" }}
              >
                <RefreshCw size={12} className={busy ? "spin" : ""} />
                <span>Bu Platformu Güncelle</span>
              </button>
            )}
          </div>

          {/* Aktif Platform Detayı */}
          {currentStrategy && (
            <div className="space-y-6">
              {/* Teşhis & Agency Uzman Kimliği */}
              <div
                className="p-4 rounded-xl border"
                style={{
                  background: PLATFORM_INFO[currentStrategy.platform].bg,
                  borderColor: PLATFORM_INFO[currentStrategy.platform].border,
                }}
              >
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{PLATFORM_INFO[currentStrategy.platform].icon}</span>
                    <strong className="text-sm text-slate-900">
                      {PLATFORM_INFO[currentStrategy.platform].label} Uzman Teşhisi &amp; Konumlandırma
                    </strong>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600">
                    Atanan Direktör: {PLATFORM_INFO[currentStrategy.platform].agent}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {currentStrategy.strategy.diagnosis}
                </p>
                {currentStrategy.strategy.missingData?.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="font-semibold">Veri Hipotezleri:</span>
                    <span>{currentStrategy.strategy.missingData.join(' • ')}</span>
                  </div>
                )}
              </div>

              {/* 4'LÜ DETAY GRID: 1. ÖNCELİKLİ TAKTİKLER */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Zap size={15} className="text-amber-500" />
                    <span>Öncelikli Büyüme Taktikleri (Doğrudan İçeriğe Dönüştürülebilir)</span>
                  </h4>
                  <span className="text-xs text-slate-500 font-medium">
                    {currentStrategy.strategy.recommendations.length} Stratejik Eylem
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {currentStrategy.strategy.recommendations.map((rec, idx) => {
                    const isPreviewing = Boolean(previews[rec.id]);
                    const isAdded = addedIds.has(rec.id);
                    const selectedFormat = formats[rec.id] || rec.format;

                    return (
                      <div
                        key={rec.id}
                        className="cockpit-detail-card"
                        style={{ borderLeft: '4px solid #6366f1', background: '#ffffff' }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: "11px", fontWeight: 800, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.05em", display: "block" }}>
                              Taktik #{idx + 1} • {rec.format.toUpperCase()}
                            </span>
                            <h5 style={{ margin: "4px 0 0", font: "700 13.5px 'Manrope'", color: "var(--text)", lineHeight: 1.35 }}>
                              {rec.title}
                            </h5>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => copyTacticText(rec, currentStrategy.platform)}
                              className="button secondary"
                              style={{ height: "26px", fontSize: "11px", fontWeight: 700, padding: "0 8px", gap: "4px" }}
                              title="Taktiği ve Uygulama Adımlarını Kopyala"
                            >
                              {copiedTacticId === rec.id ? <Check size={12} style={{ color: "#10b981" }} /> : <Copy size={12} />}
                              <span>{copiedTacticId === rec.id ? "Kopyalandı" : "Kopyala"}</span>
                            </button>
                            <span
                              className="cockpit-pill-tag"
                              style={{
                                fontSize: "11px",
                                background: rec.effort === "low" ? "#ecfdf5" : rec.effort === "medium" ? "#fffbeb" : "#fef2f2",
                                color: rec.effort === "low" ? "#065f46" : rec.effort === "medium" ? "#92400e" : "#991b1b",
                                borderColor: rec.effort === "low" ? "#a7f3d0" : rec.effort === "medium" ? "#fde68a" : "#fecaca",
                              }}
                            >
                              {rec.effort === "low" ? "Düşük Efor" : rec.effort === "medium" ? "Orta Efor" : "Yüksek Efor"}
                            </span>
                          </div>
                        </div>

                        <p style={{ margin: "8px 0 4px", fontSize: "12.5px", color: "#334155", lineHeight: "1.55", fontWeight: 500 }}>
                          {rec.rationale}
                        </p>

                        {/* Adımlar */}
                        <ol style={{ margin: "4px 0", paddingLeft: "18px", fontSize: "12px", color: "#475569", lineHeight: "1.5", display: "flex", flexDirection: "column", gap: "3px" }}>
                          {rec.steps.map((st, sIdx) => (
                            <li key={sIdx}>{st}</li>
                          ))}
                        </ol>

                        <div style={{ marginTop: "auto", paddingTop: "8px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11.5px", color: "var(--muted)" }}>
                          <span>Format: <strong style={{ color: "var(--text)" }}>{rec.format}</strong></span>
                          <span>Etki: <strong style={{ color: "var(--text)" }}>{rec.impactHypothesis}</strong></span>
                        </div>

                        {/* HIZLI ÜRETİM VE FİKİR KÖPRÜSÜ */}
                        <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #ede8ff", background: "#f8faff", padding: "10px", borderRadius: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                          {/* Üst Sıra: Doğrudan Üretim Butonları */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                              <button
                                type="button"
                                onClick={() => directProduceInCanva(rec, currentStrategy.platform)}
                                className="button primary"
                                style={{ height: "28px", fontSize: "11.5px", fontWeight: 700, padding: "0 10px", gap: "5px" }}
                                title="Bu taktiği ön ayarları yapılmış şekilde Canva Stüdyosu'na aktar"
                              >
                                <Palette size={12} />
                                <span>Canva&apos;da Üret</span>
                              </button>

                              {(rec.format.includes("video") || rec.format.includes("reels") || rec.format.includes("shorts")) && (
                                <button
                                  type="button"
                                  onClick={() => directProduceInVideo(rec)}
                                  className="button secondary"
                                  style={{ height: "28px", fontSize: "11.5px", fontWeight: 700, padding: "0 10px", gap: "5px", color: "#db2777", background: "#fdf2f8", borderColor: "#fbcfe8" }}
                                  title="Google Vids AI Video Stüdyosu'nda üret"
                                >
                                  <Clapperboard size={12} />
                                  <span>Video Üret</span>
                                </button>
                              )}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              {!isPreviewing && !isAdded ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => idea("preview", currentStrategy, rec.id, rec.format)}
                                  className="button ghost"
                                  style={{ height: "28px", fontSize: "11px", fontWeight: 600, padding: "0 8px", gap: "4px" }}
                                  title="Bu taktikten Fikir Panosu için başlık ve kanca türet"
                                >
                                  <Sparkles size={11} />
                                  <span>Fikir Türet</span>
                                </button>
                              ) : null}

                              {isAdded && (
                                <span style={{ fontSize: "11px", fontWeight: 700, color: "#059669", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                  <CheckCircle2 size={13} />
                                  <span>Panoya Eklendi</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Önizleme Açıldıysa */}
                          {previews[rec.id] && (
                            <div style={{ padding: "8px", borderRadius: "8px", background: "white", border: "1px solid #c7d2fe", display: "flex", flexDirection: "column", gap: "6px" }}>
                              <strong style={{ fontSize: "11.5px", color: "#312e81" }}>
                                {previews[rec.id].title}
                              </strong>
                              <p style={{ margin: 0, fontSize: "11px", color: "#475569", fontStyle: "italic" }}>
                                &ldquo;{previews[rec.id].hook}&rdquo;
                              </p>
                              <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "11px", color: "#475569", display: "flex", flexDirection: "column", gap: "2px" }}>
                                {previews[rec.id].structure.map((s, sIdx) => (
                                  <li key={sIdx}>{s}</li>
                                ))}
                              </ul>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => idea("add", currentStrategy, rec.id, rec.format)}
                                className="button primary"
                                style={{ width: "100%", height: "26px", fontSize: "11px", fontWeight: 700, justifyContent: "center" }}
                              >
                                <Plus size={12} />
                                <span>Fikir Panosuna Ekle</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. İÇERİK KARMASI & 7 GÜNLÜK BAŞLANGIÇ PLANI */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* İçerik Karması */}
                <div className="cockpit-detail-card">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Layers size={15} className="text-indigo-600" />
                    <h4 className="font-bold text-xs text-slate-900">
                      Haftalık İçerik Karması &amp; Ritim
                    </h4>
                  </div>
                  <p className="text-[11.5px] text-slate-600 font-medium mb-3">
                    {currentStrategy.strategy.weeklyCadence}
                  </p>
                  <div className="space-y-2">
                    {currentStrategy.strategy.contentMix.map((mix, mIdx) => (
                      <div
                        key={mIdx}
                        className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                      >
                        <span className="font-bold text-slate-800">{mix.format}</span>
                        <span className="font-semibold text-indigo-600">{mix.postsPerWeek} içerik/hafta</span>
                        <span className="text-[11px] text-slate-500">{mix.purpose}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* İlk 7 Günlük Sprint */}
                <div className="cockpit-detail-card">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Calendar size={15} className="text-emerald-600" />
                    <h4 className="font-bold text-xs text-slate-900">İlk 7 Günlük Aksiyon Planı</h4>
                  </div>
                  <div className="space-y-1.5 mt-2">
                    {currentStrategy.strategy.first7Days.map((step, sIdx) => (
                      <div
                        key={sIdx}
                        className="flex items-start gap-2 text-[11.5px] text-slate-700 p-1.5 rounded hover:bg-slate-50"
                      >
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                          {sIdx + 1}
                        </span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. 30 GÜNLÜK DENEYLER & HEDEF METRİKLER (KPIS) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 30 Günlük Büyüme Deneyleri */}
                <div className="cockpit-detail-card">
                  <div className="flex items-center gap-2 mb-2">
                    <FlaskConical size={15} className="text-purple-600" />
                    <h4 className="font-bold text-xs text-slate-900">
                      30 Günlük Büyüme Deneyleri (Growth Experiments)
                    </h4>
                  </div>
                  <div className="space-y-2.5">
                    {currentStrategy.strategy.experiments.map((exp) => (
                      <div
                        key={exp.id}
                        className="p-2.5 rounded-lg border border-purple-100 bg-purple-50/30 space-y-1"
                      >
                        <strong className="text-xs text-purple-950 font-bold block">
                          {exp.title}
                        </strong>
                        <p className="text-[11px] text-slate-600">Hipotez: {exp.hypothesis}</p>
                        <div className="flex items-center justify-between text-[10.5px] text-purple-700 font-semibold pt-1">
                          <span>Metrik: {exp.metric}</span>
                          <span>Periyot: {exp.periodDays} Gün</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hedef KPI'lar ve Kanıtlar */}
                <div className="cockpit-detail-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Target size={15} className="text-blue-600" />
                    <h4 className="font-bold text-xs text-slate-900">Ölçüm &amp; Hedef KPI&apos;lar</h4>
                  </div>
                  <div className="space-y-2">
                    {currentStrategy.strategy.kpis.map((kpi, kIdx) => (
                      <div
                        key={kIdx}
                        className="p-2 rounded-lg bg-blue-50/40 border border-blue-100 flex items-center justify-between text-xs"
                      >
                        <div>
                          <strong className="text-blue-950 block">{kpi.name}</strong>
                          <span className="text-[10px] text-slate-500">{kpi.definition}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-blue-700 block">
                            Hedef: {kpi.target}
                          </span>
                          <span className="text-[10px] text-slate-400">({kpi.periodDays} gün)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Henüz Strateji Üretilmemişse Boş Durum */
        <div style={{ textAlign: "center", padding: "40px 16px", borderRadius: "14px", border: "1px dashed var(--border)", background: "#fafafa", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "#f0edff", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={22} />
          </div>
          <div style={{ maxWidth: "420px" }}>
            <h4 style={{ margin: "0 0 4px", font: "700 13px 'Manrope'", color: "var(--text)" }}>Henüz Platform Stratejisi Üretilmedi</h4>
            <p style={{ margin: 0, fontSize: "11.5px", color: "var(--muted)", lineHeight: "1.5" }}>
              Yukarıdaki panelden analiz etmek istediğiniz platformları seçip <strong>&ldquo;Stratejiyi Üret&rdquo;</strong> butonuna basın. Agency uzman direktörleri markanız için özel büyüme takvimini ve taktikleri hazırlayacaktır.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
