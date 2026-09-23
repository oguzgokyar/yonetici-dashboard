export type DriveConfig = {
  accountId?: string;
  folderId: string;
  folderName: string;
  rootFolderId?: string;
  rootFolderName?: string;
  includeSubfolders?: boolean;
  lastSyncedAt: string | null;
  syncStatus: string;
};

export type DriveAccount = {
  id: string;
  label: string;
  email: string;
  displayName: string;
  photoLink?: string;
  selectedForProject: boolean;
  usedByProjectCount: number;
  status?: string;
  lastValidatedAt?: string | null;
  lastError?: string | null;
};

export type DriveFolder = {
  id: string;
  name: string;
};

export type OutroItem = {
  id: string;
  title: string;
  videoUrl: string;
  durationSeconds?: number;
  createdAt?: string;
};
