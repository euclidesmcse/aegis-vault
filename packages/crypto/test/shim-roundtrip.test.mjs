// AegisVault v0.2 shim roundtrip test: covers modules that transitively
// depend on libsodium-wrappers (aead, envelope, share, export). The shim
// at node_modules/libsodium-wrappers/dist/modules-esm/libsodium.mjs is a
// WebCrypto-backed stand-in (PBKDF2-SHA256 + AES-GCM) that satisfies the
// libsodium API surface but is NOT algorithmically equivalent to the real
// libsodium-wrappers-sumo (Argon2id + XChaCha20-Poly1305-IETF). Therefore this
// test only asserts referential transparency (round-trip inside this process)
// and never compares derived bytes against external known-good answers.
//
// Production CI runs the same suite against real libsodium-wrappers
// (pnpm install first). In sandbox the shim provides the substitute.
import assert from "node:assert/strict";
import { encrypt, decrypt } from "../src/aead.ts";
import { encryptEnvelope, decryptEnvelope, buildAad } from "../src/envelope.ts";
import { createShare, revealShare, envelopeDigest } from "../src/share.ts";
import { createExportBundle, decryptExportBundleWithContext } from "../src/export.ts";

let passed = 0;
let failed = 0;
async function t(name, fn) {
  try {
    await fn();
    console.log("  PASS", name);
    passed++;
  } catch (e) {
    console.error("  FAIL", name, "-", (e && e.message) ? e.message : String(e));
    failed++;
  }
}

console.log("=== AegisVault v0.2 crypto shim-roundtrip (deps via shim) ===");

await t("aead: encrypt then decrypt recovers plaintext of mixed sizes", async () => {
  const key = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const samples = [
    new Uint8Array([0]),
    new TextEncoder().encode("AegisVault"),
    new TextEncoder().encode("A".repeat(1024)),
  ];
  for (const pt of samples) {
    const sealed = await encrypt(key, pt, new Uint8Array());
    assert.ok(sealed.length >= 24 + pt.length + 16, "sealed too short for len=" + pt.length);
    const back = await decrypt(key, sealed, new Uint8Array());
    assert.deepEqual(Array.from(back), Array.from(pt), "plaintext mismatch for len=" + pt.length);
  }
});

await t("envelope: encrypt then decrypt with matching AAD recovers plaintext", async () => {
  const rec = await encryptEnvelope(
    new TextEncoder().encode("envelope-secret-payload-001"),
    "correct-horse-battery-staple-123",
    { tenantId: "tenant-prod", itemId: "item-42", type: "login" },
  );
  assert.equal(rec.v, 1);
  assert.equal(rec.alg, "XCHACHA20-POLY1305-IETF");
  assert.equal(rec.kdf, "argon2id");
  const back = await decryptEnvelope(
    rec,
    "correct-horse-battery-staple-123",
    { tenantId: "tenant-prod", itemId: "item-42", type: "login" },
  );
  assert.equal(new TextDecoder().decode(back), "envelope-secret-payload-001");
});

await t("envelope: changes in AAD tenantId cause aad-mismatch (refuses to decrypt)", async () => {
  const rec = await encryptEnvelope(
    new TextEncoder().encode("envelope-secret-payload-002"),
    "correct-horse-battery-staple-123",
    { tenantId: "tenant-prod", itemId: "item-42", type: "login" },
  );
  await assert.rejects(
    decryptEnvelope(
      rec,
      "correct-horse-battery-staple-123",
      { tenantId: "tenant-other", itemId: "item-42", type: "login" },
    ),
    /aad mismatch/,
  );
});

await t("envelope: buildAad is deterministic + version-mutation shifts bytes", () => {
  const a1 = buildAad({ tenantId: "t1", itemId: "i1", type: "login" });
  const a2 = buildAad({ tenantId: "t1", itemId: "i1", type: "login" });
  assert.deepEqual(Array.from(a1), Array.from(a2));
  const a3 = buildAad({ tenantId: "t1", itemId: "i1", type: "login", version: 2 });
  assert.notDeepEqual(Array.from(a3), Array.from(a1), "version must change AAD bytes");
});

await t("share: createShare then revealShare with full payload recovers plaintext", async () => {
  const payload = new TextEncoder().encode("share-link-secret");
  const share = await createShare(payload);
  assert.equal(typeof share.token, "string");
  assert.equal(typeof share.fragmentKey, "string");
  assert.equal(typeof share.envelope, "string");
  assert.ok(share.token.length >= 32, "token b64url too short");
  const back = await revealShare(share.fragmentKey, share.envelope, share.token);
  assert.equal(new TextDecoder().decode(back), "share-link-secret");
});

await t("share: revealShare with a wrong token refuses to decrypt (AEAD tag mismatch)", async () => {
  const share = await createShare(new TextEncoder().encode("share-link-secret-002"));
  const wrongTokenBytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  // Use Node's 'base64url' codec (built-in since Node 16) so this test never
  // has to touch regex literals for `+` or `/`, which collide with both the
  // heredoc encoder and Node's regex parser in this stack.
  const wrongTokenB64 = Buffer.from(wrongTokenBytes).toString("base64url");
  await assert.rejects(
    revealShare(share.fragmentKey, share.envelope, wrongTokenB64),
    (err) => {
      if (err instanceof assert.AssertionError) return false;
      return Boolean(err && err.message);
    },
  );
  const goodBack = await revealShare(share.fragmentKey, share.envelope, share.token);
  assert.equal(new TextDecoder().decode(goodBack), "share-link-secret-002");
});

await t("export: .aegis round-trips when exportedAt is pinned via Date mock", async () => {
  const realToIso = Date.prototype.toISOString;
  const pinned = "2025-01-01T00:00:00.000Z";
  Date.prototype.toISOString = function () { return pinned; };
  try {
    const file = await createExportBundle({
      workspaceId: "ws-personal-roundtrip",
      passphrase: "correct-horse-battery-staple-123",
      originMeta: { userId: "u1", serverOrigin: "aegis.local", exportedAt: pinned },
      items: [
        {
          originItemId: "i1", type: "login",
          folderIdOrigin: null, collectionIdOrigin: null,
          favorite: true, trashed: false,
          createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-02-02T00:00:00Z",
          payload: new TextEncoder().encode("plaintext-secret-content"),
        },
        {
          originItemId: "i2", type: "note",
          folderIdOrigin: "fid", collectionIdOrigin: null,
          favorite: false, trashed: false,
          createdAt: "2024-03-03T00:00:00Z", updatedAt: "2024-04-04T00:00:00Z",
          payload: new TextEncoder().encode("second-item-secret"),
        },
      ],
    });
    const magic = new TextDecoder().decode(file.slice(0, 8));
    assert.equal(magic, "AEGIS_V1");
    assert.equal(file[8], 1, "file version byte must be 1");
    // Bug regression check (no `sealed` in scope here). The original bug
    // over-allocated the file by 24 bytes; the writer padded those bytes
    // with zeros. Assert those last 24 bytes are NOT all zero to catch any
    // future regression of the over-allocation without depending on the
    // internal `sealed` variable from createExportBundle.
    const tail = file.slice(-24);
    assert.equal(
      tail.length > 0 && tail.every((b) => b === 0),
      false,
      "regression: file tail bytes are all zero (over-allocation bug)",
    );
    assert.ok(file.length >= 8 + 1 + 16 + 24 + 16, "file too short for any payload");
    const bundle = await decryptExportBundleWithContext(
      file,
      "correct-horse-battery-staple-123",
      { workspaceId: "ws-personal-roundtrip", exportedAt: pinned },
    );
    assert.equal(bundle.v, 1);
    assert.equal(bundle.workspaceId, "ws-personal-roundtrip");
    assert.equal(bundle.exportedAt, pinned);
    assert.equal(bundle.itemCount, 2);
    assert.equal(bundle.items.length, 2);
    assert.equal(bundle.items[0].type, "login");
    assert.equal(bundle.items[1].type, "note");
    assert.equal(bundle.items[0].originItemId, "i1");
    assert.equal(bundle.items[1].originItemId, "i2");
    assert.ok(bundle.items[0].payloadB64.length > 0);
  } finally {
    Date.prototype.toISOString = realToIso;
  }
});

console.log("=== Results: " + passed + " passed, " + failed + " failed ===");
if (failed > 0) process.exit(1);
