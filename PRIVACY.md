# AegisVault - Aviso de Privacidade

> Este documento descreve dados coletados, finalidades, retencao e direitos do usuario.
> **Nao constitui atestado de conformidade** com LGPD, GDPR ou outras normas.

## Categorias de dados

| Categoria                     | Onde                      | Finalidade              | Retencao                          |
|-------------------------------|---------------------------|-------------------------|-----------------------------------|
| E-mail verificado             | user_emails               | login, MFA, comunicacao | enquanto a conta existir + 30 d   |
| Hash da senha de autenticacao | auth_identities           | verificacao de acesso   | enquanto nao rotacionada          |
| Hash do token de sessao       | sessions                  | revogacao               | expiracao da sessao               |
| Metadados do dispositivo      | devices                   | risco e gestao          | 1 ano sem uso                     |
| Eventos de auditoria          | audit_events              | trilha minimizada       | 24 meses                          |
| Compartilhamentos ativos      | secure_shares             | entrega unica           | expiracao/revogacao + 7 d         |
| Texto de importacao           | processamento efemero     | migracao                | removido apos confirmar import   |

## Conteudo nunca coletado

- Senhas, frases de desbloqueio, segredos do cofre ou TOTP seeds sao
  **criptografados no cliente** antes de chegar ao servidor e nunca aparecem
  em logs ou telemetria.
- Hashes completos de senha **nao** sao enviados para provedores terceiros
  de exposicao. Apenas prefixos SHA-1 de 5 caracteres via k-anonimato (opt-in).
- Tokens de compartilhamento completos nao trafegam junto com a chave de
  descriptografia. O servidor armazena apenas o digest do token.

## Direitos do usuario

- Exportacao de tudo o que e mantido em texto claro pelo servidor sob
  requisicao autenticada.
- Exclusao de conta com cryptographic erasure das chaves envelopadas.
- Consentimento explicito, versionado, antes do primeiro evento de marketing
  ou compartilhamento expandido.

## Telemetria e analytics

Telemetria e **opt-in**, agregada e nunca inclui conteudo de cofre,
identificador persistente de dispositivo nem e-mail completo. Ferramentas de
replay de sessao sao proibidas em areas autenticadas e em `/s/*`.
