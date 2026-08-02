'use client';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { translate, loadCatalog, normalizeLocale, type LocaleCode } from '@aegis/i18n';
import { ssRead, type Sandbox } from '../../../../../../lib/auth-client.js';
import { createItem, defaultWorkspaceId, type ItemType, type VaultItemFields } from '../../../../../../lib/vault-client.js';
import { AutoLockGuard } from '../../../../../../components/AutoLockGuard.js';

export default function NewItemPage({ params }: { params: { locale: string; workspaceId: string } }) {
  const locale = (normalizeLocale(params.locale) ?? 'pt-BR') as LocaleCode;
  loadCatalog(locale);
  const t = useCallback(
    (k: string, vars?: Record<string, string | number>) => translate(locale, k, vars ?? {}),
    [locale],
  );
  const router = useRouter();
  const workspace = params.workspaceId || defaultWorkspaceId();

  const [type, setType] = useState<ItemType>('login');

  return (
    <AutoLockGuard locale={locale}>
      <section className="container" style={{ maxInlineSize: 720 }}>
        <h1>{t('vault.newTitle')}</h1>
        <div className="tabs" role="tablist" aria-label={t('vault.newTypeLabel')}>
          {(['login', 'note', 'identity', 'card'] as const).map((tp) => (
            <button key={tp} role="tab" aria-selected={type === tp} className="tab" type="button" onClick={() => setType(tp)}>
              {t('vault.type.' + tp)}
            </button>
          ))}
        </div>
        <div className="card" style={{ marginBlockStart: 16 }}>
          {type === 'login' && <LoginForm t={t} workspace={workspace} locale={locale} router={router} />}
          {type === 'note' && <NoteForm t={t} workspace={workspace} locale={locale} router={router} />}
          {type === 'identity' && <IdentityForm t={t} workspace={workspace} locale={locale} router={router} />}
          {type === 'card' && <CardForm t={t} workspace={workspace} locale={locale} router={router} />}
        </div>
        <p style={{ marginBlockStart: 16 }}><Link href={`/${locale}/app/${workspace}/vault`}>{t('common.back')}</Link></p>
      </section>
    </AutoLockGuard>
  );
}

type FormProps = {
  t: (k: string, vars?: Record<string, string | number>) => string;
  workspace: string;
  locale: string;
  router: ReturnType<typeof useRouter>;
};

async function save(fields: VaultItemFields, opts: { workspace: string; locale: string; router: FormProps['router'] }): Promise<void> {
  if (typeof window === 'undefined') return;
  const sandbox = ssRead<Sandbox>();
  if (!sandbox) { window.location.href = `/${opts.locale}/auth/unlock`; return; }
  const created = await createItem(fields, { sandbox });
  opts.router.push(`/${opts.locale}/app/${opts.workspace}/vault/${created.id}`);
}

function LoginForm({ t, workspace, locale, router }: FormProps) {
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await save({ type: 'login', title, username, password, url, notes, favorite: false, updatedAt: new Date().toISOString() }, { workspace, locale, router });
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
      <Field label={t('vault.fieldTitle')}><input required value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label={t('vault.fieldUsername')}><input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" /></Field>
      <Field label={t('vault.fieldPassword')}><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" /></Field>
      <Field label={t('vault.fieldUrl')}><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
      <Field label={t('vault.fieldNotes')}><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></Field>
      <button type="submit" disabled={busy} className="btn btn-primary">{busy ? t('common.loading') : t('common.save')}</button>
    </form>
  );
}

function NoteForm({ t, workspace, locale, router }: FormProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await save({ type: 'note', title, body, notes: '', favorite: false, updatedAt: new Date().toISOString() }, { workspace, locale, router });
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
      <Field label={t('vault.fieldTitle')}><input required value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label={t('vault.fieldBody')}><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} /></Field>
      <button type="submit" disabled={busy} className="btn btn-primary">{busy ? t('common.loading') : t('common.save')}</button>
    </form>
  );
}

function IdentityForm({ t, workspace, locale, router }: FormProps) {
  const [title, setTitle] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await save({ type: 'identity', title, firstName, lastName, email, phone, address, notes: '', favorite: false, updatedAt: new Date().toISOString() }, { workspace, locale, router });
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
      <Field label={t('vault.fieldTitle')}><input required value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label={t('vault.fieldFirstName')}><input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></Field>
      <Field label={t('vault.fieldLastName')}><input value={lastName} onChange={(e) => setLastName(e.target.value)} /></Field>
      <Field label={t('vault.fieldEmail')}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label={t('vault.fieldPhone')}><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      <Field label={t('vault.fieldAddress')}><textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} /></Field>
      <button type="submit" disabled={busy} className="btn btn-primary">{busy ? t('common.loading') : t('common.save')}</button>
    </form>
  );
}

function CardForm({ t, workspace, locale, router }: FormProps) {
  const [title, setTitle] = useState('');
  const [number, setNumber] = useState('');
  const [holder, setHolder] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await save({ type: 'card', title, number, holder, expiry, cvv, notes: '', favorite: false, updatedAt: new Date().toISOString() }, { workspace, locale, router });
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
      <Field label={t('vault.fieldTitle')}><input required value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label={t('vault.fieldCardNumber')}><input value={number} onChange={(e) => setNumber(e.target.value)} autoComplete="off" /></Field>
      <Field label={t('vault.fieldCardHolder')}><input value={holder} onChange={(e) => setHolder(e.target.value)} /></Field>
      <Field label={t('vault.fieldCardExpiry')}><input value={expiry} onChange={(e) => setExpiry(e.target.value)} placeholder="MM/YY" /></Field>
      <Field label={t('vault.fieldCardCvv')}><input type="password" value={cvv} onChange={(e) => setCvv(e.target.value)} autoComplete="off" /></Field>
      <button type="submit" disabled={busy} className="btn btn-primary">{busy ? t('common.loading') : t('common.save')}</button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
