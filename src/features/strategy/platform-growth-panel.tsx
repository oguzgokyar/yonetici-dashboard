'use client';

import { useEffect, useRef, useState } from 'react';
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
  const [data, setData] = useState<GrowthResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeStrategyPlatform, setActiveStrategyPlatform] = useState<GrowthPlatform>('instagram');

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

  const currentStrategy = data?.strategies?.find((s) => s.platform === activeStrategyPlatform);

  return (
    <div className="cockpit-tab-content-panel space-y-6">
      {/* 1. ÜST KONTROL BAR: STRATEJİ VE KAPASİTE YAPILANDIRMASI */}
      <div className="cockpit-detail-card highlight" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-800">Agency Platform Büyüme Kokpiti</h3>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Agency Specialists Entegre
            </span>
          </div>
          {data?.activeRun ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 animate-pulse">
              <RefreshCw size={12} className="animate-spin" />
              <span>Agency uzmanları stratejiyi analiz ediyor ({data.activeRun.id.slice(0, 8)})...</span>
            </div>
          ) : null}
        </div>

        {/* Yapılandırma Alanları */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-3 items-end">
          {/* Platform Seçimi */}
          <div className="md:col-span-5 space-y-2">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              Analiz Edilecek Platformlar
            </label>
            <div className="flex flex-wrap gap-2">
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all border ${
                      isSelected
                        ? 'bg-white shadow-sm border-indigo-300 text-slate-900 ring-2 ring-indigo-500/10'
                        : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200/70'
                    }`}
                  >
                    <span>{info.icon}</span>
                    <span>{info.label}</span>
                    {isConnected ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-500" title="Hesap Bağlı" />
                    ) : (
                      <span className="text-[10px] text-slate-400 font-normal">(Bağlı Değil)</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Haftalık Kapasite */}
          <div className="md:col-span-2 space-y-1">
            <label className="text-[11px] font-bold text-slate-600 block">Haftalık İçerik</label>
            <input
              type="number"
              min={1}
              max={21}
              value={posts}
              onChange={(e) => {
                setPosts(Number(e.target.value));
                pendingKey.current = null;
              }}
              className="w-full h-8 px-2.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white"
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="text-[11px] font-bold text-slate-600 block">Haftalık Çalışma</label>
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
              className="w-full h-8 px-2.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white"
            />
          </div>

          {/* Başlat Butonu */}
          <div className="md:col-span-3">
            <button
              type="button"
              disabled={busy || Boolean(data?.activeRun) || !selected.length}
              onClick={() => generate(selected)}
              className="w-full h-8 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
            >
              {busy ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
              <span>{busy ? 'Hazırlanıyor...' : 'Stratejiyi Üret / Yenile'}</span>
            </button>
          </div>

          {/* Hedef Cümlesi */}
          <div className="md:col-span-12 space-y-1">
            <label className="text-[11px] font-bold text-slate-600 block">Odak Hedef</label>
            <input
              type="text"
              value={objective}
              maxLength={2000}
              onChange={(e) => {
                setObjective(e.target.value);
                pendingKey.current = null;
              }}
              className="w-full h-8 px-3 text-xs rounded-lg border border-slate-300 bg-white text-slate-800"
              placeholder="Örn: Nitelikli takipçi kazanımı, yüksek Reels kaydetme oranı ve web sitesi trafiği"
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setReload((n) => n + 1)}
              className="text-[11px] font-bold underline hover:text-rose-900"
            >
              Yeniden dene
            </button>
          </div>
        )}
      </div>

      {/* 2. STRATEJİ PLATFORM SEKMELERİ (SONUÇLAR MEVCUTSA) */}
      {data?.strategies && data.strategies.length > 0 ? (
        <div className="space-y-4">
          {/* Platform Tab Bar */}
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200 pb-2">
            <div className="flex items-center gap-1.5">
              {data.strategies.map((saved) => {
                const info = PLATFORM_INFO[saved.platform];
                const isActive = activeStrategyPlatform === saved.platform;
                return (
                  <button
                    key={saved.id}
                    type="button"
                    onClick={() => setActiveStrategyPlatform(saved.platform)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    <span>{info.icon}</span>
                    <span>{info.label} Büyüme Stratejisi</span>
                    {saved.stale && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
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
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
              >
                <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
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
                          <div>
                            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                              Taktik #{idx + 1} • {rec.format.toUpperCase()}
                            </span>
                            <h5 className="font-bold text-xs text-slate-900 mt-0.5">{rec.title}</h5>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              rec.effort === 'low'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : rec.effort === 'medium'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {rec.effort === 'low' ? 'Düşük Efor' : rec.effort === 'medium' ? 'Orta Efor' : 'Yüksek Efor'}
                          </span>
                        </div>

                        <p className="text-[11.5px] text-slate-600 leading-relaxed mt-1">
                          {rec.rationale}
                        </p>

                        {/* Adımlar */}
                        <ol className="text-[11px] text-slate-600 space-y-1 list-decimal pl-4 my-2">
                          {rec.steps.map((st, sIdx) => (
                            <li key={sIdx}>{st}</li>
                          ))}
                        </ol>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                          <span>Etki: {rec.impactHypothesis}</span>
                        </div>

                        {/* FİKİR ÜRET & PANOYA EKLE KÖPRÜSÜ */}
                        {rec.contentEligible && (
                          <div className="mt-2.5 pt-2.5 border-t border-indigo-50/80 bg-indigo-50/30 p-2.5 rounded-lg space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <select
                                aria-label="İçerik formatı"
                                value={selectedFormat}
                                disabled={busy || isPreviewing}
                                onChange={(e) =>
                                  setFormats((prev) => ({ ...prev, [rec.id]: e.target.value }))
                                }
                                className="h-7 text-[11px] font-semibold rounded border border-slate-300 bg-white px-2 text-slate-700"
                              >
                                {GROWTH_FORMATS[currentStrategy.platform].map((f) => (
                                  <option key={f} value={f}>
                                    Format: {f}
                                  </option>
                                ))}
                              </select>

                              {!isPreviewing && !isAdded ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => idea('preview', currentStrategy, rec.id, rec.format)}
                                  className="h-7 px-3 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm transition"
                                >
                                  <Sparkles size={11} />
                                  <span>Fikir Üret</span>
                                </button>
                              ) : null}

                              {isAdded && (
                                <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                                  <CheckCircle2 size={13} />
                                  <span>Panoya Eklendi</span>
                                </span>
                              )}
                            </div>

                            {/* Önizleme Açıldıysa */}
                            {previews[rec.id] && (
                              <div className="p-2.5 rounded bg-white border border-indigo-200 space-y-2 mt-2 shadow-sm animate-fadeIn">
                                <strong className="text-xs text-indigo-950 font-bold block">
                                  {previews[rec.id].title}
                                </strong>
                                <p className="text-[11px] text-slate-600 italic">
                                  "{previews[rec.id].hook}"
                                </p>
                                <ul className="text-[10.5px] text-slate-600 space-y-0.5 list-disc pl-3">
                                  {previews[rec.id].structure.map((s, sIdx) => (
                                    <li key={sIdx}>{s}</li>
                                  ))}
                                </ul>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => idea('add', currentStrategy, rec.id, rec.format)}
                                  className="w-full h-7 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1"
                                >
                                  <Plus size={12} />
                                  <span>Fikir Panosuna Ekle</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
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
                    <h4 className="font-bold text-xs text-slate-900">Ölçüm &amp; Hedef KPI'lar</h4>
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
        <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto text-xl shadow-sm">
            <TrendingUp size={24} />
          </div>
          <div className="max-w-md mx-auto">
            <h4 className="font-bold text-sm text-slate-800">Henüz Platform Stratejisi Üretilmedi</h4>
            <p className="text-xs text-slate-500 mt-1">
              Yukarıdaki panelden analiz etmek istediğiniz platformları seçip{' '}
              <strong>"Stratejiyi Üret / Yenile"</strong> butonuna basın. Agency uzman direktörleri
              markanız için özel büyüme takvimini ve taktikleri hazırlayacaktır.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
