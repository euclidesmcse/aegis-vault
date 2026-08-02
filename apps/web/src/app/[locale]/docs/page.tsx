import { getPageContext } from '../../../lib/render.js';
export default async function Docs({ params }: { params: { locale: string } }) {
  const ctx = await getPageContext(params.locale);
  return <article className="container"><h1>{ctx.t('nav.docs')}</h1><p>Veja `docs/` no repositorio.</p></article>;
}
