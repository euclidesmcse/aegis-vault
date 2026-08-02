// Root layout intencionalmente minimo. O html/body estao aqui para satisfazer
// Next.js App Router; atributos lang/dir sao sincronizados em runtime pelo
// componente <DocumentLocaleSync> dentro de app/[locale]/layout.tsx para
// satisfazer WCAG/W3C com <html lang dir> dinamico por segmento.
import './styles/globals.css';
export const metadata = {
  title: { default: 'AegisVault', template: '%s - AegisVault' },
  description: 'AegisVault - platform with client-side cryptography for credential management.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" dir="ltr" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
