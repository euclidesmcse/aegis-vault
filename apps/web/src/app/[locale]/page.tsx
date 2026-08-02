import Link from 'next/link';
import { getPageContext } from '../../lib/render.js';

export default async function Home({ params }: { params: { locale: string } }) {
  const ctx = await getPageContext(params.locale);
  return (
    <section className="hero" aria-labelledby="hero-title">
      <article>
        <h1 id="hero-title">{ctx.t('landing.heroTitle')}</h1>
        <p>{ctx.t('landing.heroLead')}</p>
        <div className="cta-row">
          <Link href={`/${ctx.locale}/auth/signup`} className="btn btn-primary">{ctx.t('landing.ctaPrimary')}</Link>
          <Link href={`/${ctx.locale}/password-generator`} className="btn btn-secondary">{ctx.t('landing.ctaSecondary')}</Link>
        </div>
        <ul style={{ marginBlockStart: 32, listStyle: 'none', paddingInlineStart: 0, display: 'grid', gap: 12 }}>
          <li><strong>{ctx.t('landing.benefits.clientSide')}</strong></li>
          <li><strong>{ctx.t('landing.benefits.oneTimeLinks')}</strong></li>
          <li><strong>{ctx.t('landing.benefits.selfHost')}</strong></li>
        </ul>
      </article>
      <aside aria-hidden="true">
        <div className="orb" />
      </aside>
    </section>
  );
}
