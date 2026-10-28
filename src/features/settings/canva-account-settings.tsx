"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Palette,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Power,
  RotateCcw,
  Sparkles,
  Key,
} from "lucide-react";
import type { CanvaAccount, CanvaPoolSummary } from "@/lib/server/canva-account-pool";

export function CanvaAccountSettings() {
  const [accounts, setAccounts] = useState<CanvaAccount[]>([]);
  const [summary, setSummary] = useState<CanvaPoolSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New account modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newTokenJson, setNewTokenJson] = useState("");
  const [adding, setAdding] = useState(false);

  // Edit account token modal state
  const [editingAccount, setEditingAccount] = useState<CanvaAccount | null>(null);
  const [editTokenJson, setEditTokenJson] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Live validator for pasted token JSON in edit modal
  const editTokenValidation = (() => {
    const trimmed = editTokenJson.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed !== "object" || parsed === null) {
        return { valid: false, text: "✕ Geçersiz veri (JSON nesnesi bekleniyor)", color: "#ef4444" };
      }
      const hasAccess = Boolean(parsed.access_token);
      const hasRefresh = Boolean(parsed.refresh_token);
      if (hasAccess && hasRefresh) {
        return { valid: true, text: "✓ Geçerli Belirteç (access_token & refresh_token doğrulandı)", color: "#16a34a" };
      }
      if (hasAccess) {
        return { valid: true, text: "✓ Geçerli Belirteç (access_token doğrulandı)", color: "#16a34a" };
      }
      if (hasRefresh) {
        return { valid: true, text: "✓ Geçerli Belirteç (refresh_token doğrulandı)", color: "#16a34a" };
      }
      return { valid: false, text: "⚠️ access_token veya refresh_token anahtarı eksik", color: "#f59e0b" };
    } catch {
      return { valid: false, text: "✕ Geçersiz JSON sözdizimi", color: "#ef4444" };
    }
  })();

  // Live validator for pasted token JSON in add modal
  const tokenValidation = (() => {
    const trimmed = newTokenJson.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed !== "object" || parsed === null) {
        return { valid: false, text: "✕ Geçersiz veri (JSON nesnesi bekleniyor)", color: "#ef4444" };
      }
      const hasAccess = Boolean(parsed.access_token);
      const hasRefresh = Boolean(parsed.refresh_token);
      if (hasAccess && hasRefresh) {
        return { valid: true, text: "✓ Geçerli Belirteç (access_token & refresh_token doğrulandı)", color: "#16a34a" };
      }
      if (hasAccess) {
        return { valid: true, text: "✓ Geçerli Belirteç (access_token doğrulandı)", color: "#16a34a" };
      }
      if (hasRefresh) {
        return { valid: true, text: "✓ Geçerli Belirteç (refresh_token doğrulandı)", color: "#16a34a" };
      }
      return { valid: false, text: "⚠️ access_token veya refresh_token anahtarı eksik", color: "#f59e0b" };
    } catch {
      return { valid: false, text: "✕ Geçersiz JSON sözdizimi", color: "#ef4444" };
    }
  })();

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/system/canva/accounts", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setAccounts(data.accounts || []);
          setSummary(data.summary || null);
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleTestAccount(id: string) {
    setTestingId(id);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/system/canva/accounts/${encodeURIComponent(id)}/test`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.ok) {
        setActionMessage({
          type: data.accountStatus === "available" ? "success" : "error",
          text: data.message || "Hesap başarıyla test edildi.",
        });
      } else {
        setActionMessage({
          type: "error",
          text: data.message || "Hesap testi başarısız oldu.",
        });
      }
      await loadData();
    } catch (err) {
      setActionMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Test sırasında bir hata oluştu.",
      });
    } finally {
      setTestingId(null);
    }
  }

  async function handleToggleActive(account: CanvaAccount) {
    try {
      const res = await fetch("/api/system/canva/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: account.id, isActive: !account.isActive }),
      });
      if (res.ok) {
        await loadData();
      }
    } catch {}
  }

  async function handleResetQuota(id: string) {
    try {
      const res = await fetch("/api/system/canva/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, quotaStatus: "available" }),
      });
      if (res.ok) {
        setActionMessage({ type: "success", text: "Hesabın kota durumu 'Müsait' olarak sıfırlandı." });
        await loadData();
      }
    } catch {}
  }

  async function handleDeleteAccount(id: string, name: string) {
    if (!window.confirm(`"${name}" hesabını Canva havuzundan silmek istediğinize emin misiniz?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/system/canva/accounts?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setActionMessage({ type: "success", text: "Hesap havuzdan kaldırıldı." });
        await loadData();
      }
    } catch {}
  }

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!newDisplayName.trim() || !newTokenJson.trim()) return;

    setAdding(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/system/canva/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: newDisplayName.trim(),
          email: newEmail.trim() || undefined,
          tokenJson: newTokenJson.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Hesap eklenemedi.");
      }

      setActionMessage({ type: "success", text: "Canva hesabı başarıyla eklendi." });
      setShowAddModal(false);
      setNewDisplayName("");
      setNewEmail("");
      setNewTokenJson("");
      await loadData();
    } catch (err) {
      setActionMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Hesap eklenirken hata oluştu.",
      });
    } finally {
      setAdding(false);
    }
  }

  async function handleUpdateToken(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAccount || !editTokenJson.trim()) return;
    setSavingEdit(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/system/canva/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingAccount.id,
          tokenJson: editTokenJson.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Belirteç güncellenemedi.");
      setActionMessage({ type: "success", text: `"${editingAccount.displayName}" belirteci güncellendi.` });
      setEditingAccount(null);
      setEditTokenJson("");
      await loadData();
    } catch (err) {
      setActionMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Belirteç güncellenirken hata oluştu.",
      });
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <section
      style={{
        marginTop: "4px",
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: "14px",
        padding: "20px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
      }}
      aria-labelledby="canva-pool-title"
    >
      {/* Üst Başlık & Eylemler */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #f1f5f9",
          paddingBottom: "16px",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #0284c7, #6366f1)",
              display: "grid",
              placeItems: "center",
              color: "white",
              flexShrink: 0,
            }}
          >
            <Palette size={20} />
          </div>
          <div>
            <h2 id="canva-pool-title" style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
              Canva Hesap &amp; Token Havuzu
            </h2>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0 0" }}>
              Çoklu Canva hesabı bağlayarak günlük kota dönüşümü sağlayın.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={() => void loadData()}
            className="button secondary"
            style={{
              height: "34px",
              fontSize: "12px",
              padding: "0 12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
            title="Havuz durumunu yenile"
          >
            <RefreshCw size={13} className={loading ? "spin" : ""} />
            Yenile
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="button primary"
            style={{
              height: "34px",
              fontSize: "12px",
              padding: "0 14px",
              background: "#2563eb",
              color: "white",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Plus size={14} />
            Hesap Ekle
          </button>
        </div>
      </div>

      {/* Bildirim / Hata Mesajı */}
      {actionMessage && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: actionMessage.type === "success" ? "#f0fdf4" : "#fef2f2",
            border: actionMessage.type === "success" ? "1px solid #bbf7d0" : "1px solid #fecaca",
            color: actionMessage.type === "success" ? "#166534" : "#991b1b",
          }}
        >
          {actionMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Sade Özet Metrik Çubuğu */}
      {summary && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "12px",
            padding: "12px 16px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            marginBottom: "20px",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Havuz Durumu</div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
              {summary.hasAuthOutage
                ? "🔴 Oturum Gerekli"
                : summary.status === "all_exhausted"
                ? "🟡 Kota Doldu"
                : summary.availableAccounts > 0
                ? "🟢 Aktif"
                : "⚪ Hesap Yok"}
            </div>
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "1px" }}>
              {summary.availableAccounts} / {summary.activeAccounts} hesap müsait
            </div>
          </div>

          <div>
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Günlük Kapasite</div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#0284c7", marginTop: "2px" }}>
              {summary.totalDailyCapacity} Export
            </div>
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "1px" }}>
              Hesap başı 500 limit
            </div>
          </div>

          <div>
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Bugünkü Kullanım</div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#334155", marginTop: "2px" }}>
              {summary.usedToday} Export
            </div>
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "1px" }}>
              Kalan: ~{summary.remainingToday}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Kota Yenilenmesi</div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#6366f1", marginTop: "2px" }}>
              {summary.resetTimeFormatted}
            </div>
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "1px" }}>
              {summary.hoursUntilReset}s {summary.minutesUntilReset}d kaldı
            </div>
          </div>
        </div>
      )}

      {/* Hesap Kartları Izgarası */}
      {accounts.length === 0 && !loading ? (
        <div
          style={{
            padding: "36px 20px",
            textAlign: "center",
            background: "#f8fafc",
            borderRadius: "10px",
            border: "1px dashed #cbd5e1",
          }}
        >
          <Palette size={28} color="#94a3b8" style={{ margin: "0 auto 8px auto" }} />
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#334155" }}>Havuzda henüz Canva hesabı yok</h3>
          <p style={{ fontSize: "12px", color: "#64748b", maxWidth: "380px", margin: "4px auto 14px auto" }}>
            Canva hesabınızı ekleyerek stüdyo üretimlerinde doğrudan kota dağılımı sağlayabilirsiniz.
          </p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="button primary"
            style={{ fontSize: "12px", background: "#2563eb", color: "white", border: "none", borderRadius: "6px", padding: "6px 14px", cursor: "pointer" }}
          >
            İlk Canva Hesabını Ekle
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "14px",
          }}
        >
          {accounts.map((acc) => {
            const isTesting = testingId === acc.id;
            const isExhausted = acc.quotaStatus === "exhausted";
            const isInactive = !acc.isActive;
            const isExpired = acc.authStatus === "expired" || acc.quotaStatus === "auth_required";

            return (
              <div
                key={acc.id}
                style={{
                  border: isExpired
                    ? "1px solid #fca5a5"
                    : isExhausted
                    ? "1px solid #fed7aa"
                    : isInactive
                    ? "1px solid #e2e8f0"
                    : "1px solid #cbd5e1",
                  borderRadius: "10px",
                  padding: "16px",
                  background: isInactive ? "#f8fafc" : isExpired ? "#fffafb" : "white",
                  opacity: isInactive ? 0.75 : 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div>
                  {/* Başlık ve Tek Durum Rozeti */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                        {acc.displayName}
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                        {acc.email || "E-posta belirtilmemiş"}
                      </div>
                    </div>

                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "8px",
                        fontSize: "11px",
                        fontWeight: 600,
                        border: isInactive
                          ? "1px solid #cbd5e1"
                          : isExpired
                          ? "1px solid #fca5a5"
                          : isExhausted
                          ? "1px solid #fcd34d"
                          : "1px solid #86efac",
                        background: isInactive
                          ? "#f1f5f9"
                          : isExpired
                          ? "#fef2f2"
                          : isExhausted
                          ? "#fffbeb"
                          : "#f0fdf4",
                        color: isInactive
                          ? "#64748b"
                          : isExpired
                          ? "#b91c1c"
                          : isExhausted
                          ? "#b45309"
                          : "#15803d",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isInactive
                        ? "⚪ Pasif"
                        : isExpired
                        ? "🔴 Oturum Kapalı"
                        : isExhausted
                        ? "🟡 Kota Doldu"
                        : "🟢 Aktif"}
                    </span>
                  </div>

                  {/* Kota İlerleme Çubuğu */}
                  <div style={{ marginTop: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                      <span style={{ color: "#64748b" }}>Bugünkü Tüketim:</span>
                      <strong style={{ color: isExhausted ? "#dc2626" : "#0f172a" }}>
                        {acc.dailyExportsCount} / 500
                      </strong>
                    </div>
                    <div
                      style={{
                        width: "100%",
                        height: "4px",
                        background: "#e2e8f0",
                        borderRadius: "2px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, (acc.dailyExportsCount / 500) * 100)}%`,
                          height: "100%",
                          background: isExhausted ? "#ef4444" : "#10b981",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Eylem Butonları */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderTop: "1px solid #f1f5f9",
                    paddingTop: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => void handleTestAccount(acc.id)}
                      disabled={isTesting || isInactive}
                      style={{
                        padding: "4px 8px",
                        fontSize: "11px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        background: isTesting ? "#f8fafc" : "#f1f5f9",
                        color: "#334155",
                        cursor: isTesting || isInactive ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      title="Canva API bağlantısını kontrol et"
                    >
                      <RefreshCw size={11} className={isTesting ? "spin" : ""} />
                      {isTesting ? "Kontrol..." : "Test Et"}
                    </button>

                    {isExpired ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAccount(acc);
                          setEditTokenJson("");
                        }}
                        style={{
                          padding: "4px 8px",
                          fontSize: "11px",
                          borderRadius: "6px",
                          border: "1px solid #fca5a5",
                          background: "#fef2f2",
                          color: "#dc2626",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontWeight: 600,
                        }}
                        title="Oturum süresi dolmuş. Yeni token yapıştırın"
                      >
                        <Key size={11} />
                        Oturumu Yenile
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAccount(acc);
                          setEditTokenJson("");
                        }}
                        style={{
                          padding: "4px 8px",
                          fontSize: "11px",
                          borderRadius: "6px",
                          border: "1px solid #e2e8f0",
                          background: "#ffffff",
                          color: "#0f172a",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                        title="Canva OAuth token JSON verisini güncelle"
                      >
                        <Key size={11} />
                        Belirteç
                      </button>
                    )}

                    {isExhausted && (
                      <button
                        type="button"
                        onClick={() => void handleResetQuota(acc.id)}
                        style={{
                          padding: "4px 8px",
                          fontSize: "11px",
                          borderRadius: "6px",
                          border: "1px solid #bae6fd",
                          background: "#f0f9ff",
                          color: "#0284c7",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                        title="Kota durumunu sıfırla"
                      >
                        <RotateCcw size={11} />
                        Sıfırla
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(acc)}
                      style={{
                        padding: "4px 8px",
                        fontSize: "11px",
                        borderRadius: "6px",
                        border: "1px solid #e2e8f0",
                        background: acc.isActive ? "#f8fafc" : "#f1f5f9",
                        color: acc.isActive ? "#16a34a" : "#94a3b8",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      title={acc.isActive ? "Hesabı pasife al" : "Hesabı aktifleştir"}
                    >
                      <Power size={11} />
                      {acc.isActive ? "Aktif" : "Pasif"}
                    </button>

                    {accounts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteAccount(acc.id, acc.displayName)}
                        style={{
                          padding: "4px 6px",
                          fontSize: "11px",
                          borderRadius: "6px",
                          border: "1px solid #fee2e2",
                          background: "#fff5f5",
                          color: "#dc2626",
                          cursor: "pointer",
                        }}
                        title="Hesabı havuzdan sil"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Minimalist Hesap Ekleme Modalı */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "20px",
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "#2563eb",
                  display: "grid",
                  placeItems: "center",
                  color: "white",
                }}
              >
                <Palette size={16} />
              </div>
              <div>
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                  Canva Hesabı Ekle
                </h3>
                <p style={{ fontSize: "11px", color: "#64748b", margin: "2px 0 0 0" }}>
                  Canva Connect API belirteciyle havuza yeni hesap dahil edin.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddAccount} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "#334155", display: "block", marginBottom: "3px" }}>
                  Hesap Adı / Etiketi *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Canva Ana Hesap, Ekip 2"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "#334155", display: "block", marginBottom: "3px" }}>
                  E-posta (İsteğe Bağlı)
                </label>
                <input
                  type="email"
                  placeholder="ekip@atolyehanem.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "#334155", display: "block", marginBottom: "3px" }}>
                  Canva OAuth Belirteç Verisi (Token JSON) *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder='{"access_token": "...", "refresh_token": "..."}'
                  value={newTokenJson}
                  onChange={(e) => setNewTokenJson(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: "6px",
                    border: tokenValidation ? (tokenValidation.valid ? "1px solid #86efac" : "1px solid #fca5a5") : "1px solid #cbd5e1",
                    fontSize: "11px",
                    fontFamily: "monospace",
                  }}
                />
                {tokenValidation ? (
                  <div style={{ fontSize: "11px", color: tokenValidation.color, fontWeight: 600, marginTop: "4px" }}>
                    {tokenValidation.text}
                  </div>
                ) : (
                  <div style={{ fontSize: "10px", color: "#64748b", marginTop: "3px" }}>
                    <Sparkles size={10} style={{ display: "inline", marginRight: "3px", color: "#6366f1" }} />
                    Canva Developer veya yerel oturumdan alınan JSON nesnesini yapıştırın.
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="button secondary"
                  style={{ fontSize: "12px", padding: "6px 12px" }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={adding || !newDisplayName.trim() || !newTokenJson.trim()}
                  className="button primary"
                  style={{
                    fontSize: "12px",
                    padding: "6px 14px",
                    background: "#2563eb",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {adding ? "Kaydediliyor..." : "Hesabı Ekle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Minimalist Belirteç Güncelleme Modalı */}
      {editingAccount && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingAccount(null);
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "20px",
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "#2563eb",
                  display: "grid",
                  placeItems: "center",
                  color: "white",
                }}
              >
                <Key size={16} />
              </div>
              <div>
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                  Belirteci Güncelle
                </h3>
                <p style={{ fontSize: "11px", color: "#64748b", margin: "2px 0 0 0" }}>
                  <strong>{editingAccount.displayName}</strong> hesabı için taze token JSON verisini kaydedin.
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdateToken} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "#334155", display: "block", marginBottom: "3px" }}>
                  Yeni Canva OAuth Token JSON *
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder='{"access_token": "...", "refresh_token": "..."}'
                  value={editTokenJson}
                  onChange={(e) => setEditTokenJson(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: "6px",
                    border: editTokenValidation ? (editTokenValidation.valid ? "1px solid #86efac" : "1px solid #fca5a5") : "1px solid #cbd5e1",
                    fontSize: "11px",
                    fontFamily: "monospace",
                  }}
                />
                {editTokenValidation && (
                  <div style={{ fontSize: "11px", color: editTokenValidation.color, fontWeight: 600, marginTop: "4px" }}>
                    {editTokenValidation.text}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="button secondary"
                  style={{ fontSize: "12px", padding: "6px 12px" }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || !editTokenJson.trim()}
                  className="button primary"
                  style={{
                    fontSize: "12px",
                    padding: "6px 14px",
                    background: "#2563eb",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {savingEdit ? "Kaydediliyor..." : "Belirteci Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
