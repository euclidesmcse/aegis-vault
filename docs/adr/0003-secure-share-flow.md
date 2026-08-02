# ADR 0003 - Fluxo de compartilhamento seguro

## Status

Aceito.

## Contexto

O prompt exige que o URL de compartilhamento seja atomico (consumo
unico), resistente a scanners/prefetch, com chave em fragmento e
revelado apenas apos gesto humano explicito.

## Decisao

1. **Token**: 32 bytes aleatorios em path/query (`/s/<token>`).
2. **Chave**: 32 bytes aleatorios em fragmento (`#<key>`) - nunca vai
   para o servidor em uma requisicao HTTP, mas e lido pelo JS e
   enviado em POST.
3. **Operacao de consumo**: `UPDATE secure_shares SET state='consumed'
   WHERE token_digest=$1 AND state='active' RETURNING envelope`.
5. **CSP**: `default-src 'self'`; sem `unsafe-inline` no script.
6. **Headers**: `Referrer-Policy: no-referrer`, `Cache-Control: no-store`,
   `X-Robots-Tag: noindex, nofollow`, `Cross-Origin-Opener-Policy: same-origin`.
7. **Reveal page**: cliente le fragmento, decifra, copia com fallback
   manual; segunda leitura ao servidor e impossivel (share ja consumido).

## Consequencias

- O fragmento contem o segredo; qualquer pessoas com acesso ao URL
  tem acesso ao segredo, mas o URL e um-shot por design.
- Clientes que desabilitam JS nao conseguem revelar - comportamento
  esperado; exibimos mensagem explicando.

## Anti-cenarios verificados

- GET/HEAD no `/s/<token>` retorna 200 com a pagina de preparacao;
  sem efeito colateral.
- Scan paralelo com mesmo token: um POST vence, demais recebem 410.
