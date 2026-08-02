'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { translate, loadCatalog, normalizeLocale, type LocaleCode } from '@aegis/i18n';
import { beginMfaEnrollment, confirmMfaEnrollment, ssRead, type Sandbox } from '../../../../lib/auth-client.js';

export default function MfaSetup({ params }: { params: { locale: string } }) {
  const locale = (normalizeLocale(params.locale) ?? 'pt-BR') as LocaleCode;
  loadCatalog(locale);
  const t = useCallback(
    (k: string, vars?: Record<string, string | number>) => translate(locale, k, vars ?? {}),
    [locale],
  );
  const router = useRouter();

  const [enrollment, setEnrollment] = useState<{
    secretBase32: string;
    otpauthUri: string;
    userCode: string;
  } | null>(null);
  const [userCode, setUserCode] = useState('');
  const [sandbox, setSandbox] = useState<Sandbox | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // authKey vem do signup via sessionStorage; passphrase NUNCA persistida.
    const sb = ssRead<Sandbox>();
    if (!sb) {
      setErr(t('auth.unlockFirst'));
      return;
    }
    setSandbox(sb);
    void (async () => {
      try {
        const e = await beginMfaEnrollment(sb);
        setEnrollment({ secretBase32: e.totpSecretBase32, otpauthUri: e.otpauthUri, userCode: e.enrollCode });
      } catch (err) {
        setErr((err as Error).message);
      }
    })();
  }, [t]);

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!enrollment || !sandbox) return;
    setBusy(true);
    try {
      const { base32Decode } = await import('../../../../lib/crypto-client.js');
      const totpSecretBytes = base32Decode(enrollment.secretBase32);
      const res = await confirmMfaEnrollment({
        sandbox,
        userCode,
        totpSecretBytes,
      });
      if (res.verified) {
        router.push(`/${locale}/auth/unlock`);
        return;
      }
      setErr(t('auth.mfaMismatch'));
    } catch (err) {
      setErr((err as Error).message);
    } finally { setBusy(false); }
  };

  if (!enrollment) {
    return (
      <section className="container" style={{ maxInlineSize: 520 }}>
        <h1>{t('auth.mfaSetupTitle')}</h1>
        <p>{t('common.loading')}</p>
        {err && <p className="notice warn" role="alert">{err}</p>}
        <p><Link href={`/${locale}/auth/login`}>{t('common.back')}</Link></p>
      </section>
    );
  }

  return (
    <section className="container" style={{ maxInlineSize: 720 }}>
      <h1>{t('auth.mfaSetupTitle')}</h1>
      <p>{t('auth.mfaSetupLead')}</p>
      <div className="card" style={{ display: 'grid', gap: 16 }}>
        <p>{t('auth.mfaSetupStep1')}</p>
        <div className="qr-box" role="group" aria-label={t('auth.mfaSetupTitle')}>
          <p style={{ wordBreak: 'break-all' }}>
            <a href={enrollment.otpauthUri} className="btn btn-primary">
              {t('auth.mfaSetupOpenAuthenticator')}
            </a>
          </p>
          <p style={{ fontSize: 14, color: 'var(--aegis-text-muted)' }}>
            {t('auth.mfaSetupOrManual')}:
          </p>
          <pre style={{ background: 'var(--aegis-surface-silent)', padding: 12, borderRadius: 6, overflowX: 'auto', fontFamily: 'var(--aegis-font-mono)' }}>
{enrollment.secretBase32}</pre>
          <CopyButton value={enrollment.secretBase32} label={t('auth.mfaSetupCopySecret')} />
        </div>
        <p>{t('auth.mfaSetupStep2', { issuer: 'AegisVault' })}</p>
        <form onSubmit={confirm} style={{ display: 'grid', gap: 12 }}>
          <div className="field">
            <label htmlFor="userCode">{t('auth.mfaSetupCodeLabel')}</label>
            <input
              id="userCode"
              value={userCode}
              onChange={(e) => setUserCode(e.target.value.replace(/\D+/g, '').slice(0, 6))}
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              style={{ fontFamily: 'var(--aegis-font-mono)', letterSpacing: 6, fontSize: 24, textAlign: 'center' }}
            />
          </div>
          <button type="submit" disabled={busy || userCode.length !== 6} className="btn btn-primary">
            {busy ? t('common.loading') : t('auth.mfaSetupConfirm')}
          </button>
          {err && <p className="notice warn" role="alert">{err}</p>}
        </form>
      </div>
      <p style={{ marginBlockStart: 16 }}>
        <Link href={`/${locale}/auth/login`}>{t('common.back')}</Link>
      </p>
    </section>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [ok, setOk] = useState(false);
  const copy = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    try { await navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 2000); } catch { /* ignored */ }
  }, [value]);
  return (
    <button type="button" onClick={copy} className="btn btn-secondary">
      {ok ? '✓' : label}
    </button>
  );
}
