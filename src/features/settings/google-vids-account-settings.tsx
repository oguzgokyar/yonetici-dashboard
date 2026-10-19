"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Video,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Power,
  RotateCcw,
  ExternalLink,
  Monitor,
  Info,
  Loader2,
  ShieldCheck,
} from "lucide-react";

type GoogleVidsAccount = {
  id: string;
  email: string;
  display_name?: string;
  authuser_index: number;
  profile_directory: string;
  quota_status: "available" | "exhausted" | "cooldown";
  cooldown_until?: string | null;
  total_videos_rendered: number;
  last_used_at?: string | null;
  is_active: number;
  created_at?: string;
  updated_at?: string;
};

export function GoogleVidsAccountSettings() {
  const [accounts, setAccounts] = useState<GoogleVidsAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // noVNC helper state
  const [novncRunning, setNovncRunning] = useState(false);
  const [novncLoading, setNovncLoading] = useState(false);

  // Manual Add Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newAuthuser, setNewAuthuser] = useState(0);
  const [newProfileDir, setNewProfileDir] = useState("Default");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [adding, setAdding] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/system/google-vids/accounts", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.accounts)) {
          setAccounts(data.accounts);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const checkNovncStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/system/novnc", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setNovncRunning(data.status === "running" || data.running === true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    void loadData();
    void checkNovncStatus();
    const interval = setInterval(checkNovncStatus, 6000);
    return () => clearInterval(interval);
  }, [loadData, checkNovncStatus]);

  async function handleNovncToggle(action: "start" | "stop") {
    setNovncLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/system/novnc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setNovncRunning(action === "start");
        if (action === "start" && data.url) {
          try {
            window.open(data.url, "_blank");
          } catch {}
          setActionMessage({
            type: "success",
            text: "noVNC ekranı açıldı. Google hesabınıza giriş yaptıktan sonra 'Hesapları Otomatik Eşitle' butonuna basın.",
          });
        } else {
          setActionMessage({
            type: "success",
            text: "noVNC ve Chromium oturumu kapatıldı. RAM serbest bırakıldı.",
          });
          // Oturum kapandıktan sonra hesapları eşitle
          void handleSyncAccounts();
        }
      } else {
        setActionMessage({
          type: "error",
          text: data.message || "noVNC işlemi başarısız.",
        });
      }
    } catch (e) {
      setActionMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Bağlantı hatası",
      });
    } finally {
      setNovncLoading(false);
      void checkNovncStatus();
    }
  }

  async function handleSyncAccounts() {
    setSyncing(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/system/google-vids/accounts/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setActionMessage({
          type: "success",
          text: `✓ ${data.message || "Tarayıcıdaki Google hesapları başarıyla eşitlendi."}`,
        });
        await loadData();
      } else {
        setActionMessage({
          type: "error",
          text: data.message || "Hesap eşitleme başarısız oldu. Tarayıcıda aktif oturum olduğundan emin olun.",
        });
      }
    } catch (e) {
      setActionMessage({
        type: "error",
        text: `Eşitleme hatası: ${String(e)}`,
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAdding(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/system/google-vids/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          authuserIndex: newAuthuser,
          profileDirectory: newProfileDir.trim() || "Default",
          displayName: newDisplayName.trim() || newEmail.trim().split("@")[0],
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setActionMessage({
          type: "success",
          text: "✓ Yeni Google Vids hesabı havuza eklendi.",
        });
        setShowAddModal(false);
        setNewEmail("");
        setNewDisplayName("");
        setNewAuthuser(0);
        await loadData();
      } else {
        setActionMessage({
          type: "error",
          text: data.message || "Hesap eklenemedi.",
        });
      }
    } catch (e) {
      setActionMessage({
        type: "error",
        text: `Hata: ${String(e)}`,
      });
    } finally {
      setAdding(false);
    }
  }

  async function handleResetQuota(id: string) {
    try {
      const res = await fetch("/api/system/google-vids/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, quotaStatus: "available" }),
      });
      if (res.ok) {
        setActionMessage({ type: "success", text: "Hesap kotası sıfırlandı ve kullanıma hazır." });
        await loadData();
      }
    } catch {}
  }

  async function handleToggleActive(account: GoogleVidsAccount) {
    const nextActive = account.is_active === 1 ? false : true;
    try {
      const res = await fetch("/api/system/google-vids/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: account.id, isActive: nextActive }),
      });
      if (res.ok) {
        setActionMessage({
          type: "success",
          text: nextActive
            ? `✓ "${account.email}" hesabı aktifleştirildi (üretim rotasyonuna dahil edildi).`
            : `✓ "${account.email}" hesabı pasife alındı (havuzda saklanıyor, üretimde atlanacak).`,
        });
        await loadData();
      }
    } catch {}
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`"${email}" hesabını havuzdan silmek istediğinize emin misiniz?`)) return;
    try {
      const res = await fetch(`/api/system/google-vids/accounts?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setActionMessage({ type: "success", text: "Hesap havuzdan kaldırıldı." });
        await loadData();
      } else {
        setActionMessage({ type: "error", text: data.message || "Hesap silinemedi." });
      }
    } catch (e) {
      setActionMessage({ type: "error", text: String(e) });
    }
  }

  const availableCount = accounts.filter((a) => a.quota_status === "available" && a.is_active === 1).length;
  const estimatedCapacity = availableCount * 8;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Üst Başlık & Açıklama */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "14px",
          padding: "16px 20px",
          borderRadius: "14px",
          background: "linear-gradient(135deg, #f8fafc, #eff6ff)",
          border: "1px solid #dbeafe",
        }}
      >
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "#2563eb",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Video size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#1e3a8a" }}>
              Google Vids Çoklu Hesap Havuzu
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#475569", lineHeight: 1.5 }}>
              Google video oluşturma kotalarını dengeli paylaştırmak için tarayıcı oturumlarınızı yönetin.
              Üretim sırasında müsait hesaplar otomatik rotasyonla kullanılır.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={syncing}
            onClick={() => void handleSyncAccounts()}
            className="button secondary"
            style={{ fontSize: "12.5px", padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: "6px" }}
            title="Chromium oturumlarındaki açık Google hesaplarını otomatik olarak listeye çeker"
          >
            {syncing ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
            <span>Hesapları Otomatik Eşitle</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="button primary"
            style={{
              fontSize: "12.5px",
              padding: "8px 14px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "#2563eb",
              borderColor: "#2563eb",
            }}
          >
            <Plus size={14} />
            <span>Manuel Hesap Ekle</span>
          </button>
        </div>
      </div>

      {/* noVNC Durum Bildirim / Yardımcı Kartı */}
      <div
        style={{
          padding: "12px 16px",
          borderRadius: "12px",
          background: novncRunning ? "rgba(37, 99, 235, 0.06)" : "#f8fafc",
          border: `1px solid ${novncRunning ? "rgba(37, 99, 235, 0.25)" : "#e2e8f0"}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Monitor size={16} color={novncRunning ? "#2563eb" : "#64748b"} />
          <span style={{ fontSize: "12.5px", color: "#334155" }}>
            {novncRunning ? (
              <>
                <strong>noVNC Oturumu Açık:</strong> Tarayıcıdan yeni bir Google hesabına giriş yapabilir ve ardından{" "}
                <em>&quot;Hesapları Otomatik Eşitle&quot;</em> butonuna basabilirsiniz.
              </>
            ) : (
              <>
                <strong>Yeni Hesap Girişi Yapmak İçin:</strong> Sunucudaki noVNC uzak masaüstünü başlatıp Google girişi
                yapabilirsiniz.
              </>
            )}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {novncRunning ? (
            <>
              <a
                href="http://43.131.47.253:8080/novnc/vnc_auto.html?path=novnc/websockify%3Fservice%3Dcanva"
                target="_blank"
                rel="noreferrer"
                className="button primary compact"
                style={{ fontSize: "11.5px", height: "28px", padding: "0 10px", background: "#2563eb" }}
              >
                <span>noVNC Ekranını Aç</span>
                <ExternalLink size={12} />
              </a>
              <button
                type="button"
                disabled={novncLoading}
                onClick={() => void handleNovncToggle("stop")}
                className="button secondary compact"
                style={{ fontSize: "11.5px", height: "28px", padding: "0 10px", color: "#dc2626" }}
                title="noVNC'yi kapat ve sunucu RAM'ini sıfırla"
              >
                {novncLoading ? <Loader2 size={12} className="spin" /> : <Power size={12} />}
                <span>noVNC Kapat</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={novncLoading}
              onClick={() => void handleNovncToggle("start")}
              className="button secondary compact"
              style={{ fontSize: "11.5px", height: "28px", padding: "0 10px" }}
            >
              {novncLoading ? <Loader2 size={12} className="spin" /> : <Monitor size={12} />}
              <span>Giriş İçin noVNC Başlat</span>
            </button>
          )}
        </div>
      </div>

      {/* Bildirim Alanı */}
      {actionMessage && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            fontSize: "12.5px",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: actionMessage.type === "success" ? "#f0fdf4" : "#fef2f2",
            color: actionMessage.type === "success" ? "#166534" : "#991b1b",
            border: `1px solid ${actionMessage.type === "success" ? "#bbf7d0" : "#fecaca"}`,
          }}
        >
          {actionMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* KPI Kartları */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "12px",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#64748b" }}>Toplam Havuz Hesabı</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", marginTop: "4px" }}>
            {accounts.length} Adet
          </div>
        </div>

        <div
          style={{
            padding: "14px 16px",
            borderRadius: "12px",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#64748b" }}>Kullanılabilir &amp; Aktif</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#16a34a", marginTop: "4px" }}>
            🟢 {availableCount} Hesap Hazır
          </div>
        </div>

        <div
          style={{
            padding: "14px 16px",
            borderRadius: "12px",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#64748b" }}>Tahmini Video Kapasitesi</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#2563eb", marginTop: "4px" }}>
            ~{estimatedCapacity} Video / Gün
          </div>
        </div>
      </div>

      {/* Hesap Kartları Listesi */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ fontSize: "14px", color: "#0f172a" }}>Bağlı Hesaplar ({accounts.length})</strong>
          <button
            type="button"
            onClick={() => void loadData()}
            className="button ghost compact"
            style={{ fontSize: "12px", height: "28px" }}
          >
            <RefreshCw size={12} className={loading ? "spin" : ""} />
            <span>Yenile</span>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
            <Loader2 size={24} className="spin" style={{ margin: "0 auto 8px" }} />
            <p style={{ margin: 0, fontSize: "13px" }}>Hesaplar yükleniyor...</p>
          </div>
        ) : accounts.length === 0 ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              borderRadius: "12px",
              background: "#f8fafc",
              border: "1px dashed #cbd5e1",
            }}
          >
            <Video size={32} color="#94a3b8" style={{ margin: "0 auto 10px" }} />
            <h4 style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 600, color: "#334155" }}>
              Henüz Google Vids Hesabı Bulunmuyor
            </h4>
            <p style={{ margin: "0 0 16px", fontSize: "12.5px", color: "#64748b" }}>
              noVNC ekranını başlatıp Google hesabınıza giriş yapabilir veya manuel hesap ekleyebilirsiniz.
            </p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => void handleNovncToggle("start")}
                className="button primary compact"
                style={{ background: "#2563eb" }}
              >
                <Monitor size={13} />
                <span>noVNC ile Giriş Yap</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="button secondary compact"
              >
                <Plus size={13} />
                <span>Manuel Hesap Ekle</span>
              </button>
            </div>
          </div>
        ) : (
          accounts.map((acc) => {
            const isAvailable = acc.quota_status === "available";
            const isActive = acc.is_active === 1;

            return (
              <div
                key={acc.id}
                style={{
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: isActive ? "#ffffff" : "#f8fafc",
                  border: isActive ? "1px solid #e2e8f0" : "1px dashed #cbd5e1",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                  opacity: isActive ? 1 : 0.85,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "20px" }}>
                    {!isActive ? "⏸️" : isAvailable ? "🟢" : "🔴"}
                  </span>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "13.5px", color: isActive ? "#0f172a" : "#64748b" }}>
                        {acc.email}
                      </strong>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "2px 6px",
                          borderRadius: "6px",
                          background: isActive ? "#f1f5f9" : "#e2e8f0",
                          color: "#475569",
                        }}
                      >
                        authuser={acc.authuser_index}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#64748b",
                        }}
                      >
                        [{acc.profile_directory || "Default"}]
                      </span>
                      {!isActive && (
                        <span
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: "99px",
                            background: "#fef3c7",
                            color: "#92400e",
                            border: "1px solid #fde68a",
                          }}
                        >
                          Üretimde Atlanıyor
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "3px" }}>
                      Durum:{" "}
                      <strong style={{ color: !isActive ? "#b45309" : isAvailable ? "#16a34a" : "#dc2626" }}>
                        {!isActive ? "Pasif (Havuzda Saklanıyor, Üretimde Atlanır)" : isAvailable ? "Kota Kullanılabilir" : "Kotada / Dinlenmede"}
                      </strong>
                      {" • "}
                      Toplam Üretilen: <strong>{acc.total_videos_rendered} Video</strong>
                      {acc.last_used_at && (
                        <>
                          {" • "}
                          Son Kullanım: {new Date(acc.last_used_at).toLocaleDateString("tr-TR")}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {!isAvailable && isActive && (
                    <button
                      type="button"
                      onClick={() => void handleResetQuota(acc.id)}
                      className="button secondary compact"
                      style={{ fontSize: "11px", height: "32px", color: "#0284c7" }}
                      title="Kota durumunu sıfırlar ve tekrar 'available' yapar"
                    >
                      <RotateCcw size={12} />
                      <span>Kotayı Sıfırla</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleToggleActive(acc)}
                    className="button compact"
                    style={{
                      fontSize: "11.5px",
                      height: "32px",
                      padding: "0 12px",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      cursor: "pointer",
                      borderRadius: "8px",
                      background: isActive ? "#fffbeb" : "#16a34a",
                      color: isActive ? "#b45309" : "#ffffff",
                      border: `1px solid ${isActive ? "#fde68a" : "#16a34a"}`,
                      transition: "all 0.15s ease",
                    }}
                    title={
                      isActive
                        ? "Hesabı havuzdan silmeden pasife al (üretim rotasyonunda atlanır)"
                        : "Hesabı tekrar aktifleştir ve üretim rotasyonuna dahil et"
                    }
                  >
                    <Power size={13} color={isActive ? "#d97706" : "#ffffff"} />
                    <span>{isActive ? "Pasife Al (Kapat)" : "Aktif Et (Aç)"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleDelete(acc.id, acc.email)}
                    className="button ghost compact"
                    style={{ fontSize: "11px", height: "32px", color: "#dc2626", padding: "0 8px" }}
                    title="Hesabı tamamen havuzdan sil"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Manuel Hesap Ekle Modal */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              maxWidth: "500px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                Manuel Google Vids Hesabı Ekle
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "8px",
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddAccount} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Google Hesabı E-Posta Adresi
                </label>
                <input
                  type="email"
                  required
                  placeholder="ornek@gmail.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    authuser İndeksi
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={newAuthuser}
                    onChange={(e) => setNewAuthuser(parseInt(e.target.value, 10) || 0)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                    }}
                  />
                  <small style={{ fontSize: "11px", color: "#64748b" }}>
                    Tarayıcıdaki hesap sırası (0, 1, 2...)
                  </small>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    Profil Dizini
                  </label>
                  <input
                    type="text"
                    value={newProfileDir}
                    onChange={(e) => setNewProfileDir(e.target.value)}
                    placeholder="Default veya Profile 1"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                    }}
                  />
                  <small style={{ fontSize: "11px", color: "#64748b" }}>Chrome profil klasörü</small>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Görünen İsim (İsteğe bağlı)
                </label>
                <input
                  type="text"
                  placeholder="Hesap 1 (Atölye Hanem)"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="button secondary"
                  style={{ fontSize: "12.5px" }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="button primary"
                  style={{ fontSize: "12.5px", background: "#2563eb", borderColor: "#2563eb" }}
                >
                  {adding ? <Loader2 size={13} className="spin" /> : <Plus size={13} />}
                  <span>Havuza Ekle</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
