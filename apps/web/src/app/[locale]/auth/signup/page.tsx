'use client';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { translate, loadCatalog, normalizeLocale, type LocaleCode } from '@aegis/i18n';
import { signup, deriveSessionKeys } from '../../../../lib/auth-client.js';

export default function Signup({ params }: { params: { locale: string } }) {
  const locale = (normalizeLocale(params.locale) ?? 'pt-BR') as LocaleCode;
  loadCatalog(locale);
  const t = useCallback(
    (k: string, vars?: Record<string, string | number>) => translate(locale, k, vars ?? {}),
    [locale],
  );

  const [step, setStep] = useState<'collect' | 'generated'>('collect');
  const [email, setEmail] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [codeExpiry, setCodeExpiry] = useState<number | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (passphrase !== confirm) { setErr(t('auth.passphraseMismatch')); return; }
    if (passphrase.length < 12) { setErr(t('auth.weakPasswordBody')); return; }
    setBusy(true);
    try {
      const res = await signup({ email });
      // Derivar chaves imediatamente para /mfa-setup usar via sandbox (sessionStorage,
      // NAO localStorage); a passphrase NAO e persistida em disco em momento algum.
      const users = JSON.parse(typeof window !== 'undefined' ? window.localStorage.getItem('aegis.users') ?? '{}' : '{}');
      const stored = users[res.userId];
      if (!stored) throw new Error('user not persisted');
      const derived = await deriveSessionKeys(passphrase, stored.saltAuth, stored.saltVault);
      window.sessionStorage.setItem('aegis.sandbox', JSON.stringify({
        userId: res.userId,
        authKeyB64Url: derived.authKeyB64Url,
        vaultKeyB64Url: derived.vaultKeyB64Url,
      }));
      // Limpa copia React da passphrase apos derivar - em caso de re-hidratar
      // do form, o callback cria nova referencia sem afetar sessionStorage.
      setPassphrase('');
      setConfirm('');
      setCode(res.verificationCode);
      setCodeExpiry(res.expiresAt);
      setStep('generated');
      setTimeout(() => { window.location.href = `/${locale}/auth/verify`; }, 5000);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="container" style={{ maxInlineSize: 520 }}>
      <h1>{t('auth.signupTitle')}</h1>
      <p>{t('auth.signupLead')}</p>
      {step === 'collect' && (
        <form className="card" onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <div className="field">
            <label htmlFor="email">{t('auth.emailLabel')}</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="passphrase">{t('auth.passphraseLabel')}</label>
            <input id="passphrase" type="password" required value={passphrase} onChange={(e) => setPassphrase(e.target.value)} autoComplete="new-password" minLength={12} />
          </div>
          <div className="field">
            <label htmlFor="confirm">{t('auth.passphraseConfirmLabel')}</label>
            <input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={12} />
          </div>
          <div className="toggle">
            <input id="terms" type="checkbox" required checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
            <label htmlFor="terms">{t('auth.consentTerms')}</label>
          </div>
          <div className="toggle">
            <input id="priv" type="checkbox" required checked={acceptedPrivacy} onChange={(e) => setAcceptedPrivacy(e.target.checked)} />
            <label htmlFor="priv">{t('auth.consentPrivacy')}</label>
          </div>
          <button type="submit" disabled={busy || !acceptedTerms || !acceptedPrivacy || passphrase.length < 12} className="btn btn-primary">
            {busy ? t('common.loading') : t('auth.submit')}
          </button>
          {err && <p className="notice warn" role="alert">{err}</p>}
        </form>
      )}
      {step === 'generated' && code && codeExpiry && (
        <div className="card" role="status" aria-live="polite">
          <h2>{t('auth.verifyTitle')}</h2>
          <p>{t('auth.verifyDevNotice')}</p>
          <p style={{ fontFamily: 'var(--aegis-font-mono)', fontSize: 32, letterSpacing: 8, margin: '12px 0', textAlign: 'center' }} aria-label={`Code ${code}`}>
            {code}
          </p>
          <small>{t('auth.verifyExpiresIn', { minutes: Math.max(0, Math.ceil((codeExpiry - Date.now()) / 60000)) })}</small>
          <p style={{ marginBlockStart: 12 }}>{t('auth.verifyAutoAdvance')}</p>
          <Link href={`/${locale}/auth/verify`} className="btn btn-primary">{t('auth.verifyContinue')}</Link>
        </div>
      )}
      <p style={{ marginBlockStart: 16 }}>
        {t('auth.alreadyHaveAccount')} <Link href={`/${locale}/auth/login`}>{t('auth.loginHere')}</Link>
      </p>
    </section>
  );
}
