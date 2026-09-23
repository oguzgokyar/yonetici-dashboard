export type LegacyDriveAccount = {
  id: string;
  projectId: string;
  label: string;
  email: string;
  displayName: string;
  photoLink: string;
  encryptedTokenJson: string;
  createdAt: string;
  updatedAt: string;
};

export type GlobalDriveAccount = Omit<LegacyDriveAccount, "projectId">;

export function buildDirectChildFolderQuery(parentId: string): string {
  const safeParentId = parentId.trim() || "root";
  return `'${safeParentId.replace(/'/g, "\\'")}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
}

export function chunkFolderIds(folderIds: string[], batchSize = 20): string[][] {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("batchSize must be a positive integer");
  }

  const batches: string[][] = [];
  for (let index = 0; index < folderIds.length; index += batchSize) {
    batches.push(folderIds.slice(index, index + batchSize));
  }
  return batches;
}

export function dedupeLegacyDriveAccounts(legacyAccounts: LegacyDriveAccount[]): {
  accounts: GlobalDriveAccount[];
  projectAssignments: Array<{ projectId: string; accountId: string }>;
} {
  const accounts: GlobalDriveAccount[] = [];
  const projectAssignments: Array<{ projectId: string; accountId: string }> = [];
  const accountIdByIdentity = new Map<string, string>();

  for (const legacyAccount of legacyAccounts) {
    const normalizedEmail = legacyAccount.email.trim().toLocaleLowerCase("en-US");
    const identity = normalizedEmail || legacyAccount.id;
    let accountId = accountIdByIdentity.get(identity);

    if (!accountId) {
      accountId = legacyAccount.id;
      accountIdByIdentity.set(identity, accountId);
      accounts.push({
        id: accountId,
        label: legacyAccount.label,
        email: normalizedEmail,
        displayName: legacyAccount.displayName,
        photoLink: legacyAccount.photoLink,
        encryptedTokenJson: legacyAccount.encryptedTokenJson,
        createdAt: legacyAccount.createdAt,
        updatedAt: legacyAccount.updatedAt,
      });
    }

    projectAssignments.push({ projectId: legacyAccount.projectId, accountId });
  }

  return { accounts, projectAssignments };
}
