import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGoogleAuthorizationUrl,
  createPkcePair,
  isSafeProjectReturnPath,
} from '../src/lib/google-drive-oauth.ts';

test('PKCE pair uses URL-safe verifier and matching S256 challenge', () => {
  const pair = createPkcePair();
  assert.match(pair.verifier, /^[A-Za-z0-9_-]{43,128}$/);
  assert.match(pair.challenge, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(pair.verifier, pair.challenge);
});

test('authorization URL requests offline Drive read access and account selection', () => {
  const url = new URL(buildGoogleAuthorizationUrl({
    clientId: 'client-id',
    redirectUri: 'https://example.com/api/integrations/google-drive/oauth/callback',
    state: 'state-token',
    codeChallenge: 'challenge',
    loginHint: 'owner@example.com',
  }));

  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('prompt'), 'consent select_account');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.match(url.searchParams.get('scope') || '', /drive\.readonly/);
  assert.equal(url.searchParams.get('login_hint'), 'owner@example.com');
});

test('OAuth return path is restricted to the current project stock page', () => {
  assert.equal(isSafeProjectReturnPath('/projects/atolye-hanem/stock-videos', 'atolye-hanem'), true);
  assert.equal(isSafeProjectReturnPath('/projects/other/stock-videos', 'atolye-hanem'), false);
  assert.equal(isSafeProjectReturnPath('https://evil.example/steal', 'atolye-hanem'), false);
});
