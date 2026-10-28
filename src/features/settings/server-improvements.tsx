"use client";

import { Zap, CheckCircle2, AlertCircle, HardDrive, Cpu, Activity, ShieldCheck, ArrowDownRight, ArrowUpRight } from "lucide-react";

export function ServerImprovements() {
  return (
    <section className="update-card" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="update-heading">
        <span style={{ background: "#ecfdf5", color: "#059669" }}>
          <Zap size={22} />
        </span>
        <div>
          <h2>Sunucu &amp; Performans Geliştirmeleri</h2>
          <p>Çekirdek optimizasyonu, I/O wait darboğazı çözümü ve kaynak yönetimi günlüğü</p>
        </div>
      </div>

      {/* DURUM BİLGİLENDİRME ROZETİ */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          padding: "14px 18px",
          background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
          border: "1px solid #bbf7d0",
          borderRadius: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <ShieldCheck size={20} color="#16a34a" />
          <div>
            <strong style={{ fontSize: "13px", color: "#166534", display: "block" }}>
              Performans Mimarisi Aktif &amp; Kalıcı
            </strong>
            <small style={{ fontSize: "11.5px", color: "#15803d" }}>
              2 vCPU / 3.6 GB RAM için çekirdek kısıtlamaları ve öncelik piramidi başarıyla devrede.
            </small>
          </div>
        </div>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            padding: "4px 10px",
            background: "#dcfce7",
            color: "#15803d",
            borderRadius: "20px",
            border: "1px solid #86efac",
          }}
        >
          Sistem Kararlı
        </span>
      </div>

      {/* NEDEN YAPILDI? */}
      <div
        style={{
          padding: "16px 18px",
          background: "#fefefe",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0f172a" }}>
          <AlertCircle size={17} color="#f59e0b" />
          <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>Neden Yapıldı? (Problem Analizi)</h3>
        </div>
        <p style={{ fontSize: "12.5px", lineHeight: "1.65", color: "#475569", margin: 0 }}>
          Sunucu 2 vCPU ve 3.6 GB RAM kapasitesinde 19 aktif Docker konteyneri ile çalışmaktadır. Varsayılan Linux yapılandırmasında (
          <code>swappiness=60</code>), fiziksel bellek %50&apos;ye ulaştığında çekirdek erkenden diske takas yazmaya başlamaktaydı. Bu durum saniyede 60 MB&apos;a varan disk takas kuyruğuna (Swap Thrashing) neden olarak <strong>CPU&apos;nun %54.5&apos;ini diski bekleme durumunda (I/O Wait) kilitlemekteydi</strong>.
        </p>
        <p style={{ fontSize: "12.5px", lineHeight: "1.65", color: "#475569", margin: 0 }}>
          Aynı zamanda arka planda çalışan TUI süreçleri ve headless tarayıcı motorları, web arayüzü ve veritabanlarıyla eşit öncelikle yarıştığından sistem yükü (Load Average) <strong>4.60</strong> seviyesine tırmanmakta ve arayüz yanıtlarında takılmalara yol açmaktaydı.
        </p>
      </div>

      {/* METRİK KARŞILAŞTIRMA KARTLARI */}
      <div>
        <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "10px" }}>
          Ölçülen Performans İyileşmeleri
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "12px",
          }}
        >
          {/* Kart 1: I/O Wait */}
          <div
            style={{
              padding: "14px",
              background: "#fafafa",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <small style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>I/O Wait (Diski Bekleme)</small>
              <ArrowDownRight size={15} color="#16a34a" />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span style={{ fontSize: "18px", fontWeight: 700, color: "#16a34a" }}>%1 - 4</span>
              <del style={{ fontSize: "12px", color: "#94a3b8" }}>%54.5</del>
            </div>
            <small style={{ fontSize: "10.5px", color: "#16a34a", fontWeight: 600 }}>~%95 Rahatlama (Takılma bitti)</small>
          </div>

          {/* Kart 2: Load Average */}
          <div
            style={{
              padding: "14px",
              background: "#fafafa",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <small style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>Sistem Yükü (Load Avg)</small>
              <ArrowDownRight size={15} color="#16a34a" />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span style={{ fontSize: "18px", fontWeight: 700, color: "#16a34a" }}>0.43</span>
              <del style={{ fontSize: "12px", color: "#94a3b8" }}>4.60</del>
            </div>
            <small style={{ fontSize: "10.5px", color: "#16a34a", fontWeight: 600 }}>%90 Düşüş (İşlemci serbest)</small>
          </div>

          {/* Kart 3: Disk Boş Alan */}
          <div
            style={{
              padding: "14px",
              background: "#fafafa",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <small style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>Boş Disk Alanı</small>
              <ArrowUpRight size={15} color="#2563eb" />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span style={{ fontSize: "18px", fontWeight: 700, color: "#2563eb" }}>14.0 GB</span>
              <del style={{ fontSize: "12px", color: "#94a3b8" }}>3.9 GB</del>
            </div>
            <small style={{ fontSize: "10.5px", color: "#2563eb", fontWeight: 600 }}>+10.1 GB Net Kazanım (%76 Doluluk)</small>
          </div>

          {/* Kart 4: Swap I/O Churn */}
          <div
            style={{
              padding: "14px",
              background: "#fafafa",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <small style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>Swap Out (Diske Yazma)</small>
              <ArrowDownRight size={15} color="#16a34a" />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span style={{ fontSize: "18px", fontWeight: 700, color: "#16a34a" }}>0 KB/s</span>
              <del style={{ fontSize: "12px", color: "#94a3b8" }}>~60 MB/s</del>
            </div>
            <small style={{ fontSize: "10.5px", color: "#16a34a", fontWeight: 600 }}>Sürekli disk takas döngüsü durduruldu</small>
          </div>
        </div>
      </div>

      {/* UYGULANAN MİMARİ MÜDAHALELER */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#334155", margin: 0 }}>
          Uygulanan Kalıcı İyileştirme Adımları
        </h3>

        <div style={{ display: "grid", gap: "10px" }}>
          {/* Adım 1 */}
          <div
            style={{
              padding: "12px 14px",
              border: "1px solid #f1f5f9",
              background: "#f8fafc",
              borderRadius: "8px",
              display: "flex",
              gap: "10px",
              alignItems: "flex-start",
            }}
          >
            <CheckCircle2 size={16} color="#059669" style={{ marginTop: "2px", flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: "12.5px", color: "#0f172a", display: "block" }}>
                1. Kernel I/O ve Takaslama Politikası (sysctl Kalıcı Yapılandırma)
              </strong>
              <p style={{ fontSize: "11.5px", color: "#64748b", margin: "4px 0 0 0", lineHeight: "1.5" }}>
                <code>/etc/sysctl.d/99-performance.conf</code> dosyası ile <code>vm.swappiness = 10</code>, <code>vm.vfs_cache_pressure = 50</code> ve <code>vm.dirty_ratio = 10</code> parametreleri kalıcı kılındı. Bellek tükenme noktasına gelmedikçe diske veri yazılması durduruldu.
              </p>
            </div>
          </div>

          {/* Adım 2 */}
          <div
            style={{
              padding: "12px 14px",
              border: "1px solid #f1f5f9",
              background: "#f8fafc",
              borderRadius: "8px",
              display: "flex",
              gap: "10px",
              alignItems: "flex-start",
            }}
          >
            <CheckCircle2 size={16} color="#059669" style={{ marginTop: "2px", flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: "12.5px", color: "#0f172a", display: "block" }}>
                2. CPU Nice Piramidi ve Süreç Önceliklendirmesi
              </strong>
              <p style={{ fontSize: "11.5px", color: "#64748b", margin: "4px 0 0 0", lineHeight: "1.5" }}>
                TUI süreçleri, Headless Chromium ve arka plan botları <code>nice +10</code> (düşük öncelik) seviyesine ayarlandı. Marka Motoru web sunucusu, Traefik proxy ve PostgreSQL/Redis veritabanları tam öncelikli kılındı.
              </p>
            </div>
          </div>

          {/* Adım 3 */}
          <div
            style={{
              padding: "12px 14px",
              border: "1px solid #f1f5f9",
              background: "#f8fafc",
              borderRadius: "8px",
              display: "flex",
              gap: "10px",
              alignItems: "flex-start",
            }}
          >
            <CheckCircle2 size={16} color="#059669" style={{ marginTop: "2px", flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: "12.5px", color: "#0f172a", display: "block" }}>
                3. Sıfır Riskli Disk Hijyeni ve Swap Offloading
              </strong>
              <p style={{ fontSize: "11.5px", color: "#64748b", margin: "4px 0 0 0", lineHeight: "1.5" }}>
                Ana diskteki 4.0 GB atıl <code>/swap-extra.img</code> dosyası kaldırıldı (Swap alanı 41 GB boş yeri olan <code>/mnt/data</code> ikincil diskine taşındı). Eski Docker derleme katmanları temizlendi ve kullanılabilir disk alanı 14.0 GB&apos;a yükseltildi.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
