'use client';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { translate, loadCatalog, normalizeLocale, type LocaleCode } from '@aegis/i18n';
import { verifyEmail } from '../../../../lib/auth-client.js';

export default function Verify({ params }: { params: { locale: string } }) {
  const locale = (normalizeLocale(params.locale) ?? 'pt-BR') as LocaleCode;
  loadCatalog(locale);
  const t = useCallback(
    (k: string, vars?: Record<string, string | number>) => translate(locale, k, vars ?? {}),
    [locale],
  );
  const router = useRouter();

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await verifyEmail(code);
      if (res.ok === true) {
        router.push(`/${locale}/auth/mfa-setup`);
        return;
      }
      if (res.ok === false) {
        if (res.reason === 'expired') setErr(t('auth.verifyExpired'));
        else if (res.reason === 'mismatch') setErr(t('auth.verifyMismatch'));
        else setErr(t('errors.rateLimited'));
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <section className="container" style={{ maxInlineSize: 480 }}>
      <h1>{t('auth.verifyTitle')}</h1>
      <p>{t('auth.verifyLead')}</p>
      <form className="card" onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <div className="field">
          <label htmlFor="code">{t('auth.verifyInputLabel')}</label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D+/g, '').slice(0, 6))}
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            style={{ fontFamily: 'var(--aegis-font-mono)', letterSpacing: 6, fontSize: 24, textAlign: 'center' }}
            aria-describedby="code-help"
          />
          <small id="code-help">{t('auth.verifyHelp')}</small>
        </div>
        <button type="submit" disabled={busy || code.length !== 6} className="btn btn-primary">
          {busy ? t('common.loading') : t('auth.verifyContinue')}
        </button>
        {err && <p className="notice warn" role="alert">{err}</p>}
      </form>
      <p style={{ marginBlockStart: 16 }}>
        {t('auth.verifyResendNotice')} <Link href={`/${locale}/auth/login`}>{t('auth.verifyBack')}</Link>
      </p>
    </section>
  );
}
