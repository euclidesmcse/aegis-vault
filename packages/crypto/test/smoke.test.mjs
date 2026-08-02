// AegisVault v0.2 smoke test: pure-TS no-deps primitives exercisable in
// sandbox sem node_modules. Carregado via node --experimental-strip-types
// + scripts/loader-ts-as-js.mjs para remapear ./x.js -> ./x.ts no monorepo.
//
// Cobre: encoding (base64url + hex + utf8 + constantTime),
//        json (canonicalizacao deterministica),
//        strength (analise offline de senha).
//
// Estes modulos NAO transitivamente importam libsodium-wrappers, por isso
// o smoke roda aqui. O envelope v1, hash, prng, ulid e generator exigem
// libsodium e permanecem env-gated (ver docs/v0.2-closeout-notes.md).
import assert from 'node:assert/strict';
import {
  toHex,
  fromHex,
  toBase64Url,
  fromBase64Url,
  utf8Encode,
  utf8Decode,
  constantTimeEqual,
} from '../src/encoding.ts';
import { JSONStringifyStable, JSONParseStrict } from '../src/json.ts';
import { analyzePassword } from '../src/strength.ts';

let passed = 0;
let failed = 0;
function t(name, fn) {
  try {
    fn();
    console.log('  PASS', name);
    passed++;
  } catch (e) {
    console.error('  FAIL', name, '-', e.message);
    failed++;
  }
}

console.log('=== AegisVault v0.2 crypto smoke (no deps) ===');

t('encoding: utf8 roundtrip preserves emoji bytes', () => {
  const msg = 'AegisVault' + String.fromCharCode(0x2713);
  const bytes = utf8Encode(msg);
  assert.equal(utf8Decode(bytes), msg);
  assert.equal(bytes.length, 13);
});

t('encoding: hex roundtrip matches ASCII+UTF8', () => {
  const msg = 'AegisVault' + String.fromCharCode(0x2713);
  const bytes = utf8Encode(msg);
  assert.equal(toHex(bytes), '41656769735661756c74e29c93');
  assert.deepEqual(Array.from(fromHex('41656769735661756c74e29c93')), Array.from(bytes));
});

t('encoding: base64url round-trip with non-ASCII runes', () => {
  const bytes = utf8Encode('cafe-decor\u00e9-2025');
  const b64 = toBase64Url(bytes);
  assert.equal(b64.includes('='), false);
  assert.equal(b64.includes('+'), false);
  assert.equal(b64.includes('/'), false);
  const round = fromBase64Url(b64);
  assert.deepEqual(Array.from(round), Array.from(bytes));
  assert.equal(utf8Decode(round), 'cafe-decor\u00e9-2025');
});

t('encoding: utf8Decode fatal mode rejects malformed UTF-8 sequences', () => {
  assert.throws(
    () => utf8Decode(new Uint8Array([0xff, 0xfe, 0xfd])),
    /utf-?8|invalid|fatal|URI/i,
    'utf8Decode must reject malformed bytes (fatal mode contract)'
  );
  assert.equal(utf8Decode(new Uint8Array([0x41, 0x42, 0x43])), 'ABC');
});

t('encoding: constantTimeEqual returns true iff bitwise equal AND same length (constant-time spine)', () => {
  const a = new Uint8Array([1, 2, 3, 4]);
  const b = new Uint8Array([1, 2, 3, 4]);
  const c = new Uint8Array([1, 2, 3, 5]);
  const d = new Uint8Array([1, 2, 3]);
  assert.equal(constantTimeEqual(a, b), true);
  assert.equal(constantTimeEqual(a, c), false);
  assert.equal(constantTimeEqual(a, d), false);
});

t('json: JSONStringifyStable sorts keys deterministically', () => {
  const a = { b: 2, a: 1 };
  const c = { a: 1, b: 2 };
  assert.equal(JSONStringifyStable(a), JSONStringifyStable(c));
  assert.equal(JSONStringifyStable(a), '{"a":1,"b":2}');
});

t('json: JSONStringifyStable recurses into nested objects + arrays', () => {
  const o = { z: { y: 2, x: { w: 4, v: 3 } }, a: [{ d: 4, c: 3 }] };
  const expected = '{"a":[{"c":3,"d":4}],"z":{"x":{"v":3,"w":4},"y":2}}';
  assert.equal(JSONStringifyStable(o), expected);
});

t('json: round-trip JSONParseStrict equals canonicalized input across nested arrays+objects', () => {
  const raw = '{"a":1,"b":{"c":[1,2,3],"d":[{"e":"f","g":null}]}}';
  const parsed = JSONParseStrict(raw);
  assert.equal(JSONStringifyStable(parsed), raw);
});

t('strength: short obvious password hits very-weak', () => {
  const r = analyzePassword('password123');
  assert.equal(r.level, 'very-weak');
  assert.ok(r.entropyBits < 30);
});

t('strength: well-formed long passphrase reaches excellent', () => {
  const r = analyzePassword('Correct-Horse-Battery-Staple-2024!');
  assert.ok(['strong', 'excellent'].includes(r.level), 'level=' + r.level);
  assert.ok(r.entropyBits >= 80);
});

t('strength: empty input is very-weak with single finding', () => {
  const r = analyzePassword('');
  assert.equal(r.level, 'very-weak');
  assert.equal(r.findings.length, 1);
});

console.log('=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
if (failed > 0) {
  process.exit(1);
}
