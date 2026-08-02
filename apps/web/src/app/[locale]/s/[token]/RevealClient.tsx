'use client';
import { useState } from 'react';
import { revealShare } from '@aegis/crypto';
import { translate, loadCatalog, normalizeLocale, type LocaleCode } from '@aegis/i18n';

type Status = 'idle' | 'awaiting-confirm' | 'revealing' | 'revealed' | 'expired' | 'consumed' | 'revoked' | 'invalid' | 'no-key';

export function RevealClient({ token, locale: localeStr }: { token: string; locale: string }) {
  const locale = (normalizeLocale(localeStr) ?? 'pt-BR') as LocaleCode;
  loadCatalog(locale);
  const t = (k: string, vars?: Record<string, string | number>) => translate(locale, k, vars ?? {});
  const [status, setStatus] = useState<Status>(typeof window !== 'undefined' && window.location.hash ? 'awaiting-confirm' : 'no-key');
  const [plain, setPlain] = useState('');
  const [copied, setCopied] = useState<'idle'|'ok'|'fail'>('idle');

  async function confirm() {
    setStatus('revealing');
    const fragmentKey = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    if (!fragmentKey) { setStatus('no-key'); return; }
    try {
      const submit = await fetch(`/api/v1/shares/${encodeURIComponent(token)}/consume`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fragmentKey }) });
      if (submit.status === 410) {
        setStatus('invalid');
        return;
      }
      if (!submit.ok) { setStatus('invalid'); return; }
      const data = await submit.json() as { envelope: string };
      const pt = await revealShare(fragmentKey, data.envelope, token);
      setPlain(new TextDecoder().decode(pt));
      setStatus('revealed');
      try { await navigator.clipboard.writeText(new TextDecoder().decode(pt)); setCopied('ok'); }
      catch { setCopied('fail'); }
    } catch {
      setStatus('invalid');
    }
  }

  if (status === 'no-key') return <p className="notice warn">{t('share.invalid')}</p>;
  if (status === 'expired') return <p className="notice warn">{t('share.expired')}</p>;
  if (status === 'consumed') return <p className="notice warn">{t('share.consumed')}</p>;
  if (status === 'revoked') return <p className="notice warn">{t('share.revoked')}</p>;
  if (status === 'invalid') return <p className="notice warn">{t('share.invalid')}</p>;
  if (status === 'awaiting-confirm') {
    return (
      <div className="card">
        <p>{t('share.revealNotice')}</p>
        <button className="btn btn-primary" type="button" onClick={confirm}>{t('share.revealButton')}</button>
      </div>
    );
  }
  if (status === 'revealing') return <p>{t('common.loading')}</p>;
  return (
    <div className="card">
      <label htmlFor="plain">{t('share.revealTitle')}</label>
      <textarea id="plain" readOnly value={plain} rows={4} style={{ width: '100%' }} />
      {copied === 'fail' && <p className="notice warn">{t('share.selectWarning')}</p>}
      {copied === 'ok' && <p className="notice" role="status">{t('generator.copied')}</p>}
    </div>
  );
}
