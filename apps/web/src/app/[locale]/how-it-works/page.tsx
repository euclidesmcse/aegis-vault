import { getPageContext } from '../../../lib/render.js';
export default async function HowItWorks({ params }: { params: { locale: string } }) {
  const ctx = await getPageContext(params.locale);
  return <article className="container"><h1>{ctx.t('nav.howItWorks')}</h1><p>{ctx.t('app.footer')}</p></article>;
}
