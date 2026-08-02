import '../../../styles/globals.css';
import Link from 'next/link';
import { getPageContext } from '../../lib/render.js';
import { REQUIRED_LOCALES } from '@aegis/i18n';
import { DocumentLocaleSync } from '../../components/DocumentLocaleSync.js';

export async function generateStaticParams() {
  return REQUIRED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: { locale: string } }) {
  const ctx = await getPageContext(params.locale);
  return (
    <>
      <DocumentLocaleSync locale={ctx.locale} direction={ctx.direction} />
      <div lang={ctx.locale} dir={ctx.direction}>
        <header className="navbar" role="banner">
          <Link href={`/${ctx.locale}`} className="brand" aria-label={ctx.t('app.name')}>{ctx.t('app.name')}</Link>
          <nav aria-label="Primary">
            <Link href={`/${ctx.locale}/password-generator`}>{ctx.t('nav.generator')}</Link>
            <Link href={`/${ctx.locale}/password-strength`}>{ctx.t('nav.strength')}</Link>
            <Link href={`/${ctx.locale}/secure-share`}>{ctx.t('nav.share')}</Link>
            <Link href={`/${ctx.locale}/security`}>{ctx.t('nav.security')}</Link>
            <Link href={`/${ctx.locale}/docs`}>{ctx.t('nav.docs')}</Link>
          </nav>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href={`/${ctx.locale}/auth/login`}>{ctx.t('nav.login')}</Link>
            <Link href={`/${ctx.locale}/auth/signup`} className="btn btn-primary">{ctx.t('nav.signup')}</Link>
          </div>
        </header>
        <main id="main" className="container" role="main">{children}</main>
        <footer className="footer" role="contentinfo">
          <div className="container">
            <small>{ctx.t('app.footer')}</small>
            <nav aria-label="Footer">
              <Link href={`/${ctx.locale}/security`}>{ctx.t('footer.links.security')}</Link>
              <Link href={`/${ctx.locale}/privacy`}>{ctx.t('footer.links.privacy')}</Link>
              <Link href={`/${ctx.locale}/terms`}>{ctx.t('footer.links.terms')}</Link>
            </nav>
            <small>{ctx.t('footer.copyright', { year: new Date().getFullYear() })}</small>
          </div>
        </footer>
      </div>
    </>
  );
}
