"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Instagram,
  LoaderCircle,
  Plus,
  RefreshCw,
  Settings,
  Share2,
  Unlink,
  Youtube,
  Music2,
} from "lucide-react";

type ConnectedAccount = {
  id: string;
  service: string;
  integrationId: string;
  name: string;
  identifier: string;
  profile: string;
  picture: string;
  disabled: boolean;
  createdAt: string;
};

type AvailableIntegration = {
  id: string;
  name: string;
  identifier: string;
  profile?: string;
  picture?: string;
  disabled?: boolean;
};

type AccountsResponse = {
  ok: boolean;
  connected: ConnectedAccount[];
  available: AvailableIntegration[];
  postizConfigured: boolean;
  postizError?: string;
  postizWebUrl: string;
};

// Platform bilgilerini döndüren yardımcı fonksiyon
function getPlatformMeta(identifier: string): {
  label: string;
  color: string;
  bg: string;
  icon: React.ReactNode;
  description: string;
} {
  switch (identifier) {
    case "youtube":
      return {
        label: "YouTube",
        color: "#ff0000",
        bg: "#fff0f0",
        icon: <Youtube size={18} />,
        description: "Shorts & Uzun Video",
      };
    case "tiktok":
      return {
        label: "TikTok",
        color: "#010101",
        bg: "#f0f0f0",
        icon: <Music2 size={18} />,
        description: "Video & Fotoğraf Karesi",
      };
    case "instagram-standalone":
    case "instagram":
    default:
      return {
        label: "Instagram",
        color: "#e1306c",
        bg: "#fff0f5",
        icon: <Instagram size={18} />,
        description: "Reels, Story, Feed",
      };
  }
}

export function ProjectAccounts({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AccountsResponse | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadAccounts() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/accounts`);
      if (!response.ok) throw new Error("Hesaplar yüklenemedi.");
      const json = (await response.json()) as AccountsResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAccounts();
  }, [projectId]);

  async function linkAccount(integrationId: string) {
    setActionLoading(`link-${integrationId}`);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Hesap bağlanamadı.");
      setSuccessMessage(result.message || "Hesap başarıyla bağlandı.");
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(null);
    }
  }

  async function unlinkAccount(accountId: string) {
    if (!confirm("Bu hesabın proje bağlantısını kaldırmak istediğinize emin misiniz?")) return;
    setActionLoading(`unlink-${accountId}`);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/accounts?id=${accountId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Hesap bağlantısı kaldırılamadı.");
      setSuccessMessage(result.message || "Hesap bağlantısı kaldırıldı.");
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="overview-loading" style={{ minHeight: "380px" }} />
    );
  }

  const connectedIds = new Set(data?.connected.map((c) => c.integrationId) || []);
  const unlinkedAvailable = (data?.available || []).filter((item) => !connectedIds.has(item.id));
  const connectedCount = data?.connected.length || 0;

  // Platform sayıları
  const platformCounts = (data?.connected || []).reduce<Record<string, number>>((acc, a) => {
    const id = a.identifier || "instagram";
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});
  const platformLabels = Object.keys(platformCounts)
    .map((id) => getPlatformMeta(id).label)
    .join(", ") || "—";

  // Desteklenen platformlar: YouTube ve TikTok bağlama kılavuzu
  const hasYoutube = (data?.available || []).some((a) => a.identifier === "youtube") ||
    (data?.connected || []).some((a) => a.identifier === "youtube");
  const hasTiktok = (data?.available || []).some((a) => a.identifier === "tiktok") ||
    (data?.connected || []).some((a) => a.identifier === "tiktok");

  return (
    <>
      {/* 1. Page Intro */}
      <section className="page-intro">
        <div>
          <h2>Sosyal Medya Hesapları</h2>
          <p>Bu markaya ait paylaşımların yayınlanacağı aktif kanalları yönetin ve Postiz ile senkronize edin.</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={loadAccounts}
            className="button secondary"
            title="Yenile"
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            Yenile
          </button>
          {data?.postizWebUrl && (
            <a
              href={data.postizWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button primary"
            >
              <ExternalLink size={15} />
              Postiz Paneli ↗
            </a>
          )}
        </div>
      </section>

      {/* 2. Metrics Bar */}
      <section className="metric-grid">
        <div className="metric-card">
          <div className="metric-icon violet"><Share2 size={19} /></div>
          <div>
            <span>Bağlı Hesap</span>
            <strong>{connectedCount}</strong>
            <small>Aktif Kanal</small>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon blue"><Instagram size={19} /></div>
          <div>
            <span>Platformlar</span>
            <strong>{connectedCount > 0 ? platformLabels : "—"}</strong>
            <small>Bağlı Kanallar</small>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon green"><CheckCircle2 size={19} /></div>
          <div>
            <span>Postiz API</span>
            <strong>{data?.postizConfigured ? "Aktif" : "Eksik"}</strong>
            <small>{data?.postizConfigured ? "VPS İçi Canlı" : "Anahtar Gerekli"}</small>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon orange"><Plus size={19} /></div>
          <div>
            <span>Eşlenebilir</span>
            <strong>{unlinkedAvailable.length}</strong>
            <small>Postiz Hesabı</small>
          </div>
        </div>
      </section>

      {/* Postiz Not Configured Warning */}
      {!data?.postizConfigured && (
        <section className="setup-banner" style={{ margin: "16px 0" }}>
          <div className="setup-icon" style={{ background: "#fff2e8", color: "#d67c34" }}>
            <CircleAlert size={20} />
          </div>
          <div>
            <strong>Postiz API Bağlantısı Tanımlanmamış</strong>
            <p>Sosyal medya hesaplarınızı eşleştirmek için önce Sistem Ayarları &gt; API Yönetimi bölümünden Postiz anahtarınızı kaydedin.</p>
          </div>
          <Link href="/settings" className="button secondary">
            <Settings size={15} />
            API Yönetimine Git
          </Link>
        </section>
      )}

      {/* Feedback Alerts */}
      {error && (
        <div className="connection-result error" style={{ margin: "12px 0" }}>
          <CircleAlert size={16} />
          <span><strong>Hata</strong><small>{error}</small></span>
        </div>
      )}
      {successMessage && (
        <div className="connection-result success" style={{ margin: "12px 0" }}>
          <CheckCircle2 size={16} />
          <span><strong>Başarılı</strong><small>{successMessage}</small></span>
        </div>
      )}

      {/* 3. Projeye Bağlı Aktif Hesaplar */}
      <section className="panel" style={{ marginTop: "18px" }}>
        <div className="panel-header">
          <div>
            <h3>Projeye Bağlı Hesaplar</h3>
            <p>Bu markanın içeriklerinin doğrudan yayınlanacağı aktif hesaplar</p>
          </div>
          <span className="badge-pill success">
            {connectedCount} Aktif
          </span>
        </div>

        {connectedCount > 0 ? (
          <div className="accounts-grid">
            {data?.connected.map((account) => {
              const meta = getPlatformMeta(account.identifier || account.service);
              return (
                <div key={account.id} className="account-card">
                  {account.picture ? (
                    <img
                      src={account.picture}
                      alt={account.name}
                      className="account-avatar"
                    />
                  ) : (
                    <div
                      className="account-avatar-placeholder"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      {meta.icon}
                    </div>
                  )}
                  <div className="account-info">
                    <h4 className="account-name">{account.name || "İsimsiz"}</h4>
                    <span className="account-meta">
                      {account.profile ? `@${account.profile}` : account.identifier}
                    </span>
                    <div style={{ marginTop: "4px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      <span className="badge-pill success">
                        <CheckCircle2 size={10} /> Bağlı
                      </span>
                      <span
                        className="badge-pill"
                        style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}22` }}
                      >
                        {meta.label} · {meta.description}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => unlinkAccount(account.id)}
                    disabled={actionLoading === `unlink-${account.id}`}
                    className="icon-button"
                    style={{ color: "#d83d45" }}
                    title="Bağlantıyı Kaldır"
                  >
                    {actionLoading === `unlink-${account.id}` ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <Unlink size={16} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="panel-empty" style={{ minHeight: "180px" }}>
            <div style={{ background: "#f0edff", color: "#6757e8" }}>
              <Share2 size={24} />
            </div>
            <strong>Henüz bir hesap bağlanmadı</strong>
            <p>Aşağıdaki Postiz listesinden bir sosyal medya hesabını bu markayla eşleştirebilirsiniz.</p>
          </div>
        )}
      </section>

      {/* 4. Postiz'de Yetkilendirilmiş Kullanılabilir Hesaplar */}
      {data?.postizConfigured && (
        <section className="panel" style={{ marginTop: "18px" }}>
          <div className="panel-header">
            <div>
              <h3>Postiz&apos;den Hesap Eşle</h3>
              <p>Postiz hesabınızda tanımlı olan ancak bu projeye henüz atanmamış hesaplar</p>
            </div>
            <span className="badge-pill info">
              {unlinkedAvailable.length} Kullanılabilir
            </span>
          </div>

          {unlinkedAvailable.length > 0 ? (
            <div className="accounts-grid">
              {unlinkedAvailable.map((integration) => {
                const meta = getPlatformMeta(integration.identifier);
                return (
                  <div key={integration.id} className="account-card">
                    {integration.picture ? (
                      <img
                        src={integration.picture}
                        alt={integration.name}
                        className="account-avatar"
                      />
                    ) : (
                      <div
                        className="account-avatar-placeholder"
                        style={{ background: meta.bg, color: meta.color }}
                      >
                        {meta.icon}
                      </div>
                    )}
                    <div className="account-info">
                      <h4 className="account-name">{integration.name}</h4>
                      <span className="account-meta">
                        {integration.profile ? `@${integration.profile}` : integration.identifier}
                      </span>
                      <span
                        className="badge-pill"
                        style={{ marginTop: "4px", background: meta.bg, color: meta.color, border: `1px solid ${meta.color}22` }}
                      >
                        {meta.label} · {meta.description}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => linkAccount(integration.id)}
                      disabled={actionLoading === `link-${integration.id}`}
                      className="button secondary"
                      style={{ height: "34px", padding: "0 10px", fontSize: "11px" }}
                    >
                      {actionLoading === `link-${integration.id}` ? (
                        <LoaderCircle className="spin" size={13} />
                      ) : (
                        <Plus size={13} />
                      )}
                      Eşle
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="panel-empty" style={{ minHeight: "160px" }}>
              <div><CheckCircle2 size={22} /></div>
              <strong>{data.available.length === 0 ? "Postiz'de bağlı hesap bulunamadı" : "Tüm hesaplar eşleştirildi"}</strong>
              <p>
                {data.available.length === 0
                  ? "Yeni bir hesap bağlamak için Postiz panelini açıp yetkilendirme yapın."
                  : "Postiz'deki tüm hesaplar bu projeyle zaten eşleştirilmiş durumda."}
              </p>
              {data.postizWebUrl && (
                <a
                  href={data.postizWebUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button secondary"
                  style={{ marginTop: "12px", height: "34px", fontSize: "11px" }}
                >
                  <ExternalLink size={13} />
                  Postiz&apos;de Yeni Hesap Bağla
                </a>
              )}
            </div>
          )}
        </section>
      )}

      {/* 5. YouTube ve TikTok Bağlama Kılavuzu */}
      {!hasYoutube || !hasTiktok ? (
        <section className="panel" style={{ marginTop: "18px" }}>
          <div className="panel-header">
            <div>
              <h3>YouTube & TikTok Bağlama Kılavuzu</h3>
              <p>Bu platformları aktifleştirmek için gereken adımlar</p>
            </div>
            <span className="badge-pill" style={{ background: "#fff8e6", color: "#b57c00" }}>API Anahtarı Bekleniyor</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", padding: "4px 0" }}>
            {/* YouTube */}
            {!hasYoutube && (
              <div
                style={{
                  padding: "20px",
                  borderRadius: "12px",
                  border: "1px solid #ffd0d0",
                  background: "#fff8f8",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <div style={{ padding: "8px", borderRadius: "10px", background: "#fff0f0", color: "#ff0000" }}>
                    <Youtube size={20} />
                  </div>
                  <div>
                    <strong style={{ fontSize: "14px" }}>YouTube</strong>
                    <div style={{ fontSize: "11px", color: "#888" }}>Shorts & Uzun Video</div>
                  </div>
                </div>
                <ol style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", lineHeight: 1.8, color: "#555" }}>
                  <li>Google Cloud Console&apos;da proje oluşturun</li>
                  <li><strong>YouTube Data API v3</strong> etkinleştirin</li>
                  <li>OAuth 2.0 Client ID alın (Web Application)</li>
                  <li>Redirect URI ekleyin: <code style={{ fontSize: "10px" }}>sm.atolyehanem.com/api/v1/integrations/social/youtube/callback</code></li>
                  <li>Bize <strong>CLIENT_ID</strong> ve <strong>CLIENT_SECRET</strong> gönderin</li>
                </ol>
                <a
                  href="https://console.cloud.google.com/apis/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button secondary"
                  style={{ marginTop: "12px", width: "100%", justifyContent: "center", fontSize: "11px", height: "34px" }}
                >
                  <ExternalLink size={12} />
                  Google Cloud Console ↗
                </a>
              </div>
            )}

            {/* TikTok */}
            {!hasTiktok && (
              <div
                style={{
                  padding: "20px",
                  borderRadius: "12px",
                  border: "1px solid #d0d0d0",
                  background: "#f8f8f8",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <div style={{ padding: "8px", borderRadius: "10px", background: "#f0f0f0", color: "#010101" }}>
                    <Music2 size={20} />
                  </div>
                  <div>
                    <strong style={{ fontSize: "14px" }}>TikTok</strong>
                    <div style={{ fontSize: "11px", color: "#888" }}>Video & Doğrudan Yayın</div>
                  </div>
                </div>
                <ol style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", lineHeight: 1.8, color: "#555" }}>
                  <li>developers.tiktok.com&apos;da Developer App oluşturun</li>
                  <li><strong>Content Posting API</strong> ve <strong>Direct Post</strong> izinlerini ekleyin</li>
                  <li>Redirect URI ekleyin: <code style={{ fontSize: "10px" }}>sm.atolyehanem.com/api/v1/integrations/social/tiktok/callback</code></li>
                  <li>Uygulama onayını bekleyin (1-3 iş günü)</li>
                  <li>Bize <strong>Client Key</strong> ve <strong>Client Secret</strong> gönderin</li>
                </ol>
                <a
                  href="https://developers.tiktok.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button secondary"
                  style={{ marginTop: "12px", width: "100%", justifyContent: "center", fontSize: "11px", height: "34px" }}
                >
                  <ExternalLink size={12} />
                  TikTok Developers ↗
                </a>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </>
  );
}
