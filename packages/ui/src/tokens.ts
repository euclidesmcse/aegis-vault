// Design tokens semanticos. Apenas referencias logicas (nao physicas).
export const tokens = {
  color: {
    bg: 'var(--aegis-bg)',
    surface: 'var(--aegis-surface)',
    surfaceSilent: 'var(--aegis-surface-silent)',
    text: 'var(--aegis-text)',
    textMuted: 'var(--aegis-text-muted)',
    accent: 'var(--aegis-accent)',
    accentHover: 'var(--aegis-accent-hover)',
    successBg: 'var(--aegis-success-bg)',
    success: 'var(--aegis-success)',
    warning: 'var(--aegis-warn)',
    danger: 'var(--aegis-danger)',
    dangerSoft: 'var(--aegis-danger-soft)',
    focus: 'var(--aegis-focus)',
    divider: 'var(--aegis-divider)',
  },
  spacing: {
    xs: 'var(--aegis-space-xs)',
    sm: 'var(--aegis-space-sm)',
    md: 'var(--aegis-space-md)',
    lg: 'var(--aegis-space-lg)',
    xl: 'var(--aegis-space-xl)',
  },
  radius: {
    sm: 'var(--aegis-radius-sm)',
    md: 'var(--aegis-radius-md)',
    lg: 'var(--aegis-radius-lg)',
    pill: '999px',
  },
  shadow: {
    card: '0 1px 2px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(15, 23, 42, 0.05)',
    focus: '0 0 0 3px rgba(60, 99, 248, 0.55)',
    sticky: '0 1px 0 rgba(15, 23, 42, 0.06), 0 24px 32px -20px rgba(15, 23, 42, 0.12)',
  },
  font: {
    body: 'var(--aegis-font-body)',
    heading: 'var(--aegis-font-heading)',
    mono: 'var(--aegis-font-mono)',
  },
  motion: {
    fast: '120ms cubic-bezier(0.2, 0.8, 0.4, 1)',
    medium: '240ms cubic-bezier(0.2, 0.8, 0.4, 1)',
    slow: '480ms cubic-bezier(0.2, 0.8, 0.4, 1)',
  },
};
export const UI_VERSION = '0.1.0';
