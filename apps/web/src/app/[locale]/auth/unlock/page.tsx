'use client';
import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { translate, loadCatalog, normalizeLocale, type LocaleCode } from '@aegis/i18n';
import { unlock, ssRead, getCurrentUser, type Sandbox } from '../../../../lib/auth-client.js';

// useSearchParams exigiria Suspense no Next.js 14. Em vez disso, lemos via
// window.location.search da mount do cliente. SSR-safe por early-return.
function readIdleReason(): 'idle' | 'other' {
  if (typeof window === 'undefined') return 'other';
  const sp = new URLSearchParams(window.location.search);
  return sp.get('reason') === 'idle' ? 'idle' : 'other';
}

export default function UnlockPage({ params }: { params: { locale: string } }) {
  const locale = (normalizeLocale(params.locale) ?? 'pt-BR') as LocaleCode;
  loadCatalog(locale);
  const t = useCallback(
    (k: string, vars?: Record<string, string | number>) => translate(locale, k, vars ?? {}),
    [locale],
  );
  const router = useRouter();
  const [reason, setReason] = useState<'idle' | 'other'>('other');

  const [email, setEmail] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Detecta `?reason=idle` para copy explicativo. (Suspense-safe via window.)
  useEffect(() => {
    setReason(readIdleReason());
  }, []);

  // Se a sandbox ja esta materializada e o usuario tem MFA enrolled + verified,
  // a sessao continua viva - segue direto para o cofre sem re-prompt.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    void (async () => {
      const sandbox = ssRead<Sandbox>();
      if (!sandbox) return;
      const u = await getCurrentUser();
      // Race-safe: se a user record foi apagada (clearAllData), nao prossegue.
      if (!u || !u.verifiedAt || !u.mfaEnrolledAt) return;
      router.replace(`/${locale}/app/default/vault`);
    })();
  }, [router, locale]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await unlock(email, passphrase);
      if ('error' in res) {
        setErr(t('auth.unlockInvalid'));
        setBusy(false);
        return;
      }
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('aegis.signupPassphrase');
      }
      router.push(`/${locale}/app/default/vault`);
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <section className="container" style={{ maxInlineSize: 480 }}>
      <h1>{t(reason === 'idle' ? 'auth.unlockIdleTitle' : 'auth.unlockTitle')}</h1>
      <p>{reason === 'idle' ? t('auth.unlockIdleLead') : t('auth.unlockLead')}</p>
      <form className="card" onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <div className="field">
          <label htmlFor="email">{t('auth.emailLabel')}</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="passphrase">{t('auth.passphraseLabel')}</label>
          <input id="passphrase" type="password" required value={passphrase} onChange={(e) => setPassphrase(e.target.value)} autoComplete="current-password" />
        </div>
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? t('common.loading') : t('auth.unlockButton')}
        </button>
        {err && <p className="notice warn" role="alert">{err}</p>}
      </form>
      <p style={{ marginBlockStart: 16 }}>
        <Link href={`/${locale}/auth/signup`}>{t('auth.signupHere')}</Link>
      </p>
    </section>
  );
}
