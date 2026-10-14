"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight, Building2, ExternalLink, Globe2,
  Image as ImageIcon, Clapperboard, Film, Compass, Send, Share2, Pin,
  Pencil, Layers, Sparkles, Settings2,
} from "lucide-react";
import { useProjects } from "./projects-context";
import { BrandSettings } from "./brand-settings";

export function ProjectHub({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "settings" ? "settings" : "hub";
  const [activeTab, setActiveTab] = useState<"hub" | "settings">(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "settings") {
      setActiveTab("settings");
    } else if (tabParam === "hub") {
      setActiveTab("hub");
    }
  }, [searchParams]);

  const { getProject } = useProjects();
  const project = getProject(projectId);

  if (!project) {
    return (
      <div className="empty-state">
        <h3>Proje bulunamadı</h3>
        <Link className="button primary" href="/projects">Projelere dön</Link>
      </div>
    );
  }

  const brand = project.brand;
  const fields = [
    brand.brandName, brand.website, brand.industry, brand.description,
    brand.audience, brand.tone, brand.phone, brand.email, brand.address, brand.logo
  ];
  const completed = fields.filter(Boolean).length;
  const completeness = Math.round((completed / fields.length) * 100);
  const brandName = brand.brandName || project.name;

  return (
    <>
      {/* Üst Sekme Barı: Çalışma Alanı vs Marka & Proje Ayarları */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid var(--border)",
        paddingBottom: "12px",
        marginBottom: "20px",
      }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setActiveTab("hub")}
            className={`button compact ${activeTab === "hub" ? "primary" : "ghost"}`}
            style={{
              fontSize: "13px",
              fontWeight: 700,
              padding: "8px 16px",
              height: "36px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Layers size={16} />
            <span>Üretim Araçları</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`button compact ${activeTab === "settings" ? "primary" : "ghost"}`}
            style={{
              fontSize: "13px",
              fontWeight: 700,
              padding: "8px 16px",
              height: "36px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Settings2 size={16} />
            <span>Marka Bilgileri</span>
          </button>
        </div>

        {activeTab === "hub" && (
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className="button secondary compact"
            style={{ fontSize: "12px", height: "32px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Pencil size={14} />
            <span>Ayarları Düzenle</span>
          </button>
        )}
      </div>

      {activeTab === "settings" ? (
        <BrandSettings projectId={projectId} />
      ) : (
        <>
          {/* Proje Kimlik Kartı */}
          <section className="project-identity-header">
            <div className="identity-monogram" style={{ background: `${brand.primaryColor}18`, color: brand.primaryColor }}>
              {brand.logo ? (
                <Image src={brand.logo} alt={`${brandName} logosu`} width={58} height={58} unoptimized />
              ) : (
                brandName.slice(0, 2).toLocaleUpperCase("tr-TR")
              )}
            </div>
            <div className="identity-copy">
              <span>PROJE KİMLİĞİ</span>
              <h2>{brandName}</h2>
              <p>{brand.description || "Marka açıklaması henüz eklenmedi."}</p>
              <div className="identity-meta">
                {brand.industry && <span><Building2 size={14} />{brand.industry}</span>}
                {brand.website && (
                  <a href={brand.website.startsWith("http") ? brand.website : `https://${brand.website}`} target="_blank" rel="noreferrer">
                    <Globe2 size={14} />{brand.website}<ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
            <button
              type="button"
              className="button secondary"
              onClick={() => setActiveTab("settings")}
            >
              <Pencil size={16} />Marka bilgilerini düzenle
            </button>
          </section>

          {/* TÜM ÜRETİM ARAÇLARI KISAYOL KARTLARI */}
          <section className="project-section-heading" style={{ marginTop: "16px" }}>
            <div>
              <h3>Tüm Üretim ve Yönetim Araçları</h3>
              <p>Bu projeye bağlı içerik üretimi, video kurgusu ve kanal dağıtım araçları</p>
            </div>
          </section>

          <div className="workflow-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "14px" }}>
            {/* 1. Strateji & Fikir Makinesi */}
            <WorkflowCard
              href={`/projects/${projectId}/strategy`}
              icon={<Compass size={20} />}
              title="Strateji &amp; İçerik"
              text="Fikir Makinesi, 4 sütunlu kanban ve platform büyüme kokpiti."
            />

            {/* 2. Görsel & Canva Stüdyosu */}
            <WorkflowCard
              href={`/projects/${projectId}/image-generation`}
              icon={<ImageIcon size={20} />}
              title="Görsel &amp; Canva Üret"
              text="Kreatif reklam afişleri, Canva karosel ve story tasarımları."
            />

            {/* 3. Google Vids Video Stüdyosu */}
            <WorkflowCard
              href={`/projects/${projectId}/video-generation?tab=vids`}
              icon={<Clapperboard size={20} />}
              title="Google Vids Video"
              text="Karakter DNA'sı, sinematik sahneler, dış ses ve altyazılı video."
            />

            {/* 4. Remotion Hareketli Video */}
            <WorkflowCard
              href={`/projects/${projectId}/video-generation?tab=motion`}
              icon={<Sparkles size={20} />}
              title="Remotion Motion Video"
              text="Statik görselleri hareketli posterlere ve videolara dönüştürün."
            />

            {/* 5. Stok Video & Altyazı Motoru */}
            <WorkflowCard
              href={`/projects/${projectId}/stock-videos`}
              icon={<Film size={20} />}
              title="Stok İçerik &amp; Kurgu"
              text="Google Drive stok videoları, bulanık çerçeve ve altyazı motoru."
            />

            {/* 6. Paylaşım Planı & Dağıtım */}
            <WorkflowCard
              href={`/projects/${projectId}/publishing`}
              icon={<Send size={20} />}
              title="Paylaşım Planı"
              text="Tekil ve toplu zamanlama, AI etiket kontrolü ve kanal dağıtımı."
            />

            {/* 7. Sosyal Medya Hesapları */}
            <WorkflowCard
              href={`/projects/${projectId}/accounts`}
              icon={<Share2 size={20} />}
              title="Bağlı Hesaplar"
              text="YouTube, TikTok, Instagram ve diğer kanal bağlantıları."
            />

            {/* 8. Pinterest Stüdyosu */}
            <WorkflowCard
              href={`/projects/${projectId}/pinterest`}
              icon={<Pin size={20} />}
              title="Pinterest Panoları"
              text="Pano yönetimi, pin zamanlama ve görsel paylaşımı."
            />
          </div>
        </>
      )}
    </>
  );
}

function WorkflowCard({
  href,
  icon,
  title,
  text,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Link href={href} className="workflow-card">
      <div>{icon}</div>
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      <ArrowRight size={17} />
    </Link>
  );
}
