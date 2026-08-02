# Arquitetura criptografica

> Detalhes do uso de primitivas, parametros e limites. Este documento descreve
> **o que** o sistema faz e **o que nao** faz. Nenhum elemento deste
> documento constitui atestado formal de seguranca.

## TL;DR

| Finalidade                          | Algoritmo                      | Justificativa                                        |
|-------------------------------------|--------------------------------|------------------------------------------------------|
| Derivacao de chave (KDF cliente)    | Argon2id (`crypto_pwhash`)     | Padrao OWASP/RFC 9106, resistente a GPU/ASIC        |
| Derivacao de chave (KDF servidor)   | Argon2id                       | Hash lento resistente a memoria para senha da conta |
| Cifra de autenticacao reversivel    | XChaCha20-Poly1305-IETF        | AEAD em ambos Node e WASM; nonce de 192 bits        |
| Hash                            | SHA-256 (token digest)         | Padrao NIST FIPS 180-4 para digest de token         |
| Envelope canon                      | JSON com `v,alg,kdf,params,salt,nonce,aad,ct` | Versionado, base64url           |

> Decisao documentada em `docs/adr/0002-cryptography.md`.

## Dominios

| Dominio                          | Finalidade                       | Tratamento                                |
|----------------------------------|----------------------------------|-------------------------------------------|
| Credencial de autenticacao       | Provar acesso a conta            | Argon2id no servidor; nunca reversivel    |
| Segredo de desbloqueio do cofre  | Derivar chaves locais            | Nunca enviado ao servidor                 |
| Conteudo do cofre                | Recuperar credenciais salvas     | XChaCha20-Poly1305 no cliente             |
| Token de compartilhamento        | Autorizar consumo unico          | 32B aleatorio; digest SHA-256 no servidor |

Senha da conta e segredo do cofre sao **separados**. OAuth autentica a conta
mas nao substitui o desbloqueio do cofre.

## Algoritmos (com parametros)

### Argon2id (cliente e servidor)

- Algoritmo: `crypto_pwhash_ALG_ARGON2ID13`
- Padrao recomendado: `t=3, m=64 MiB, p=1`
- Salt: 16 bytes aleatorios por segredo
- Limites: `pwd_len >= 1`, `pwd_len <= 1024`, valor de entrada normalizado
  para `Uint8Array` apos UTF-8 decode

### XChaCha20-Poly1305 (conteudo)

- Nonce: 24 bytes aleatorios por cifragem (probabilidade de birthday
  desprezivel para cadencia humana)
- AAD: `tenantId:itemId:type:v1` em UTF-8
- Saida MAC: 16 bytes (Poly1305)
- Limite: 2^64 mensagens por chave (limite teorico); cadencia humana
  nao se aproxima desse limite

### SHA-256 (digest de tokens)

- 32 bytes de entrada
- Saida: 32 bytes armazenados em base64url sem padding
- Comparacao: `crypto.timingSafeEqual` em Node e `subtle.verify` no cliente

## Envelope canon

Formato JSON canon:

```
{
  "v": 1,
  "alg": "XCHACHA20-POLY1305-IETF",
  "kdf": "argon2id",
  "params": { "t": 3, "m": 65536, "p": 1 },
  "salt": "<base64url>",
  "nonce": "<base64url>",
  "aad": "<base64url of utf-8 'tenantId:itemId:type:v1'>",
  "ct": "<base64url of ciphertext+tag>"
}
```

Codificacao externa: usar `aegis.crypto.envelope.encode/decode` de
`packages/crypto`. Nenhum outro lugar do codigo deve produzir JSON
de envelope.

## Hierarquia de chaves

1. **Vault Key** (por usuario x workspace) derivada via Argon2id do
   segredo do cofre. Permanece no cliente; envelope armazenado no
   servidor.
2. **Item Key** por item. Quando ha compartilhamento, o Item Key e
   envelopado para cada destinatario autorizado. Sem isso, a rotacao
   por item nao exigiria redistribuicao.
3. **Session Unlock Key** derivada do segredo do cofre para a sessao
   do navegador, com auto-lock configurado. Apaga da memoria no lock.

## Cifra alternativa (escopo futuro)

Planejado para Fase 2+: migracao para libsodium 1.1 com suporte a
X25519 + BLAKE2b para compartilhamento de chaves multi-destinatario,
eliminando rewrap explicito por destinatario. ADR previa em
`docs/adr/0004-key-rotation.md` (a redigir).

## Proibicoes codificadas

- `Math.random()` substituido por `packages/crypto::randomBytes`.
- Keys persistidos em `localStorage` sao proibidos; session unlock
  usa uma store em memoria com auto-lock.
- Conteudo em claro nunca e serializado para `fetch`, `console`, log,
  URL completa ou `sendBeacon`.
- Reuso de nonce por (chave, direcao) e detectado pelo teste
  `envelope.test.ts` que gera 10^5 envelopes com a mesma chave.

## Vetores de teste

Vetores conhecidos em `packages/crypto/test/vectors.json`, comparados
na suite. Inclui cifragem/decifragem, AAD alterada (deve falhar),
nonce alterado (deve falhar), versao desconhecida (deve falhar).
