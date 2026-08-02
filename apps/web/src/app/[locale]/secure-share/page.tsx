'use client';
import { useState, useCallback } from 'react';
import { createShare, envelopeDigest } from '@aegis/crypto';
import { translate, loadCatalog, normalizeLocale, type LocaleCode } from '@aegis/i18n';

export default function SecureShareCreate({ params }: { params: { locale: string } }) {
  const locale = (normalizeLocale(params.locale) ?? 'pt-BR') as LocaleCode;
  loadCatalog(locale);
  const t = (k: string, vars?: Record<string, string | number>) => translate(locale, k, vars ?? {});
  const [plaintext, setPlaintext] = useState('');
  const [ttl, setTtl] = useState({ unit: 'hours' as 'minutes' | 'hours' | 'days' | 'weeks' | 'months', value: 24 });
  const [result, setResult] = useState<null | { url: string; id: string }>(null);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async () => {
    setError(null);
    try {
      const unitMult = { minutes: 60, hours: 3600, days: 86400, weeks: 7 * 86400, months: 30 * 86400 } as const;
      const ttlSeconds = Math.min(60 * 60 * 24 * 90, Math.max(60, unitMult[ttl.unit] * ttl.value));
      const enc = new TextEncoder();
      const { token, fragmentKey, envelope } = await createShare(enc.encode(plaintext));
      const digest = await sha256Base64UrlClient(token);
      const submit = await fetch('/api/v1/shares', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-token-digest': digest },
        body: JSON.stringify({ envelope, ttlSeconds }),
      });
      if (!submit.ok) throw new Error(`Failed to create share (${submit.status})`);
      const json = await submit.json() as { id: string };
      const host = window.location.host;
      const url = `${window.location.protocol}//${host}/${locale}/s/${token}#${fragmentKey}`;
      setResult({ url, id: json.id });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [plaintext, ttl, locale]);

  return (
    <section className="container" aria-labelledby="title">
      <h1 id="title">{t('share.createTitle')}</h1>
      <p>{t('share.createLead')}</p>
      <div className="card">
        <label htmlFor="secret">{t('share.createTitle')}</label>
        <textarea id="secret" value={plaintext} onChange={(e) => setPlaintext(e.target.value)} rows={4} />
        <fieldset style={{ border: 0, padding: 0, marginBlockStart: 16 }}>
          <legend>{t('share.ttlLabel')}</legend>
          <select value={ttl.unit} onChange={(e) => setTtl({ ...ttl, unit: e.target.value as typeof ttl.unit })}>
            <option value="minutes">{t('share.ttl.minutes', { count: ttl.value })}</option>
            <option value="hours">{t('share.ttl.hours', { count: ttl.value })}</option>
            <option value="days">{t('share.ttl.days', { count: ttl.value })}</option>
            <option value="weeks">{t('share.ttl.weeks', { count: ttl.value })}</option>
            <option value="months">{t('share.ttl.months', { count: ttl.value })}</option>
          </select>
        </fieldset>
        <button onClick={create} className="btn btn-primary" disabled={!plaintext}>{t('share.createButton')}</button>
        {error && <p className="notice warn" role="alert">{error}</p>}
        {result && (
          <div role="status" aria-live="polite">
            <h2>{t('share.resultTitle')}</h2>
            <textarea readOnly value={result.url} rows={4} style={{ width: '100%', fontFamily: 'var(--aegis-font-mono)' }} />
          </div>
        )}
      </div>
    </section>
  );
}
async function sha256Base64UrlClient(token: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(token));
  const b = new Uint8Array(buf);
  let s = '';
  for (const v of b) s += String.fromCharCode(v);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
