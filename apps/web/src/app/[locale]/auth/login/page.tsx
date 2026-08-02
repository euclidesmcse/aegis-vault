'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeLocale, type LocaleCode } from '@aegis/i18n';

export default function Login({ params }: { params: { locale: string } }) {
  const locale = (normalizeLocale(params.locale) ?? 'pt-BR') as LocaleCode;
  const router = useRouter();
  useEffect(() => {
    router.replace(`/${locale}/auth/unlock`);
  }, [router, locale]);
  return null;
}
