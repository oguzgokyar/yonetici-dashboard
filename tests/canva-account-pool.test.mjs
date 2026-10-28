import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from '../node_modules/typescript/lib/typescript.js';

const require = createRequire(import.meta.url);

function createMockDatabase() {
  const rows = [];
  return {
    rows,
    prepare(sql) {
      if (sql.includes('UPDATE canva_accounts SET daily_exports_count = 0')) {
        return {
          run() {
            return { changes: 0 };
          }
        };
      }
      if (sql.includes('SELECT id, email, display_name, token_json')) {
        return {
          all() {
            return rows;
          },
          get(id) {
            return rows.find(r => r.id === id);
          }
        };
      }
      if (sql.includes('SELECT COUNT(*) as count FROM canva_accounts')) {
        return {
          get() {
            return { count: rows.length };
          }
        };
      }
      if (sql.includes('INSERT INTO canva_accounts')) {
        return {
          run(...args) {
            if (args.length === 3) {
              const [token_json, created_at, updated_at] = args;
              rows.push({
                id: 'canva_default',
                email: null,
                display_name: 'Canva Ana Hesap (Hermes)',
                token_json,
                quota_status: 'available',
                quota_exhausted_at: null,
                daily_exports_count: 0,
                total_exports_count: 0,
                last_used_at: null,
                last_error: null,
                is_active: 1,
                created_at,
                updated_at,
              });
            } else {
              const [id, email, display_name, token_json, created_at, updated_at] = args;
              rows.push({
                id,
                email,
                display_name,
                token_json,
                quota_status: 'available',
                quota_exhausted_at: null,
                daily_exports_count: 0,
                total_exports_count: 0,
                last_used_at: null,
                last_error: null,
                is_active: 1,
                created_at,
                updated_at,
              });
            }
            return { changes: 1 };
          }
        };
      }
      if (sql.includes('UPDATE canva_accounts SET')) {
        return {
          run(...args) {
            const id = args[args.length - 1];
            const target = rows.find(r => r.id === id);
            if (target) {
              if (sql.includes('is_active = ?')) {
                target.is_active = args[1];
              }
              if (sql.includes('token_json = ?')) {
                target.token_json = args[1];
              }
              return { changes: 1 };
            }
            return { changes: 0 };
          }
        };
      }
      if (sql.includes('DELETE FROM canva_accounts')) {
        return {
          run(id) {
            const idx = rows.findIndex(r => r.id === id);
            if (idx >= 0) {
              rows.splice(idx, 1);
              return { changes: 1 };
            }
            return { changes: 0 };
          }
        };
      }
      return {
        run() { return { changes: 0 }; },
        all() { return []; },
        get() { return null; },
      };
    }
  };
}

function loadPoolModule(mockDb) {
  const stubs = {
    '@/lib/server/database': {
      getDatabase: () => mockDb,
    },
  };

  const code = fs.readFileSync(new URL('../src/lib/server/canva-account-pool.ts', import.meta.url), 'utf8');
  const transpiled = ts.transpile(code, {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  });

  const moduleObj = { exports: {} };
  const mockRequire = (id) => {
    if (stubs[id]) return stubs[id];
    return require(id);
  };

  const fn = new Function('module', 'exports', 'require', transpiled);
  fn(moduleObj, moduleObj.exports, mockRequire);
  return moduleObj.exports;
}

test('getAccountAuthInfo correctly determines token state', () => {
  const pool = loadPoolModule(createMockDatabase());

  // Empty / invalid
  assert.equal(pool.getAccountAuthInfo('').authStatus, 'no_token');
  assert.equal(pool.getAccountAuthInfo('{}').authStatus, 'no_token');
  assert.equal(pool.getAccountAuthInfo('not-json').authStatus, 'no_token');

  // Expired token (expires_at in past)
  const pastSeconds = Math.floor(Date.now() / 1000) - 3600;
  const expiredJson = JSON.stringify({ access_token: 'abc', expires_at: pastSeconds });
  const expiredInfo = pool.getAccountAuthInfo(expiredJson);
  assert.equal(expiredInfo.authStatus, 'expired');
  assert.ok(expiredInfo.expiresAt);

  // Active token (expires_at in future)
  const futureSeconds = Math.floor(Date.now() / 1000) + 7200;
  const activeJson = JSON.stringify({ access_token: 'abc', expires_at: futureSeconds });
  const activeInfo = pool.getAccountAuthInfo(activeJson);
  assert.equal(activeInfo.authStatus, 'active');
  assert.ok(activeInfo.expiresAt);
});

test('pool summary detects auth outage when all accounts have expired tokens', () => {
  const mockDb = createMockDatabase();
  const pool = loadPoolModule(mockDb);

  // Add account with expired token
  const pastSeconds = Math.floor(Date.now() / 1000) - 3600;
  mockDb.rows.push({
    id: 'canva_default',
    email: 'test@example.com',
    display_name: 'Test Account',
    token_json: JSON.stringify({ access_token: 'tok', expires_at: pastSeconds }),
    quota_status: 'available',
    quota_exhausted_at: null,
    daily_exports_count: 0,
    total_exports_count: 0,
    last_used_at: null,
    last_error: null,
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const summary = pool.getCanvaPoolSummary();
  assert.equal(summary.hasAuthOutage, true);
  assert.equal(summary.availableAccounts, 0);
  assert.equal(summary.expiredAccountsCount, 1);
  assert.ok(summary.reconnectUrl);
  assert.ok(summary.authMessage.includes('belirtecinin süresi dolmuş'));

  // getNextAvailableCanvaAccount returns null because token is expired
  const nextAcc = pool.getNextAvailableCanvaAccount();
  assert.equal(nextAcc, null);
});

test('pool summary returns available when an account has a valid token', () => {
  const mockDb = createMockDatabase();
  const pool = loadPoolModule(mockDb);

  const futureSeconds = Math.floor(Date.now() / 1000) + 7200;
  mockDb.rows.push({
    id: 'canva_valid',
    email: 'valid@example.com',
    display_name: 'Valid Account',
    token_json: JSON.stringify({ access_token: 'tok', expires_at: futureSeconds }),
    quota_status: 'available',
    quota_exhausted_at: null,
    daily_exports_count: 0,
    total_exports_count: 0,
    last_used_at: null,
    last_error: null,
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const summary = pool.getCanvaPoolSummary();
  assert.equal(summary.hasAuthOutage, false);
  assert.equal(summary.availableAccounts, 1);
  assert.equal(summary.status, 'available');

  const nextAcc = pool.getNextAvailableCanvaAccount();
  assert.ok(nextAcc);
  assert.equal(nextAcc.id, 'canva_valid');
});
