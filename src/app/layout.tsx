import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Saffra', template: '%s · Saffra' },
  description: 'Know your real cost per order, the right selling price and your monthly profit.',
  applicationName: 'Saffra',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#161F1A' },
  ],
};

// Applies the saved Light/Dark choice before the first paint, so there is no flash.
// Storage keys keep the old 'kerdion-' prefix on purpose: renaming them would make every browser forget its saved theme.
const themeScript = `try{var t=localStorage.getItem('kerdion-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-kd-theme',t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@700&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Mono:wght@500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
