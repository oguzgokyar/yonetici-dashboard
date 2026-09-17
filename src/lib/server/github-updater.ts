import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();

export type UpdateStatus = {
  mode: "local-git" | "coolify";
  repositoryReady: boolean;
  remoteUrl: string;
  branch: string;
  currentCommit: string;
  currentMessage: string;
  latestCommit: string;
  latestMessage: string;
  behind: number;
  ahead: number;
  updateAvailable: boolean;
  dirty: boolean;
  restartRequired?: boolean;
  deploymentQueued?: boolean;
};

type GithubCommit = { sha?: string; commit?: { message?: string } };

async function getCoolifyStatus(): Promise<UpdateStatus> {
  const repository = process.env.GITHUB_REPOSITORY || "oguzgokyar/yonetici-dashboard";
  const branch = process.env.GITHUB_BRANCH || "main";
  const currentCommit = process.env.SOURCE_COMMIT || process.env.APP_REVISION || "";
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "yonetici-dashboard" };
  if (process.env.GITHUB_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_ACCESS_TOKEN}`;
  const response = await fetch(`https://api.github.com/repos/${repository}/commits/${encodeURIComponent(branch)}`, { headers, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(response.status === 404 ? "GitHub deposuna erişilemedi. GITHUB_ACCESS_TOKEN ayarını kontrol edin." : `GitHub sürüm bilgisi alınamadı (${response.status}).`);
  const latest = await response.json() as GithubCommit;
  const latestCommit = latest.sha || "";
  const normalizedCurrent = currentCommit.toLowerCase();
  const normalizedLatest = latestCommit.toLowerCase();
  const updateAvailable = Boolean(normalizedCurrent && normalizedLatest && !normalizedLatest.startsWith(normalizedCurrent) && !normalizedCurrent.startsWith(normalizedLatest));
  return { mode: "coolify", repositoryReady: true, remoteUrl: `https://github.com/${repository}`, branch, currentCommit: currentCommit.slice(0, 7), currentMessage: "Çalışan Coolify dağıtımı", latestCommit: latestCommit.slice(0, 7), latestMessage: latest.commit?.message?.split("\n")[0] || "GitHub main sürümü", behind: updateAvailable ? 1 : 0, ahead: 0, updateAvailable, dirty: false };
}

async function run(command: string, args: string[], timeout = 30_000) {
  const result = await execFileAsync(command, args, {
    cwd: root,
    timeout,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  return result.stdout.trim();
}

async function git(args: string[], timeout?: number) {
  return run("git", args, timeout);
}

export async function getUpdateStatus(fetchRemote = false): Promise<UpdateStatus> {
  if (process.env.COOLIFY_DEPLOY_WEBHOOK) return getCoolifyStatus();
  try {
    await git(["rev-parse", "--is-inside-work-tree"]);
  } catch {
    return {
      mode: "local-git", repositoryReady: false, remoteUrl: "", branch: "", currentCommit: "", currentMessage: "",
      latestCommit: "", latestMessage: "", behind: 0, ahead: 0, updateAvailable: false, dirty: false,
    };
  }

  const branch = await git(["branch", "--show-current"]);
  const remoteUrl = await git(["remote", "get-url", "origin"]).catch(() => "");
  if (fetchRemote && remoteUrl) await git(["fetch", "--prune", "origin", "main"], 120_000);

  const currentCommit = await git(["rev-parse", "--short", "HEAD"]);
  const currentMessage = await git(["log", "-1", "--pretty=%s", "HEAD"]);
  const changedFiles = (await git(["status", "--porcelain"]))
    .split("\n")
    .filter(Boolean)
    .filter((line) => !line.endsWith("next-env.d.ts"));
  const dirty = changedFiles.length > 0;
  const hasRemoteMain = await git(["rev-parse", "--verify", "origin/main"]).then(() => true).catch(() => false);

  if (!hasRemoteMain) {
    return { mode: "local-git", repositoryReady: true, remoteUrl, branch, currentCommit, currentMessage, latestCommit: "", latestMessage: "", behind: 0, ahead: 0, updateAvailable: false, dirty };
  }

  const latestCommit = await git(["rev-parse", "--short", "origin/main"]);
  const latestMessage = await git(["log", "-1", "--pretty=%s", "origin/main"]);
  const counts = (await git(["rev-list", "--left-right", "--count", "HEAD...origin/main"])).split(/\s+/).map(Number);
  const [ahead = 0, behind = 0] = counts;
  return { mode: "local-git", repositoryReady: true, remoteUrl, branch, currentCommit, currentMessage, latestCommit, latestMessage, behind, ahead, updateAvailable: behind > 0, dirty };
}

export async function installUpdate() {
  if (process.env.COOLIFY_DEPLOY_WEBHOOK) {
    const token = process.env.COOLIFY_TOKEN;
    if (!token) throw new Error("COOLIFY_TOKEN tanımlanmamış.");
    const before = await getCoolifyStatus();
    if (!before.updateAvailable) return { ...before, restartRequired: false, deploymentQueued: false };
    const response = await fetch(process.env.COOLIFY_DEPLOY_WEBHOOK, { method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Coolify dağıtımı başlatılamadı (${response.status}).`);
    return { ...before, restartRequired: false, deploymentQueued: true };
  }
  const before = await getUpdateStatus(true);
  if (!before.repositoryReady || !before.remoteUrl) throw new Error("GitHub deposu henüz yapılandırılmamış.");
  if (before.branch !== "main") throw new Error("Güncelleme yalnızca main dalında yapılabilir.");
  if (before.dirty) throw new Error("Sunucuda kaydedilmemiş dosya değişiklikleri var. Güncelleme güvenlik için durduruldu.");
  if (before.ahead > 0) throw new Error("Sunucu main dalı GitHub'dan ileride. Önce dal geçmişini eşitleyin.");
  if (!before.updateAvailable) return { ...before, restartRequired: false };

  await git(["merge", "--ff-only", "origin/main"], 120_000);
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  await run(npmCommand, ["ci", "--no-audit", "--no-fund"], 10 * 60_000);
  await run(npmCommand, ["run", "build"], 10 * 60_000);
  return { ...(await getUpdateStatus(false)), restartRequired: true };
}
