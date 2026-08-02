'use client';
import { useState, useCallback } from 'react';
import { analyzePassword } from '@aegis/crypto';
import {
  translate,
  loadCatalog,
  normalizeLocale,
  type LocaleCode,
} from '@aegis/i18n';

type CopyResult = 'idle' | 'ok' | 'fail';

// analyzePassword devolve level com hifens; chaves i18n sao camelCase.
function i18nLevel(level: 'very-weak' | 'weak' | 'fair' | 'strong' | 'excellent' | null): string {
  if (level === null) return 'fair';
  return level === 'very-weak' ? 'veryWeak' : level;
}

async function safeCopy(value: string): Promise<CopyResult> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return 'fail';
  try {
    await navigator.clipboard.writeText(value);
    return 'ok';
  } catch {
    return 'fail';
  }
}

export default function PasswordStrength({ params }: { params: { locale: string } }) {
  const locale = (normalizeLocale(params.locale) ?? 'pt-BR') as LocaleCode;
  loadCatalog(locale);
  const t = useCallback(
    (k: string, vars?: Record<string, string | number>) => translate(locale, k, vars ?? {}),
    [locale],
  );

  const [input, setInput] = useState('');
  const [copyState, setCopyState] = useState<CopyResult>('idle');

  const result = input ? analyzePassword(input) : null;
  const level = result?.level ?? null;

  // Faixas visuais aproximadas: 0..28 very-weak, 28..48 weak, 48..72 fair, 72..100 strong, 100+ excellent.
  const widthPct = (bits: number) => Math.min(100, Math.max(4, (bits / 128) * 100));

  const onCopy = useCallback(async () => {
    if (!input) return;
    const r = await safeCopy(input);
    setCopyState(r);
    if (r === 'ok' && typeof window !== 'undefined') {
      window.setTimeout(() => setCopyState('idle'), 3000);
    }
  }, [input]);

  return (
    <section className="container" aria-labelledby="title" style={{ maxInlineSize: 920 }}>
      <h1 id="title">{t('strength.title')}</h1>
      <p>{t('strength.lead')}</p>

      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <label htmlFor="password">{t('strength.title')}</label>
        <input
          id="password"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('strength.placeholder')}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby="strength-notice"
          style={{ inlineSize: '100%', fontFamily: 'var(--aegis-font-mono)' }}
        />

        {result && (
          <div role="status" aria-live="polite" style={{ display: 'grid', gap: 8 }}>
            <strong>{t(`strength.level.${i18nLevel(level)}`)}</strong>
            <div className="gauge" data-level={level ?? 'fair'} aria-hidden="true">
              <span style={{ inlineSize: `${widthPct(result.entropyBits)}%` }} />
            </div>
            <small id="strength-notice" role="note">
              {t('generator.entropyBits', { count: result.entropyBits })}
            </small>
            {result.findings.length > 0 && (
              <details>
                <summary>{t('strength.feedbackTitle')}</summary>
                <ul>
                  {result.findings.map((f, i) => (
                    <li key={i}>{f.message}</li>
                  ))}
                </ul>
              </details>
            )}
            <small>{t('strength.improvementFooter')}</small>
          </div>
        )}

        <div className="cta-row" style={{ marginBlockStart: 8 }}>
          <button type="button" onClick={onCopy} disabled={!input} className="btn btn-primary">
            {copyState === 'ok' ? t('generator.copied') : t('generator.copy')}
          </button>
        </div>

        {copyState === 'fail' && (
          <p className="notice warn" role="alert">
            {t('generator.copyFailed')}
          </p>
        )}
      </div>
    </section>
  );
}
