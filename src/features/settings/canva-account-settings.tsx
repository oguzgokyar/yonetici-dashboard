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
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import type { CanvaAccount, CanvaPoolSummary } from "@/lib/server/canva-account-pool";

export function CanvaAccountSettings() {
  const [accounts, setAccounts] = useState<CanvaAccount[]>([]);
  const [summary, setSummary] = useState<CanvaPoolSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New account modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [pastedCallbackInput, setPastedCallbackInput] = useState("");
  const [showManualJson, setShowManualJson] = useState(false);
  const [newTokenJson, setNewTokenJson] = useState("");
  const [isSubmittingOAuth, setIsSubmittingOAuth] = useState(false);
  const [oauthWindowOpened, setOauthWindowOpened] = useState(false);

  // Edit / Reconnect modal state
  const [reconnectAccount, setReconnectAccount] = useState<CanvaAccount | null>(null);
  const [reconnectCallbackInput, setReconnectCallbackInput] = useState("");
  const [reconnectWindowOpened, setReconnectWindowOpened] = useState(false);
  const [isSubmittingReconnect, setIsSubmittingReconnect] = useState(false);

  const loadData = useCallback(async (isManualRefresh = false) => {
    setLoading(true);
    try {
      const res = await fetch("/api/system/canva/accounts", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setAccounts(data.accounts || []);
          setSummary(data.summary || null);
          if (isManualRefresh) {
            setActionMessage({
              type: "success",
              text: "✓ Canva hesap havuzu ve bağlantı durumları güncellendi.",
            });
          }
        }
      }
    } catch {
      if (isManualRefresh) {
        setActionMessage({
          type: "error",
          text: "Havuz durumu güncellenirken hata oluştu.",
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(false);

    // Check URL parameters for OAuth return notifications
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const oauthStatus = params.get("canvaOAuth");
      const accountName = params.get("account");
      const errorMsg = params.get("message");

      if (oauthStatus === "success") {
        setActionMessage({
          type: "success",
          text: `Canva hesabı başarıyla bağlandı ve havuza eklendi! ${accountName ? `(${accountName})` : ""}`,
        });
        const cleanUrl = window.location.pathname + (params.get("tab") ? `?tab=${params.get("tab")}` : "");
        window.history.replaceState({}, "", cleanUrl);
      } else if (oauthStatus === "error") {
        setActionMessage({
          type: "error",
          text: `Canva yetkilendirme hatası: ${errorMsg || "İşlem tamamlanamadı."}`,
        });
        const cleanUrl = window.location.pathname + (params.get("tab") ? `?tab=${params.get("tab")}` : "");
        window.history.replaceState({}, "", cleanUrl);
      }
    }
  }, [loadData]);

  // Handle direct OAuth initiation in a popup window
  async function handleStartOAuth(targetAccountId?: string, customName?: string) {
    try {
      const name = customName || newDisplayName || newEmail || "Canva Hesabı";
      const query = new URLSearchParams({
        json: "1",
        ...(targetAccountId ? { accountId: targetAccountId } : {}),
        displayName: name,
      });

      const res = await fetch(`/api/system/canva/oauth/start?${query.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.ok || !data.authorizationUrl) {
        throw new Error(data.message || "Yetkilendirme bağlantısı oluşturulamadı.");
      }

      window.open(data.authorizationUrl, "_blank", "width=850,height=750,menubar=no,toolbar=no");
      if (targetAccountId) {
        setReconnectWindowOpened(true);
      } else {
        setOauthWindowOpened(true);
      }
    } catch (err) {
      setActionMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Canva bağlantısı başlatılamadı.",
      });
    }
  }

  // Handle completing OAuth with pasted URL or authorization code
  async function handleCompleteOAuth(e: React.FormEvent) {
    e.preventDefault();
    const input = pastedCallbackInput.trim();
    if (!input) return;

    setIsSubmittingOAuth(true);
    setActionMessage(null);
    try {
      const name = newDisplayName.trim() || newEmail.trim() || undefined;
      const res = await fetch("/api/system/canva/oauth/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: input,
          displayName: name,
          email: newEmail.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Hesap yetkilendirilemedi.");
      }

      setActionMessage({
        type: "success",
        text: `Canva hesabı başarıyla eklendi! (${data.displayName || newDisplayName || newEmail || "Aktif"})`,
      });
      setShowAddModal(false);
      setNewEmail("");
      setNewDisplayName("");
      setPastedCallbackInput("");
      setOauthWindowOpened(false);
      await loadData(false);
    } catch (err) {
      setActionMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Hesap eklenirken hata oluştu.",
      });
    } finally {
      setIsSubmittingOAuth(false);
    }
  }

  // Handle completing Reconnect with pasted URL or authorization code
  async function handleCompleteReconnect(e: React.FormEvent) {
    e.preventDefault();
    if (!reconnectAccount) return;
    const input = reconnectCallbackInput.trim();
    if (!input) return;

    setIsSubmittingReconnect(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/system/canva/oauth/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: input,
          displayName: reconnectAccount.displayName,
          email: reconnectAccount.email || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Yeniden yetkilendirme doğrulanamadı.");
      }

      setActionMessage({
        type: "success",
        text: `"${reconnectAccount.displayName}" hesabı başarıyla yeniden yetkilendirildi!`,
      });
      setReconnectAccount(null);
      setReconnectCallbackInput("");
      setReconnectWindowOpened(false);
      await loadData(false);
    } catch (err) {
      setActionMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Yetkilendirme yenilenirken hata oluştu.",
      });
    } finally {
      setIsSubmittingReconnect(false);
    }
  }

  // Handle fallback manual JSON submission
  async function handleManualJsonSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newTokenJson.trim()) return;

    setIsSubmittingOAuth(true);
    setActionMessage(null);
    try {
      const name = newDisplayName.trim() || newEmail.trim() || "Canva Hesabı";
      const res = await fetch("/api/system/canva/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: name,
          email: newEmail.trim() || undefined,
          tokenJson: newTokenJson.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Hesap eklenemedi.");

      setActionMessage({ type: "success", text: "Canva hesabı başarıyla eklendi." });
      setShowAddModal(false);
      setNewEmail("");
      setNewDisplayName("");
      setNewTokenJson("");
      await loadData(false);
    } catch (err) {
      setActionMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Hesap eklenirken hata oluştu.",
      });
    } finally {
      setIsSubmittingOAuth(false);
    }
  }

  // Quick Silent Auto-Refresh trigger
  async function handleQuickRefresh(account: CanvaAccount) {
    setRefreshingId(account.id);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/system/canva/accounts/${encodeURIComponent(account.id)}/reconnect`);
      const data = await res.json();
      if (res.ok && data.connected) {
        setActionMessage({
          type: "success",
          text: `"${account.displayName}" belirteci arka planda başarıyla tazelendi! (🟢 Aktif)`,
        });
      } else {
        setActionMessage({
          type: "error",
          text: data.message || "Belirteç yenilenemedi, yeniden yetkilendirme gerekebilir.",
        });
      }
      await loadData(false);
    } catch (err) {
      setActionMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Yenileme sırasında hata oluştu.",
      });
    } finally {
      setRefreshingId(null);
    }
  }

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
      await loadData(false);
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
        await loadData(false);
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
        await loadData(false);
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
        await loadData(false);
      }
    } catch {}
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
              Canva Hesap &amp; Çoklu Havuz Yönetimi
            </h2>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0 0" }}>
              Canva hesaplarınızı tek tıkla bağlayın; arka planda otomatik yenilemeyle kesintisiz üretim yapın.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={loading}
            className="button secondary"
            style={{
              height: "34px",
              fontSize: "12px",
              padding: "0 12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: loading ? "wait" : "pointer",
            }}
            title="Havuz durumunu yenile"
          >
            <RefreshCw size={13} className={loading ? "spin" : ""} />
            {loading ? "Yenileniyor..." : "Yenile"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOauthWindowOpened(false);
              setPastedCallbackInput("");
              setShowAddModal(true);
            }}
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
            + Canva Hesabı Ekle
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
              Hesap başı +500 limit
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
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#334155" }}>Havuzda henüz bağlı Canva hesabı yok</h3>
          <p style={{ fontSize: "12px", color: "#64748b", maxWidth: "380px", margin: "4px auto 14px auto" }}>
            Canva hesabınızı doğrudan bağlayarak Canva Stüdyo üretimlerinde kota havuzunu anında aktifleştirebilirsiniz.
          </p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="button primary"
            style={{ fontSize: "12px", background: "#2563eb", color: "white", border: "none", borderRadius: "6px", padding: "8px 16px", cursor: "pointer", fontWeight: 600 }}
          >
            🔑 İlk Canva Hesabını Bağla
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
            gap: "14px",
          }}
        >
          {accounts.map((acc) => {
            const isTesting = testingId === acc.id;
            const isRefreshing = refreshingId === acc.id;
            const isExhausted = acc.quotaStatus === "exhausted";
            const isInactive = !acc.isActive;
            const isExpired = acc.authStatus === "expired" || (acc.quotaStatus as string) === "auth_required";

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
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", wordBreak: "break-all" }}>
                        {acc.displayName || acc.email || "Canva Hesabı"}
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                        {acc.email || "OAuth Oturumu"}
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
                    flexWrap: "wrap",
                    gap: "6px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {/* Tek Tıkla Belirteç Tazele */}
                    <button
                      type="button"
                      onClick={() => void handleQuickRefresh(acc)}
                      disabled={isRefreshing || isInactive}
                      style={{
                        padding: "4px 8px",
                        fontSize: "11px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        background: isRefreshing ? "#f8fafc" : "#f1f5f9",
                        color: "#0369a1",
                        cursor: isRefreshing || isInactive ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontWeight: 600,
                      }}
                      title="Canva'dan arka planda taze belirteç al"
                    >
                      <RefreshCw size={11} className={isRefreshing ? "spin" : ""} />
                      {isRefreshing ? "Tazeleniyor..." : "Tazele"}
                    </button>

                    {/* Test Et */}
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
                      <Sparkles size={11} className={isTesting ? "spin" : ""} />
                      {isTesting ? "Kontrol..." : "Test Et"}
                    </button>

                    {/* Yeniden Yetkilendir */}
                    <button
                      type="button"
                      onClick={() => {
                        setReconnectAccount(acc);
                        setReconnectCallbackInput("");
                        setReconnectWindowOpened(false);
                      }}
                      style={{
                        padding: "4px 8px",
                        fontSize: "11px",
                        borderRadius: "6px",
                        border: isExpired ? "1px solid #fca5a5" : "1px solid #cbd5e1",
                        background: isExpired ? "#fef2f2" : "#ffffff",
                        color: isExpired ? "#dc2626" : "#2563eb",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontWeight: 600,
                      }}
                      title="Canva üzerinden yeniden yetkilendir"
                    >
                      <Key size={11} />
                      Yeniden Bağla
                    </button>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    {isExhausted && (
                      <button
                        type="button"
                        onClick={() => void handleResetQuota(acc.id)}
                        style={{
                          padding: "4px 6px",
                          fontSize: "10px",
                          borderRadius: "4px",
                          border: "1px solid #fcd34d",
                          background: "#fffbeb",
                          color: "#b45309",
                          cursor: "pointer",
                        }}
                        title="Günlük kotayı sıfırla"
                      >
                        <RotateCcw size={10} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleToggleActive(acc)}
                      style={{
                        padding: "4px 6px",
                        fontSize: "10px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                        background: acc.isActive ? "#f8fafc" : "#f1f5f9",
                        color: acc.isActive ? "#64748b" : "#10b981",
                        cursor: "pointer",
                      }}
                      title={acc.isActive ? "Hesabı pasife al" : "Hesabı aktifleştir"}
                    >
                      <Power size={11} />
                    </button>

                    {accounts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteAccount(acc.id, acc.displayName)}
                        style={{
                          padding: "4px 6px",
                          fontSize: "10px",
                          borderRadius: "4px",
                          border: "1px solid #fee2e2",
                          background: "#fff5f5",
                          color: "#dc2626",
                          cursor: "pointer",
                        }}
                        title="Hesabı havuzdan sil"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modern Tek Tıkla Canva Hesabı Ekleme Modalı */}
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
              position: "relative",
              background: "white",
              borderRadius: "14px",
              padding: "24px",
              maxWidth: "520px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15)",
            }}
          >
            {/* Kapat Butonu (X) */}
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: "4px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Kapat"
            >
              <X size={18} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #0284c7, #2563eb)",
                  display: "grid",
                  placeItems: "center",
                  color: "white",
                }}
              >
                <Palette size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                  Yeni Canva Hesabı Bağla
                </h3>
                <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0 0" }}>
                  Tek tıkla Canva hesabınızı veya ekibinizi havuza dahil edin.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Otomatik E-posta & Hesap Etiketi */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#334155", display: "block", marginBottom: "4px" }}>
                  Canva Hesap E-postası (Hesap Adı) *
                </label>
                <input
                  type="email"
                  required
                  placeholder="Örn: oguz@atolyehanem.com"
                  value={newEmail}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewEmail(val);
                    setNewDisplayName(val);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                  }}
                />
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "3px" }}>
                  Hesap kartı etiketi otomatik olarak bu e-posta adresi olacaktır.
                </div>
              </div>

              {/* 1. Adım: Canva Yetkilendirmesi Başlat */}
              <div
                style={{
                  padding: "14px",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "10px",
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#166534", marginBottom: "6px" }}>
                  1. Adım: Canva Giriş Ekranını Açın
                </div>
                <p style={{ fontSize: "11px", color: "#15803d", margin: "0 0 10px 0" }}>
                  Aşağıdaki butona bastığınızda resmi Canva yetkilendirme penceresi açılır. Hesabınızı seçip izin verin.
                </p>
                <button
                  type="button"
                  onClick={() => void handleStartOAuth(undefined, newDisplayName || newEmail)}
                  style={{
                    width: "100%",
                    padding: "9px 14px",
                    background: "#16a34a",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <ExternalLink size={14} />
                  Canva ile Yetkilendir (Yeni Pencere)
                </button>
              </div>

              {/* 2. Adım: Yönlendirme Kodu veya URL Yapıştır */}
              {oauthWindowOpened && (
                <form onSubmit={handleCompleteOAuth} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div
                    style={{
                      padding: "14px",
                      background: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      borderRadius: "10px",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#1e40af", marginBottom: "4px" }}>
                      2. Adım: Yönlendirme Linkini Onaylayın
                    </div>
                    <p style={{ fontSize: "11px", color: "#2563eb", margin: "0 0 8px 0" }}>
                      Canva&apos;da onay verdikten sonra tarayıcı adres satırındaki yönlendirme linkini (veya kodu) buraya yapıştırıp &quot;Havuza Kaydet&quot; butonuna basın:
                    </p>
                    <input
                      type="text"
                      required
                      placeholder="http://127.0.0.1:27890/callback?code=... veya sadece kod"
                      value={pastedCallbackInput}
                      onChange={(e) => setPastedCallbackInput(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #93c5fd",
                        fontSize: "12px",
                        fontFamily: "monospace",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="button secondary"
                      style={{ fontSize: "12px", padding: "7px 14px" }}
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingOAuth || !pastedCallbackInput.trim()}
                      className="button primary"
                      style={{
                        fontSize: "12px",
                        padding: "7px 16px",
                        background: "#2563eb",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {isSubmittingOAuth ? "Hesap Ekleniyor..." : "✓ Hesabı Havuza Kaydet"}
                    </button>
                  </div>
                </form>
              )}

              {/* Gelişmiş Manuel JSON Akordiyonu */}
              <div style={{ marginTop: "4px", borderTop: "1px solid #f1f5f9", paddingTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setShowManualJson(!showManualJson)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    fontSize: "11px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: 0,
                  }}
                >
                  {showManualJson ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  Gelişmiş: Manuel Token JSON ile Ekle
                </button>

                {showManualJson && (
                  <form onSubmit={handleManualJsonSubmit} style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <textarea
                      rows={3}
                      placeholder='{"access_token": "...", "refresh_token": "..."}'
                      value={newTokenJson}
                      onChange={(e) => setNewTokenJson(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "11px",
                        fontFamily: "monospace",
                      }}
                    />
                    <button
                      type="submit"
                      disabled={isSubmittingOAuth || !newTokenJson.trim()}
                      style={{
                        alignSelf: "flex-end",
                        padding: "6px 12px",
                        fontSize: "11px",
                        background: "#334155",
                        color: "white",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      JSON ile Kaydet
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Yeniden Yetkilendir Modalı */}
      {reconnectAccount && (
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
            if (e.target === e.currentTarget) setReconnectAccount(null);
          }}
        >
          <div
            style={{
              position: "relative",
              background: "white",
              borderRadius: "14px",
              padding: "24px",
              maxWidth: "500px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15)",
            }}
          >
            {/* Kapat Butonu (X) */}
            <button
              type="button"
              onClick={() => setReconnectAccount(null)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: "4px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Kapat"
            >
              <X size={18} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "#2563eb",
                  display: "grid",
                  placeItems: "center",
                  color: "white",
                }}
              >
                <Key size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                  Oturumu Yenile: {reconnectAccount.displayName}
                </h3>
                <p style={{ fontSize: "11px", color: "#64748b", margin: "2px 0 0 0" }}>
                  Canva üzerinden tek tıkla hesabınızı tazeleyin.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <button
                type="button"
                onClick={() => void handleStartOAuth(reconnectAccount.id, reconnectAccount.displayName)}
                style={{
                  padding: "10px 14px",
                  background: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <ExternalLink size={14} />
                1. Adım: Canva Yetkilendirmesini Aç
              </button>

              {reconnectWindowOpened && (
                <form onSubmit={handleCompleteReconnect} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ fontSize: "11px", color: "#475569" }}>
                    2. Adım: Canva onayından sonra açılan adresteki linki veya kodu buraya yapıştırın:
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="http://127.0.0.1:27890/callback?code=... veya kod"
                    value={reconnectCallbackInput}
                    onChange={(e) => setReconnectCallbackInput(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "12px",
                      fontFamily: "monospace",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
                    <button
                      type="button"
                      onClick={() => setReconnectAccount(null)}
                      className="button secondary"
                      style={{ fontSize: "12px", padding: "6px 12px" }}
                    >
                      Kapat
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingReconnect || !reconnectCallbackInput.trim()}
                      className="button primary"
                      style={{
                        fontSize: "12px",
                        padding: "6px 14px",
                        background: "#16a34a",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {isSubmittingReconnect ? "Güncelleniyor..." : "✓ Oturumu Yenile"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
