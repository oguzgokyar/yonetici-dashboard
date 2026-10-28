"use client";

import { useState } from "react";
import { Lock, ShieldCheck, Check, KeyRound } from "lucide-react";

export function AccessSecuritySettings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword || loading) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      setResult({ ok: res.ok && data.ok, message: data.message || "İşlem tamamlandı." });
      if (res.ok && data.ok) {
        setCurrentPassword("");
        setNewPassword("");
      }
    } catch (err: any) {
      setResult({ ok: false, message: "Bağlantı hatası: " + err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="update-card" style={{ marginTop: "20px" }}>
      <div className="update-heading">
        <span style={{ background: "rgba(99, 102, 241, 0.1)", color: "#6366f1" }}>
          <Lock size={22} />
        </span>
        <div>
          <h2>Erişim Kilidi & Yönetici Şifresi</h2>
          <p>
            Dışarıdan yetkisiz erişimleri sınırlandırmak için kullanılan ana şifredir. Giriş yapan tarayıcılarda oturum 30 gün boyunca aktif kalır.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px", color: "#475569" }}>
        <ShieldCheck size={16} color="#10b981" />
        <span>Giriş koruması aktif. Yetkisiz ziyaretçiler doğrudan giriş ekranına yönlendirilir.</span>
      </div>

      <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "14px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
              Mevcut Şifre
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
              Yeni Şifre
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="En az 4 karakter"
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {result && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              background: result.ok ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
              border: result.ok ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
              color: result.ok ? "#15803d" : "#b91c1c",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {result.ok ? <Check size={14} /> : null}
            <span>{result.message}</span>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={loading || !currentPassword || !newPassword}
            className="button primary text-xs"
            style={{ height: "36px", padding: "0 16px", fontWeight: "600" }}
          >
            <KeyRound size={14} />
            <span>{loading ? "Güncelleniyor..." : "Şifreyi Değiştir"}</span>
          </button>
        </div>
      </form>
    </section>
  );
}
