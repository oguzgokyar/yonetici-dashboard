import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import ts from "typescript";
import { DatabaseSync } from "node:sqlite";

test("OpenPost integration client and publisher router standalone test", async () => {
  const encKeyFile = "/opt/data/yonetici-dashboard/.data/encryption.key";
  const rawKey = fs.readFileSync(encKeyFile);
  const encKey = crypto.createHash("sha256").update(rawKey).digest();

  // Test AES-GCM decrypt with secrets helper
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey, iv);
  const tokenPlain = "op_cli_a7d3ce0a_zu0nqAUPCzZ7nYnGaKMTMnKTxzopZKVCoPKH1A8FJms";
  const encrypted = Buffer.concat([cipher.update(tokenPlain, "utf8"), cipher.final()]);
  const encSecret = ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");

  const decipher = crypto.createDecipheriv("aes-256-gcm", encKey, Buffer.from(iv.toString("base64url"), "base64url"));
  decipher.setAuthTag(Buffer.from(cipher.getAuthTag().toString("base64url"), "base64url"));
  const dec = Buffer.concat([decipher.update(Buffer.from(encrypted.toString("base64url"), "base64url")), decipher.final()]).toString("utf8");
  assert.equal(dec, tokenPlain, "Encryption/Decryption must roundtrip identically");

  // Test live OpenPost accounts API
  const url = "https://sm.atolyehanem.com/api/v1/accounts?workspace_id=451b4a2b-a35e-443f-8627-7e3509b00199";
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${tokenPlain}`,
      Accept: "application/json",
    },
  });
  assert.equal(res.status, 200, "OpenPost API must return 200 OK");
  const accounts = await res.json();
  assert.ok(Array.isArray(accounts), "Accounts must be an array");
  assert.ok(accounts.length >= 2, "Must return at least 2 connected accounts (YouTube and Facebook)");

  const yt = accounts.find((a) => a.platform === "youtube");
  assert.ok(yt, "Must contain YouTube account");
  assert.equal(yt.account_username, "@atolye-hanem");

  const fb = accounts.find((a) => a.platform === "facebook");
  assert.ok(fb, "Must contain Facebook account");
  assert.equal(fb.account_username, "Atölye Hanem");
});
