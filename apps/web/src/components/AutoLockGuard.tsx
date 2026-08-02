'use client';
// AutoLockGuard v2: arma com base na PRESENCA de sandbox em sessionStorage,
// nao mais em pathname. Isso cobre /auth/* (signup/verify/mfa-setup) onde
// authKey + vaultKey ficam materializados durante todo o fluxo de cadastro.

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ssRead, ssClear, type Sandbox } from '../lib/auth-client.js';

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const AUTH_FLOW_TIMEOUT_MS = 5 * 60 * 1000; // 5 min durante signup/verify/mfa-setup

export function AutoLockGuard({ locale, idleMs = DEFAULT_TIMEOUT_MS, authFlowIdleMs = AUTH_FLOW_TIMEOUT_MS }: { locale: string; idleMs?: number; authFlowIdleMs?: number }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function arm(timeoutMs: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      ssClear();
      router.replace(`/${locale}/auth/unlock?reason=idle`);
    }, timeoutMs);
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Sem sandbox -> nada para proteger.
    const sandbox = ssRead<Sandbox>();
    if (!sandbox) return;
    // seleciona timeout conforme o caminho do app.
    const path = window.location.pathname;
    const isAuthFlow = path.startsWith(`/${locale}/auth/`);
    const timeout = isAuthFlow ? authFlowIdleMs : idleMs;
    arm(timeout);

    const events = ['mousemove', 'keydown', 'pointerdown', 'touchstart'] as const;
    // Debounce: so rearma depois de `debounceMs` de quietude, evitando
    // centenas de resets por segundo em paginas movimentadas.
    const debounceMs = Math.min(1000, Math.floor(timeout / 6));
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const onActivity = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { debounceTimer = null; arm(timeout); }, debounceMs);
    };
    for (const ev of events) window.addEventListener(ev, onActivity, { passive: true });
    const onVisibility = () => { if (document.hidden) ssClear(); };
    document.addEventListener('visibilitychange', onVisibility);
    const onPageHide = () => ssClear();
    window.addEventListener('pagehide', onPageHide);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (debounceTimer) clearTimeout(debounceTimer);
      for (const ev of events) window.removeEventListener(ev, onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [idleMs, authFlowIdleMs, locale, router]);

  return null;
}
