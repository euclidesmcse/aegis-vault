// Bateria de testes REAL contra libsodium-wrappers-sumo 0.8.4 (não o shim WebCrypto).
// Valida vetores conhecidos (SHA-256), determinismo do Argon2id, round-trips de
// AEAD/envelope/share/export e propriedades do PRNG. O entry ESM do sumo é
// autocontido (importa 'libsodium-sumo', resolvido nativamente) — sem alias.
// Contrato: o entry ESM do sumo só anexa funções/constantes após `sodium.ready`
// resolver — todo teste que importa `sodium` deve `await sodium.ready` antes de
// tocar em qualquer membro (ou depender do src, que faz ensureReady() interno).
import { describe, expect, it } from 'vitest';
import { sha256, sha256Hex, sha256Base64Url } from '../src/hash.js';
import { deriveKey, hashPassword, verifyPassword, Profiles, Argon2Params } from '../src/kdf.js';
import { encrypt, decrypt } from '../src/aead.js';
import { encryptEnvelope, decryptEnvelope } from '../src/envelope.js';
import { createShare, revealShare } from '../src/share.js';
import { randomBytes, randomIntBelow } from '../src/prng.js';
import { createExportBundle, decryptExportBundleWithContext } from '../src/export.js';
import { generatePassword, generatePin } from '../src/generator.js';
import { utf8Encode, fromBase64Url } from '../src/encoding.js';
import sodium from 'libsodium-wrappers-sumo';

const U8 = (s: string) => utf8Encode(s);

describe('real libsodium: SHA-256 known answers', () => {
  it('matches NIST vectors', async () => {
    expect(await sha256Hex(U8(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(await sha256Hex(U8('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await sha256Hex(U8('hello'))).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });
  it('sha256 returns 32 bytes and is deterministic', async () => {
    const a = await sha256(U8('AegisVault'));
    const b = await sha256(U8('AegisVault'));
    expect(a).toHaveLength(32);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(await sha256Base64Url(U8('AegisVault'))).toBe(await sha256Base64Url(U8('AegisVault')));
  });
});

describe('real libsodium: Argon2id deriveKey', () => {
  it('is deterministic for same password+salt and returns 32 bytes', async () => {
    const k1 = await deriveKey('senha-secreta', U8('0123456789abcdef'));
    const k2 = await deriveKey('senha-secreta', U8('0123456789abcdef'));
    expect(k1).toHaveLength(32);
    expect(Array.from(k1)).toEqual(Array.from(k2));
  });
  it('different salt yields a different key', async () => {
    const k1 = await deriveKey('senha-secreta', U8('0123456789abcdef'));
    const k2 = await deriveKey('senha-secreta', U8('fedcba9876543210'));
    expect(Array.from(k1)).not.toEqual(Array.from(k2));
  });
  it('rejects salt that is not exactly 16 bytes', async () => {
    await expect(deriveKey('pw', U8('short'))).rejects.toThrow(/salt/);
    await expect(deriveKey('pw', new Uint8Array(17))).rejects.toThrow(/salt/);
  });
  it('different profiles produce distinct keys', async () => {
    const fast = await deriveKey('pw', U8('0123456789abcdef'), Profiles.fast);
    const hard = await deriveKey('pw', U8('0123456789abcdef'), Profiles.hardened);
    expect(Array.from(fast)).not.toEqual(Array.from(hard));
  });
});

describe('real libsodium: Argon2id official vector (libsodium pwhash_argon2id tv1[0])', () => {
  it('matches the official libsodium test vector (proves correctness, not just determinism)', async () => {
    await sodium.ready;
    const pwHex = 'a347ae92bce9f80f6f595a4480fc9c2fe7e7d7148d371e9487d75f5c23008ffae0' +
      '65577a928febd9b1973a5a95073acdbeb6a030cfc0d79caa2dc5cd011cef02c08d' +
      'a232d76d52dfbca38ca8dcbd665b17d1665f7cf5fe59772ec909733b24de97d6f5' +
      '8d220b20c60d7c07ec1fd93c52c31020300c6c1facd77937a597c7a6';
    const pw = Uint8Array.from(Buffer.from(pwHex, 'hex'));
    const saltHex = '5541fbc995d5c197ba290346d2c559dedf405cf97e5f95482143202f9e74f5c2';
    const salt = Uint8Array.from(Buffer.from(saltHex, 'hex').subarray(0, 16));
    const out = sodium.crypto_pwhash(155, pw, salt, 5, 7256678, Argon2Params.ALG);
    expect(out).toHaveLength(155);
    expect(Buffer.from(out).toString('hex')).toBe(
      '18acec5d6507739f203d1f5d9f1d862f7c2cdac4f19d2bdff64487e60d969e3ce' +
      'd615337b9eec6ac4461c6ca07f0939741e57c24d0005c7ea171a0ee1e7348249d1' +
      '35b38f222e4dad7b9a033ed83f5ca27277393e316582033c74affe2566a2bea47f9' +
      '1f0fd9fe49ece7e1f79f3ad6e9b23e0277c8ecc4b313225748dd2a80f5679534a07' +
      '00e246a79a49b3f74eb89ec6205fe1eeb941c73b1fcf1',
    );
  });
});

describe('real libsodium: hashPassword / verifyPassword', () => {
  it('round-trips and rejects wrong password', async () => {
    const { hashB64Url, saltB64Url, profile } = await hashPassword('minha-senha-forte');
    expect(await verifyPassword('minha-senha-forte', hashB64Url, saltB64Url, profile)).toBe(true);
    expect(await verifyPassword('senha-errada', hashB64Url, saltB64Url, profile)).toBe(false);
  });
  it('returns false for tampered salt', async () => {
    const { hashB64Url, profile } = await hashPassword('pw');
    expect(await verifyPassword('pw', hashB64Url, 'AAA', profile)).toBe(false);
  });
});

describe('real libsodium: AEAD XChaCha20-Poly1305', () => {
  it('round-trips plaintext of mixed sizes', async () => {
    const key = await randomBytes(32);
    for (const size of [0, 1, 33, 1024, 4096]) {
      const pt = new Uint8Array(size).map((_, i) => (i * 7 + size) % 256);
      const sealed = await encrypt(key, pt, new Uint8Array());
      expect(sealed.length).toBe(24 + size + 16);
      const back = await decrypt(key, sealed, new Uint8Array());
      expect(Array.from(back)).toEqual(Array.from(pt));
    }
  });
  it('fails on tampered ciphertext', async () => {
    const key = await randomBytes(32);
    const sealed = await encrypt(key, U8('segredo-tamper'), new Uint8Array());
    sealed[sealed.length - 1] = (sealed[sealed.length - 1] ?? 0) ^ 0x01;
    await expect(decrypt(key, sealed, new Uint8Array())).rejects.toThrow();
  });
  it('fails on wrong key and wrong AAD', async () => {
    const key = await randomBytes(32);
    const other = await randomBytes(32);
    const sealed = await encrypt(key, U8('segredo'), U8('aad-certo'));
    await expect(decrypt(other, sealed, U8('aad-certo'))).rejects.toThrow();
    await expect(decrypt(key, sealed, U8('aad-errado'))).rejects.toThrow();
  });
});

describe('real libsodium: PRNG', () => {
  it('randomBytes honors length and draws differ', async () => {
    const a = await randomBytes(32);
    const b = await randomBytes(32);
    expect(a).toHaveLength(32);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
  it('randomIntBelow stays in range', async () => {
    for (let i = 0; i < 500; i++) {
      const v = await randomIntBelow(6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
    }
  });
});

describe('real libsodium: share round-trip', () => {
  it('createShare -> revealShare recovers plaintext', async () => {
    const pt = U8('compartilhamento-secreto');
    const { token, fragmentKey, envelope } = await createShare(pt);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThanOrEqual(32);
    const back = await revealShare(fragmentKey, envelope, token);
    expect(new TextDecoder().decode(back)).toBe('compartilhamento-secreto');
  });
  it('fails with wrong fragment key', async () => {
    const { token, envelope } = await createShare(U8('x'));
    await expect(revealShare('AAAA', envelope, token)).rejects.toThrow();
  });
});

describe('real libsodium: envelope round-trip', () => {
  const ctx = { tenantId: 'ws-real', itemId: 'item-1', type: 'login' };
  it('encryptEnvelope -> decryptEnvelope recovers plaintext', async () => {
    const env = await encryptEnvelope(U8('conteudo-do-cofre'), 'pwd-real', ctx);
    expect(env.alg).toBe('XCHACHA20-POLY1305-IETF');
    expect(env.kdf).toBe('argon2id');
    const back = await decryptEnvelope(env, 'pwd-real', ctx);
    expect(new TextDecoder().decode(back)).toBe('conteudo-do-cofre');
  });
  it('fails with wrong password', async () => {
    const env = await encryptEnvelope(U8('x'), 'pwd-a', ctx);
    await expect(decryptEnvelope(env, 'pwd-b', ctx)).rejects.toThrow();
  });
});

describe('real libsodium: export bundle round-trip', () => {
  it('.aegis round-trips with pinned exportedAt', async () => {
    const realToIso = Date.prototype.toISOString;
    const pinned = '2025-01-01T00:00:00.000Z';
    Date.prototype.toISOString = function () { return pinned; };
    try {
      const file = await createExportBundle({
        workspaceId: 'ws-export-real',
        passphrase: 'correct-horse-battery-staple-123',
        originMeta: { userId: 'u1', serverOrigin: 'aegis.local', exportedAt: pinned },
        items: [
          { originItemId: 'i1', type: 'login', folderIdOrigin: null, collectionIdOrigin: null, favorite: true, trashed: false, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-02T00:00:00Z', payload: U8('primeiro-segredo') },
          { originItemId: 'i2', type: 'note', folderIdOrigin: 'f', collectionIdOrigin: null, favorite: false, trashed: false, createdAt: '2024-02-02T00:00:00Z', updatedAt: '2024-02-03T00:00:00Z', payload: U8('segundo-segredo') },
        ],
      });
      expect(new TextDecoder().decode(file.slice(0, 8))).toBe('AEGIS_V1');
      expect(file[8]).toBe(1);
      const bundle = await decryptExportBundleWithContext(
        file,
        'correct-horse-battery-staple-123',
        { workspaceId: 'ws-export-real', exportedAt: pinned },
      );
      expect(bundle.v).toBe(1);
      expect(bundle.workspaceId).toBe('ws-export-real');
      expect(bundle.itemCount).toBe(2);
      expect(bundle.items[0]!.originItemId).toBe('i1');
      expect(bundle.items[1]!.originItemId).toBe('i2');
      expect(new TextDecoder().decode(fromBase64Url(bundle.items[0]!.payloadB64))).toBe('primeiro-segredo');
      expect(new TextDecoder().decode(fromBase64Url(bundle.items[1]!.payloadB64))).toBe('segundo-segredo');
    } finally {
      Date.prototype.toISOString = realToIso;
    }
  });
});

describe('real libsodium: generator', () => {
  it('password respects length and all selected classes', async () => {
    const pwd = await generatePassword({
      length: 24, upper: true, lower: true, digits: true, symbols: true,
      excludeAmbiguous: false, requireEach: true,
    });
    expect(pwd).toHaveLength(24);
    expect(/[A-Z]/.test(pwd)).toBe(true);
    expect(/[a-z]/.test(pwd)).toBe(true);
    expect(/[0-9]/.test(pwd)).toBe(true);
    expect(/[^A-Za-z0-9]/.test(pwd)).toBe(true);
  });
  it('PIN is digits only', async () => {
    for (let i = 0; i < 20; i++) {
      expect(await generatePin({ length: 6 })).toMatch(/^[0-9]{6}$/);
    }
  });
});
