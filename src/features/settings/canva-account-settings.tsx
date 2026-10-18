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
  Info,
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
  const [copiedCommand, setCopiedCommand] = useState(false);

  // Live validator for pasted token JSON
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
        return { valid: true, text: "✓ Geçerli Canva Belirteci (access_token & refresh_token doğrulandı)", color: "#16a34a" };
      }
      if (hasAccess) {
        return { valid: true, text: "✓ Geçerli Belirteç (access_token doğrulandı)", color: "#16a34a" };
      }
      if (hasRefresh) {
        return { valid: true, text: "✓ Geçerli Belirteç (refresh_token doğrulandı)", color: "#16a34a" };
      }
      return { valid: false, text: "⚠️ JSON geçerli ancak access_token veya refresh_token anahtarı eksik", color: "#f59e0b" };
    } catch {
      return { valid: false, text: "✕ Geçersiz JSON sözdizimi. Lütfen tırnak ve parantezleri kontrol edin.", color: "#ef4444" };
    }
  })();

  function handleFillSampleTemplate() {
    setNewTokenJson(
      JSON.stringify(
        {
          access_token: "Örnek_Access_Token_Buraya",
          refresh_token: "Örnek_Refresh_Token_Buraya",
          token_type: "Bearer",
          expires_in: 14400,
          scope: "profile:read design:meta:read design:content:write design:content:read folder:read folder:write",
        },
        null,
        2
      )
    );
  }

  function handleCopyCommand(cmd: string) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(cmd).catch(() => {});
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2000);
    }
  }

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

      setActionMessage({ type: "success", text: "Yeni Canva hesabı başarıyla havuza eklendi!" });
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
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
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
              background: "linear-gradient(135deg, #00c4cc, #7d2ae8)",
              display: "grid",
              placeItems: "center",
              color: "white",
            }}
          >
            <Palette size={22} />
          </div>
          <div>
            <h2 id="canva-pool-title" style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
              Canva Hesap &amp; Token Havuzu
            </h2>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0 0" }}>
              Çoklu Canva hesabı bağlayarak günlük 500 export sınırını katlayın ve otomatik dönüşüm sağlayın.
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
              background: "linear-gradient(135deg, #0284c7, #6366f1)",
              color: "white",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              border: "none",
            }}
          >
            <Plus size={14} />
            Canva Hesabı Ekle
          </button>
        </div>
      </div>

      {/* Action Notification */}
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

      {/* Pool Summary Metrics Banner */}
      {summary && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
            padding: "12px 16px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            marginBottom: "20px",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Aktif Havuz Durumu</div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
              {summary.availableAccounts} / {summary.activeAccounts} Hesap Müsait
            </div>
            <div style={{ fontSize: "10px", color: "#94a3b8" }}>
              {summary.status === "available"
                ? "🟢 Tüm hesaplar aktif"
                : summary.status === "partially_exhausted"
                ? "🟡 Kısmi kota doldu (rotasyon devam ediyor)"
                : "🔴 Tüm hesapların kotası doldu"}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Günlük Toplam Kapasite</div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#0284c7", marginTop: "2px" }}>
              {summary.totalDailyCapacity} Export / Gün
            </div>
            <div style={{ fontSize: "10px", color: "#64748b" }}>
              {summary.activeAccounts} hesap × 500 export limiti
            </div>
          </div>

          <div>
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Bugünkü Kullanım</div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#334155", marginTop: "2px" }}>
              {summary.usedToday} Export yapıldı
            </div>
            <div style={{ fontSize: "10px", color: "#64748b" }}>
              Kalan: ~{summary.remainingToday} export hakkı
            </div>
          </div>

          <div>
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Kota Yenilenmesi</div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#8b5cf6", marginTop: "2px" }}>
              {summary.resetTimeFormatted}
            </div>
            <div style={{ fontSize: "10px", color: "#64748b" }}>
              Kalan: {summary.hoursUntilReset}s {summary.minutesUntilReset}d
            </div>
          </div>
        </div>
      )}

      {/* Account Cards Grid */}
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
          <Palette size={32} color="#94a3b8" style={{ margin: "0 auto 10px auto" }} />
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#334155" }}>Havuzda henüz Canva hesabı yok</h3>
          <p style={{ fontSize: "12px", color: "#64748b", maxWidth: "420px", margin: "4px auto 16px auto" }}>
            Canva hesabınızı havuza ekleyerek stüdyo üretimlerinde doğrudan kota dağılımı sağlayabilirsiniz.
          </p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="button primary"
            style={{ fontSize: "12px" }}
          >
            İlk Canva Hesabını Ekle
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "14px",
          }}
        >
          {accounts.map((acc) => {
            const isTesting = testingId === acc.id;
            const isExhausted = acc.quotaStatus === "exhausted";
            const isInactive = !acc.isActive;

            return (
              <div
                key={acc.id}
                style={{
                  border: isExhausted ? "1px solid #fca5a5" : isInactive ? "1px solid #e2e8f0" : "1px solid #cbd5e1",
                  borderRadius: "10px",
                  padding: "16px",
                  background: isInactive ? "#f8fafc" : isExhausted ? "#fffafb" : "white",
                  opacity: isInactive ? 0.75 : 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "14px",
                }}
              >
                <div>
                  {/* Card Title & Status Badge */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                        {acc.displayName}
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>
                        {acc.email || "E-posta belirtilmemiş"}
                      </div>
                    </div>

                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "12px",
                        fontSize: "10px",
                        fontWeight: 600,
                        border: isInactive
                          ? "1px solid #cbd5e1"
                          : isExhausted
                          ? "1px solid #fca5a5"
                          : "1px solid #86efac",
                        background: isInactive ? "#f1f5f9" : isExhausted ? "#fef2f2" : "#f0fdf4",
                        color: isInactive ? "#64748b" : isExhausted ? "#b91c1c" : "#15803d",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isInactive
                        ? "⚪ Pasif"
                        : isExhausted
                        ? "🔴 Günlük Kota Doldu"
                        : "🟢 Kota Müsait"}
                    </span>
                  </div>

                  {/* Quota Progress */}
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
                        height: "5px",
                        background: "#e2e8f0",
                        borderRadius: "3px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, (acc.dailyExportsCount / 500) * 100)}%`,
                          height: "100%",
                          background: isExhausted
                            ? "#ef4444"
                            : acc.dailyExportsCount > 400
                            ? "#f59e0b"
                            : "#10b981",
                        }}
                      />
                    </div>
                  </div>

                  {/* Details / Errors */}
                  {acc.lastError && isExhausted && (
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#b91c1c",
                        background: "#fef2f2",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        marginTop: "10px",
                        lineHeight: 1.3,
                      }}
                    >
                      <Info size={11} style={{ display: "inline", marginRight: "4px" }} />
                      {acc.lastError} (03:00 TSİ'de sıfırlanır)
                    </div>
                  )}
                </div>

                {/* Actions Toolbar */}
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
                      title="Bu hesabın Canva API bağlantısını ve kotasını doğrudan sına"
                    >
                      <RefreshCw size={11} className={isTesting ? "spin" : ""} />
                      {isTesting ? "Test Ediliyor..." : "Test Et"}
                    </button>

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
                        title="Hesap durumunu manuel olarak 'Müsait' durumuna getir"
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
                      title={acc.isActive ? "Hesabı geçici olarak devre dışı bırak" : "Hesabı tekrar aktifleştir"}
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

      {/* Add New Account Modal */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
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
              borderRadius: "14px",
              padding: "24px",
              maxWidth: "520px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #00c4cc, #7d2ae8)",
                  display: "grid",
                  placeItems: "center",
                  color: "white",
                }}
              >
                <Palette size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                  Yeni Canva Hesabı Ekle
                </h3>
                <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0 0" }}>
                  Havuza eklenen her Canva hesabı günlük bağımsız +500 export hakkı sağlar.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddAccount} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#334155", display: "block", marginBottom: "4px" }}>
                  Hesap Adı / Etiketi *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Canva 2. Ekip Hesabı, Ofis Hesabı"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#334155", display: "block", marginBottom: "4px" }}>
                  Canva E-posta Adresi (İsteğe Bağlı)
                </label>
                <input
                  type="email"
                  placeholder="Örn: ekip2@atolyehanem.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                  }}
                />
              </div>

              {/* 3 Adımlı Canva Token Rehberi */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  fontSize: "12px",
                  color: "#334155",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>
                  <Info size={14} color="#0284c7" />
                  Canva Belirteç Verisi (Token JSON) Nasıl Alınır?
                </div>
                <ol style={{ margin: 0, paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "6px", lineHeight: 1.4 }}>
                  <li>
                    <strong>Tarayıcıda Giriş:</strong> 2. Canva hesabınıza tarayıcınızda (tercihen gizli sekmede) giriş yapın.
                  </li>
                  <li>
                    <strong>Yetkilendirme Komutu:</strong> Terminalde şu komutu çalıştırıp ekrandaki bağlantıyı tarayıcıda açarak izin verin:
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                      <code
                        style={{
                          background: "#0f172a",
                          color: "#38bdf8",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontFamily: "monospace",
                        }}
                      >
                        codex mcp login canva
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopyCommand("codex mcp login canva")}
                        style={{
                          padding: "3px 8px",
                          borderRadius: "4px",
                          border: "1px solid #cbd5e1",
                          background: "white",
                          fontSize: "10px",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        {copiedCommand ? "✓ Kopyalandı" : "Kopyala"}
                      </button>
                    </div>
                  </li>
                  <li>
                    <strong>Belirteci Yapıştırma:</strong> İşlem tamamlandığında oluşturulan{" "}
                    <code style={{ background: "#e2e8f0", padding: "2px 4px", borderRadius: "3px" }}>
                      /opt/data/mcp-tokens/canva.json
                    </code>{" "}
                    dosyasının tüm içeriğini aşağıdaki kutucuğa yapıştırın.
                  </li>
                </ol>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                    OAuth Belirteç Verisi (Token JSON) *
                  </label>
                  <button
                    type="button"
                    onClick={handleFillSampleTemplate}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#6366f1",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    📋 Örnek Şablonu Doldur
                  </button>
                </div>
                <textarea
                  required
                  rows={5}
                  placeholder='{"access_token": "...", "refresh_token": "...", "expires_at": ...}'
                  value={newTokenJson}
                  onChange={(e) => setNewTokenJson(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: tokenValidation ? (tokenValidation.valid ? "1px solid #86efac" : "1px solid #fca5a5") : "1px solid #cbd5e1",
                    fontSize: "11px",
                    fontFamily: "monospace",
                  }}
                />

                {/* Live Token Validator Badge */}
                {tokenValidation ? (
                  <div
                    style={{
                      fontSize: "11px",
                      color: tokenValidation.color,
                      fontWeight: 600,
                      marginTop: "5px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    {tokenValidation.text}
                  </div>
                ) : (
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                    <Sparkles size={11} style={{ display: "inline", marginRight: "4px", color: "#8b5cf6" }} />
                    Canva hesabınızla yetkilendirilmiş OAuth JSON içeriğini buraya yapıştırın.
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="button secondary"
                  style={{ fontSize: "12px" }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={adding || !newDisplayName.trim() || !newTokenJson.trim()}
                  className="button primary"
                  style={{
                    fontSize: "12px",
                    background: "linear-gradient(135deg, #0284c7, #6366f1)",
                    color: "white",
                    border: "none",
                  }}
                >
                  {adding ? "Kaydediliyor..." : "Hesabı Havuza Ekle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
