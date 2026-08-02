'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { translate, loadCatalog, normalizeLocale, type LocaleCode } from '@aegis/i18n';
import { ssRead, ssClear, type Sandbox } from '../../../../../lib/auth-client.js';
import { listItems, defaultWorkspaceId, type VaultItemSummary } from '../../../../../lib/vault-client.js';
import { AutoLockGuard } from '../../../../../components/AutoLockGuard.js';

export default function VaultPage({ params }: { params: { locale: string; workspaceId: string } }) {
  const locale = (normalizeLocale(params.locale) ?? 'pt-BR') as LocaleCode;
  const workspace = params.workspaceId || defaultWorkspaceId();
  loadCatalog(locale);
  const t = useCallback(
    (k: string, vars?: Record<string, string | number>) => translate(locale, k, vars ?? {}),
    [locale],
  );

  const [items, setItems] = useState<VaultItemSummary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    void (async () => {
      const sandbox = ssRead<Sandbox>();
      if (!sandbox) {
        setErr(t('vault.locked'));
        return;
      }
      try {
        const rows = await listItems({ sandbox });
        setItems(rows);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, [t]);

  return (
    <AutoLockGuard locale={locale}>
      <section className="container" style={{ maxInlineSize: 1080 }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBlockEnd: 16 }}>
          <h1>{t('vault.listTitle')}</h1>
          <Link href={`/${locale}/app/${workspace}/vault/new`} className="btn btn-primary">
            {t('vault.addItem')}
          </Link>
        </header>
        {err && <p className="notice warn" role="alert">{err}</p>}
        {items === null && !err && <p>{t('common.loading')}</p>}
        {items && items.length === 0 && (
          <div className="card" role="status">
            <h2>{t('vault.emptyTitle')}</h2>
            <p>{t('vault.emptyLead')}</p>
            <Link href={`/${locale}/app/${workspace}/vault/new`} className="btn btn-primary">
              {t('vault.emptyCTA')}
            </Link>
          </div>
        )}
        {items && items.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }} aria-label={t('vault.listTitle')}>
            {items.map((it) => (
              <li key={it.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Link href={`/${locale}/app/${workspace}/vault/${it.id}`}>
                  <strong>{it.title || t('vault.untitled')}</strong>{' '}
                  <small style={{ color: 'var(--aegis-text-muted)' }}>{t('vault.type.' + it.type)}</small>
                </Link>
                <small style={{ color: 'var(--aegis-text-muted)' }}>{it.updatedAt.slice(0, 10)}</small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AutoLockGuard>
  );
}
