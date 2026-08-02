'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { translate, loadCatalog, normalizeLocale, type LocaleCode } from '@aegis/i18n';
import { ssRead, type Sandbox } from '../../../../../../lib/auth-client.js';
import { getItem, updateItem, trashItem, type VaultItemStored, defaultWorkspaceId } from '../../../../../../lib/vault-client.js';
import { AutoLockGuard } from '../../../../../../components/AutoLockGuard.js';

type CopyState = 'idle' | 'ok' | 'fail';

export default function ItemDetailPage({ params }: { params: { locale: string; workspaceId: string; itemId: string } }) {
  const locale = (normalizeLocale(params.locale) ?? 'pt-BR') as LocaleCode;
  loadCatalog(locale);
  const t = useCallback(
    (k: string, vars?: Record<string, string | number>) => translate(locale, k, vars ?? {}),
    [locale],
  );
  const router = useRouter();
  const workspace = params.workspaceId || defaultWorkspaceId();
  const itemId = params.itemId;

  const [item, setItem] = useState<VaultItemStored | null>(null);
  const [edit, setEdit] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copy, setCopy] = useState<Record<string, CopyState>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    void (async () => {
      const sandbox = ssRead<Sandbox>();
      if (!sandbox) { setErr(t('vault.locked')); return; }
      try {
        const full = await getItem(itemId, { sandbox });
        if (!full) { setErr(t('vault.notFound')); return; }
        setItem(full);
      } catch (e) { setErr((e as Error).message); }
    })();
  }, [t, itemId]);

  if (err) return <p className="notice warn" role="alert">{err}</p>;
  if (!item) return <p>{t('common.loading')}</p>;

  const onCopy = useCallback(async (field: string, value: string) => {
    if (!value) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setCopy((c) => ({ ...c, [field]: 'fail' })); return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopy((c) => ({ ...c, [field]: 'ok' }));
      setTimeout(() => setCopy((c) => ({ ...c, [field]: 'idle' })), 2000);
    } catch {
      setCopy((c) => ({ ...c, [field]: 'fail' }));
    }
  }, []);

  const onSave = async (patch: Partial<VaultItemStored>) => {
    const sandbox = ssRead<Sandbox>();
    if (!sandbox) return;
    await updateItem(itemId, patch, { sandbox });
    const fresh = await getItem(itemId, { sandbox });
    if (fresh) setItem(fresh);
    setEdit(false);
  };

  const onDelete = async () => {
    if (!window.confirm(t('vault.confirmDelete'))) return;
    const sandbox = ssRead<Sandbox>();
    if (!sandbox) return;
    await trashItem(itemId, { sandbox });
    router.push(`/${locale}/app/${workspace}/vault`);
  };

  return (
    <AutoLockGuard locale={locale}>
      <section className="container" style={{ maxInlineSize: 720 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBlockEnd: 16 }}>
          <h1>{item.title || t('vault.untitled')}</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setEdit((e) => !e)}>
              {edit ? t('common.cancel') : t('common.save')}
            </button>
            <button type="button" className="btn btn-danger" onClick={onDelete}>
              {t('common.delete')}
            </button>
          </div>
        </header>

        {!edit && <ReadView item={item} copy={copy} onCopy={onCopy} t={t} />}
        {edit && <EditForm item={item} onSave={onSave} t={t} />}

        <p style={{ marginBlockStart: 16 }}><Link href={`/${locale}/app/${workspace}/vault`}>{t('common.back')}</Link></p>
      </section>
    </AutoLockGuard>
  );
}

function ReadView({ item, copy, onCopy, t }: { item: VaultItemStored; copy: Record<string, CopyState>; onCopy: (k: string, v: string) => void; t: (k: string) => string }) {
  return (
    <div className="card" style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0 }}>{t('vault.type.' + item.type)}</h2>
      {item.type === 'login' && (
        <>
          <Row label={t('vault.fieldUsername')} value={item.username} onCopy={onCopy} copyState={copy['username']} t={t} hideable />
          <Row label={t('vault.fieldPassword')} value={item.password} onCopy={onCopy} copyState={copy['password']} t={t} hideable masked />
          {item.url && <Row label={t('vault.fieldUrl')} value={item.url} onCopy={onCopy} copyState={copy['url']} t={t} />}
          {item.notes && <Row label={t('vault.fieldNotes')} value={item.notes} onCopy={onCopy} copyState={copy['notes']} t={t} multiline />}
        </>
      )}
      {item.type === 'note' && <Row label={t('vault.fieldBody')} value={item.body} onCopy={onCopy} copyState={copy['body']} t={t} multiline />}
      {item.type === 'identity' && (
        <>
          <Row label={t('vault.fieldFirstName')} value={item.firstName} onCopy={onCopy} copyState={copy['firstName']} t={t} />
          <Row label={t('vault.fieldLastName')} value={item.lastName} onCopy={onCopy} copyState={copy['lastName']} t={t} />
          <Row label={t('vault.fieldEmail')} value={item.email} onCopy={onCopy} copyState={copy['email']} t={t} />
          <Row label={t('vault.fieldPhone')} value={item.phone} onCopy={onCopy} copyState={copy['phone']} t={t} />
          {item.address && <Row label={t('vault.fieldAddress')} value={item.address} onCopy={onCopy} copyState={copy['address']} t={t} multiline />}
        </>
      )}
      {item.type === 'card' && (
        <>
          <Row label={t('vault.fieldCardNumber')} value={item.number} onCopy={onCopy} copyState={copy['number']} t={t} hideable masked />
          <Row label={t('vault.fieldCardHolder')} value={item.holder} onCopy={onCopy} copyState={copy['holder']} t={t} />
          <Row label={t('vault.fieldCardExpiry')} value={item.expiry} onCopy={onCopy} copyState={copy['expiry']} t={t} />
          <Row label={t('vault.fieldCardCvv')} value={item.cvv} onCopy={onCopy} copyState={copy['cvv']} t={t} masked />
        </>
      )}
    </div>
  );
}

function Row({ label, value, onCopy, copyState, t, masked, hideable, multiline }: {
  label: string; value: string; onCopy: (k: string, v: string) => void;
  copyState: CopyState | undefined; t: (k: string) => string;
  masked?: boolean; hideable?: boolean; multiline?: boolean;
}) {
  const [show, setShow] = useState(!masked);
  return (
    <div>
      <strong>{label}:</strong>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--aegis-font-mono)', wordBreak: multiline ? 'break-word' : 'break-all', flex: 1 }}>
          {show ? value : '••••••••'}
        </span>
        {hideable && (
          <button type="button" className="btn btn-secondary" onClick={() => setShow((s) => !s)} aria-pressed={show}>
            {show ? t('vault.hide') : t('vault.show')}
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={() => onCopy(label, value)}>
          {copyState === 'ok' ? t('generator.copied') : t('generator.copy')}
        </button>
      </div>
    </div>
  );
}

function EditForm({ item, onSave, t }: { item: VaultItemStored; onSave: (patch: Partial<VaultItemStored>) => Promise<void>; t: (k: string) => string }) {
  const [title, setTitle] = useState(item.title);
  const [notes, setNotes] = useState(item.notes);
  const [username, setUsername] = useState(item.type === 'login' ? item.username : '');
  const [password, setPassword] = useState(item.type === 'login' ? item.password : '');
  const [url, setUrl] = useState(item.type === 'login' ? item.url : '');
  const [body, setBody] = useState(item.type === 'note' ? item.body : '');
  const [firstName, setFirstName] = useState(item.type === 'identity' ? item.firstName : '');
  const [lastName, setLastName] = useState(item.type === 'identity' ? item.lastName : '');
  const [email, setEmail] = useState(item.type === 'identity' ? item.email : '');
  const [phone, setPhone] = useState(item.type === 'identity' ? item.phone : '');
  const [address, setAddress] = useState(item.type === 'identity' ? item.address : '');
  const [number, setNumber] = useState(item.type === 'card' ? item.number : '');
  const [holder, setHolder] = useState(item.type === 'card' ? item.holder : '');
  const [expiry, setExpiry] = useState(item.type === 'card' ? item.expiry : '');
  const [cvv, setCvv] = useState(item.type === 'card' ? item.cvv : '');

  return (
    <form className="card" style={{ display: 'grid', gap: 12 }} onSubmit={(e) => {
      e.preventDefault();
      const patch: Partial<VaultItemStored> = { title, notes };
      if (item.type === 'login') Object.assign(patch, { username, password, url });
      else if (item.type === 'note') Object.assign(patch, { body });
      else if (item.type === 'identity') Object.assign(patch, { firstName, lastName, email, phone, address });
      else if (item.type === 'card') Object.assign(patch, { number, holder, expiry, cvv });
      void onSave(patch);
    }}>
      <div className="field"><label>{t('vault.fieldTitle')}</label><input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="field"><label>{t('vault.fieldNotes')}</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
      {item.type === 'login' && <>
        <div className="field"><label>{t('vault.fieldUsername')}</label><input value={username} onChange={(e) => setUsername(e.target.value)} /></div>
        <div className="field"><label>{t('vault.fieldPassword')}</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <div className="field"><label>{t('vault.fieldUrl')}</label><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
      </>}
      {item.type === 'note' && <div className="field"><label>{t('vault.fieldBody')}</label><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} /></div>}
      {item.type === 'identity' && <>
        <div className="field"><label>{t('vault.fieldFirstName')}</label><input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
        <div className="field"><label>{t('vault.fieldLastName')}</label><input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
        <div className="field"><label>{t('vault.fieldEmail')}</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>{t('vault.fieldPhone')}</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div className="field"><label>{t('vault.fieldAddress')}</label><textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} /></div>
      </>}
      {item.type === 'card' && <>
        <div className="field"><label>{t('vault.fieldCardNumber')}</label><input value={number} onChange={(e) => setNumber(e.target.value)} /></div>
        <div className="field"><label>{t('vault.fieldCardHolder')}</label><input value={holder} onChange={(e) => setHolder(e.target.value)} /></div>
        <div className="field"><label>{t('vault.fieldCardExpiry')}</label><input value={expiry} onChange={(e) => setExpiry(e.target.value)} /></div>
        <div className="field"><label>{t('vault.fieldCardCvv')}</label><input type="password" value={cvv} onChange={(e) => setCvv(e.target.value)} /></div>
      </>}
      <button type="submit" className="btn btn-primary">{t('common.save')}</button>
    </form>
  );
}
