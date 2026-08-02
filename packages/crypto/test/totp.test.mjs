// Prova TOTP HMAC-SHA1 contra vetor canonico RFC 6238.
// Versao .mjs para rodar diretamente via Node sem loader TS.

import { strict as assert } from 'node:assert';
import {
  totpCode,
  base32Encode,
  base32Decode,
  verifyTotp,
} from '../web/totp-fixture.mjs';

async function main() {
  const secretB32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const secretBytes = base32Decode(secretB32);
  assert.equal(secretBytes.length, 20, 'RFC 6238 secret decodes to 20 bytes');

  const reEncoded = base32Encode(secretBytes);
  assert.equal(reEncoded, secretB32, 'base32 encode matches canonical');

  const digits8 = await totpCode(secretBytes, 59, 30, 8);
  assert.equal(digits8, '94287082', 'T=59 -> 94287082 (RFC 6238)');
  const digits6 = await totpCode(secretBytes, 59, 30, 6);
  assert.equal(digits6, digits8.slice(-6), 'T=59 6 digits is suffix of 8 digits');

  const digits8b = await totpCode(secretBytes, 1111111109, 30, 8);
  assert.equal(digits8b, '07081804', 'T=1111111109 SHA-1 8-digit -> 07081804 (RFC 6238 Appendix B)');
  const digits6b = await totpCode(secretBytes, 1111111109, 30, 6);
  assert.equal(digits6b, '081804', 'T=1111111109 SHA-1 6-digit -> 081804 (RFC 6238 Appendix B)');

  const matches = await verifyTotp(secretBytes, digits8.slice(-6), 59, 1, 30);
  assert.equal(matches, true, 'verifyTotp accepts valid code');
  const rejects = await verifyTotp(secretBytes, '000000', 59, 1, 30);
  assert.equal(rejects, false, 'verifyTotp rejects 000000');

  const period60 = await totpCode(secretBytes, 59, 60, 6);
  assert.notEqual(period60, digits6, 'different period gives different code');

  let threw = false;
  try { await totpCode(new Uint8Array(8), 59, 30, 6); } catch { threw = true; }
  assert.equal(threw, true, 'short secret rejected');

  console.log('=== AegisVault v0.3 TOTP RFC 6238 conformance ===');
  console.log('  PASS secret decodes to 20 bytes');
  console.log('  PASS base32 round-trip equals canonical');
  console.log('  PASS T=59 8-digit code 94287082');
  console.log(`  PASS T=59 6-digit suffix ${digits6}`);
  console.log(`  PASS T=1111111109 8-digit code ${digits8b}`);
  console.log(`  PASS T=1111111109 6-digit code ${digits6b}`);
  console.log('  PASS verifyTotp accepts valid code');
  console.log('  PASS verifyTotp rejects invalid code');
  console.log('  PASS period=30 vs period=60 yields different code');
  console.log('  PASS short secret rejected');
  console.log('\nResults: 8 passed, 0 failed');
}

main().catch((e) => { console.error(e); process.exit(1); });
