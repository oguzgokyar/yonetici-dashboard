import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDirectChildFolderQuery,
  chunkFolderIds,
  dedupeLegacyDriveAccounts,
} from '../src/lib/stock-drive-architecture.ts';

test('root folder query lists only direct root children', () => {
  assert.equal(
    buildDirectChildFolderQuery('root'),
    "'root' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
  );
});

test('folder query lists only direct children of the current folder', () => {
  assert.equal(
    buildDirectChildFolderQuery('folder-123'),
    "'folder-123' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
  );
});

test('folder ids are split into bounded Drive query batches without loss', () => {
  const ids = Array.from({ length: 53 }, (_, index) => `folder-${index + 1}`);
  const batches = chunkFolderIds(ids, 20);

  assert.deepEqual(batches.map((batch) => batch.length), [20, 20, 13]);
  assert.deepEqual(batches.flat(), ids);
});

test('legacy project accounts are deduplicated globally by Google email', () => {
  const legacy = [
    {
      id: 'account-a',
      projectId: 'project-a',
      label: 'Archive A',
      email: 'owner@example.com',
      displayName: 'Owner',
      photoLink: '',
      encryptedTokenJson: 'token-a',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
    {
      id: 'account-b',
      projectId: 'project-b',
      label: 'Archive B',
      email: 'OWNER@example.com',
      displayName: 'Owner',
      photoLink: '',
      encryptedTokenJson: 'token-b',
      createdAt: '2026-01-03T00:00:00.000Z',
      updatedAt: '2026-01-04T00:00:00.000Z',
    },
  ];

  const result = dedupeLegacyDriveAccounts(legacy);

  assert.equal(result.accounts.length, 1);
  assert.equal(result.accounts[0].email, 'owner@example.com');
  assert.deepEqual(result.projectAssignments, [
    { projectId: 'project-a', accountId: result.accounts[0].id },
    { projectId: 'project-b', accountId: result.accounts[0].id },
  ]);
});
