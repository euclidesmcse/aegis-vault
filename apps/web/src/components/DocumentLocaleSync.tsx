'use client';
import { useEffect } from 'react';

// Sincroniza lang/dir no documentElement. A href href em <head> ja define lang/dir
// no segmento [locale]; este componente evita a pagina totalmente monocultura.
export function DocumentLocaleSync({ locale, direction }: { locale: string; direction: 'ltr' | 'rtl' }) {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', locale);
    root.setAttribute('dir', direction);
    return () => {};
  }, [locale, direction]);
  return null;
}
