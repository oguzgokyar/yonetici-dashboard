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
            <strong>{connectedCount > 0 ? "Instagram" : "—"}</strong>
            <small>Reels, Story, Feed</small>
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
            {data?.connected.map((account) => (
              <div key={account.id} className="account-card">
                {account.picture ? (
                  <img
                    src={account.picture}
                    alt={account.name}
                    className="account-avatar"
                  />
                ) : (
                  <div className="account-avatar-placeholder">
                    <Instagram size={20} />
                  </div>
                )}
                <div className="account-info">
                  <h4 className="account-name">{account.name || "İsimsiz"}</h4>
                  <span className="account-meta">
                    {account.profile ? `@${account.profile}` : account.identifier}
                  </span>
                  <div style={{ marginTop: "4px" }}>
                    <span className="badge-pill success">
                      <CheckCircle2 size={10} /> Bağlı
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
            ))}
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
              {unlinkedAvailable.map((integration) => (
                <div key={integration.id} className="account-card">
                  {integration.picture ? (
                    <img
                      src={integration.picture}
                      alt={integration.name}
                      className="account-avatar"
                    />
                  ) : (
                    <div className="account-avatar-placeholder" style={{ background: "#f0f1f5", color: "#747785" }}>
                      <Instagram size={20} />
                    </div>
                  )}
                  <div className="account-info">
                    <h4 className="account-name">{integration.name}</h4>
                    <span className="account-meta">
                      {integration.profile ? `@${integration.profile}` : integration.identifier}
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
              ))}
            </div>
          ) : (
            <div className="panel-empty" style={{ minHeight: "160px" }}>
              <div><CheckCircle2 size={22} /></div>
              <strong>{data.available.length === 0 ? "Postiz'de bağlı hesap bulunamadı" : "Tüm hesaplar eşleştirildi"}</strong>
              <p>
                {data.available.length === 0
                  ? "Yeni bir Instagram hesabı bağlamak için Postiz panelini açıp yetkilendirme yapın."
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
    </>
  );
}
