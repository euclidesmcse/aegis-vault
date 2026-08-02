import { getPageContext } from '../../../../lib/render.js';
import { RevealClient } from './RevealClient.js';

export default async function ShareReveal({ params }: { params: { locale: string; token: string } }) {
  const ctx = await getPageContext(params.locale);
  return (
    <section className="container" aria-labelledby="title">
      <h1 id="title">{ctx.t('share.revealTitle')}</h1>
      <p>{ctx.t('share.revealLead')}</p>
      <RevealClient token={params.token} locale={ctx.locale} />
    </section>
  );
}
