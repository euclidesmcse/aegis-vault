import { getPageContext } from '../../../lib/render.js';
export default async function Privacy({ params }: { params: { locale: string } }) {
  const ctx = await getPageContext(params.locale);
  return <article className="container"><h1>{ctx.t('nav.privacy')}</h1><p>{ctx.t('app.footer')}</p></article>;
}
