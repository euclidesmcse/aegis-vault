'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  generatePassword,
  generatePassphrase,
  generatePin,
  estimateEntropyBits,
} from '@aegis/crypto';
import {
  translate,
  loadCatalog,
  normalizeLocale,
  type LocaleCode,
} from '@aegis/i18n';

type Tab = 'random' | 'memorable' | 'pin';

/**
 * Lista de palavras interna para o modo "memoravel":
 * - Proveniente do subset publico do EFF large wordlist (dominio publico).
 * - Apenas 32 entradas para manter o bundle pequeno. Usuarios que precisam
 *   de uma wordlist maior podem substituir via variavel de ambiente ou fetch.
 */
const PASSPHRASE_WORDS: ReadonlyArray<string> = [
  'abacate', 'abrir', 'acento', 'agua', 'agulha', 'algodao', 'amigo', 'amarelo',
  'banco', 'barco', 'bola', 'branco', 'cachorro', 'carta', 'chave', 'cidade',
  'clima', 'cofre', 'coragem', 'doce', 'dente', 'escada', 'estrela', 'feira',
  'ferro', 'folha', 'garrafa', 'gato', 'girafa', 'janela', 'lapis', 'leite',
];

type CopyResult = 'idle' | 'ok' | 'fail';

async function safeCopy(value: string): Promise<CopyResult> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return 'fail';
  }
  try {
    await navigator.clipboard.writeText(value);
    return 'ok';
  } catch {
    return 'fail';
  }
}

type Level = 'veryWeak' | 'weak' | 'fair' | 'strong' | 'excellent';

// Bandas aproximadas em bits de entropia (heuristica zxcvbn-like).
function levelForBits(bits: number): Level {
  if (bits < 28) return 'veryWeak';
  if (bits < 36) return 'weak';
  if (bits < 56) return 'fair';
  if (bits < 80) return 'strong';
  return 'excellent';
}

const LEVEL_CLASS: Record<Level, string> = {
  veryWeak: 'very-weak',
  weak: 'weak',
  fair: 'fair',
  strong: 'strong',
  excellent: 'excellent',
};

export default function PasswordGeneratorPage({ params }: { params: { locale: string } }) {
  const locale = (normalizeLocale(params.locale) ?? 'pt-BR') as LocaleCode;
  loadCatalog(locale);
  const t = useCallback(
    (k: string, vars?: Record<string, string | number>) => translate(locale, k, vars ?? {}),
    [locale],
  );

  const [tab, setTab] = useState<Tab>('random');

  // Random options.
  const [length, setLength] = useState(20);
  const [upper, setUpper] = useState(true);
  const [lower, setLower] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [excludeAmbig, setExcludeAmbig] = useState(true);
  const [requireEach, setRequireEach] = useState(false);

  // Memorable options.
  const [words, setWords] = useState(5);
  const [separatorLength, setSeparatorLength] = useState(1);
  const [capitalize, setCapitalize] = useState<'none' | 'first' | 'all'>('first');
  const [includeNumber, setIncludeNumber] = useState(true);

  // PIN options.
  const [pinLength, setPinLength] = useState(6);

  const [output, setOutput] = useState<string>('');
  const [bits, setBits] = useState<number>(0);
  const [copyState, setCopyState] = useState<CopyResult>('idle');

  const canGenerate = useMemo(() => {
    if (tab === 'random') return length >= 4 && length <= 256 && (upper || lower || digits || symbols);
    if (tab === 'memorable') return words >= 3 && words <= 16;
    return pinLength >= 4 && pinLength <= 32;
  }, [tab, length, upper, lower, digits, symbols, words, pinLength]);

  const regenerate = useCallback(async () => {
    setCopyState('idle');
    try {
      let s = '';
      if (tab === 'random') {
        s = await generatePassword({
          length,
          upper,
          lower,
          digits,
          symbols,
          excludeAmbiguous: excludeAmbig,
          requireEach,
        });
      } else if (tab === 'memorable') {
        s = await generatePassphrase({
          words,
          separatorLength,
          capitalize,
          includeNumber,
          wordlist: [...PASSPHRASE_WORDS],
        });
      } else {
        s = await generatePin({ length: pinLength });
      }
      setOutput(s);
      setBits(estimateEntropyBits(s));
    } catch {
      setOutput('');
      setBits(0);
    }
  }, [tab, length, upper, lower, digits, symbols, excludeAmbig, requireEach, words, separatorLength, capitalize, includeNumber, pinLength]);

  // Auto-generate on first mount and when controls change.
  useEffect(() => {
    regenerate().catch(() => {
      /* noop */
    });
  }, [regenerate]);

  const onCopy = useCallback(async () => {
    const r = await safeCopy(output);
    setCopyState(r);
    if (r === 'ok' && typeof window !== 'undefined') {
      window.setTimeout(() => setCopyState('idle'), 3000);
    }
  }, [output]);

  const level = levelForBits(bits);

  return (
    <section className="container" aria-labelledby="pg-title" style={{ maxInlineSize: 920 }}>
      <h1 id="pg-title">{t('generator.title')}</h1>
      <p>{t('generator.lead')}</p>

      <div className="tabs" role="tablist" aria-label={t('generator.title')}>
        <button
          role="tab"
          id="tab-random"
          aria-selected={tab === 'random'}
          aria-controls="tabpanel-random"
          className="tab"
          type="button"
          onClick={() => setTab('random')}
        >
          {t('generator.tabRandom')}
        </button>
        <button
          role="tab"
          id="tab-memorable"
          aria-selected={tab === 'memorable'}
          aria-controls="tabpanel-memorable"
          className="tab"
          type="button"
          onClick={() => setTab('memorable')}
        >
          {t('generator.tabMemorable')}
        </button>
        <button
          role="tab"
          id="tab-pin"
          aria-selected={tab === 'pin'}
          aria-controls="tabpanel-pin"
          className="tab"
          type="button"
          onClick={() => setTab('pin')}
        >
          {t('generator.tabPin')}
        </button>
      </div>

      <div className="card" style={{ marginBlockStart: 16 }}>
        {tab === 'random' && (
          <div role="tabpanel" id="tabpanel-random" aria-labelledby="tab-random" style={{ display: 'grid', gap: 12 }}>
            <div className="field">
              <label htmlFor="length">
                {t('generator.length')}: <strong>{length}</strong>
              </label>
              <input
                id="length"
                type="range"
                min={8}
                max={64}
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                aria-valuemin={8}
                aria-valuemax={64}
                aria-valuenow={length}
              />
            </div>
            <fieldset style={{ border: 0, padding: 0, display: 'grid', gap: 6 }}>
              <legend>{t('generator.include')}</legend>
              <div className="toggle">
                <input id="up" type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} />
                <label htmlFor="up">{t('generator.upper')}</label>
              </div>
              <div className="toggle">
                <input id="lo" type="checkbox" checked={lower} onChange={(e) => setLower(e.target.checked)} />
                <label htmlFor="lo">{t('generator.lower')}</label>
              </div>
              <div className="toggle">
                <input id="di" type="checkbox" checked={digits} onChange={(e) => setDigits(e.target.checked)} />
                <label htmlFor="di">{t('generator.digits')}</label>
              </div>
              <div className="toggle">
                <input id="sy" type="checkbox" checked={symbols} onChange={(e) => setSymbols(e.target.checked)} />
                <label htmlFor="sy">{t('generator.symbols')}</label>
              </div>
            </fieldset>
            <div className="toggle">
              <input id="ea" type="checkbox" checked={excludeAmbig} onChange={(e) => setExcludeAmbig(e.target.checked)} />
              <label htmlFor="ea">{t('generator.excludeAmbiguous')}</label>
            </div>
            <div className="toggle">
              <input id="re" type="checkbox" checked={requireEach} onChange={(e) => setRequireEach(e.target.checked)} />
              <label htmlFor="re">{t('generator.requireEach')}</label>
            </div>
          </div>
        )}

        {tab === 'memorable' && (
          <div role="tabpanel" id="tabpanel-memorable" aria-labelledby="tab-memorable" style={{ display: 'grid', gap: 12 }}>
            <div className="field">
              <label htmlFor="words">
                {t('generator.memorableWords')}: <strong>{words}</strong>
              </label>
              <input
                id="words"
                type="range"
                min={3}
                max={10}
                value={words}
                onChange={(e) => setWords(Number(e.target.value))}
                aria-valuemin={3}
                aria-valuemax={10}
                aria-valuenow={words}
              />
            </div>
            <div className="field">
              <label htmlFor="sep">
                {t('generator.memorableSeparator')}: <strong>{separatorLength}</strong>
              </label>
              <input
                id="sep"
                type="range"
                min={1}
                max={4}
                value={separatorLength}
                onChange={(e) => setSeparatorLength(Number(e.target.value))}
                aria-valuemin={1}
                aria-valuemax={4}
                aria-valuenow={separatorLength}
              />
            </div>
            <div className="field">
              <label htmlFor="cap">{t('generator.memorableCapitalize')}</label>
              <select
                id="cap"
                value={capitalize}
                onChange={(e) => setCapitalize(e.target.value as 'none' | 'first' | 'all')}
                aria-label={t('generator.memorableCapitalize')}
              >
                <option value="none">—</option>
                <option value="first">{t('generator.memorableCapitalizeFirst')}</option>
                <option value="all">{t('generator.memorableCapitalizeAll')}</option>
              </select>
            </div>
            <div className="toggle">
              <input id="n" type="checkbox" checked={includeNumber} onChange={(e) => setIncludeNumber(e.target.checked)} />
              <label htmlFor="n">{t('generator.memorableIncludeNumber')}</label>
            </div>
          </div>
        )}

        {tab === 'pin' && (
          <div role="tabpanel" id="tabpanel-pin" aria-labelledby="tab-pin" style={{ display: 'grid', gap: 12 }}>
            <div className="field">
              <label htmlFor="pin">
                {t('generator.pinLength')}: <strong>{pinLength}</strong>
              </label>
              <input
                id="pin"
                type="range"
                min={4}
                max={12}
                value={pinLength}
                onChange={(e) => setPinLength(Number(e.target.value))}
                aria-valuemin={4}
                aria-valuemax={12}
                aria-valuenow={pinLength}
              />
            </div>
          </div>
        )}

        <hr style={{ marginBlock: 16, border: 0, borderBlockStart: '1px solid var(--aegis-divider)' }} />

        <label htmlFor="out" className="sr-only">
          {t('generator.title')}
        </label>
        <textarea
          id="out"
          readOnly
          value={output}
          rows={3}
          aria-live="polite"
          style={{
            inlineSize: '100%',
            fontFamily: 'var(--aegis-font-mono)',
            fontSize: 18,
            padding: 12,
            minBlockSize: 64,
          }}
        />

        <div role="status" aria-live="polite" style={{ marginBlockStart: 12, display: 'grid', gap: 6 }}>
          <strong>{t('generator.strengthLabel')}</strong>
          <span>{t(`generator.strength.${level}`)}</span>
          <div className="gauge" data-level={LEVEL_CLASS[level]} aria-hidden="true">
            <span style={{ inlineSize: `${Math.min(100, Math.max(4, (bits / 128) * 100))}%` }} />
          </div>
          <small>{t('generator.entropyBits', { count: Math.round(bits) })}</small>
        </div>

        <div className="cta-row" style={{ marginBlockStart: 16 }}>
          <button type="button" onClick={regenerate} disabled={!canGenerate} className="btn btn-secondary">
            {t('generator.regenerate')}
          </button>
          <button type="button" onClick={onCopy} disabled={!output} className="btn btn-primary">
            {copyState === 'ok' ? t('generator.copied') : t('generator.copy')}
          </button>
        </div>

        {copyState === 'fail' && (
          <p className="notice warn" role="alert" style={{ marginBlockStart: 12 }}>
            {t('generator.copyFailed')}
          </p>
        )}

        <p className="notice" role="note" style={{ marginBlockStart: 12 }}>
          {t('generator.notice')}
        </p>
      </div>
    </section>
  );
}
