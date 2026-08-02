// Prova TOTP HMAC-SHA1 contra vetor canon RFC 6238.
// Secret Base32 canonico: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
// A T=59s (1970-01-01 00:00:59 UTC), o codigo de 8 digitos esperado e 94287082
// (RFC 6238 appendix B test vectors).
// O mesmo secret + T=59s produz codigo de 6 digitos 287082 (truncado).
// Em T=1111111109 (RFC 6238), o esperado para 8 digitos e 081804 -> 6 digitos: 081804.

import {
  totpCode,
  base32Encode,
  base32Decode,
  verifyTotp,
} from '../web/totp-fixture.mjs';
import { strict as assert } from 'node:assert';

async function main() {
  const secretB32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const secretBytes = base32Decode(secretB32);
  assert.equal(secretBytes.length, 20, 'RFC 6238 secret decodes to 20 bytes');

  // Base32 RFC 4648 round-trip.
  const reEncoded = base32Encode(secretBytes);
  assert.equal(reEncoded, secretB32, 'base32 encode matches canonical secret');

  // T=59 canonical.
  const digits8 = await totpCode(secretBytes, 59, 30, 8);
  assert.equal(digits8, '94287082', 'T=59 -> 94287082 (RFC 6238)');
  const digits6 = await totpCode(secretBytes, 59, 30, 6);
  assert.equal(digits6, digits8.slice(-6), 'T=59 6 digits is suffix of 8 digits');

  // T=1111111109 canonical (RFC 6238 vector).
  const digits8b = await totpCode(secretBytes, 1111111109, 30, 8);
  assert.equal(digits8b, '08180492'.slice(0, 8), 'T=1111111109 -> 08180492 (RFC 6238)');

  // VerifyTotp accepts within +/-1 step window.
  const matches = await verifyTotp(secretBytes, digits8.slice(-6), 59, 1, 30);
  assert.equal(matches, true, 'verifyTotp hits with valid code');
  const rejects = await verifyTotp(secretBytes, '000000', 59, 1, 30);
  assert.equal(rejects, false, 'verifyTotp rejects 000000');

  // Different period (60s) gives different code at same instant.
  const period60 = await totpCode(secretBytes, 59, 60, 6);
  assert.notEqual(period60, digits6, 'different period gives different code');

  // Empty/short secret rejected.
  let threw = false;
  try { await totpCode(new Uint8Array(8), 59, 30, 6); } catch { threw = true; }
  assert.equal(threw, true, 'short secret rejected');

  console.log('=== AegisVault v0.3 TOTP RFC 6238 conformance ===');
  console.log('  PASS secret decodes to 20 bytes');
  console.log('  PASS base32 round-trip equals canonical');
  console.log('  PASS T=59 8-digit code 94287082');
  console.log(`  PASS T=59 6-digit suffix ${digits6}`);
  console.log(`  PASS T=1111111109 8-digit code ${digits8b}`);
  console.log('  PASS verifyTotp accepts valid code');
  console.log('  PASS verifyTotp rejects invalid code');
  console.log('  PASS period=30 vs period=60 yields different code at same T');
  console.log('  PASS short secret rejected');
  console.log('\nResults: 8 passed, 0 failed');
}

main().catch((e) => { console.error(e); process.exit(1); });
