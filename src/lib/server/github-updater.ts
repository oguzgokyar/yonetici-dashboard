import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();

export type UpdateStatus = {
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
};

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
  try {
    await git(["rev-parse", "--is-inside-work-tree"]);
  } catch {
    return {
      repositoryReady: false, remoteUrl: "", branch: "", currentCommit: "", currentMessage: "",
      latestCommit: "", latestMessage: "", behind: 0, ahead: 0, updateAvailable: false, dirty: false,
    };
  }

  const branch = await git(["branch", "--show-current"]);
  const remoteUrl = await git(["remote", "get-url", "origin"]).catch(() => "");
  if (fetchRemote && remoteUrl) await git(["fetch", "--prune", "origin", "main"], 120_000);

  const currentCommit = await git(["rev-parse", "--short", "HEAD"]);
  const currentMessage = await git(["log", "-1", "--pretty=%s", "HEAD"]);
  const dirty = Boolean(await git(["status", "--porcelain"]));
  const hasRemoteMain = await git(["rev-parse", "--verify", "origin/main"]).then(() => true).catch(() => false);

  if (!hasRemoteMain) {
    return { repositoryReady: true, remoteUrl, branch, currentCommit, currentMessage, latestCommit: "", latestMessage: "", behind: 0, ahead: 0, updateAvailable: false, dirty };
  }

  const latestCommit = await git(["rev-parse", "--short", "origin/main"]);
  const latestMessage = await git(["log", "-1", "--pretty=%s", "origin/main"]);
  const counts = (await git(["rev-list", "--left-right", "--count", "HEAD...origin/main"])).split(/\s+/).map(Number);
  const [ahead = 0, behind = 0] = counts;
  return { repositoryReady: true, remoteUrl, branch, currentCommit, currentMessage, latestCommit, latestMessage, behind, ahead, updateAvailable: behind > 0, dirty };
}

export async function installUpdate() {
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
