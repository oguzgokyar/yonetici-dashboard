"use client";

import Link from "next/link";
import {
  Sparkles,
  Video,
  FileText,
  TrendingUp,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Terminal,
  Layers,
  Activity,
  Cpu,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";

type ToolCardProps = {
  href: string;
  externalUrl?: string;
  icon: React.ReactNode;
  title: string;
  badge: string;
  badgeColor?: "emerald" | "blue" | "purple" | "rose";
  description: string;
  tag: string;
};

export default function DeveloperToolsPage() {
  return (
    <DashboardShell title="Geliştirici Araçları" eyebrow="Yönetim & Otomasyon">
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Banner Section */}
        <section
          style={{
            background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)",
            borderRadius: "18px",
            padding: "28px 32px",
            color: "white",
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 10px 30px rgba(49, 46, 129, 0.15)",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: "-20px",
              bottom: "-30px",
              opacity: 0.1,
              transform: "rotate(-10deg)",
            }}
          >
            <Cpu size={220} />
          </div>

          <div style={{ position: "relative", zIndex: 1, maxWidth: "680px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(255, 255, 255, 0.15)",
                padding: "4px 10px",
                borderRadius: "20px",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                marginBottom: "12px",
                backdropFilter: "blur(6px)",
              }}
            >
              <Activity size={12} className="text-emerald-400" />
              <span>Sistem Araçları &amp; Otopilotlar</span>
            </div>
            <h2 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 8px 0", letterSpacing: "-0.5px" }}>
              Geliştirici &amp; Büyüme Araçları Merkezi
            </h2>
            <p style={{ margin: 0, fontSize: "14px", color: "rgba(255, 255, 255, 0.82)", lineHeight: 1.5 }}>
              Atölye Hanem dijital ekosistemine entegre otomasyon sunucuları, toplantı transkripsiyon botu,
              teklif motoru ve sosyal medya büyüme havuzlarına tek merkezden erişin.
            </p>
          </div>
        </section>

        {/* Tools Grid Section */}
        <div>
          <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 4px 0" }}>
                Aktif Geliştirici &amp; Operasyon Masaları
              </h3>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
                Doğrudan Marka Motoru paneli içinde entegre olarak çalışır
              </p>
            </div>
          </div>

          <div
            className="workflow-grid"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
              gap: "16px",
            }}
          >
            {/* 1. Büyüme Arşivi */}
            <ToolCard
              href="/growth-archive"
              externalUrl="https://teklif.43.131.47.253.sslip.io/library/"
              icon={<Sparkles size={22} className="text-indigo-600" />}
              title="Büyüme &amp; Strateji Arşivi"
              badge="Kütüphane"
              badgeColor="blue"
              tag="PDF / Dokümanlar"
              description="Pazarlama dökümanları, büyüme analizleri, infografikler ve referans strateji kitaplığı."
            />

            {/* 2. Toplantı Asistanı */}
            <ToolCard
              href="/meeting"
              externalUrl="https://teklif.43.131.47.253.sslip.io/meeting/"
              icon={<Video size={22} className="text-purple-600" />}
              title="Toplantı Asistanı &amp; Arşiv"
              badge="Canlı Bot"
              badgeColor="purple"
              tag="Meet / WebRTC"
              description="Google Meet / Zoom ses kaydı, canlı transkript, Gemini toplantı özetleri ve sesli arşiv."
            />

            {/* 3. Teklif Aracı */}
            <ToolCard
              href="/teklif"
              externalUrl="https://teklif.43.131.47.253.sslip.io/teklif/"
              icon={<FileText size={22} className="text-emerald-600" />}
              title="Teklif Hazırlama Aracı"
              badge="Kurumsal"
              badgeColor="emerald"
              tag="Fiyat / PDF"
              description="Kurumsal müşteri teklif sihirbazı, otomatik maliyet hesaplama ve anlık PDF export."
            />

            {/* 4. Instagram Growth */}
            <ToolCard
              href="/instagram-growth"
              externalUrl="https://growth.43.131.47.253.sslip.io/"
              icon={<TrendingUp size={22} className="text-rose-600" />}
              title="Instagram Growth &amp; Takipçi Masası"
              badge="Otopilot"
              badgeColor="rose"
              tag="Otomasyon &amp; Filtre"
              description="Otopilot etkileşim, beyaz liste koruması ve yabancı takipçileri çıkarma havuzu."
            />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function ToolCard({
  href,
  externalUrl,
  icon,
  title,
  badge,
  badgeColor = "blue",
  description,
  tag,
}: ToolCardProps) {
  const badgeClasses = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
  }[badgeColor];

  return (
    <div
      style={{
        background: "white",
        borderRadius: "16px",
        border: "1px solid var(--border)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "16px",
        transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
        boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
      }}
      className="hover:shadow-md hover:-translate-y-1"
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              display: "grid",
              placeItems: "center",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            {icon}
          </div>

          <span
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${badgeClasses}`}
          >
            {badge}
          </span>
        </div>

        <h4 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px 0", color: "#0f172a" }}>
          {title}
        </h4>
        <p style={{ margin: "0 0 12px 0", fontSize: "12.5px", color: "#64748b", lineHeight: 1.45 }}>
          {description}
        </p>

        <span
          style={{
            fontSize: "11px",
            color: "#94a3b8",
            background: "#f1f5f9",
            padding: "3px 8px",
            borderRadius: "6px",
            fontWeight: 500,
          }}
        >
          {tag}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          paddingTop: "14px",
          borderTop: "1px solid #f1f5f9",
        }}
      >
        <Link
          href={href}
          className="button primary compact"
          style={{
            flex: 1,
            justifyContent: "center",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12.5px",
            fontWeight: 600,
            padding: "8px 14px",
          }}
        >
          <span>Paneli Aç</span>
          <ArrowRight size={14} />
        </Link>

        {externalUrl && (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="button ghost compact icon-only"
            title="Yeni Sekmede Aç ↗"
            style={{
              width: "36px",
              height: "36px",
              display: "grid",
              placeItems: "center",
              color: "#64748b",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
            }}
          >
            <ExternalLink size={15} />
          </a>
        )}
      </div>
    </div>
  );
}
