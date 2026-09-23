"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronRight, FileJson, Folder, HardDrive, LoaderCircle, Trash2, Upload, X } from "lucide-react";
import type { DriveAccount, DriveConfig, DriveFolder } from "./types";

type SystemAccount = { email: string; displayName: string; photoLink?: string };
type Breadcrumb = { id: string; name: string };

export function DriveSettingsModal({
  projectId,
  config,
  initialTab,
  onClose,
  onConfigured,
}: {
  projectId: string;
  config: DriveConfig | null;
  initialTab: "accounts" | "folders";
  onClose: () => void;
  onConfigured: (message: string, syncAfterSave?: boolean) => Promise<void> | void;
}) {
  const [tab, setTab] = useState(initialTab);
  const [accounts, setAccounts] = useState<DriveAccount[]>([]);
  const [systemAccount, setSystemAccount] = useState<SystemAccount | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: "root", name: "Drive" }]);
  const [includeSubfolders, setIncludeSubfolders] = useState(config?.includeSubfolders !== false);
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [accountLabel, setAccountLabel] = useState("");
  const [tokenJson, setTokenJson] = useState("");
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/stock-videos/drive-accounts`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Drive hesapları alınamadı.");
      setAccounts(data.accounts || []);
      setSystemAccount(data.systemAccount || null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Drive hesapları alınamadı.");
    } finally {
      setAccountsLoading(false);
    }
  }, [projectId]);

  const loadFolder = useCallback(async (folder: Breadcrumb, nextBreadcrumbs: Breadcrumb[]) => {
    setFoldersLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/stock-videos/drive-tree?parentId=${encodeURIComponent(folder.id)}&parentName=${encodeURIComponent(folder.name)}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Klasörler alınamadı.");
      setFolders(data.folders || []);
      setBreadcrumbs(nextBreadcrumbs);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Klasörler alınamadı.");
    } finally {
      setFoldersLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAccounts();
    void loadFolder({ id: "root", name: "Drive" }, [{ id: "root", name: "Drive" }]);
  }, [loadAccounts, loadFolder]);

  const currentFolder = breadcrumbs[breadcrumbs.length - 1];
  const selectedAccount = accounts.find((account) => account.selectedForProject);

  async function selectAccount(accountId?: string) {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/stock-videos/drive-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountId ? { action: "select", accountId } : { action: "use_system" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Hesap seçilemedi.");
      await loadAccounts();
      await loadFolder({ id: "root", name: "Drive" }, [{ id: "root", name: "Drive" }]);
      setNotice(data.message);
      await onConfigured(data.message, false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Hesap seçilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount(account: DriveAccount) {
    if (!confirm(`${account.label} hesabını kaldırmak istediğinize emin misiniz?`)) return;
    const response = await fetch(`/api/projects/${projectId}/stock-videos/drive-accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", accountId: account.id }),
    });
    const data = await response.json();
    setNotice(data.message || (response.ok ? "Hesap kaldırıldı." : "Hesap kaldırılamadı."));
    if (response.ok) await loadAccounts();
  }

  async function readTokenFile(file?: File) {
    if (!file) return;
    setFileName(file.name);
    setTokenJson(await file.text());
  }

  async function addAccount() {
    if (!tokenJson.trim()) {
      setNotice("Önce Google kimlik JSON dosyasını seçin.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/stock-videos/drive-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", label: accountLabel, tokenJson }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Hesap bağlanamadı.");
      setAccountLabel("");
      setTokenJson("");
      setFileName("");
      setAccountFormOpen(false);
      await loadAccounts();
      await loadFolder({ id: "root", name: "Drive" }, [{ id: "root", name: "Drive" }]);
      setNotice(data.message);
      await onConfigured(data.message, false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Hesap bağlanamadı.");
    } finally {
      setSaving(false);
    }
  }

  async function selectRootFolder() {
    if (currentFolder.id === "root") {
      setNotice("Drive kökü yerine bir klasörün içine girip o klasörü ana dizin seçin.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/stock-videos/drive-tree`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootFolderId: currentFolder.id,
          rootFolderName: currentFolder.name,
          includeSubfolders,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Ana dizin kaydedilemedi.");
      await onConfigured(data.message, true);
      onClose();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Ana dizin kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  function enterFolder(folder: DriveFolder) {
    void loadFolder(folder, [...breadcrumbs, folder]);
  }

  function goBack() {
    if (breadcrumbs.length <= 1) return;
    const next = breadcrumbs.slice(0, -1);
    void loadFolder(next[next.length - 1], next);
  }

  return (
    <div className="modal-backdrop">
      <div className="surface-modal drive-settings-dialog">
        <div className="drive-dialog-header">
          <div>
            <span>STOK İÇERİK</span>
            <h3>Google Drive Yapılandırması</h3>
          </div>
          <button type="button" className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="drive-dialog-tabs">
          <button type="button" className={tab === "accounts" ? "active" : ""} onClick={() => setTab("accounts")}>
            <HardDrive size={15} /> Hesap
          </button>
          <button type="button" className={tab === "folders" ? "active" : ""} onClick={() => setTab("folders")}>
            <Folder size={15} /> Ana klasör
          </button>
        </div>

        {notice && <div className="drive-dialog-notice">{notice}</div>}

        {tab === "accounts" ? (
          <div className="drive-account-view">
            <div className="drive-section-heading">
              <div><strong>Kayıtlı hesaplar</strong><small>Bir kez eklenen hesap tüm projelerde kullanılabilir.</small></div>
              <button type="button" className="button secondary" onClick={() => setAccountFormOpen((value) => !value)}>
                <Upload size={14} /> Yeni hesap
              </button>
            </div>

            {accountsLoading ? <div className="drive-dialog-loading"><LoaderCircle className="spin" /> Hesaplar yükleniyor</div> : (
              <div className="drive-account-list-clean">
                {systemAccount && (
                  <button type="button" className={`drive-account-choice ${!selectedAccount ? "selected" : ""}`} onClick={() => void selectAccount()} disabled={saving}>
                    <span className="drive-avatar"><HardDrive size={18} /></span>
                    <span><strong>{systemAccount.displayName || "Sistem Drive"}</strong><small>{systemAccount.email}</small></span>
                    {!selectedAccount && <Check size={17} />}
                  </button>
                )}
                {accounts.map((account) => (
                  <div key={account.id} className={`drive-account-choice ${account.selectedForProject ? "selected" : ""}`}>
                    <button type="button" className="drive-account-select" onClick={() => void selectAccount(account.id)} disabled={saving}>
                      <span className="drive-avatar">
                        {account.photoLink ? <Image src={account.photoLink} alt="" width={36} height={36} unoptimized /> : <HardDrive size={18} />}
                      </span>
                      <span><strong>{account.label}</strong><small>{account.email} · {account.usedByProjectCount} proje</small></span>
                      {account.selectedForProject && <Check size={17} />}
                    </button>
                    <button type="button" className="drive-account-delete" onClick={() => void deleteAccount(account)} title="Hesabı kaldır"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}

            {accountFormOpen && (
              <div className="drive-account-connect-card">
                <div><FileJson size={18} /><span><strong>Google kimlik dosyası</strong><small>JSON dosyası doğrulanır ve şifrelenerek saklanır.</small></span></div>
                <input className="custom-input" value={accountLabel} onChange={(event) => setAccountLabel(event.target.value)} placeholder="Hesap etiketi (isteğe bağlı)" />
                <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => void readTokenFile(event.target.files?.[0])} />
                <button type="button" className="drive-file-picker" onClick={() => fileRef.current?.click()}>
                  <Upload size={15} /> {fileName || "JSON dosyası seç"}
                </button>
                <div className="drive-connect-actions">
                  <button type="button" className="button ghost" onClick={() => setAccountFormOpen(false)}>Vazgeç</button>
                  <button type="button" className="button primary" onClick={() => void addAccount()} disabled={saving || !tokenJson}>
                    {saving ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />} Doğrula ve bağla
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="drive-folder-view">
            <div className="drive-folder-toolbar">
              <button type="button" className="drive-back-button" onClick={goBack} disabled={breadcrumbs.length <= 1}><ArrowLeft size={15} /> Geri</button>
              <div className="drive-breadcrumbs">
                {breadcrumbs.map((crumb, index) => <span key={crumb.id}>{index > 0 && "/"}{crumb.name}</span>)}
              </div>
            </div>

            <div className="drive-current-folder">
              <Folder size={17} /><span><small>Bulunulan klasör</small><strong>{currentFolder.name}</strong></span>
            </div>

            <div className="drive-folder-list-clean">
              {foldersLoading ? <div className="drive-dialog-loading"><LoaderCircle className="spin" /> Klasörler yükleniyor</div> : folders.length ? folders.map((folder) => (
                <button type="button" key={folder.id} onClick={() => enterFolder(folder)}>
                  <Folder size={18} /><span>{folder.name}</span><ChevronRight size={16} />
                </button>
              )) : <div className="drive-empty-folder">Bu dizinde alt klasör bulunmuyor.</div>}
            </div>

            <label className="drive-subfolder-toggle">
              <input type="checkbox" checked={includeSubfolders} onChange={(event) => setIncludeSubfolders(event.target.checked)} />
              <span><strong>Alt klasörleri de tara</strong><small>Seçilen ana klasörün tüm alt klasörlerindeki videolar dahil edilir.</small></span>
            </label>

            <div className="drive-folder-footer">
              <span>Seçili: <strong>{config?.rootFolderName || "Henüz seçilmedi"}</strong></span>
              <button type="button" className="button primary" onClick={() => void selectRootFolder()} disabled={saving || currentFolder.id === "root"}>
                {saving ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />} Bu klasörü ana dizin yap
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
