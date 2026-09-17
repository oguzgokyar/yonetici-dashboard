"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, Building2, CheckCircle2, CircleDashed, ExternalLink, Globe2,
  ImageIcon, Megaphone, MessageSquareText, Palette, Pencil, Target, UsersRound,
} from "lucide-react";
import { useProjects } from "./projects-context";

export function ProjectHub({ projectId }: { projectId: string }) {
  const { getProject } = useProjects();
  const project = getProject(projectId);

  if (!project) {
    return <div className="empty-state"><h3>Proje bulunamadı</h3><Link className="button primary" href="/projects">Projelere dön</Link></div>;
  }

  const brand = project.brand;
  const fields = [brand.brandName, brand.website, brand.industry, brand.description, brand.audience, brand.tone, brand.phone, brand.email, brand.address, brand.logo];
  const completed = fields.filter(Boolean).length;
  const completeness = Math.round((completed / fields.length) * 100);
  const brandName = brand.brandName || project.name;

  return (
    <>
      <section className="project-identity-header">
        <div className="identity-monogram" style={{ background: `${brand.primaryColor}18`, color: brand.primaryColor }}>
          {brand.logo ? <Image src={brand.logo} alt={`${brandName} logosu`} width={58} height={58} unoptimized /> : brandName.slice(0, 2).toLocaleUpperCase("tr-TR")}
        </div>
        <div className="identity-copy">
          <span>PROJE KİMLİĞİ</span>
          <h2>{brandName}</h2>
          <p>{brand.description || "Marka açıklaması henüz eklenmedi."}</p>
          <div className="identity-meta">
            {brand.industry && <span><Building2 size={14} />{brand.industry}</span>}
            {brand.website && <a href={brand.website.startsWith("http") ? brand.website : `https://${brand.website}`} target="_blank" rel="noreferrer"><Globe2 size={14} />{brand.website}<ExternalLink size={12} /></a>}
          </div>
        </div>
        <Link className="button secondary" href={`/projects/${projectId}/settings`}><Pencil size={16} />Marka bilgilerini düzenle</Link>
      </section>

      <div className="project-brain-grid">
        <section className="panel brand-dna-panel">
          <div className="panel-header"><div><h3>Marka DNA’sı</h3><p>Üretimlerde kullanılacak ana bağlam</p></div><Palette size={19} /></div>
          <div className="brand-dna-list">
            <BrandFact icon={<Target size={17} />} label="Hedef kitle" value={brand.audience} placeholder="Hedef kitle tanımlanmadı" />
            <BrandFact icon={<MessageSquareText size={17} />} label="İletişim tonu" value={brand.tone} placeholder="Marka tonu tanımlanmadı" />
            <BrandFact icon={<Palette size={17} />} label="Ana renk" value={brand.primaryColor.toLocaleUpperCase("tr-TR")} color={brand.primaryColor} />
          </div>
        </section>

        <section className="panel completeness-panel">
          <div className="panel-header"><div><h3>Profil tamamlanma</h3><p>Daha iyi AI sonuçları için</p></div><span className="completion-value">%{completeness}</span></div>
          <div className="completion-track"><span style={{ width: `${completeness}%`, background: brand.primaryColor }} /></div>
          <div className="completion-list">
            <Completion label="Temel bilgiler" done={Boolean(brand.brandName && brand.industry)} />
            <Completion label="Marka açıklaması" done={Boolean(brand.description)} />
            <Completion label="Hedef kitle" done={Boolean(brand.audience)} />
            <Completion label="İletişim tonu" done={Boolean(brand.tone)} />
            <Completion label="Logo ve iletişim" done={Boolean(brand.logo && brand.phone && brand.email)} />
          </div>
          {completeness < 100 && <Link href={`/projects/${projectId}/settings`}>Eksik bilgileri tamamla <ArrowRight size={15} /></Link>}
        </section>
      </div>

      <section className="project-section-heading"><div><h3>Proje çalışma alanı</h3><p>Bu projeye bağlı üretim ve dağıtım süreçleri</p></div></section>
      <div className="workflow-grid">
        <WorkflowCard href={`/projects/${projectId}/overview`} icon={<UsersRound size={20} />} title="Genel Bakış" text="İçerik ve performans özetini görüntüleyin." />
        <WorkflowCard href={`/projects/${projectId}/image-generation`} icon={<ImageIcon size={20} />} title="Görsel Üret" text="Marka bilgileriyle uyumlu kreatifler üretin." />
        <WorkflowCard href={`/projects/${projectId}/publishing`} icon={<Megaphone size={20} />} title="Dağıtım" text="İçerikleri planlayın ve kanallara gönderin." />
      </div>
    </>
  );
}

function BrandFact({ icon, label, value, placeholder, color }: { icon: React.ReactNode; label: string; value: string; placeholder?: string; color?: string }) {
  return <div className="brand-fact"><div className="brand-fact-icon">{icon}</div><div><span>{label}</span><strong className={!value ? "muted-value" : ""}>{value || placeholder}</strong></div>{color && <i style={{ background: color }} />}</div>;
}

function Completion({ label, done }: { label: string; done: boolean }) {
  return <div>{done ? <CheckCircle2 className="done" size={16} /> : <CircleDashed size={16} />}<span>{label}</span></div>;
}

function WorkflowCard({ href, icon, title, text }: { href: string; icon: React.ReactNode; title: string; text: string }) {
  return <Link href={href} className="workflow-card"><div>{icon}</div><span><strong>{title}</strong><small>{text}</small></span><ArrowRight size={17} /></Link>;
}
