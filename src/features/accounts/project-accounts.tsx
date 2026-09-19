"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Instagram,
  Link2,
  LoaderCircle,
  Plus,
  RefreshCw,
  Settings,
  Share2,
  Trash2,
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
      <div className="panel flex items-center justify-center py-16 text-center text-muted-foreground">
        <LoaderCircle className="spin mb-2" size={24} />
        <p>Sosyal medya hesapları yükleniyor...</p>
      </div>
    );
  }

  const connectedIds = new Set(data?.connected.map((c) => c.integrationId) || []);
  const unlinkedAvailable = (data?.available || []).filter((item) => !connectedIds.has(item.id));

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner / Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Share2 size={20} className="text-[#612bd3]" />
            <h2 className="text-lg font-bold">Sosyal Medya Hesapları</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Bu markaya ait paylaşımların gideceği Postiz sosyal medya hesaplarını eşleştirin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAccounts}
            className="button secondary text-xs"
            title="Yenile"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            Yenile
          </button>
          {data?.postizWebUrl && (
            <a
              href={data.postizWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button primary text-xs flex items-center gap-1.5"
            >
              <ExternalLink size={14} />
              Postiz Paneli ↗
            </a>
          )}
        </div>
      </div>

      {/* Alerts */}
      {!data?.postizConfigured && (
        <div className="connection-result error flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-amber-600 dark:text-amber-400">
          <CircleAlert size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <strong>Postiz API Bağlantısı Gerekli</strong>
            <p className="mt-1">
              Sosyal medya hesaplarınızı eşleştirmek için önce Sistem Ayarları &gt; API Yönetimi &gt; Postiz bölümünden API anahtarınızı tanımlamalısınız.
            </p>
            <Link href="/settings" className="button secondary mt-3 inline-flex text-xs">
              <Settings size={14} className="mr-1" />
              API Yönetimine Git
            </Link>
          </div>
        </div>
      )}

      {error && (
        <div className="connection-result error flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500">
          <CircleAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="connection-result success flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600">
          <CheckCircle2 size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* 1. Projeye Bağlı Hesaplar */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Projeye Bağlı Hesaplar</h3>
            <p>Bu markanın içeriklerinin doğrudan yayınlanacağı aktif hesaplar</p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {data?.connected.length || 0} Bağlı
          </span>
        </div>

        {data?.connected && data.connected.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {data.connected.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between gap-4 p-4 rounded-xl border bg-background hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {account.picture ? (
                    <img
                      src={account.picture}
                      alt={account.name}
                      className="w-11 h-11 rounded-full object-cover border"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-[#612bd3]/10 text-[#612bd3] flex items-center justify-center font-bold">
                      <Instagram size={20} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <strong className="text-sm font-semibold truncate">{account.name || "İsimsiz"}</strong>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-medium">
                        Aktif
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {account.profile ? `@${account.profile}` : account.identifier}
                    </p>
                    <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 mt-0.5">
                      <Instagram size={11} /> {account.identifier === "instagram-standalone" ? "Instagram Standalone" : "Instagram Business"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => unlinkAccount(account.id)}
                  disabled={actionLoading === `unlink-${account.id}`}
                  className="button ghost text-xs text-red-500 hover:bg-red-500/10 hover:text-red-600 p-2 rounded-lg"
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
          <div className="panel-empty mt-4 flex flex-col items-center justify-center p-8 text-center border border-dashed rounded-xl">
            <Share2 size={32} className="text-muted-foreground/40 mb-3" />
            <strong className="text-sm">Henüz bir hesap bağlanmadı</strong>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              Bu markaya ait bir sosyal medya hesabı bağlamak için aşağıdaki Postiz listesinden seçim yapabilirsiniz.
            </p>
          </div>
        )}
      </section>

      {/* 2. Postiz'de Yetkilendirilmiş Kullanılabilir Hesaplar */}
      {data?.postizConfigured && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Postiz'den Hesap Eşle</h3>
              <p>Postiz hesabınızda tanımlı olan ancak bu projeye henüz atanmamış hesaplar</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {unlinkedAvailable.length} Kullanılabilir
            </span>
          </div>

          {unlinkedAvailable.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {unlinkedAvailable.map((integration) => (
                <div
                  key={integration.id}
                  className="flex items-center justify-between gap-4 p-4 rounded-xl border bg-background hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {integration.picture ? (
                      <img
                        src={integration.picture}
                        alt={integration.name}
                        className="w-10 h-10 rounded-full object-cover border"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        <Instagram size={18} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <strong className="text-sm font-semibold truncate block">{integration.name}</strong>
                      <p className="text-xs text-muted-foreground truncate">
                        {integration.profile ? `@${integration.profile}` : integration.identifier}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => linkAccount(integration.id)}
                    disabled={actionLoading === `link-${integration.id}`}
                    className="button secondary text-xs flex items-center gap-1.5"
                  >
                    {actionLoading === `link-${integration.id}` ? (
                      <LoaderCircle className="spin" size={14} />
                    ) : (
                      <Plus size={14} />
                    )}
                    Projeye Bağla
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 p-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
              {data.available.length === 0 ? (
                <div>
                  <p className="font-medium">Postiz'de bağlı herhangi bir sosyal medya hesabı bulunamadı.</p>
                  <p className="mt-1">Yeni bir hesap bağlamak için Postiz panelini açıp Instagram veya Facebook yetkilendirmesi yapın.</p>
                </div>
              ) : (
                <p>Postiz'deki tüm hesaplar bu projeyle zaten eşleştirilmiş durumda.</p>
              )}
              {data.postizWebUrl && (
                <a
                  href={data.postizWebUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button secondary mt-3 inline-flex text-xs"
                >
                  <ExternalLink size={14} className="mr-1" />
                  Postiz'de Yeni Hesap Bağla
                </a>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
