"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, ImageIcon, MoreHorizontal, Plus, Send, Sparkles, WandSparkles } from "lucide-react";
import { useProjects } from "@/features/projects/projects-context";

export function ProjectOverview({ projectId }: { projectId: string }) {
  const { getProject, ready } = useProjects();
  const project = getProject(projectId);
  if (!ready) return <div className="overview-loading" />;
  if (!project) return <div className="empty-state"><h3>Proje bulunamadı</h3><Link className="button primary" href="/projects">Projelere dön</Link></div>;
  const profileComplete = Boolean(project.brand.description && project.brand.audience && project.brand.tone);

  return <>
    <section className="hero-panel">
      <div>
        <span className="welcome-pill"><Sparkles size={14} /> Bugünün özeti</span>
        <h2>Merhaba, {project.name} için<br /><em>üretmeye hazırsınız.</em></h2>
        <p>İçerik üretiminizi, planınızı ve kanal performansınızı tek bir çalışma alanından yönetin.</p>
        <div className="hero-actions"><Link className="button primary" href={`/projects/${projectId}/image-generation`}><WandSparkles size={18} />İçerik oluştur</Link><Link className="button ghost" href={`/projects/${projectId}/publishing`}><CalendarDays size={18} />Planı görüntüle</Link></div>
      </div>
      <div className="hero-visual" aria-hidden="true"><div className="orb orb-one" /><div className="orb orb-two" /><div className="floating-card card-a"><ImageIcon size={18} /><span>Yeni kreatif</span><strong>1080 × 1350</strong></div><div className="floating-card card-b"><CheckCircle2 size={18} /><span>Yayına hazır</span></div></div>
    </section>

    {!profileComplete && <section className="setup-banner"><div className="setup-icon"><Sparkles size={20} /></div><div><strong>Marka profilinizi tamamlayın</strong><p>AI üretimlerinin markanıza daha iyi uyum sağlaması için marka tonunu ve hedef kitlenizi ekleyin.</p></div><Link href={`/projects/${projectId}/settings`} className="button secondary">Şimdi tamamla <ArrowRight size={16} /></Link></section>}

    <section className="metric-grid">
      <Metric icon={<ImageIcon size={19} />} label="Toplam içerik" value="0" change="Bu ay" tone="violet" />
      <Metric icon={<CalendarDays size={19} />} label="Planlanan" value="0" change="Önümüzdeki 7 gün" tone="blue" />
      <Metric icon={<Send size={19} />} label="Yayınlanan" value="0" change="Bu ay" tone="green" />
      <Metric icon={<Sparkles size={19} />} label="AI üretimi" value="0" change="Bu ay" tone="orange" />
    </section>

    <div className="overview-grid">
      <section className="panel recent-panel"><div className="panel-header"><div><h3>Son içerikler</h3><p>En son ürettiğiniz kreatifler</p></div><button className="icon-button"><MoreHorizontal size={20} /></button></div><div className="panel-empty"><div><ImageIcon size={25} /></div><strong>Henüz içerik yok</strong><p>İlk kreatifinizi oluşturduğunuzda burada görünecek.</p><Link href={`/projects/${projectId}/image-generation`}><Plus size={16} /> İlk içeriği oluştur</Link></div></section>
      <section className="panel schedule-panel"><div className="panel-header"><div><h3>Yaklaşan paylaşımlar</h3><p>Önümüzdeki 7 gün</p></div><Link href={`/projects/${projectId}/publishing`}>Tümünü gör</Link></div><div className="mini-calendar"><div className="calendar-days"><span>Pzt<strong>14</strong></span><span>Sal<strong>15</strong></span><span className="today">Çar<strong>16</strong></span><span>Per<strong>17</strong></span><span>Cum<strong>18</strong></span><span>Cmt<strong>19</strong></span><span>Paz<strong>20</strong></span></div><div className="schedule-empty"><CalendarDays size={21} /><span>Planlanmış paylaşım yok</span></div></div></section>
    </div>
  </>;
}

function Metric({ icon, label, value, change, tone }: { icon: React.ReactNode; label: string; value: string; change: string; tone: string }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{change}</small></div></div>;
}
