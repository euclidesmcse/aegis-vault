import { getPageContext } from '../../../lib/render.js';
export default async function SecurityPage({ params }: { params: { locale: string } }) {
  const ctx = await getPageContext(params.locale);
  return (
    <article className="container" style={{ maxInlineSize: 900 }}>
      <h1>{ctx.t('nav.security')}</h1>
      <h2>{ctx.t('landing.benefits.clientSide')}</h2>
      <p>{ctx.t('landing.featureItems.csrfBody')}</p>
      <h2>{ctx.t('landing.benefits.oneTimeLinks')}</h2>
      <p>{ctx.t('landing.featureItems.otpBody')}</p>
      <h2>{ctx.t('landing.benefits.selfHost')}</h2>
      <p>{ctx.t('landing.featureItems.selfBody')}</p>
    </article>
  );
}
